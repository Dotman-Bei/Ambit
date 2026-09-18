import { describe, expect, it } from "vitest";
import { intent, policy, window, ALLOWED_RECIPIENT, DENIED_RECIPIENT, UNKNOWN_RECIPIENT, NOW } from "@ambit/fixtures";
import type { PolicyReasonCode } from "@ambit/shared";
import { decide, hashIntent, hashPolicy } from "./decide.js";
import { RULES } from "./rules.js";

/**
 * §21 The policy engine is a pure function, so every rule gets a table-driven test with pass and
 * fail cases. The table below is that test: one row per rule per outcome, and a guard at the end
 * that fails if a rule is ever added without a row.
 */

type Row = {
  rule: string;
  ordinal: number;
  name: string;
  intent: Parameters<typeof decide>[0];
  policy: Parameters<typeof decide>[1];
  window: Parameters<typeof decide>[2];
  expect: "ALLOW" | "BLOCK" | "ESCALATE";
  code?: PolicyReasonCode;
};

const minutesBefore = (instant: string, minutes: number): string =>
  new Date(Date.parse(instant) - minutes * 60_000).toISOString();

const table: Row[] = [
  /* 1 policy.active */
  {
    rule: "policy.active",
    ordinal: 1,
    name: "an expired policy authorises nothing",
    intent: intent(),
    policy: policy({ expiresAt: "2026-01-01T00:00:00.000Z" }),
    window: window(),
    expect: "BLOCK",
    code: "POLICY_EXPIRED",
  },
  {
    rule: "policy.active",
    ordinal: 1,
    name: "a policy not yet in force authorises nothing",
    intent: intent(),
    policy: policy({ notBefore: "2027-01-01T00:00:00.000Z", expiresAt: "2028-01-01T00:00:00.000Z" }),
    window: window(),
    expect: "BLOCK",
    code: "POLICY_NOT_ACTIVE",
  },
  {
    rule: "policy.active",
    ordinal: 1,
    name: "a live policy passes",
    intent: intent(),
    policy: policy(),
    window: window(),
    expect: "ALLOW",
  },

  /* 2 duplicate */
  {
    rule: "duplicate.provider_capability_amount_recipient",
    ordinal: 2,
    name: "an identical intent inside the window is refused",
    intent: intent(),
    policy: policy({ duplicateWindowSeconds: 300 }),
    window: window({ lastIdenticalIntentAt: minutesBefore(NOW, 1) }),
    expect: "BLOCK",
    code: "DUPLICATE_INTENT",
  },
  {
    rule: "duplicate.provider_capability_amount_recipient",
    ordinal: 2,
    name: "an identical intent outside the window passes",
    intent: intent(),
    policy: policy({ duplicateWindowSeconds: 300 }),
    window: window({ lastIdenticalIntentAt: minutesBefore(NOW, 10) }),
    expect: "ALLOW",
  },

  /* 3 cooldown */
  {
    rule: "cooldown.sameService",
    ordinal: 3,
    name: "a call inside the cooldown is refused",
    intent: intent(),
    policy: policy({ cooldownSecondsPerService: 600 }),
    window: window({ lastCallToServiceAt: minutesBefore(NOW, 2) }),
    expect: "BLOCK",
    code: "COOLDOWN_ACTIVE",
  },
  {
    rule: "cooldown.sameService",
    ordinal: 3,
    name: "a call after the cooldown passes",
    intent: intent(),
    policy: policy({ cooldownSecondsPerService: 60 }),
    window: window({ lastCallToServiceAt: minutesBefore(NOW, 5) }),
    expect: "ALLOW",
  },

  /* 4 replay */
  {
    rule: "replay.contextBinding",
    ordinal: 4,
    name: "a context already spent against is refused",
    intent: intent(),
    policy: policy(),
    window: window({ contextAlreadySpent: true }),
    expect: "BLOCK",
    code: "CONTEXT_REPLAY",
  },
  {
    rule: "replay.contextBinding",
    ordinal: 4,
    name: "a fresh context passes",
    intent: intent(),
    policy: policy(),
    window: window({ contextAlreadySpent: false }),
    expect: "ALLOW",
  },

  /* 5 recipient */
  {
    rule: "recipient.allowDeny",
    ordinal: 5,
    name: "a denied recipient is refused",
    intent: intent({ recipient: DENIED_RECIPIENT }),
    policy: policy(),
    window: window(),
    expect: "BLOCK",
    code: "RECIPIENT_DENIED",
  },
  {
    rule: "recipient.allowDeny",
    ordinal: 5,
    name: "a recipient absent from a set allowlist is refused",
    intent: intent({ recipient: UNKNOWN_RECIPIENT }),
    policy: policy(),
    window: window(),
    expect: "BLOCK",
    code: "RECIPIENT_NOT_ALLOWED",
  },
  {
    rule: "recipient.allowDeny",
    ordinal: 5,
    name: "an allowlisted recipient passes",
    intent: intent({ recipient: ALLOWED_RECIPIENT }),
    policy: policy(),
    window: window(),
    expect: "ALLOW",
  },
  {
    rule: "recipient.allowDeny",
    ordinal: 5,
    name: "allowlist matching ignores EIP-55 checksum casing",
    intent: intent({ recipient: ALLOWED_RECIPIENT.toUpperCase().replace("0X", "0x") }),
    policy: policy(),
    window: window(),
    expect: "ALLOW",
  },

  /* 6 worker */
  {
    rule: "agent.workerAllowDeny",
    ordinal: 6,
    name: "a denied worker is refused",
    intent: intent({ context: { taskId: "task-001", requestedBy: "worker-quarantined" } }),
    policy: policy(),
    window: window(),
    expect: "BLOCK",
    code: "WORKER_DENIED",
  },
  {
    rule: "agent.workerAllowDeny",
    ordinal: 6,
    name: "a worker absent from a set allowlist is refused",
    intent: intent({ context: { taskId: "task-001", requestedBy: "worker-unknown" } }),
    policy: policy({ workerAllowList: ["worker-alpha"] }),
    window: window(),
    expect: "BLOCK",
    code: "WORKER_NOT_ALLOWED",
  },
  {
    rule: "agent.workerAllowDeny",
    ordinal: 6,
    name: "an allowlisted worker passes",
    intent: intent(),
    policy: policy({ workerAllowList: ["worker-alpha"] }),
    window: window(),
    expect: "ALLOW",
  },

  /* 7 category */
  {
    rule: "category.allow",
    ordinal: 7,
    name: "a denied category is refused",
    intent: intent({ category: "gambling" }),
    policy: policy(),
    window: window(),
    expect: "BLOCK",
    code: "CATEGORY_DENIED",
  },
  {
    rule: "category.allow",
    ordinal: 7,
    name: "a category absent from a set allowlist is refused",
    intent: intent({ category: "hosting" }),
    policy: policy({ categoryAllowList: ["data"] }),
    window: window(),
    expect: "BLOCK",
    code: "CATEGORY_NOT_ALLOWED",
  },
  {
    rule: "category.allow",
    ordinal: 7,
    name: "an allowlisted category passes",
    intent: intent({ category: "data" }),
    policy: policy({ categoryAllowList: ["data"] }),
    window: window(),
    expect: "ALLOW",
  },

  /* 9 intent ceiling */
  {
    rule: "intent.maxAmountBound",
    ordinal: 9,
    name: "an amount above the intent's own ceiling is refused",
    intent: intent({ amount: "0.50", maxAmount: "0.10" }),
    policy: policy(),
    window: window(),
    expect: "BLOCK",
    code: "INTENT_MAX_EXCEEDED",
  },
  {
    rule: "intent.maxAmountBound",
    ordinal: 9,
    name: "an amount at the intent's ceiling passes",
    intent: intent({ amount: "0.10", maxAmount: "0.10" }),
    policy: policy(),
    window: window(),
    expect: "ALLOW",
  },

  /* 10 hard cap */
  {
    rule: "hardCap.absolute",
    ordinal: 10,
    name: "an amount above the absolute cap is refused",
    intent: intent({ amount: "9.00" }),
    policy: policy({ perCallCap: "50.00", dailyBudget: "100.00", hardCapAbsolute: "5.00" }),
    window: window(),
    expect: "BLOCK",
    code: "HARD_CAP_EXCEEDED",
  },
  {
    rule: "hardCap.absolute",
    ordinal: 10,
    name: "an amount at the absolute cap passes",
    intent: intent({ amount: "5.00" }),
    policy: policy({ perCallCap: "50.00", dailyBudget: "100.00", hardCapAbsolute: "5.00" }),
    window: window(),
    expect: "ALLOW",
  },

  /* 11 per-call cap */
  {
    rule: "perCall.cap",
    ordinal: 11,
    name: "an amount above the per-call cap is refused",
    intent: intent({ amount: "2.00" }),
    policy: policy({ perCallCap: "1.00" }),
    window: window(),
    expect: "BLOCK",
    code: "PER_CALL_CAP_EXCEEDED",
  },
  {
    rule: "perCall.cap",
    ordinal: 11,
    name: "an amount at the per-call cap passes",
    intent: intent({ amount: "1.00" }),
    policy: policy({ perCallCap: "1.00" }),
    window: window(),
    expect: "ALLOW",
  },

  /* 12 daily budget — §10.2 effective usage */
  {
    rule: "budget.daily",
    ordinal: 12,
    name: "settled spend alone can exhaust the budget",
    intent: intent({ amount: "0.05" }),
    policy: policy({ dailyBudget: "1.00" }),
    window: window({ settledTodayAtomic: "1000000" }),
    expect: "BLOCK",
    code: "DAILY_BUDGET_EXCEEDED",
  },
  {
    rule: "budget.daily",
    ordinal: 12,
    name: "reserved authority counts toward the budget even though nothing has settled",
    intent: intent({ amount: "0.05" }),
    policy: policy({ dailyBudget: "1.00" }),
    window: window({ settledTodayAtomic: "0", reservedTodayAtomic: "1000000" }),
    expect: "BLOCK",
    code: "DAILY_BUDGET_EXCEEDED",
  },
  {
    rule: "budget.daily",
    ordinal: 12,
    name: "an amount that exactly fills the remaining budget passes",
    intent: intent({ amount: "0.05" }),
    policy: policy({ dailyBudget: "1.00" }),
    window: window({ settledTodayAtomic: "900000", reservedTodayAtomic: "50000" }),
    expect: "ALLOW",
  },

  /* 13 rate limit */
  {
    rule: "rate.limit",
    ordinal: 13,
    name: "calls at the hourly limit are refused",
    intent: intent(),
    policy: policy({ rateLimitPerHour: 5 }),
    window: window({ callsInLastHour: 5 }),
    expect: "BLOCK",
    code: "RATE_LIMIT_EXCEEDED",
  },
  {
    rule: "rate.limit",
    ordinal: 13,
    name: "calls below the hourly limit pass",
    intent: intent(),
    policy: policy({ rateLimitPerHour: 5 }),
    window: window({ callsInLastHour: 4 }),
    expect: "ALLOW",
  },

  /* 15 escalation */
  {
    rule: "escalate.aboveThreshold",
    ordinal: 15,
    name: "an amount at the escalation threshold goes to a human",
    intent: intent({ amount: "0.50" }),
    policy: policy({ escalateAboveAmount: "0.50" }),
    window: window(),
    expect: "ESCALATE",
  },
  {
    rule: "escalate.aboveThreshold",
    ordinal: 15,
    name: "an amount below the escalation threshold passes",
    intent: intent({ amount: "0.49" }),
    policy: policy({ escalateAboveAmount: "0.50" }),
    window: window(),
    expect: "ALLOW",
  },
];

describe("§10.1 rule table", () => {
  for (const row of table) {
    it(`rule ${row.ordinal} ${row.rule}: ${row.name}`, () => {
      const decision = decide(row.intent, row.policy, row.window);
      expect(decision.verdict).toBe(row.expect);
      if (row.code) {
        expect(decision.reasonCode).toBe(row.code);
        // §10.4 a receipt that says "blocked" without naming the rule is a defect
        expect(decision.reason).toContain(row.rule);
      }
    });
  }

  it("every enforced rule has at least one PASS row and one FAIL row in the table", () => {
    const enforced = RULES.filter((rule) => rule.enforced);
    const missing: string[] = [];
    for (const rule of enforced) {
      const rows = table.filter((row) => row.rule === rule.id);
      const hasFail = rows.some((row) => row.expect !== "ALLOW");
      const hasPass = rows.some((row) => row.expect === "ALLOW");
      if (!hasFail || !hasPass) missing.push(`${rule.id} (pass: ${hasPass}, fail: ${hasFail})`);
    }
    expect(missing, "a rule was added without a table row — §21 requires both cases").toEqual([]);
  });
});

describe("§10 output contract", () => {
  it("evaluates all fifteen rules on every call, in the fixed order", () => {
    const decision = decide(intent(), policy(), window());
    expect(decision.rulesEvaluated).toHaveLength(15);
    expect(decision.rulesEvaluated.map((r) => r.ordinal)).toEqual([...Array(15)].map((_, i) => i + 1));
    expect(decision.rulesEvaluated.map((r) => r.id)).toEqual(RULES.map((r) => r.id));
  });

  it("evaluates every rule even after one has failed, so the console can show all fifteen", () => {
    // Rule 1 fails here. Rules 2..15 must still report an outcome rather than being skipped.
    const decision = decide(intent(), policy({ expiresAt: "2026-01-01T00:00:00.000Z" }), window());
    expect(decision.verdict).toBe("BLOCK");
    expect(decision.rulesEvaluated).toHaveLength(15);
    expect(decision.rulesEvaluated.every((r) => r.detail.length > 0)).toBe(true);
  });

  it("attributes a block to the FIRST failing rule in the fixed order, not an arbitrary one", () => {
    // Both rule 5 (denied recipient) and rule 11 (over per-call cap) fail. Rule 5 comes first.
    const decision = decide(
      intent({ recipient: DENIED_RECIPIENT, amount: "2.00" }),
      policy({ perCallCap: "1.00" }),
      window(),
    );
    expect(decision.verdict).toBe("BLOCK");
    expect(decision.reasonCode).toBe("RECIPIENT_DENIED");
    const capRule = decision.rulesEvaluated.find((r) => r.id === "perCall.cap");
    expect(capRule?.result).toBe("FAIL");
  });

  it("§10.1 rules 8 and 14 are present, return RULE_NOT_ENFORCED, and decide nothing", () => {
    const decision = decide(intent(), policy(), window());
    const vendor = decision.rulesEvaluated.find((r) => r.id === "vendor.lcbFloor");
    const proof = decision.rulesEvaluated.find((r) => r.id === "proof.tierRequired");
    expect(vendor?.result).toBe("RULE_NOT_ENFORCED");
    expect(proof?.result).toBe("RULE_NOT_ENFORCED");
    expect(decision.verdict).toBe("ALLOW");
    // Not silently skipped: they are in the array, labelled, with a detail explaining the phase.
    expect(vendor?.detail).toContain("not enforced");
    expect(proof?.detail).toContain("not enforced");
  });

  it("a BLOCK carries no proposal — a refusal reserves nothing", () => {
    const decision = decide(intent({ recipient: DENIED_RECIPIENT }), policy(), window());
    expect(decision.proposal).toBeNull();
  });

  it("§10.2 an ALLOW reserves budget and the proposal is not reported as spend", () => {
    const decision = decide(intent({ amount: "0.05" }), policy(), window());
    expect(decision.proposal).not.toBeNull();
    expect(decision.proposal?.budgetDeltaAtomic).toBe("50000");
    expect(Date.parse(decision.proposal!.expiresAt)).toBeGreaterThan(Date.parse(NOW));
  });

  it("an ESCALATE reserves budget too, so pending escalations cannot jointly overspend", () => {
    const decision = decide(intent({ amount: "0.50" }), policy({ escalateAboveAmount: "0.50" }), window());
    expect(decision.verdict).toBe("ESCALATE");
    expect(decision.proposal).not.toBeNull();
  });

  it("§10.4 the verdict enum contains no safety vocabulary", () => {
    const decision = decide(intent(), policy(), window());
    expect(["ALLOW", "ESCALATE", "BLOCK"]).toContain(decision.verdict);
    expect(decision.reason.toLowerCase()).not.toMatch(/\bsafe\b|\btrusted\b|\bguaranteed\b/);
  });
});

describe("§22 C10 determinism", () => {
  it("ten identical calls produce ten byte-identical decisions", () => {
    const results = [...Array(10)].map(() => JSON.stringify(decide(intent(), policy(), window())));
    expect(new Set(results).size).toBe(1);
  });

  it("the reservation id is derived, not random, so an identical decision reserves once", () => {
    const a = decide(intent(), policy(), window());
    const b = decide(intent(), policy(), window());
    expect(a.proposal?.reservationId).toBe(b.proposal?.reservationId);
  });
});

describe("hashing", () => {
  it("the intent hash ignores the free-form note, so identical spends still trip the duplicate rule", () => {
    const a = hashIntent(intent({ context: { taskId: "t", requestedBy: "w", note: "first try" } }));
    const b = hashIntent(intent({ context: { taskId: "t", requestedBy: "w", note: "second try" } }));
    expect(a).toBe(b);
  });

  it("the intent hash changes when the amount changes", () => {
    expect(hashIntent(intent({ amount: "0.05" }))).not.toBe(hashIntent(intent({ amount: "0.06" })));
  });

  it("the policy hash changes when a cap changes", () => {
    expect(hashPolicy(policy({ perCallCap: "1.00" }))).not.toBe(hashPolicy(policy({ perCallCap: "2.00" })));
  });

  it("the policy hash is stable across allowlist ordering, which is a set not a sequence", () => {
    const a = hashPolicy(policy({ recipientAllowList: [ALLOWED_RECIPIENT, UNKNOWN_RECIPIENT] }));
    const b = hashPolicy(policy({ recipientAllowList: [UNKNOWN_RECIPIENT, ALLOWED_RECIPIENT] }));
    expect(a).toBe(b);
  });
});
