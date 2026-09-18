import {
  toAtomicForAsset,
  type DecisionWindow,
  type Policy,
  type PolicyReasonCode,
  type RuleResult,
  type SpendIntent,
} from "@ambit/shared";

/**
 * §10.1 The fifteen rules, in evaluation order.
 *
 * Every rule here is a pure function of `(intent, policy, window)`. No I/O, no clock read, no
 * network, no model. State the rule would otherwise look up — today's settled total, the last
 * identical intent, the vendor's score — arrives on the `window` because the caller gathered it
 * before the call. That is what keeps a network hop, and an LLM, off the money decision path (§4).
 */

export type RuleOutcome = {
  result: RuleResult;
  detail: string;
  reasonCode: PolicyReasonCode | null;
};

export type Rule = {
  ordinal: number;
  id: string;
  /** §10.1 Rules 8 and 14 are present, return RULE_NOT_ENFORCED, and are labelled. */
  enforced: boolean;
  phase: "P1" | "P2" | "P3";
  /** What the rule enforces, in the words of §10.1. Carried into the console and the receipt. */
  enforces: string;
  evaluate(intent: SpendIntent, policy: Policy, window: DecisionWindow): RuleOutcome;
};

const pass = (detail: string): RuleOutcome => ({ result: "PASS", detail, reasonCode: null });

const fail = (reasonCode: PolicyReasonCode, detail: string): RuleOutcome => ({
  result: "FAIL",
  detail,
  reasonCode,
});

/**
 * A failed test that is not a refusal. Only rule 15 uses it: escalation means "a human decides",
 * not "this was blocked", and attaching a refusal code would put escalations into the aggregate
 * refusal counts (§10.4) where they do not belong.
 */
const failWithoutReasonCode = (detail: string): RuleOutcome => ({
  result: "FAIL",
  detail,
  reasonCode: null,
});

const notEnforced = (detail: string): RuleOutcome => ({
  result: "RULE_NOT_ENFORCED",
  detail,
  reasonCode: null,
});

const ms = (instant: string): number => Date.parse(instant);

const intentAtomic = (intent: SpendIntent): bigint => toAtomicForAsset(intent.amount, intent.asset);

const policyAtomic = (value: string, policy: Policy): bigint => toAtomicForAsset(value, policy.asset);

/* ------------------------------------------------------------------ 1 */

export const policyActive: Rule = {
  ordinal: 1,
  id: "policy.active",
  enforced: true,
  phase: "P1",
  enforces: "a policy past expiry authorises nothing",
  evaluate(_intent, policy, window) {
    const now = ms(window.now);
    if (policy.notBefore !== undefined && now < ms(policy.notBefore)) {
      return fail("POLICY_NOT_ACTIVE", `policy is not in force until ${policy.notBefore}`);
    }
    if (now >= ms(policy.expiresAt)) {
      return fail("POLICY_EXPIRED", `policy expired at ${policy.expiresAt}`);
    }
    return pass(`policy is in force until ${policy.expiresAt}`);
  },
};

/* ------------------------------------------------------------------ 2 */

export const duplicateIntent: Rule = {
  ordinal: 2,
  id: "duplicate.provider_capability_amount_recipient",
  enforced: true,
  phase: "P1",
  enforces: "the same task twice inside a TTL is refused",
  evaluate(_intent, policy, window) {
    // The window's `lastIdenticalIntentAt` is already keyed on provider + capability + amount +
    // recipient by the caller — the rule id names that key so the caller cannot quietly narrow it.
    if (policy.duplicateWindowSeconds === 0) {
      return pass("no duplicate window is set on this policy");
    }
    if (window.lastIdenticalIntentAt === null) {
      return pass("no identical intent has been allowed before");
    }
    const elapsedSeconds = (ms(window.now) - ms(window.lastIdenticalIntentAt)) / 1000;
    if (elapsedSeconds < policy.duplicateWindowSeconds) {
      return fail(
        "DUPLICATE_INTENT",
        `an identical intent was allowed ${elapsedSeconds.toFixed(1)}s ago, inside the ${policy.duplicateWindowSeconds}s duplicate window`,
      );
    }
    return pass(
      `the last identical intent was ${elapsedSeconds.toFixed(1)}s ago, outside the ${policy.duplicateWindowSeconds}s window`,
    );
  },
};

/* ------------------------------------------------------------------ 3 */

export const cooldownSameService: Rule = {
  ordinal: 3,
  id: "cooldown.sameService",
  enforced: true,
  phase: "P1",
  enforces: "minimum gap between calls to the same service",
  evaluate(intent, policy, window) {
    if (policy.cooldownSecondsPerService === 0) {
      return pass("no cooldown is set on this policy");
    }
    if (window.lastCallToServiceAt === null) {
      return pass(`no previous call to ${intent.provider}/${intent.capability}`);
    }
    const elapsedSeconds = (ms(window.now) - ms(window.lastCallToServiceAt)) / 1000;
    if (elapsedSeconds < policy.cooldownSecondsPerService) {
      return fail(
        "COOLDOWN_ACTIVE",
        `${intent.provider}/${intent.capability} was called ${elapsedSeconds.toFixed(1)}s ago; the cooldown is ${policy.cooldownSecondsPerService}s`,
      );
    }
    return pass(`${elapsedSeconds.toFixed(1)}s since the last call, cooldown is ${policy.cooldownSecondsPerService}s`);
  },
};

/* ------------------------------------------------------------------ 4 */

export const replayContextBinding: Rule = {
  ordinal: 4,
  id: "replay.contextBinding",
  enforced: true,
  phase: "P1",
  enforces: "an intent bound to a stale context is refused",
  evaluate(intent, _policy, window) {
    if (window.contextAlreadySpent) {
      return fail(
        "CONTEXT_REPLAY",
        `task ${intent.context.taskId} has already been spent against; an intent may bind a context once`,
      );
    }
    return pass(`task ${intent.context.taskId} has not been spent against`);
  },
};

/* ------------------------------------------------------------------ 5 */

/**
 * Deny beats allow, and an empty allowlist means "no allowlist set" rather than "nothing allowed".
 *
 * The second half matters more than it looks: reading an empty allowlist as "deny everything" is
 * the safer-sounding choice, but it means a policy saved before the field existed silently blocks
 * every payment, and the refusal names a recipient rule that the user never configured. The engine
 * refuses on what the user wrote, not on what they omitted.
 */
function allowDeny(
  subject: string,
  value: string,
  allowList: readonly string[],
  denyList: readonly string[],
  deniedCode: PolicyReasonCode,
  notAllowedCode: PolicyReasonCode,
  normalise: (input: string) => string = (input) => input,
): RuleOutcome {
  const needle = normalise(value);
  if (denyList.some((entry) => normalise(entry) === needle)) {
    return fail(deniedCode, `${subject} ${value} is on the deny list`);
  }
  if (allowList.length === 0) {
    return pass(`no ${subject} allowlist is set; the deny list does not name ${value}`);
  }
  if (allowList.some((entry) => normalise(entry) === needle)) {
    return pass(`${subject} ${value} is on the allowlist`);
  }
  return fail(notAllowedCode, `${subject} ${value} is not on the ${allowList.length}-entry allowlist`);
}

const lower = (input: string): string => input.toLowerCase();

export const recipientAllowDeny: Rule = {
  ordinal: 5,
  id: "recipient.allowDeny",
  enforced: true,
  phase: "P1",
  enforces: "allow / deny lists over payees",
  evaluate(intent, policy) {
    // EVM addresses are compared case-insensitively: EIP-55 checksum casing is a display
    // convention, and a policy that failed open because the user pasted a lowercase address
    // would be a control that stops working exactly when someone copies from the wrong place.
    return allowDeny(
      "recipient",
      intent.recipient,
      policy.recipientAllowList,
      policy.recipientDenyList,
      "RECIPIENT_DENIED",
      "RECIPIENT_NOT_ALLOWED",
      lower,
    );
  },
};

/* ------------------------------------------------------------------ 6 */

export const workerAllowDeny: Rule = {
  ordinal: 6,
  id: "agent.workerAllowDeny",
  enforced: true,
  phase: "P1",
  enforces: "which worker agents may act",
  evaluate(intent, policy) {
    return allowDeny(
      "worker",
      intent.context.requestedBy,
      policy.workerAllowList,
      policy.workerDenyList,
      "WORKER_DENIED",
      "WORKER_NOT_ALLOWED",
    );
  },
};

/* ------------------------------------------------------------------ 7 */

export const categoryAllow: Rule = {
  ordinal: 7,
  id: "category.allow",
  enforced: true,
  phase: "P1",
  enforces: "allow / deny lists over spend categories",
  evaluate(intent, policy) {
    return allowDeny(
      "category",
      intent.category,
      policy.categoryAllowList,
      policy.categoryDenyList,
      "CATEGORY_DENIED",
      "CATEGORY_NOT_ALLOWED",
      lower,
    );
  },
};

/* ------------------------------------------------------------------ 8 */

/**
 * §10.1 Phase 3, stubbed and labelled. It is present in the engine, returns RULE_NOT_ENFORCED,
 * and says so in the console and on the receipt. It is not silently skipped and not silently passed.
 *
 * The distinction is the entire point of the rule existing now: a reviewer reading the receipt sees
 * fourteen enforced rules and one that announces it is not enforcing anything, rather than fifteen
 * green ticks of which one is decorative.
 */
export const vendorLcbFloor: Rule = {
  ordinal: 8,
  id: "vendor.lcbFloor",
  enforced: false,
  phase: "P3",
  enforces: "vendor score lower-confidence bound floor",
  evaluate(_intent, policy, window) {
    const floor = policy.vendorLcbFloor;
    const observed = window.vendorLcb;
    return notEnforced(
      `vendor scoring is phase 3 and is not enforced. ` +
        `Policy floor ${floor ?? "unset"}; observed lower-confidence bound ${observed ?? "none"}. ` +
        `No verdict is drawn from either value.`,
    );
  },
};

/* ------------------------------------------------------------------ 9 */

export const intentMaxAmountBound: Rule = {
  ordinal: 9,
  id: "intent.maxAmountBound",
  enforced: true,
  phase: "P1",
  enforces: "the intent's own declared ceiling",
  evaluate(intent) {
    if (intent.maxAmount === undefined) {
      return pass("the intent declared no ceiling of its own");
    }
    const amount = intentAtomic(intent);
    const ceiling = toAtomicForAsset(intent.maxAmount, intent.asset);
    if (amount > ceiling) {
      return fail(
        "INTENT_MAX_EXCEEDED",
        `${intent.amount} ${intent.asset} exceeds the intent's own declared ceiling of ${intent.maxAmount}`,
      );
    }
    return pass(`${intent.amount} is within the intent's declared ceiling of ${intent.maxAmount}`);
  },
};

/* ------------------------------------------------------------------ 10 */

export const hardCapAbsolute: Rule = {
  ordinal: 10,
  id: "hardCap.absolute",
  enforced: true,
  phase: "P1",
  enforces: "an absolute ceiling no policy can exceed",
  evaluate(intent, policy) {
    const amount = intentAtomic(intent);
    const cap = policyAtomic(policy.hardCapAbsolute, policy);
    if (amount > cap) {
      return fail(
        "HARD_CAP_EXCEEDED",
        `${intent.amount} ${intent.asset} exceeds the absolute cap of ${policy.hardCapAbsolute}`,
      );
    }
    return pass(`${intent.amount} is within the absolute cap of ${policy.hardCapAbsolute}`);
  },
};

/* ------------------------------------------------------------------ 11 */

export const perCallCap: Rule = {
  ordinal: 11,
  id: "perCall.cap",
  enforced: true,
  phase: "P1",
  enforces: "a single call can never exceed the human's limit",
  evaluate(intent, policy) {
    const amount = intentAtomic(intent);
    const cap = policyAtomic(policy.perCallCap, policy);
    if (amount > cap) {
      return fail(
        "PER_CALL_CAP_EXCEEDED",
        `${intent.amount} ${intent.asset} exceeds the per-call cap of ${policy.perCallCap}`,
      );
    }
    return pass(`${intent.amount} is within the per-call cap of ${policy.perCallCap}`);
  },
};

/* ------------------------------------------------------------------ 12 */

/**
 * §10.2 Enforced against *effective* usage: settled money plus still-executable reserved authority.
 * The two are reported separately and an approved decision is never counted as spend.
 */
export const budgetDaily: Rule = {
  ordinal: 12,
  id: "budget.daily",
  enforced: true,
  phase: "P1",
  enforces: "daily ceiling against effective usage",
  evaluate(intent, policy, window) {
    const amount = intentAtomic(intent);
    const budget = policyAtomic(policy.dailyBudget, policy);
    const settled = BigInt(window.settledTodayAtomic);
    const reserved = BigInt(window.reservedTodayAtomic);
    const effective = settled + reserved;
    if (effective + amount > budget) {
      return fail(
        "DAILY_BUDGET_EXCEEDED",
        `settled ${settled} + reserved ${reserved} + this ${amount} exceeds the daily budget of ${budget} atomic units`,
      );
    }
    return pass(
      `settled ${settled} + reserved ${reserved} + this ${amount} is within the daily budget of ${budget} atomic units`,
    );
  },
};

/* ------------------------------------------------------------------ 13 */

export const rateLimit: Rule = {
  ordinal: 13,
  id: "rate.limit",
  enforced: true,
  phase: "P1",
  enforces: "calls per hour",
  evaluate(_intent, policy, window) {
    if (window.callsInLastHour >= policy.rateLimitPerHour) {
      return fail(
        "RATE_LIMIT_EXCEEDED",
        `${window.callsInLastHour} calls in the last hour meets the limit of ${policy.rateLimitPerHour}`,
      );
    }
    return pass(`${window.callsInLastHour} calls in the last hour, limit is ${policy.rateLimitPerHour}`);
  },
};

/* ------------------------------------------------------------------ 14 */

/**
 * §10.1 Phase 2, stubbed and labelled — same contract as rule 8.
 *
 * §15 is explicit that verification is not available for every capability, and that where it is
 * not, the receipt says `T0_NONE` with a reason rather than quietly downgrading to the provider's
 * own claim while still showing a verified badge. This rule not being enforced yet is that honesty
 * applied one level up: nothing here is allowed to imply a delivery check happened.
 */
export const proofTierRequired: Rule = {
  ordinal: 14,
  id: "proof.tierRequired",
  enforced: false,
  phase: "P2",
  enforces: "required delivery-verification tier for this category",
  evaluate(intent, policy, window) {
    const required = policy.proofTierByCategory[intent.category] ?? "T0_NONE";
    const available = window.availableProofTier ?? "none observed";
    return notEnforced(
      `delivery verification is phase 2 and is not enforced. ` +
        `Category "${intent.category}" would require ${required}; currently available: ${available}. ` +
        `No verdict is drawn from either value.`,
    );
  },
};

/* ------------------------------------------------------------------ 15 */

/**
 * The one rule whose FAIL does not mean BLOCK.
 *
 * §10.3 fixes the result enum at PASS | FAIL | RULE_NOT_ENFORCED, so "this needs a human" has to be
 * expressed as a failed test — the intent failed to stay below the threshold. The engine maps that
 * single rule's failure to `ESCALATE` rather than `BLOCK`, and `decide()` documents the mapping in
 * one place so it cannot drift.
 */
export const escalateAboveThreshold: Rule = {
  ordinal: 15,
  id: "escalate.aboveThreshold",
  enforced: true,
  phase: "P2",
  enforces: "above threshold, a human decides",
  evaluate(intent, policy) {
    if (policy.escalateAboveAmount === undefined) {
      return pass("no escalation threshold is set on this policy");
    }
    const amount = intentAtomic(intent);
    const threshold = policyAtomic(policy.escalateAboveAmount, policy);
    if (amount >= threshold) {
      return failWithoutReasonCode(
        `${intent.amount} ${intent.asset} is at or above the escalation threshold of ${policy.escalateAboveAmount}; a human decides this one`,
      );
    }
    return pass(`${intent.amount} is below the escalation threshold of ${policy.escalateAboveAmount}`);
  },
};

/** §10.1 The rule set, in evaluation order. The array order *is* the specified order. */
export const RULES: readonly Rule[] = [
  policyActive,
  duplicateIntent,
  cooldownSameService,
  replayContextBinding,
  recipientAllowDeny,
  workerAllowDeny,
  categoryAllow,
  vendorLcbFloor,
  intentMaxAmountBound,
  hardCapAbsolute,
  perCallCap,
  budgetDaily,
  rateLimit,
  proofTierRequired,
  escalateAboveThreshold,
];

/** The ordinal of the escalation rule, so `decide()` never has to match on its id by string. */
export const ESCALATION_RULE_ORDINAL = escalateAboveThreshold.ordinal;
