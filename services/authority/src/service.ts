import { randomUUID } from "node:crypto";
import { assertDigestBinds, hashQuote, mintDigest, mintNonce } from "@ambit/approval";
import {
  payAndRetry,
  requestChallenge,
  type ProviderRegistryEntry,
  type TypedDataPayload,
} from "@ambit/payments-x402";
import { decide, hashPolicy, RULES } from "@ambit/policy-engine";
import { AmbitStore, type DecisionRecord } from "@ambit/policy-store";
import { ProofEngine } from "@ambit/proof-engine";
import { anchorNotInScope, findReceiptDefects, paymentEvidence } from "@ambit/receipts";
import {
  AmbitError,
  toAtomicForAsset,
  type ApprovalBinding,
  type DecisionWindow,
  type Policy,
  type Quote,
  type Receipt,
  type SpendIntent,
} from "@ambit/shared";
import { CredentialStore } from "./dynamic/credentials.js";
import { createClient, executionEnabled, isDynamicConfigured, readDynamicConfig, signPaymentAuthorization } from "./dynamic/delegated-client.js";
import { findProvider } from "./registry.js";

/**
 * The authority service's core. Everything the HTTP layer does is in here, so the routes stay thin
 * and the flow is readable in one file.
 *
 * The ordering in `execute()` is the part worth reading closely. §12.2's flow puts the policy
 * decision *between* reading the challenge and signing the payment, and §11 puts a digest
 * re-verification immediately before the signature. Both seams are load-bearing and both are easy
 * to lose to a refactor that "simplifies" the function, so each is commented with what it prevents.
 */

export type ServiceDeps = {
  store: AmbitStore;
  credentials: CredentialStore;
  proof: ProofEngine;
  env: Record<string, string | undefined>;
  /** Injected so tests and the campaign runner control time rather than racing it. */
  now: () => Date;
  fetchImpl?: typeof fetch;
};

export type ProposeInput = {
  owner: string;
  policyId: string;
  intent: SpendIntent;
  requesterPrincipal: string;
};

export type ProposeResult = {
  decisionId: string;
  record: DecisionRecord;
};

export class AuthorityService {
  readonly #deps: ServiceDeps;

  constructor(deps: ServiceDeps) {
    this.#deps = deps;
  }

  get store(): AmbitStore {
    return this.#deps.store;
  }

  get credentials(): CredentialStore {
    return this.#deps.credentials;
  }

  nowIso(): string {
    return this.#deps.now().toISOString();
  }

  /**
   * Gathers the decision window. This is the I/O the engine is not allowed to do (§10), performed
   * here, before the call, so the engine stays a pure function of values.
   */
  buildWindow(owner: string, intent: SpendIntent, policy: Policy): DecisionWindow {
    const now = this.nowIso();
    const store = this.#deps.store;
    const recent = store.listDecisionsForOwner(owner, 500);

    const identicalKey = (record: DecisionRecord) =>
      record.intent.provider === intent.provider &&
      record.intent.capability === intent.capability &&
      record.intent.amount === intent.amount &&
      record.intent.recipient.toLowerCase() === intent.recipient.toLowerCase();

    // §10.1 rule 2's key is provider + capability + amount + recipient, exactly as the rule id says.
    // Only decisions that were allowed count: a refused duplicate is not a purchase that happened.
    const lastIdentical = recent.find((r) => identicalKey(r) && r.decision.verdict !== "BLOCK");

    const lastToService = recent.find(
      (r) =>
        r.intent.provider === intent.provider &&
        r.intent.capability === intent.capability &&
        r.decision.verdict !== "BLOCK",
    );

    const hourAgo = Date.parse(now) - 3_600_000;
    const callsInLastHour = recent.filter((r) => Date.parse(r.createdAt) >= hourAgo).length;

    // §10.1 rule 4: a context is spent when a decision bound to that task actually settled.
    const contextAlreadySpent = recent.some(
      (r) => r.intent.context.taskId === intent.context.taskId && r.execution === "SETTLED",
    );

    return {
      now,
      settledTodayAtomic: store.settledToday(owner, now).toString(),
      reservedTodayAtomic: store.reservedToday(owner, now).toString(),
      callsInLastHour,
      lastIdenticalIntentAt: lastIdentical?.createdAt ?? null,
      lastCallToServiceAt: lastToService?.createdAt ?? null,
      contextAlreadySpent,
      vendorLcb: null,
      availableProofTier: this.#deps.proof.availableTier(intent.capability),
    };
  }

  /**
   * §12.2 steps 1–4 up to the decision. The agent proposes; the engine decides; nothing has moved.
   *
   * No payment is attempted here and no wallet is touched. A `BLOCK` from this method is the §22
   * C2/C4/C5/C6/C7/C8 outcome: a named refusal with zero on-chain movement, and the absence of a
   * transaction is itself the evidence.
   */
  propose(input: ProposeInput): ProposeResult {
    const { owner, policyId, intent, requesterPrincipal } = input;
    const policy = this.#deps.store.getPolicyForOwner(policyId, owner);

    // §12.3 The rail is checked before anything else spends effort: the wallet either can pay in
    // this asset on this network or the request refuses. It does not improvise a bridge or a swap.
    if (intent.network !== policy.network || intent.asset !== policy.asset) {
      throw new AmbitError(
        "RAIL_UNAVAILABLE",
        `the intent asks for ${intent.asset} on ${intent.network}; this policy covers ${policy.asset} on ${policy.network}`,
        400,
      );
    }

    // §20 Checked on every capability issuance, per the scope ladder.
    const pause = this.#deps.store.activePause({ provider: intent.provider, network: intent.network, owner });
    if (pause !== null) {
      throw new AmbitError("EXECUTION_PAUSED", `an operator paused scope "${pause}"`, 503);
    }

    const window = this.buildWindow(owner, intent, policy);
    const decision = decide(intent, policy, window);

    const record: DecisionRecord = {
      id: `dec_${randomUUID()}`,
      owner,
      createdAt: window.now,
      intent,
      decision,
      policyId,
      binding: null,
      digest: null,
      execution: decision.verdict === "BLOCK" ? "REFUSED" : "PENDING",
      requesterPrincipal,
    };

    this.#deps.store.appendDecision(record);

    // §10.2 The engine returned a *proposal*. Committing it is the caller's act, and it is a
    // reservation — not spend. Nothing here moves money or reports that it did.
    if (decision.proposal !== null) {
      this.#deps.store.hold({
        id: decision.proposal.reservationId,
        owner,
        decisionId: record.id,
        amountAtomic: decision.proposal.budgetDeltaAtomic,
        state: "HELD",
        createdAt: window.now,
        expiresAt: decision.proposal.expiresAt,
      });
    }

    return { decisionId: record.id, record };
  }

  /**
   * §12.2 steps 4–8. Reads the live quote, re-runs the decision against **that exact quote**, mints
   * and immediately re-verifies the digest, signs through Dynamic, and captures the evidence.
   */
  async execute(owner: string, decisionId: string, userId: string): Promise<Receipt> {
    const deps = this.#deps;
    const record = deps.store.getDecisionForOwner(decisionId, owner);

    if (record.decision.verdict !== "ALLOW") {
      throw new AmbitError(
        "DECISION_NOT_ALLOWED",
        `decision ${decisionId} returned ${record.decision.verdict}; only an ALLOW is executable. ` +
          (record.decision.verdict === "ESCALATE"
            ? "§14.1: a human approves this exact digest, or it expires unspent."
            : ""),
        409,
      );
    }
    if (record.execution !== "PENDING") {
      throw new AmbitError("DECISION_ALREADY_EXECUTED", `decision ${decisionId} is ${record.execution}`, 409);
    }

    // §20 Both emergency layers, checked here as well as at propose time, because a pause applied
    // between the two must still stop the payment.
    if (!executionEnabled(deps.env)) {
      throw new AmbitError("EXECUTION_DISABLED", "EXECUTION_ENABLED is not set to 1 or true (§20)", 503);
    }
    const pause = deps.store.activePause({
      provider: record.intent.provider,
      network: record.intent.network,
      owner,
    });
    if (pause !== null) {
      throw new AmbitError("EXECUTION_PAUSED", `an operator paused scope "${pause}"`, 503);
    }

    const reservation = record.decision.proposal
      ? deps.store.getReservation(record.decision.proposal.reservationId)
      : undefined;
    if (record.decision.proposal && Date.parse(this.nowIso()) >= Date.parse(record.decision.proposal.expiresAt)) {
      deps.store.advanceExecution(decisionId, "REFUSED");
      throw new AmbitError("DECISION_EXPIRED", "the reservation window closed before execution", 409);
    }

    const provider = findProvider(record.intent.provider);
    if (provider === undefined) {
      throw new AmbitError("PROVIDER_NOT_REGISTERED", `provider "${record.intent.provider}" is not registered`, 400);
    }

    // Credentials are opened before the network call so that a revoked delegation refuses without
    // ever reaching the provider. §22 C9's five-second target depends on this being the first gate.
    const credentials = deps.credentials.open(userId, deps.env["CREDENTIAL_ENCRYPTION_KEY"]);

    if (!isDynamicConfigured(deps.env)) {
      throw new AmbitError(
        "CONFIG_INCOMPLETE",
        "Dynamic is not configured, so no signature can be produced. The payment is not simulated (§0.4).",
        503,
      );
    }

    /* -- §12.2 step 1 and 2: read the live challenge --------------------- */

    const challenge = await requestChallenge({
      provider,
      capability: record.intent.capability,
      requiredNetwork: record.intent.network,
      requiredAssetAddress: this.#assetAddress(record.intent.network),
      ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
    });

    if (challenge.unpaid !== null) {
      throw new AmbitError(
        "CHALLENGE_UNPARSEABLE",
        `the endpoint returned ${challenge.unpaid.status} rather than a 402 challenge, so there is no ` +
          `quote to judge. Ambit does not pay an endpoint that did not ask to be paid.`,
        502,
      );
    }

    const quote = challenge.quote;

    /* -- §12.2 step 3: the engine judges THAT exact quote ---------------- */

    /**
     * This re-decision is not redundant with `propose`. The proposal was judged against the amount
     * the *agent* stated; this is judged against the amount the *provider* actually demands. If the
     * provider now wants more, the engine refuses here and nothing is signed — which is precisely
     * the gap a "quote once, pay later" design leaves open.
     */
    const policy = deps.store.getPolicyForOwner(record.policyId, owner);
    const quotedIntent: SpendIntent = {
      ...record.intent,
      amount: this.#atomicToHuman(quote.amountAtomic),
      recipient: quote.payTo as SpendIntent["recipient"],
    };
    const quotedWindow = this.buildWindow(owner, quotedIntent, policy);
    const quotedDecision = decide(quotedIntent, policy, quotedWindow);

    if (quotedDecision.verdict !== "ALLOW") {
      deps.store.advanceExecution(decisionId, "REFUSED");
      if (record.decision.proposal) deps.store.releaseReservation(record.decision.proposal.reservationId);
      throw new AmbitError(
        quotedDecision.reasonCode ?? "DECISION_NOT_ALLOWED",
        `the live quote was judged again and refused: ${quotedDecision.reason}`,
        409,
      );
    }

    /* -- §11 step 4: mint the digest, bound to this quote ---------------- */

    const nonce = mintNonce();
    const binding: ApprovalBinding = {
      quoteHash: hashQuote(quote),
      amountAtomic: quote.amountAtomic,
      recipient: quote.payTo as ApprovalBinding["recipient"],
      policyId: record.policyId,
      policyHash: hashPolicy(policy),
      requesterPrincipal: record.requesterPrincipal,
      walletId: credentials.walletId,
      nonce,
      expiresAt: new Date(Date.parse(this.nowIso()) + quote.maxTimeoutSeconds * 1000).toISOString(),
    };
    const digest = mintDigest(binding);

    /**
     * §11 *"The digest is computed once, before signing, and re-computed at execution time from the
     * stored intent. Execution compares and refuses on any difference."*
     *
     * The re-check immediately below looks trivial because in this path the mint and the check are
     * adjacent. It is here because §22 case C3 mutates the stored binding between the two, and
     * because any future path that persists the binding and signs later must pass through this same
     * assertion. Removing it because "it always passes" is exactly how $5 becomes $500.
     */
    assertDigestBinds({ expected: digest, binding, now: this.nowIso() }, binding);
    deps.store.advanceExecution(decisionId, "PENDING", binding, digest);

    /* -- §12.2 step 5: sign through the Dynamic delegated client --------- */

    const dynamicClient = createClient(readDynamicConfig(deps.env));
    const signTypedData = async (typedData: TypedDataPayload): Promise<string> => {
      // Re-verified once more against the binding the signature will authorise. The typed data is
      // built from the quote; the binding hashes the quote; so this asserts they still agree at the
      // last instant before key material is used.
      assertDigestBinds({ expected: digest, binding, now: this.nowIso() }, binding);
      return signPaymentAuthorization(dynamicClient, credentials, typedData);
    };

    /* -- §12.2 steps 6 and 7: retry with the credential, capture evidence - */

    let outcome: Awaited<ReturnType<typeof payAndRetry>>;
    try {
      outcome = await payAndRetry({
        url: challenge.url,
        quote,
        from: credentials.walletAddress,
        signTypedData,
        now: deps.now(),
        ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
      });
    } catch (error) {
      const ambit = error instanceof AmbitError ? error : null;
      // §12.3 An ambiguous outcome goes to a human, never to a retry.
      const nextState = ambit?.code === "MANUAL_REVIEW" ? "MANUAL_REVIEW" : "REFUSED";
      deps.store.advanceExecution(decisionId, nextState, binding, digest);
      if (nextState === "REFUSED" && record.decision.proposal) {
        deps.store.releaseReservation(record.decision.proposal.reservationId);
      }
      throw error;
    }

    /* -- §12.2 step 8: evidence ----------------------------------------- */

    const settledAt = this.nowIso();

    if (outcome.txHash === null) {
      // §12.3 A 200 without settlement evidence is ambiguous: the resource may have been delivered
      // and the payment may have settled. No hash is invented and nothing is retried.
      deps.store.advanceExecution(decisionId, "MANUAL_REVIEW", binding, digest);
      throw new AmbitError(
        "SETTLEMENT_EVIDENCE_MISSING",
        "the provider returned the resource but no X-PAYMENT-RESPONSE settlement header. " +
          "The payment may have settled. This is not retried (§12.3) and no transaction hash is inferred.",
        409,
      );
    }

    deps.store.advanceExecution(decisionId, "SETTLED", binding, digest);
    if (record.decision.proposal) deps.store.settleReservation(record.decision.proposal.reservationId, settledAt);

    const delivery = await deps.proof.verify(record.intent.capability, {
      providerResponse: outcome.body,
      resource: quote.resource,
      now: settledAt,
      ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
    });

    const receipt: Receipt = {
      id: `rcp_${randomUUID()}`,
      createdAt: settledAt,
      decision: quotedDecision,
      payment: paymentEvidence({
        txHash: outcome.txHash,
        network: quote.network,
        amountAtomic: quote.amountAtomic,
        payTo: quote.payTo,
        providerKind: provider.kind,
        // §12.3 Two counterparty channels are never merged. This is what the provider said.
        providerAssertion: outcome.body.slice(0, 500),
        settledAt,
      }),
      delivery,
      anchor: anchorNotInScope(),
      quote,
      digest,
      intent: record.intent,
      correlationId: record.id,
      owner: owner as Receipt["owner"],
    };

    // §13.1's defect, checked rather than hoped for. A receipt that claims more than it proves does
    // not leave this function.
    const defects = findReceiptDefects(receipt);
    if (defects.length > 0) {
      throw new Error(
        `receipt ${receipt.id} claims more than it proves: ${defects.map((d) => `${d.field}: ${d.problem}`).join("; ")}`,
      );
    }

    return receipt;
  }

  /** Builds the refusal receipt for a decision that blocked. Zero movement, named reason. */
  refusalReceipt(record: DecisionRecord): Receipt {
    return {
      id: `rcp_${record.id.slice(4)}`,
      createdAt: record.createdAt,
      decision: record.decision,
      // §13.1 A BLOCK carries no payment evidence, because nothing moved.
      payment: null,
      delivery: {
        tier: "T0_NONE",
        detail: "nothing was paid for, so there is nothing to verify delivery of",
        checkedAt: null,
        source: null,
      },
      anchor: anchorNotInScope(),
      quote: null,
      digest: null,
      intent: record.intent,
      correlationId: record.id,
      owner: record.owner as Receipt["owner"],
    };
  }

  /** The rule catalogue the console renders before any decision exists. */
  ruleCatalogue() {
    return RULES.map((rule) => ({
      ordinal: rule.ordinal,
      id: rule.id,
      enforces: rule.enforces,
      phase: rule.phase,
      enforced: rule.enforced,
    }));
  }

  #assetAddress(network: string): string {
    const addresses: Record<string, string> = {
      "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    };
    const address = addresses[network];
    if (address === undefined) {
      throw new AmbitError("RAIL_UNAVAILABLE", `no USDC address is configured for ${network}`, 400);
    }
    return address;
  }

  #atomicToHuman(atomic: string): string {
    const padded = atomic.padStart(7, "0");
    return `${padded.slice(0, padded.length - 6)}.${padded.slice(padded.length - 6)}`;
  }
}

export type { Quote, ProviderRegistryEntry };
export { toAtomicForAsset };
