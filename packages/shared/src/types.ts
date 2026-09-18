import { z } from "zod";
import { REASON_CODES, type ReasonCode } from "./reason-codes.js";

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

/** CAIP-2 chain id, e.g. "eip155:8453" for Base. §12.1 */
export const CaipChainIdSchema = z
  .string()
  .regex(/^eip155:\d+$/, 'network must be a CAIP-2 eip155 chain id, e.g. "eip155:8453"');

export const EvmAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed 20-byte EVM address");

export const Sha256HexSchema = z.string().regex(/^[0-9a-f]{64}$/, "must be a lowercase 64-char sha256 hex digest");

export const IsoInstantSchema = z
  .string()
  .datetime({ offset: false })
  .describe("RFC 3339 UTC instant, e.g. 2026-09-17T12:00:00.000Z");

/** A non-negative human decimal string. Parsed to atomic units at the boundary. See amount.ts. */
export const DecimalAmountSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "amount must be a non-negative decimal string, without sign or exponent");

export const AssetSchema = z.enum(["USDC"]);

/* ------------------------------------------------------------------ *
 * SpendIntent — §4, the bounded struct the model proposes
 * ------------------------------------------------------------------ */

/**
 * The only thing a model may hand to Ambit. §6: the engine reads this struct and nothing else,
 * which is why prompt injection cannot widen what the policy permits — there is no field here
 * that raises a limit. `.strict()` is load-bearing: an unknown key is rejected rather than ignored,
 * so a model cannot smuggle `{"maxAmount": "999"}` past a schema that would otherwise drop it.
 */
export const SpendIntentSchema = z
  .object({
    provider: z.string().min(1).max(128),
    capability: z.string().min(1).max(128),
    category: z.string().min(1).max(64).default("uncategorised"),
    amount: DecimalAmountSchema,
    asset: AssetSchema,
    network: CaipChainIdSchema,
    recipient: EvmAddressSchema,
    /** The intent's own declared ceiling. Rule 9 holds it to this. It can lower, never raise. */
    maxAmount: DecimalAmountSchema.optional(),
    context: z
      .object({
        taskId: z.string().min(1).max(128),
        requestedBy: z.string().min(1).max(128),
        /** Free-form note carried into the receipt. Never read by the engine. */
        note: z.string().max(512).optional(),
      })
      .strict(),
  })
  .strict();

export type SpendIntent = z.infer<typeof SpendIntentSchema>;

/* ------------------------------------------------------------------ *
 * Policy — §10, what the human set
 * ------------------------------------------------------------------ */

export const ProofTierSchema = z.enum(["T0_NONE", "T1_ATTESTED", "T2_INDEPENDENT"]);
export type ProofTier = z.infer<typeof ProofTierSchema>;

export const PolicySchema = z
  .object({
    id: z.string().min(1),
    /** The address that owns this policy. §18 tenant isolation is scoped by this. */
    owner: EvmAddressSchema,
    version: z.number().int().nonnegative().default(1),

    notBefore: IsoInstantSchema.optional(),
    expiresAt: IsoInstantSchema,

    /** rule 10 — the ceiling no other setting can raise. */
    hardCapAbsolute: DecimalAmountSchema,
    /** rule 11 */
    perCallCap: DecimalAmountSchema,
    /** rule 12 — enforced against effective usage: settled plus reserved. §10.2 */
    dailyBudget: DecimalAmountSchema,
    /** rule 15 — at or above this, a human decides. */
    escalateAboveAmount: DecimalAmountSchema.optional(),

    /** rule 13 */
    rateLimitPerHour: z.number().int().positive(),
    /** rule 2 */
    duplicateWindowSeconds: z.number().int().nonnegative(),
    /** rule 3 */
    cooldownSecondsPerService: z.number().int().nonnegative(),

    /** rule 5 — an empty allowlist means "no allowlist set", not "nothing allowed". */
    recipientAllowList: z.array(EvmAddressSchema).default([]),
    recipientDenyList: z.array(EvmAddressSchema).default([]),
    /** rule 6 */
    workerAllowList: z.array(z.string().min(1)).default([]),
    workerDenyList: z.array(z.string().min(1)).default([]),
    /** rule 7 */
    categoryAllowList: z.array(z.string().min(1)).default([]),
    categoryDenyList: z.array(z.string().min(1)).default([]),

    /** rule 8 — P3. Present, stubbed, labelled. §10.1 */
    vendorLcbFloor: z.number().min(0).max(1).optional(),
    /** rule 14 — P2. Present, stubbed, labelled. §10.1 */
    proofTierByCategory: z.record(z.string(), ProofTierSchema).default({}),

    asset: AssetSchema,
    network: CaipChainIdSchema,
  })
  .strict();

export type Policy = z.infer<typeof PolicySchema>;

/* ------------------------------------------------------------------ *
 * Decision window — §10, the third input to the pure function
 * ------------------------------------------------------------------ */

/**
 * Everything the engine needs to know about the world, gathered by the caller *before* the call.
 * The engine performs no I/O (§10), so state it would otherwise have to look up is passed in here.
 * That is what makes the engine testable as a pure function and what keeps a network call off the
 * money decision path.
 */
export const DecisionWindowSchema = z
  .object({
    now: IsoInstantSchema,

    /** §10.2 Settled money — payments that actually left. */
    settledTodayAtomic: z.string().regex(/^\d+$/),
    /** §10.2 Still-executable reserved authority. Approved but unspent. Never reported as spend. */
    reservedTodayAtomic: z.string().regex(/^\d+$/),

    /** rule 13 — calls in the trailing hour. */
    callsInLastHour: z.number().int().nonnegative(),

    /** rule 2 — when an identical intent was last allowed, if ever. */
    lastIdenticalIntentAt: IsoInstantSchema.nullable().default(null),
    /** rule 3 — when this provider+capability was last called, if ever. */
    lastCallToServiceAt: IsoInstantSchema.nullable().default(null),
    /** rule 4 — has this context taskId already been spent against. */
    contextAlreadySpent: z.boolean().default(false),

    /** rule 8 — P3 input. Null means no score exists, which is not the same as a low score. */
    vendorLcb: z.number().min(0).max(1).nullable().default(null),
    /** rule 14 — P2 input. The best tier actually available for this capability. */
    availableProofTier: ProofTierSchema.nullable().default(null),
  })
  .strict();

export type DecisionWindow = z.infer<typeof DecisionWindowSchema>;

/* ------------------------------------------------------------------ *
 * Decision output — §10.3
 * ------------------------------------------------------------------ */

/** §10.4 The verdict enum is fixed and contains no "SAFE" and no "APPROVED_SAFE". */
export const VerdictSchema = z.enum(["ALLOW", "ESCALATE", "BLOCK"]);
export type Verdict = z.infer<typeof VerdictSchema>;

/**
 * §10.1 Rules 8 and 14 are present in the engine and return `RULE_NOT_ENFORCED`.
 * They are not silently skipped and not silently passed — the distinction is the point.
 */
export const RuleResultSchema = z.enum(["PASS", "FAIL", "RULE_NOT_ENFORCED"]);
export type RuleResult = z.infer<typeof RuleResultSchema>;

export const RuleEvaluationSchema = z
  .object({
    id: z.string().min(1),
    ordinal: z.number().int().positive(),
    result: RuleResultSchema,
    detail: z.string(),
    reasonCode: z.enum(REASON_CODES).nullable().default(null),
  })
  .strict();

export type RuleEvaluation = z.infer<typeof RuleEvaluationSchema>;

export const ProposalSchema = z
  .object({
    /** §10.2 A decision reserves budget. It does not move money. */
    budgetDeltaAtomic: z.string().regex(/^\d+$/),
    reservationId: z.string().min(1),
    expiresAt: IsoInstantSchema,
  })
  .strict();

export type Proposal = z.infer<typeof ProposalSchema>;

export const DecisionSchema = z
  .object({
    verdict: VerdictSchema,
    rulesEvaluated: z.array(RuleEvaluationSchema),
    /** §10.3 Carried into the receipt verbatim. */
    reason: z.string(),
    reasonCode: z.enum(REASON_CODES).nullable(),
    /** §10 The engine returns a PROPOSAL of what committing would change. It writes nothing itself. */
    proposal: ProposalSchema.nullable(),
    policyHash: Sha256HexSchema,
    intentHash: Sha256HexSchema,
    decidedAt: IsoInstantSchema,
  })
  .strict();

export type Decision = z.infer<typeof DecisionSchema>;

/* ------------------------------------------------------------------ *
 * Quote and approval digest — §11
 * ------------------------------------------------------------------ */

/** The exact terms read off an x402 challenge. Rule 3 of §12.2: the engine judges THIS, not an estimate. */
export const QuoteSchema = z
  .object({
    scheme: z.literal("exact"),
    x402Version: z.number().int().positive(),
    network: CaipChainIdSchema,
    /** Atomic units, exactly as the challenge stated them. */
    amountAtomic: z.string().regex(/^\d+$/),
    asset: EvmAddressSchema,
    assetSymbol: AssetSchema,
    payTo: EvmAddressSchema,
    resource: z.string().min(1),
    description: z.string().default(""),
    maxTimeoutSeconds: z.number().int().positive(),
    /** EIP-712 domain fields the challenge carried in `extra`. See X402-SURFACE.md. */
    domainName: z.string().min(1),
    domainVersion: z.string().min(1),
    /** Which part of the 402 the challenge was read from. Recorded, never inferred. */
    source: z.enum(["BODY", "HEADER"]),
  })
  .strict();

export type Quote = z.infer<typeof QuoteSchema>;

/**
 * §11 An approval does not authorise "a purchase". It authorises one hash.
 * Change the amount, the recipient, the TTL, the item or the wallet and the digest changes.
 */
export const ApprovalBindingSchema = z
  .object({
    quoteHash: Sha256HexSchema,
    amountAtomic: z.string().regex(/^\d+$/),
    recipient: EvmAddressSchema,
    policyId: z.string().min(1),
    policyHash: Sha256HexSchema,
    requesterPrincipal: z.string().min(1),
    walletId: z.string().min(1),
    nonce: z.string().min(16),
    expiresAt: IsoInstantSchema,
  })
  .strict();

export type ApprovalBinding = z.infer<typeof ApprovalBindingSchema>;

/* ------------------------------------------------------------------ *
 * Receipts — §13
 * ------------------------------------------------------------------ */

/** §13.2 Never a nullable id. Five distinguishable states. */
export const AnchorStateSchema = z.enum([
  "NOT_RECORDED",
  "PENDING",
  "ANCHORED",
  "ANCHOR_FAILED",
  "NOT_FOUND",
]);
export type AnchorState = z.infer<typeof AnchorStateSchema>;

export const DeliveryEvidenceSchema = z
  .object({
    tier: ProofTierSchema,
    /** §15 Where T2 is unavailable this says so, with a reason. It never downgrades quietly. */
    detail: z.string(),
    checkedAt: IsoInstantSchema.nullable(),
    source: z.string().nullable(),
  })
  .strict();

export type DeliveryEvidence = z.infer<typeof DeliveryEvidenceSchema>;

export const PaymentEvidenceSchema = z
  .object({
    settled: z.boolean(),
    txHash: z.string().nullable(),
    explorerUrl: z.string().nullable(),
    network: CaipChainIdSchema,
    amountAtomic: z.string().regex(/^\d+$/),
    asset: AssetSchema,
    payTo: EvmAddressSchema,
    /** §12.4 A project-operated seller is labelled everywhere it appears. */
    providerKind: z.enum(["THIRD_PARTY", "PROJECT_OPERATED"]),
    /** §12.3 What the provider said, kept separate from what Ambit proved. */
    providerAssertion: z.string().nullable(),
    settledAt: IsoInstantSchema.nullable(),
  })
  .strict();

export type PaymentEvidence = z.infer<typeof PaymentEvidenceSchema>;

export const AnchorEvidenceSchema = z
  .object({
    state: AnchorStateSchema,
    reason: z.string(),
    txHash: z.string().nullable(),
    blockNumber: z.number().int().nonnegative().nullable(),
  })
  .strict();

export type AnchorEvidence = z.infer<typeof AnchorEvidenceSchema>;

export const ReceiptSchema = z
  .object({
    id: z.string().min(1),
    createdAt: IsoInstantSchema,
    /** §13.1 Four things, deliberately not collapsed. */
    decision: DecisionSchema,
    payment: PaymentEvidenceSchema.nullable(),
    delivery: DeliveryEvidenceSchema,
    anchor: AnchorEvidenceSchema,
    quote: QuoteSchema.nullable(),
    digest: Sha256HexSchema.nullable(),
    intent: SpendIntentSchema,
    /** Withheld from the public view. §13.3 */
    correlationId: z.string(),
    owner: EvmAddressSchema,
  })
  .strict();

export type Receipt = z.infer<typeof ReceiptSchema>;

/* ------------------------------------------------------------------ *
 * Typed failure
 * ------------------------------------------------------------------ */

export class AmbitError extends Error {
  readonly code: ReasonCode;
  readonly httpStatus: number;
  readonly detail: string | undefined;

  constructor(code: ReasonCode, detail?: string, httpStatus = 400) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "AmbitError";
    this.code = code;
    this.detail = detail;
    this.httpStatus = httpStatus;
  }
}
