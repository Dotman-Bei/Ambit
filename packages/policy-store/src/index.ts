import { AmbitError, type ApprovalBinding, type Decision, type Policy, type SpendIntent } from "@ambit/shared";

/**
 * Persistence with the properties §18 requires, over an in-memory store.
 *
 * Three of those properties are enforced here rather than left to a database:
 *   - **Append-only.** Decision and payment records reject update and delete. §18.
 *   - **Owner scoping.** Every read goes through an owner-scoped accessor, so a valid signature
 *     from the wrong address is `NOT_POLICY_OWNER` (403) and not a successful read. §18.
 *   - **Single-use nonces, consumed before verification.** §18 is explicit that the other order
 *     turns signature verification into a free oracle.
 *
 * Phase 1 runs this in memory. That is a real limitation and `LIMITATIONS.md` says so: the process
 * restarting loses the ledger. The interface is the part that matters — a Postgres implementation
 * satisfies the same contract, and the append-only rule becomes a table grant rather than a throw.
 */

export type ReservationState = "HELD" | "SETTLED" | "RELEASED";

export type Reservation = {
  id: string;
  owner: string;
  decisionId: string;
  amountAtomic: string;
  state: ReservationState;
  createdAt: string;
  expiresAt: string;
};

export type ExecutionState =
  | "PENDING"
  | "SETTLED"
  | "REFUSED"
  | "MANUAL_REVIEW";

export type DecisionRecord = {
  id: string;
  owner: string;
  createdAt: string;
  intent: SpendIntent;
  decision: Decision;
  policyId: string;
  /** Null until a quote has been read and a digest minted. */
  binding: ApprovalBinding | null;
  digest: string | null;
  execution: ExecutionState;
  /** The worker that proposed it, kept for the rate and duplicate windows. */
  requesterPrincipal: string;
};

export class AppendOnlyViolation extends Error {
  constructor(what: string) {
    super(
      `${what} is append-only (§18). A correction is a new record that supersedes this one, ` +
        `never an edit to it — otherwise the audit trail can be quietly revised.`,
    );
    this.name = "AppendOnlyViolation";
  }
}

export class AmbitStore {
  readonly #policies = new Map<string, Policy>();
  readonly #decisions = new Map<string, DecisionRecord>();
  readonly #reservations = new Map<string, Reservation>();
  readonly #usedNonces = new Set<string>();
  readonly #issuedNonces = new Map<string, { owner: string; expiresAt: string }>();
  /** §20 Database pauses: immediate, no deploy. Scope ladder from §20. */
  readonly #pauses = new Set<string>();
  /** Settled payments, by owner and UTC day. */
  readonly #settled = new Map<string, bigint>();

  /* ------------------------------------------------------------ policies */

  putPolicy(policy: Policy): void {
    // A policy *is* editable — it is the user's live configuration, not an audit record. What is
    // append-only is the decision that was made under a given version of it, which is why every
    // decision stores the policy hash it was judged against.
    this.#policies.set(policy.id, policy);
  }

  /** §18 owner-scoped accessor. Every read of a policy goes through this. */
  getPolicyForOwner(policyId: string, owner: string): Policy {
    const policy = this.#policies.get(policyId);
    if (policy === undefined) {
      throw new AmbitError("NOT_FOUND", `no policy ${policyId}`, 404);
    }
    if (policy.owner.toLowerCase() !== owner.toLowerCase()) {
      // Distinct from 401. §18: a valid signature from the wrong address is 403, because the
      // requester proved who they are and simply is not the owner. Conflating the two tells an
      // attacker nothing useful but tells a legitimate user the wrong thing about their own error.
      throw new AmbitError("NOT_POLICY_OWNER", `policy ${policyId} belongs to another owner`, 403);
    }
    return policy;
  }

  listPoliciesForOwner(owner: string): Policy[] {
    return [...this.#policies.values()].filter((p) => p.owner.toLowerCase() === owner.toLowerCase());
  }

  /* ------------------------------------------------------------ decisions */

  appendDecision(record: DecisionRecord): DecisionRecord {
    if (this.#decisions.has(record.id)) {
      throw new AppendOnlyViolation(`decision ${record.id}`);
    }
    this.#decisions.set(record.id, { ...record });
    return record;
  }

  getDecisionForOwner(id: string, owner: string): DecisionRecord {
    const record = this.#decisions.get(id);
    if (record === undefined) {
      throw new AmbitError("NOT_FOUND", `no decision ${id}`, 404);
    }
    if (record.owner.toLowerCase() !== owner.toLowerCase()) {
      throw new AmbitError("NOT_POLICY_OWNER", `decision ${id} belongs to another owner`, 403);
    }
    return record;
  }

  /**
   * The one mutation a decision record permits: the execution lifecycle, and only forwards.
   *
   * This is not an exception to append-only so much as the boundary of it. The *decision* — the
   * verdict, the rules, the reason — is frozen at creation and nothing here can touch it. What
   * moves is the record of what happened next, and it moves through a state machine that has no
   * edges back to `PENDING`, so a settled payment can never be re-opened and re-settled.
   */
  advanceExecution(id: string, to: ExecutionState, binding?: ApprovalBinding, digest?: string): DecisionRecord {
    const record = this.#decisions.get(id);
    if (record === undefined) throw new AmbitError("NOT_FOUND", `no decision ${id}`, 404);

    const terminal: ExecutionState[] = ["SETTLED", "REFUSED", "MANUAL_REVIEW"];
    if (terminal.includes(record.execution)) {
      throw new AmbitError(
        "DECISION_ALREADY_EXECUTED",
        `decision ${id} is already ${record.execution} and cannot move to ${to}`,
        409,
      );
    }

    const updated: DecisionRecord = {
      ...record,
      execution: to,
      binding: binding ?? record.binding,
      digest: digest ?? record.digest,
    };
    this.#decisions.set(id, updated);
    return updated;
  }

  listDecisionsForOwner(owner: string, limit = 50): DecisionRecord[] {
    return [...this.#decisions.values()]
      .filter((r) => r.owner.toLowerCase() === owner.toLowerCase())
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, limit);
  }

  /* ------------------------------------------------------------ §10.2 accounting */

  /**
   * §10.2 A decision reserves budget. It does not move money, and no surface reports it as spend.
   * The two totals are kept in separate maps precisely so that no query can accidentally add them
   * together and call the result "spent".
   */
  hold(reservation: Reservation): void {
    const existing = this.#reservations.get(reservation.id);
    // The reservation id is derived from the decision (see policy-engine), so committing the same
    // proposal twice is idempotent rather than double-counting.
    if (existing !== undefined) return;
    this.#reservations.set(reservation.id, { ...reservation });
  }

  releaseReservation(id: string): void {
    const reservation = this.#reservations.get(id);
    if (reservation === undefined || reservation.state !== "HELD") return;
    this.#reservations.set(id, { ...reservation, state: "RELEASED" });
  }

  settleReservation(id: string, at: string): void {
    const reservation = this.#reservations.get(id);
    if (reservation === undefined) return;
    if (reservation.state === "SETTLED") return;
    this.#reservations.set(id, { ...reservation, state: "SETTLED" });
    const key = this.#dayKey(reservation.owner, at);
    this.#settled.set(key, (this.#settled.get(key) ?? 0n) + BigInt(reservation.amountAtomic));
  }

  /** Settled money for this owner on this UTC day. Money that actually left. */
  settledToday(owner: string, now: string): bigint {
    return this.#settled.get(this.#dayKey(owner, now)) ?? 0n;
  }

  /**
   * Still-executable reserved authority for this owner. A reservation past its expiry is not
   * still-executable, so it is excluded — otherwise a day's budget would be permanently consumed
   * by proposals that were never acted on.
   */
  reservedToday(owner: string, now: string): bigint {
    const nowMs = Date.parse(now);
    let total = 0n;
    for (const reservation of this.#reservations.values()) {
      if (reservation.owner.toLowerCase() !== owner.toLowerCase()) continue;
      if (reservation.state !== "HELD") continue;
      if (Date.parse(reservation.expiresAt) <= nowMs) continue;
      if (this.#dayKey(reservation.owner, reservation.createdAt) !== this.#dayKey(owner, now)) continue;
      total += BigInt(reservation.amountAtomic);
    }
    return total;
  }

  getReservation(id: string): Reservation | undefined {
    const found = this.#reservations.get(id);
    return found ? { ...found } : undefined;
  }

  #dayKey(owner: string, instant: string): string {
    return `${owner.toLowerCase()}:${instant.slice(0, 10)}`;
  }

  /* ------------------------------------------------------------ §18 nonces */

  issueNonce(nonce: string, owner: string, expiresAt: string): void {
    this.#issuedNonces.set(nonce, { owner, expiresAt });
  }

  /**
   * §18 Nonces are consumed **before** the signature is verified.
   *
   * The caller must call this first and verify second. Verifying first would let an attacker submit
   * candidate signatures against a live nonce indefinitely and learn which ones verify — a free
   * oracle. Consuming first means every attempt costs a nonce whether or not it was valid.
   */
  consumeNonce(nonce: string, owner: string, now: string): void {
    if (this.#usedNonces.has(nonce)) {
      throw new AmbitError("NONCE_ALREADY_USED", "this nonce has already been consumed", 401);
    }
    const issued = this.#issuedNonces.get(nonce);
    if (issued === undefined) {
      throw new AmbitError("NONCE_UNKNOWN", "this nonce was not issued by this server", 401);
    }
    this.#usedNonces.add(nonce);
    if (issued.owner.toLowerCase() !== owner.toLowerCase()) {
      throw new AmbitError("NONCE_UNKNOWN", "this nonce was issued to another principal", 401);
    }
    if (Date.parse(now) >= Date.parse(issued.expiresAt)) {
      throw new AmbitError("NONCE_UNKNOWN", "this nonce has expired", 401);
    }
  }

  /* ------------------------------------------------------------ §20 pauses */

  /** §20 Scope ladder: everything → all spending → one provider → one rail → one user. */
  pause(scope: string): void {
    this.#pauses.add(scope);
  }

  resume(scope: string): void {
    this.#pauses.delete(scope);
  }

  listPauses(): string[] {
    return [...this.#pauses].sort();
  }

  /**
   * Checked on **every** capability issuance, per §20. Returns the matching pause scope or null.
   * The ladder is evaluated broadest-first so that "everything" cannot be bypassed by a request
   * that happens not to match a narrower rule.
   */
  activePause(input: { provider: string; network: string; owner: string }): string | null {
    const ladder = [
      "everything",
      "spending",
      `provider:${input.provider}`,
      `network:${input.network}`,
      `owner:${input.owner.toLowerCase()}`,
    ];
    return ladder.find((scope) => this.#pauses.has(scope)) ?? null;
  }
}
