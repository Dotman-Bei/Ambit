import type { DecisionWindow, Policy, Quote, SpendIntent } from "@ambit/shared";

/**
 * Canonical fixtures. §8.1 keeps these out of the packages so that a test, the campaign runner and
 * the adversarial cases all judge the *same* baseline, and a change to the baseline shows up in one
 * diff rather than three.
 *
 * Every value here is a fixture, not a claim: no address below is funded, and no amount below has
 * ever settled. §9's "figures are always real" rule applies to what the product displays, not to
 * what a test feeds it.
 */

export const OWNER = "0x1111111111111111111111111111111111111111";
export const ALLOWED_RECIPIENT = "0x2222222222222222222222222222222222222222";
export const DENIED_RECIPIENT = "0x3333333333333333333333333333333333333333";
export const UNKNOWN_RECIPIENT = "0x4444444444444444444444444444444444444444";

/** USDC on Base, the canonical mainnet address. Used as the EIP-712 verifying contract in quotes. */
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export const NOW = "2026-09-17T12:00:00.000Z";

export const basePolicy: Policy = {
  id: "pol_demo",
  owner: OWNER,
  version: 1,
  expiresAt: "2027-01-01T00:00:00.000Z",
  hardCapAbsolute: "5.00",
  perCallCap: "1.00",
  dailyBudget: "10.00",
  rateLimitPerHour: 20,
  duplicateWindowSeconds: 300,
  cooldownSecondsPerService: 0,
  recipientAllowList: [ALLOWED_RECIPIENT],
  recipientDenyList: [DENIED_RECIPIENT],
  workerAllowList: [],
  workerDenyList: ["worker-quarantined"],
  categoryAllowList: [],
  categoryDenyList: ["gambling"],
  proofTierByCategory: {},
  asset: "USDC",
  network: "eip155:8453",
};

export const baseIntent: SpendIntent = {
  provider: "example",
  capability: "domains.check",
  category: "data",
  amount: "0.05",
  asset: "USDC",
  network: "eip155:8453",
  recipient: ALLOWED_RECIPIENT,
  context: { taskId: "task-001", requestedBy: "worker-alpha" },
};

export const baseWindow: DecisionWindow = {
  now: NOW,
  settledTodayAtomic: "0",
  reservedTodayAtomic: "0",
  callsInLastHour: 0,
  lastIdenticalIntentAt: null,
  lastCallToServiceAt: null,
  contextAlreadySpent: false,
  vendorLcb: null,
  availableProofTier: null,
};

export const baseQuote: Quote = {
  scheme: "exact",
  x402Version: 1,
  network: "eip155:8453",
  amountAtomic: "50000",
  asset: USDC_BASE,
  assetSymbol: "USDC",
  payTo: ALLOWED_RECIPIENT,
  resource: "https://example.test/domains/check",
  description: "domain availability check",
  maxTimeoutSeconds: 60,
  domainName: "USD Coin",
  domainVersion: "2",
  source: "BODY",
};

export const intent = (overrides: Partial<SpendIntent> = {}): SpendIntent => ({
  ...baseIntent,
  ...overrides,
  context: { ...baseIntent.context, ...(overrides.context ?? {}) },
});

export const policy = (overrides: Partial<Policy> = {}): Policy => ({ ...basePolicy, ...overrides });

export const window = (overrides: Partial<DecisionWindow> = {}): DecisionWindow => ({
  ...baseWindow,
  ...overrides,
});

export const quote = (overrides: Partial<Quote> = {}): Quote => ({ ...baseQuote, ...overrides });
