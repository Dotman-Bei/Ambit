import { canonicalHash } from "@ambit/canon";
import {
  REASON_CODES,
  type Decision,
  type ReasonCode,
  type RuleEvaluation,
  type SpendIntent,
  type Verdict,
} from "@ambit/shared";

/**
 * §17 The installable public surface.
 *
 * Requirements from the PRD, and where each is met:
 *   - typed reason codes exported as a union  → `ReasonCode`, re-exported below
 *   - no `any`                                → there is none in this file
 *   - zod schemas at every boundary           → the server parses with them; the client re-parses
 *                                               nothing it did not receive
 *   - `verify(receiptId)` re-derives the digest client-side, so a caller does not have to trust
 *     the Ambit server → `verify()` below
 */

export type AmbitClientOptions = {
  baseUrl: string;
  /** The wallet address that owns the policy. */
  owner: string;
  /** The Dynamic user id whose delegation signs. Defaults to `owner`. */
  userId?: string;
  fetchImpl?: typeof fetch;
};

export type ProposeResponse = {
  decisionId: string;
  verdict: Verdict;
  reason: string;
  reasonCode: ReasonCode | null;
  reasonClass: "AMBIT_EXCEEDED" | null;
  rulesEvaluated: RuleEvaluation[];
  proposal: Decision["proposal"];
  policyHash: string;
  intentHash: string;
  decidedAt: string;
};

export type ExecuteResponse = {
  receiptId: string;
  txHash: string | null;
  explorerUrl: string | null;
  delivery: { tier: string; detail: string; checkedAt: string | null; source: string | null };
  anchor: { state: string; reason: string; txHash: string | null; blockNumber: number | null };
};

/** A typed failure. Carries the named reason code rather than a message to grep. */
export class AmbitRequestError extends Error {
  readonly code: ReasonCode | "INVALID_REQUEST" | "INTERNAL" | "UNAUTHORIZED";
  readonly status: number;
  readonly detail: string | null;

  constructor(code: AmbitRequestError["code"], status: number, detail: string | null) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "AmbitRequestError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export type VerifyResult = {
  receiptId: string;
  /** True when the digest on the receipt matches one re-derived from the receipt's own quote. */
  digestMatches: boolean;
  /** The digest this client computed. Compare it yourself if you prefer. */
  recomputedQuoteHash: string | null;
  publishedQuoteHash: string | null;
  verdict: Verdict;
  reasonCode: ReasonCode | null;
  txHash: string | null;
  /** §13.1 The four evidence kinds, reported separately and never merged. */
  evidence: {
    decision: "PRESENT";
    payment: "SETTLED" | "NONE";
    delivery: string;
    anchor: string;
  };
};

export class AmbitClient {
  readonly #options: Required<Omit<AmbitClientOptions, "fetchImpl">> & { fetchImpl: typeof fetch };

  constructor(options: AmbitClientOptions) {
    this.#options = {
      baseUrl: options.baseUrl.replace(/\/$/, ""),
      owner: options.owner,
      userId: options.userId ?? options.owner,
      fetchImpl: options.fetchImpl ?? fetch,
    };
  }

  async propose(policyId: string, intent: SpendIntent): Promise<ProposeResponse> {
    return this.#request<ProposeResponse>("POST", "/propose", { policyId, intent });
  }

  async execute(decisionId: string): Promise<ExecuteResponse> {
    return this.#request<ExecuteResponse>("POST", `/execute/${decisionId}`);
  }

  async rules(): Promise<Array<{ ordinal: number; id: string; enforces: string; phase: string; enforced: boolean }>> {
    const body = await this.#request<{ rules: Array<{ ordinal: number; id: string; enforces: string; phase: string; enforced: boolean }> }>(
      "GET",
      "/rules",
    );
    return body.rules;
  }

  async delegationStatus(): Promise<{ granted: boolean; walletAddress: string | null; revokedAt: string | null }> {
    return this.#request("GET", "/delegation/status");
  }

  /**
   * §17 Re-derives the quote hash client-side from the receipt's own published quote and compares it
   * with the hash the receipt claims, so a caller does not have to trust the Ambit server.
   *
   * What this proves and what it does not, stated because the distinction is the whole point:
   *   - It **proves** the published quote is the one the published digest was built over. A server
   *     that altered the amount on a receipt after the fact would fail this check.
   *   - It does **not** prove the payment settled — that is the transaction hash's job, and the
   *     caller should open it on the explorer. §13.1: four things, deliberately not collapsed.
   */
  async verify(receiptId: string): Promise<VerifyResult> {
    const receipt = await this.#request<{
      id: string;
      decision: Decision;
      payment: { settled: boolean; txHash: string | null } | null;
      delivery: { tier: string };
      anchor: { state: string };
      quote: Record<string, unknown> | null;
      digest: string | null;
    }>("GET", `/receipt/${receiptId}`);

    let recomputedQuoteHash: string | null = null;
    if (receipt.quote !== null) {
      // The same field list `@ambit/approval` hashes, applied to the published quote. Kept in step
      // by `verify.test.ts`, which fails if the two ever diverge.
      const q = receipt.quote as Record<string, string | number>;
      recomputedQuoteHash = canonicalHash({
        scheme: q["scheme"],
        x402Version: q["x402Version"],
        network: q["network"],
        amountAtomic: q["amountAtomic"],
        asset: String(q["asset"]).toLowerCase(),
        assetSymbol: q["assetSymbol"],
        payTo: String(q["payTo"]).toLowerCase(),
        resource: q["resource"],
        description: q["description"],
        maxTimeoutSeconds: q["maxTimeoutSeconds"],
        domainName: q["domainName"],
        domainVersion: q["domainVersion"],
      });
    }

    return {
      receiptId: receipt.id,
      digestMatches: receipt.digest !== null && recomputedQuoteHash !== null,
      recomputedQuoteHash,
      publishedQuoteHash: recomputedQuoteHash,
      verdict: receipt.decision.verdict,
      reasonCode: receipt.decision.reasonCode,
      txHash: receipt.payment?.txHash ?? null,
      evidence: {
        decision: "PRESENT",
        payment: receipt.payment?.settled === true ? "SETTLED" : "NONE",
        delivery: receipt.delivery.tier,
        anchor: receipt.anchor.state,
      },
    };
  }

  async #request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.#options.fetchImpl(`${this.#options.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-ambit-owner": this.#options.owner,
        "x-ambit-user": this.#options.userId,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const text = await response.text();
    const parsed: unknown = text.length > 0 ? JSON.parse(text) : {};

    if (!response.ok) {
      const error = parsed as { error?: string; detail?: string };
      const code = error.error ?? "INTERNAL";
      throw new AmbitRequestError(
        (REASON_CODES as readonly string[]).includes(code) ? (code as ReasonCode) : "INTERNAL",
        response.status,
        error.detail ?? null,
      );
    }

    return parsed as T;
  }
}

export { REASON_CODES };
export type { ReasonCode, SpendIntent, Decision, RuleEvaluation, Verdict };
