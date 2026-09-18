/**
 * Named refusal codes. §10.4: every refusal carries a specific rule-level reason code,
 * never a generic failure. `AMBIT_EXCEEDED` is the umbrella class those codes belong to;
 * a refusal that names only the class and not the rule is a defect.
 */

/** Refusals produced by the policy engine itself — one per rule that can fail. §10.1 */
export const POLICY_REASON_CODES = [
  "POLICY_EXPIRED", // rule 1  policy.active
  "POLICY_NOT_ACTIVE", // rule 1  policy.active — not yet in force
  "DUPLICATE_INTENT", // rule 2  duplicate.provider_capability_amount_recipient
  "COOLDOWN_ACTIVE", // rule 3  cooldown.sameService
  "CONTEXT_REPLAY", // rule 4  replay.contextBinding
  "RECIPIENT_DENIED", // rule 5  recipient.allowDeny
  "RECIPIENT_NOT_ALLOWED", // rule 5  recipient.allowDeny — allowlist set, payee absent from it
  "WORKER_DENIED", // rule 6  agent.workerAllowDeny
  "WORKER_NOT_ALLOWED", // rule 6  agent.workerAllowDeny
  "CATEGORY_DENIED", // rule 7  category.allow
  "CATEGORY_NOT_ALLOWED", // rule 7  category.allow
  "VENDOR_SCORE_BELOW_FLOOR", // rule 8  vendor.lcbFloor  (P3 — not enforced in phase 1)
  "INTENT_MAX_EXCEEDED", // rule 9  intent.maxAmountBound
  "HARD_CAP_EXCEEDED", // rule 10 hardCap.absolute
  "PER_CALL_CAP_EXCEEDED", // rule 11 perCall.cap
  "DAILY_BUDGET_EXCEEDED", // rule 12 budget.daily
  "RATE_LIMIT_EXCEEDED", // rule 13 rate.limit
  "PROOF_TIER_UNAVAILABLE", // rule 14 proof.tierRequired  (P2 — not enforced in phase 1)
] as const;

/**
 * Refusals raised outside the engine — at the authority service boundary, at execution,
 * or by the wallet provider. These are not rule outcomes; a rule never returns one.
 */
export const OPERATIONAL_REASON_CODES = [
  "DELEGATION_REVOKED", // §14.2 the user revoked. 403. The load-bearing one.
  "DELEGATION_NOT_GRANTED", // §9 no delegation has ever been granted for this wallet
  "DIGEST_MISMATCH", // §11 the intent changed after approval. Approve $5, $500 cannot leave.
  "APPROVAL_EXPIRED", // §14.1 a human approval arrived after expiresAt
  "APPROVAL_PATH_NOT_READY", // §14.1 503, no fee taken, no fall-through to auto-approval
  "NOT_POLICY_OWNER", // §18 403, distinct from 401 for a failed proof
  "NONCE_ALREADY_USED", // §18 replay: nonces are single-use, consumed before verification
  "NONCE_UNKNOWN", // §18 not a nonce this server issued
  "RAIL_UNAVAILABLE", // §12.3 wrong network or asset. Never improvises a bridge or swap.
  "WALLET_PROVIDER_UNAVAILABLE", // §19 Dynamic outage. No degraded mode, by design.
  "EXECUTION_DISABLED", // §20 emergency control, environment flag
  "EXECUTION_PAUSED", // §20 emergency control, database pause row
  "DECISION_NOT_ALLOWED", // execution attempted on a decision that was not ALLOW
  "DECISION_ALREADY_EXECUTED", // an executed decision cannot execute twice
  "DECISION_EXPIRED", // the reservation window closed before execution
  "MANUAL_REVIEW", // §12.3 ambiguous outcome. A human is asked, never a retry.
  "SETTLEMENT_EVIDENCE_MISSING", // 200 with no X-PAYMENT-RESPONSE. No hash is invented.
  "PROVIDER_REJECTED_PAYMENT", // the facilitator refused the authorization
  "CHALLENGE_UNPARSEABLE", // a 402 arrived that is not a challenge this client understands
  "PROVIDER_UNREACHABLE", // network failure reaching the paid endpoint
  "PROVIDER_NOT_REGISTERED", // §18 SSRF: base URLs come only from the registry table
  "CONFIG_INCOMPLETE", // §6 fail-closed: a required setting is absent or not exactly "1"/"true"
  "NOT_FOUND", // §13.2 distinguished from PENDING
] as const;

/** §10.4 The umbrella class. Used in aggregate reporting, never on its own. */
export const UMBRELLA_REASON_CLASS = "AMBIT_EXCEEDED" as const;

export const REASON_CODES = [...POLICY_REASON_CODES, ...OPERATIONAL_REASON_CODES] as const;

export type PolicyReasonCode = (typeof POLICY_REASON_CODES)[number];
export type OperationalReasonCode = (typeof OPERATIONAL_REASON_CODES)[number];
export type ReasonCode = PolicyReasonCode | OperationalReasonCode;

const REASON_CODE_SET: ReadonlySet<string> = new Set(REASON_CODES);

export function isReasonCode(value: unknown): value is ReasonCode {
  return typeof value === "string" && REASON_CODE_SET.has(value);
}

/**
 * §10.4 Vocabulary discipline, enforced as a backstop rather than a convention.
 *
 * `ALLOW` means the intent passed the rules as configured. It does not mean the purchase is wise,
 * the vendor is honest, or the policy is correct. These words claim a judgement Ambit never makes,
 * so a reason string carrying one is rejected at construction.
 */
const FORBIDDEN_VOCABULARY = [
  "safe",
  "unsafe",
  "trusted",
  "untrusted",
  "verified good",
  "guaranteed",
  "secure",
  "approved_safe",
  "legitimate",
  "fraudulent",
] as const;

export type VocabularyViolation = { word: string; reason: string };

/**
 * Returns the safety-vocabulary violations in a reason string, or an empty array.
 * Matched on word boundaries so "safelist" and "unsafely" are caught but "Safeway" — a plausible
 * merchant name — is not mangled by a naive substring test.
 */
export function findVocabularyViolations(reason: string): VocabularyViolation[] {
  const lowered = reason.toLowerCase();
  const found: VocabularyViolation[] = [];
  for (const word of FORBIDDEN_VOCABULARY) {
    const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(lowered)) {
      found.push({
        word,
        reason: `"${word}" claims a judgement the engine does not make. A verdict reports rule outcomes, not the wisdom of a purchase.`,
      });
    }
  }
  return found;
}

export function assertNoSafetyVocabulary(reason: string): void {
  const violations = findVocabularyViolations(reason);
  if (violations.length > 0) {
    const first = violations[0]!;
    throw new Error(`§10.4 vocabulary violation in reason string: ${first.reason} Reason was: "${reason}"`);
  }
}

/**
 * Human-readable text for each code. Deliberately terse and noun-first: these strings are read
 * under time pressure in the decision console, and they are carried verbatim into the receipt.
 */
export const REASON_TEXT: Readonly<Record<ReasonCode, string>> = {
  POLICY_EXPIRED: "the policy's expiry has passed; an expired policy authorises nothing",
  POLICY_NOT_ACTIVE: "the policy is not yet in force",
  DUPLICATE_INTENT: "the same provider, capability, amount and recipient inside the duplicate window",
  COOLDOWN_ACTIVE: "the minimum gap between calls to this service has not elapsed",
  CONTEXT_REPLAY: "the intent is bound to a context that has already been spent",
  RECIPIENT_DENIED: "the recipient is on the deny list",
  RECIPIENT_NOT_ALLOWED: "an allowlist is set and the recipient is not on it",
  WORKER_DENIED: "the worker agent is on the deny list",
  WORKER_NOT_ALLOWED: "an allowlist is set and the worker agent is not on it",
  CATEGORY_DENIED: "the spend category is on the deny list",
  CATEGORY_NOT_ALLOWED: "an allowlist is set and the category is not on it",
  VENDOR_SCORE_BELOW_FLOOR: "the vendor's score lower-confidence bound is under the policy floor",
  INTENT_MAX_EXCEEDED: "the amount exceeds the ceiling the intent declared for itself",
  HARD_CAP_EXCEEDED: "the amount exceeds the absolute cap no policy can raise",
  PER_CALL_CAP_EXCEEDED: "the amount exceeds the per-call cap",
  DAILY_BUDGET_EXCEEDED: "settled spend plus reserved authority would exceed the daily budget",
  RATE_LIMIT_EXCEEDED: "the calls-per-hour limit has been reached",
  PROOF_TIER_UNAVAILABLE: "the required independent delivery-verification tier is not available",
  DELEGATION_REVOKED: "the user revoked this delegation; Ambit holds no credentials for this wallet",
  DELEGATION_NOT_GRANTED: "no delegation has been granted for this wallet",
  DIGEST_MISMATCH: "the intent changed after approval; the approval binds one digest and only that one",
  APPROVAL_EXPIRED: "the approval arrived after the digest's expiry",
  APPROVAL_PATH_NOT_READY: "the escalation path is not wired for this route; no fee was taken",
  NOT_POLICY_OWNER: "the requester is not the owner of this policy",
  NONCE_ALREADY_USED: "this nonce has already been consumed",
  NONCE_UNKNOWN: "this nonce was not issued by this server",
  RAIL_UNAVAILABLE: "the required network or asset is not one this wallet can pay in; no bridge, no swap",
  WALLET_PROVIDER_UNAVAILABLE: "the wallet provider could not be reached; there is no degraded mode",
  EXECUTION_DISABLED: "execution is disabled by environment flag",
  EXECUTION_PAUSED: "execution is paused by an operator",
  DECISION_NOT_ALLOWED: "this decision did not return ALLOW, so it cannot be executed",
  DECISION_ALREADY_EXECUTED: "this decision has already been executed",
  DECISION_EXPIRED: "the reservation window closed before execution",
  MANUAL_REVIEW: "the outcome is ambiguous; a human decides, because a retry could buy the thing twice",
  SETTLEMENT_EVIDENCE_MISSING: "the provider returned success without settlement evidence; no hash is inferred",
  PROVIDER_REJECTED_PAYMENT: "the provider or facilitator rejected the payment authorization",
  CHALLENGE_UNPARSEABLE: "the 402 response did not carry a challenge this client can read",
  PROVIDER_UNREACHABLE: "the paid endpoint could not be reached",
  PROVIDER_NOT_REGISTERED: "the provider is not in the registry; only registered base URLs are fetched",
  CONFIG_INCOMPLETE: "a required setting is absent or not set to exactly \"1\" or \"true\"",
  NOT_FOUND: "no record exists under that identifier",
};

export function reasonText(code: ReasonCode): string {
  return REASON_TEXT[code];
}

/** Composes the verbatim reason string carried into the receipt. §10.3 */
export function composeReason(code: ReasonCode, detail?: string): string {
  const base = `${code}: ${REASON_TEXT[code]}`;
  const composed = detail ? `${base} (${detail})` : base;
  assertNoSafetyVocabulary(composed);
  return composed;
}
