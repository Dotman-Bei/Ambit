import { canonicalHash } from "@ambit/canon";
import {
  composeReason,
  DecisionWindowSchema,
  PolicySchema,
  SpendIntentSchema,
  toAtomicForAsset,
  type Decision,
  type DecisionWindow,
  type Policy,
  type Proposal,
  type RuleEvaluation,
  type SpendIntent,
  type Verdict,
} from "@ambit/shared";
import { ESCALATION_RULE_ORDINAL, RULES } from "./rules.js";

/**
 * §10 The policy engine. A pure function of `(intent, policy, decisionWindow)`.
 *
 * It performs no I/O, returns a decision plus a PROPOSAL of what committing would change, and
 * writes nothing itself. **No LLM call appears anywhere on the money decision path.**
 *
 * Three properties this file is responsible for, each tested in `decide.test.ts` and
 * `properties.test.ts`:
 *
 *  1. *Determinism.* Same inputs, same output, every time — including the reservation id, which is
 *     derived from the inputs rather than drawn from a random source. §22 case C10 runs the same
 *     request ten times and expects ten identical verdicts; a `randomUUID()` here would make that
 *     case pass on the verdict and quietly fail on the record.
 *  2. *Totality.* All fifteen rules are evaluated on every call, even after one has failed, because
 *     §9 requires the console to show all fifteen with their outcomes. Short-circuiting would make
 *     the console show "blocked at rule 2" and nothing about rules 3 to 15.
 *  3. *First-failure attribution.* The verdict's reason is the first rule that failed in the fixed
 *     order of §10.1, not the last and not an arbitrary one. A refusal that names a different rule
 *     on a re-run is a refusal a user cannot act on.
 */

/** How long an ALLOW reserves budget for before the reservation lapses unspent. */
export const RESERVATION_TTL_SECONDS = 300;

export type DecideOptions = {
  /** Overrides the reservation TTL. Present for tests and for routes with a shorter quote validity. */
  reservationTtlSeconds?: number;
};

/**
 * The canonical form of a policy for hashing. Deliberately built by *naming* the fields that
 * constitute the policy's identity rather than hashing the whole object, so that adding a display-only
 * field later cannot silently change every policy hash in circulation.
 */
export function policyHashInput(policy: Policy): Record<string, unknown> {
  return {
    id: policy.id,
    owner: policy.owner.toLowerCase(),
    version: policy.version,
    notBefore: policy.notBefore ?? null,
    expiresAt: policy.expiresAt,
    hardCapAbsolute: policy.hardCapAbsolute,
    perCallCap: policy.perCallCap,
    dailyBudget: policy.dailyBudget,
    escalateAboveAmount: policy.escalateAboveAmount ?? null,
    rateLimitPerHour: policy.rateLimitPerHour,
    duplicateWindowSeconds: policy.duplicateWindowSeconds,
    cooldownSecondsPerService: policy.cooldownSecondsPerService,
    recipientAllowList: [...policy.recipientAllowList].map((a) => a.toLowerCase()).sort(),
    recipientDenyList: [...policy.recipientDenyList].map((a) => a.toLowerCase()).sort(),
    workerAllowList: [...policy.workerAllowList].sort(),
    workerDenyList: [...policy.workerDenyList].sort(),
    categoryAllowList: [...policy.categoryAllowList].map((c) => c.toLowerCase()).sort(),
    categoryDenyList: [...policy.categoryDenyList].map((c) => c.toLowerCase()).sort(),
    vendorLcbFloor: policy.vendorLcbFloor ?? null,
    proofTierByCategory: policy.proofTierByCategory,
    asset: policy.asset,
    network: policy.network,
  };
}

export function hashPolicy(policy: Policy): string {
  return canonicalHash(policyHashInput(policy));
}

/**
 * The canonical form of an intent for hashing. `context.note` is excluded on purpose: it is a
 * free-form field the engine never reads, and including it would mean two identical spends with
 * different commentary hash differently, defeating the duplicate rule they should both trip.
 */
export function intentHashInput(intent: SpendIntent): Record<string, unknown> {
  return {
    provider: intent.provider,
    capability: intent.capability,
    category: intent.category.toLowerCase(),
    amount: intent.amount,
    asset: intent.asset,
    network: intent.network,
    recipient: intent.recipient.toLowerCase(),
    maxAmount: intent.maxAmount ?? null,
    context: {
      taskId: intent.context.taskId,
      requestedBy: intent.context.requestedBy,
    },
  };
}

export function hashIntent(intent: SpendIntent): string {
  return canonicalHash(intentHashInput(intent));
}

/**
 * §22 C10 determinism, made structural: the reservation id is a hash of what the decision was
 * about, not a random token. Two identical decisions produce the same id, and a caller committing
 * the same proposal twice writes one reservation rather than two.
 */
function deriveReservationId(intentHash: string, policyHash: string, decidedAt: string): string {
  return `rsv_${canonicalHash({ intentHash, policyHash, decidedAt }).slice(0, 32)}`;
}

function addSeconds(instant: string, seconds: number): string {
  return new Date(Date.parse(instant) + seconds * 1000).toISOString();
}

export function decide(
  rawIntent: SpendIntent,
  rawPolicy: Policy,
  rawWindow: DecisionWindow,
  options: DecideOptions = {},
): Decision {
  // Parsed at the boundary rather than trusted. The intent in particular is the one input a model
  // can influence (§4), and `.strict()` on the schema is what stops an unknown field riding along.
  const intent = SpendIntentSchema.parse(rawIntent);
  const policy = PolicySchema.parse(rawPolicy);
  const window = DecisionWindowSchema.parse(rawWindow);

  const policyHash = hashPolicy(policy);
  const intentHash = hashIntent(intent);
  const decidedAt = window.now;

  // Every rule runs. See property 2 above.
  const rulesEvaluated: RuleEvaluation[] = RULES.map((rule) => {
    const outcome = rule.evaluate(intent, policy, window);
    return {
      id: rule.id,
      ordinal: rule.ordinal,
      result: outcome.result,
      detail: outcome.detail,
      reasonCode: outcome.reasonCode,
    };
  });

  // §10.1's fixed order is the array order, so "first failure" is simply the first FAIL found.
  const blocking = rulesEvaluated.find(
    (evaluation) => evaluation.result === "FAIL" && evaluation.ordinal !== ESCALATION_RULE_ORDINAL,
  );
  const escalating = rulesEvaluated.find(
    (evaluation) => evaluation.result === "FAIL" && evaluation.ordinal === ESCALATION_RULE_ORDINAL,
  );

  let verdict: Verdict;
  let reason: string;
  let reasonCode: Decision["reasonCode"];

  if (blocking !== undefined) {
    verdict = "BLOCK";
    reasonCode = blocking.reasonCode;
    // §10.4 A receipt that says "blocked" without naming the rule is a defect, so the rule id is
    // part of the reason string and not only part of the rules array beside it.
    reason = blocking.reasonCode
      ? composeReason(blocking.reasonCode, `rule ${blocking.ordinal} ${blocking.id}: ${blocking.detail}`)
      : `rule ${blocking.ordinal} ${blocking.id}: ${blocking.detail}`;
  } else if (escalating !== undefined) {
    verdict = "ESCALATE";
    reasonCode = null;
    reason = `rule ${escalating.ordinal} ${escalating.id}: ${escalating.detail}`;
  } else {
    verdict = "ALLOW";
    reasonCode = null;
    // §10.4 "ALLOW means the intent passed the rules as configured. It does not mean the purchase
    // is wise, the vendor is honest, or the policy is correct." The reason string says exactly that
    // and no more, and `composeReason`'s vocabulary check would reject it if it said more.
    const enforcedCount = RULES.filter((rule) => rule.enforced).length;
    const notEnforcedCount = RULES.length - enforcedCount;
    reason =
      `passed ${enforcedCount} enforced rules as configured` +
      (notEnforcedCount > 0
        ? `; ${notEnforcedCount} rules are present but not enforced in this phase and decided nothing`
        : "");
  }

  /**
   * §10.2 A decision reserves budget. It does not move money, and no surface reports it as spend.
   *
   * ESCALATE reserves too, and that is the conservative reading of §10.2's "still-executable
   * reserved authority": a pending escalation is still executable the moment a human approves it,
   * so ten pending escalations against a budget that fits one must not all be approvable. A
   * reservation that lapses unspent is released; an approval that never comes costs nothing.
   */
  const proposal: Proposal | null =
    verdict === "BLOCK"
      ? null
      : {
          budgetDeltaAtomic: toAtomicForAsset(intent.amount, intent.asset).toString(),
          reservationId: deriveReservationId(intentHash, policyHash, decidedAt),
          expiresAt: addSeconds(decidedAt, options.reservationTtlSeconds ?? RESERVATION_TTL_SECONDS),
        };

  return {
    verdict,
    rulesEvaluated,
    reason,
    reasonCode,
    proposal,
    policyHash,
    intentHash,
    decidedAt,
  };
}
