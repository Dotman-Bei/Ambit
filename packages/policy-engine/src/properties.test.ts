import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { policy as basePolicy, window as baseWindow, intent as baseIntent, NOW } from "@ambit/fixtures";
import { fromAtomic, toAtomicForAsset } from "@ambit/shared";
import { mintDigest } from "@ambit/approval";
import { decide } from "./decide.js";

/**
 * §21 Property tests on the engine. Two properties are named in the PRD:
 *   - no intent above `hardCap.absolute` ever returns ALLOW
 *   - the digest is injective over its inputs
 *
 * A table test says "these cases behave"; a property test says "no case behaves otherwise, across
 * thousands of generated inputs". The difference matters most for rule 10, which is the rule that
 * is supposed to hold when every other setting is wrong.
 */

/** Generates a USDC amount as a human decimal string, in atomic units up to ~1000 USDC. */
const usdcAmount = (min: number, max: number) =>
  fc.integer({ min, max }).map((atomic) => fromAtomic(BigInt(atomic), 6));

describe("§21 property: the absolute cap is absolute", () => {
  it("no intent above hardCap.absolute ever returns ALLOW, whatever the other settings say", () => {
    fc.assert(
      fc.property(
        usdcAmount(1, 1_000_000_000),
        usdcAmount(1, 1_000_000_000),
        fc.integer({ min: 1, max: 10_000 }),
        (capHuman, overHuman, rateLimit) => {
          const cap = toAtomicForAsset(capHuman, "USDC");
          const over = toAtomicForAsset(overHuman, "USDC");
          // Only interested in amounts strictly above the cap.
          fc.pre(over > cap);

          // Every *other* limit is set as permissively as it can be, so the only thing that can
          // refuse this intent is rule 10. If ALLOW ever comes back, the cap is not absolute.
          const decision = decide(
            baseIntent({ amount: overHuman, recipient: "0x2222222222222222222222222222222222222222" }),
            basePolicy({
              hardCapAbsolute: capHuman,
              perCallCap: "1000000.00",
              dailyBudget: "1000000.00",
              rateLimitPerHour: rateLimit,
              duplicateWindowSeconds: 0,
              cooldownSecondsPerService: 0,
              recipientAllowList: [],
              recipientDenyList: [],
              workerDenyList: [],
              categoryDenyList: [],
            }),
            baseWindow(),
          );

          expect(decision.verdict).not.toBe("ALLOW");
          return true;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("an amount at or below the cap is not refused BY the cap", () => {
    fc.assert(
      fc.property(usdcAmount(1, 1_000_000), usdcAmount(1, 1_000_000), (capHuman, underHuman) => {
        const cap = toAtomicForAsset(capHuman, "USDC");
        const under = toAtomicForAsset(underHuman, "USDC");
        fc.pre(under <= cap);

        const decision = decide(
          baseIntent({ amount: underHuman, recipient: "0x2222222222222222222222222222222222222222" }),
          basePolicy({
            hardCapAbsolute: capHuman,
            perCallCap: "1000000.00",
            dailyBudget: "1000000.00",
            duplicateWindowSeconds: 0,
            cooldownSecondsPerService: 0,
          }),
          baseWindow(),
        );

        expect(decision.reasonCode).not.toBe("HARD_CAP_EXCEEDED");
        return true;
      }),
      { numRuns: 300 },
    );
  });
});

describe("§21 property: the engine is deterministic", () => {
  it("the same inputs always produce the same decision", () => {
    fc.assert(
      fc.property(
        usdcAmount(1, 2_000_000),
        fc.integer({ min: 0, max: 50 }),
        fc.boolean(),
        (amount, callsInLastHour, contextAlreadySpent) => {
          const args = [
            baseIntent({ amount }),
            basePolicy(),
            baseWindow({ callsInLastHour, contextAlreadySpent }),
          ] as const;
          const first = JSON.stringify(decide(...args));
          const second = JSON.stringify(decide(...args));
          expect(first).toBe(second);
          return true;
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("§21 property: the digest is injective over its inputs", () => {
  const binding = (overrides: Record<string, unknown> = {}) => ({
    quoteHash: "a".repeat(64),
    amountAtomic: "50000",
    recipient: "0x2222222222222222222222222222222222222222",
    policyId: "pol_demo",
    policyHash: "b".repeat(64),
    requesterPrincipal: "worker-alpha",
    walletId: "wallet-1",
    nonce: "c".repeat(64),
    expiresAt: NOW,
    ...overrides,
  });

  it("changing any single bound field changes the digest", () => {
    const baseline = mintDigest(binding() as never);

    const mutations: Array<[string, Record<string, unknown>]> = [
      ["quoteHash", { quoteHash: "d".repeat(64) }],
      ["amountAtomic", { amountAtomic: "50001" }],
      ["recipient", { recipient: "0x4444444444444444444444444444444444444444" }],
      ["policyId", { policyId: "pol_other" }],
      ["policyHash", { policyHash: "e".repeat(64) }],
      ["requesterPrincipal", { requesterPrincipal: "worker-beta" }],
      ["walletId", { walletId: "wallet-2" }],
      ["nonce", { nonce: "f".repeat(64) }],
      ["expiresAt", { expiresAt: "2026-09-17T13:00:00.000Z" }],
    ];

    for (const [field, mutation] of mutations) {
      expect(mintDigest(binding(mutation) as never), `mutating ${field} must change the digest`).not.toBe(
        baseline,
      );
    }
  });

  it("distinct amounts never collide — §11 approve $5, $500 cannot leave", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 12n }), fc.bigInt({ min: 0n, max: 10n ** 12n }), (a, b) => {
        fc.pre(a !== b);
        const da = mintDigest(binding({ amountAtomic: a.toString() }) as never);
        const db = mintDigest(binding({ amountAtomic: b.toString() }) as never);
        expect(da).not.toBe(db);
        return true;
      }),
      { numRuns: 500 },
    );
  });

  it("the digest is stable: the same binding always mints the same digest", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 12n }), (amount) => {
        const b = binding({ amountAtomic: amount.toString() });
        expect(mintDigest(b as never)).toBe(mintDigest(b as never));
        return true;
      }),
      { numRuns: 200 },
    );
  });
});

describe("§4 property: an intent cannot widen what the policy permits", () => {
  it("no field a proposer controls raises a limit — the intent's own ceiling can only lower", () => {
    fc.assert(
      fc.property(usdcAmount(1, 5_000_000), usdcAmount(1, 5_000_000), (amount, declaredMax) => {
        const decision = decide(
          baseIntent({ amount, maxAmount: declaredMax, recipient: "0x2222222222222222222222222222222222222222" }),
          basePolicy({ perCallCap: "1.00", hardCapAbsolute: "5.00", dailyBudget: "10.00" }),
          baseWindow(),
        );

        // Whatever the intent declares for itself, the policy's per-call cap still binds.
        const atomic = toAtomicForAsset(amount, "USDC");
        const perCallCap = toAtomicForAsset("1.00", "USDC");
        if (atomic > perCallCap) {
          expect(decision.verdict).not.toBe("ALLOW");
        }
        return true;
      }),
      { numRuns: 400 },
    );
  });
});
