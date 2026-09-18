import type { AnchorEvidence, DeliveryEvidence, PaymentEvidence, Receipt } from "@ambit/shared";

/**
 * §13 Receipts. Four things, deliberately not collapsed: decision, payment, delivery, anchor.
 *
 * *"A page that shows one and implies the others is the exact defect this section exists to
 * prevent."* Everything in this module is arranged so that implying is harder than stating.
 */

/**
 * §13.3 The public view is built by **naming** the fields that may be published, never by deleting
 * fields from the private one.
 *
 * The difference is not stylistic. A denylist means every field added later is public until someone
 * remembers to hide it, and the failure is silent. An allowlist means every field added later is
 * private until someone decides otherwise, and the failure is a missing field somebody notices.
 */
export const PUBLIC_RECEIPT_FIELDS = [
  "id",
  "createdAt",
  "decision",
  "payment",
  "delivery",
  "anchor",
  "quote",
  "digest",
] as const;

/** §13.3 Withheld, and named here so the reason is on the record rather than in someone's memory. */
export const WITHHELD_FIELDS: Readonly<Record<string, string>> = {
  intent: "the raw request payload can carry task detail the requester did not publish",
  correlationId: "correlates a user's requests across receipts",
  owner: "the wallet owner's address is theirs to disclose",
  approvalChannel: "which channel resolved an approval is operational detail, not evidence",
};

export type PublicReceipt = Pick<Receipt, (typeof PUBLIC_RECEIPT_FIELDS)[number]>;

export function toPublicReceipt(receipt: Receipt): PublicReceipt {
  const out = {} as Record<string, unknown>;
  for (const field of PUBLIC_RECEIPT_FIELDS) {
    out[field] = receipt[field];
  }
  return out as PublicReceipt;
}

/* ------------------------------------------------------------------ *
 * Constructors for the states that are easy to get wrong
 * ------------------------------------------------------------------ */

/**
 * §13.2 Anchor states are never a nullable id. `NOT_RECORDED` carries the reason.
 *
 * *"The record is authoritative either way. Anchoring is publication, not truth."*
 */
export function anchorNotInScope(): AnchorEvidence {
  return {
    state: "NOT_RECORDED",
    reason:
      "ANCHORING_NOT_IN_SCOPE — on-chain anchoring is phase 3 (§16) and is not built. " +
      "The record is authoritative regardless: anchoring is publication, not truth.",
    txHash: null,
    blockNumber: null,
  };
}

/**
 * §15 Where an independent source does not exist, the receipt says `T0_NONE` with a reason.
 * It does not quietly downgrade to the provider's claim while still displaying a verified badge.
 */
export function deliveryNotVerified(reason: string): DeliveryEvidence {
  return { tier: "T0_NONE", detail: reason, checkedAt: null, source: null };
}

/**
 * §15 A provider's own claim, labelled as such. Never merged with a T2 result.
 *
 * The parameter is named `providerClaim` rather than `evidence` on purpose: at every call site the
 * code reads as recording what someone said, not what was established.
 */
export function deliveryProviderAttested(providerClaim: string, checkedAt: string): DeliveryEvidence {
  return {
    tier: "T1_ATTESTED",
    detail: `PROVIDER_ATTESTED — the provider states: ${providerClaim}. This is the merchant's own claim and is not independent verification.`,
    checkedAt,
    source: "provider",
  };
}

export function deliveryIndependent(detail: string, source: string, checkedAt: string): DeliveryEvidence {
  return { tier: "T2_INDEPENDENT", detail, checkedAt, source };
}

export type PaymentEvidenceInput = {
  txHash: string | null;
  network: string;
  amountAtomic: string;
  payTo: string;
  providerKind: "THIRD_PARTY" | "PROJECT_OPERATED";
  providerAssertion: string | null;
  settledAt: string | null;
};

/**
 * §12.3 Two counterparty channels are never merged. What the provider says lives in
 * `providerAssertion`; what Ambit proved lives in `txHash`. `settled` is true only when there is a
 * hash, so a provider's cheerful 200 cannot by itself mark a payment as settled.
 */
export function paymentEvidence(input: PaymentEvidenceInput): PaymentEvidence {
  return {
    settled: input.txHash !== null,
    txHash: input.txHash,
    explorerUrl: input.txHash ? explorerUrlFor(input.network, input.txHash) : null,
    network: input.network as PaymentEvidence["network"],
    amountAtomic: input.amountAtomic,
    asset: "USDC",
    payTo: input.payTo as PaymentEvidence["payTo"],
    providerKind: input.providerKind,
    providerAssertion: input.providerAssertion,
    settledAt: input.settledAt,
  };
}

const EXPLORERS: Readonly<Record<string, string>> = {
  "eip155:8453": "https://basescan.org/tx/",
  "eip155:84532": "https://sepolia.basescan.org/tx/",
};

/** Returns null rather than a guessed URL: a link that 404s is worse than no link. */
export function explorerUrlFor(network: string, txHash: string): string | null {
  const base = EXPLORERS[network];
  return base ? `${base}${txHash}` : null;
}

/* ------------------------------------------------------------------ *
 * The honesty check
 * ------------------------------------------------------------------ */

export type ReceiptDefect = { field: string; problem: string };

/**
 * §13.1's defect, made checkable: a receipt that shows one kind of evidence and implies another.
 *
 * This runs in tests and in the campaign runner. It is not a validator in the schema sense — the
 * types already guarantee shape — it is a check on whether the receipt *claims more than it proves*.
 */
export function findReceiptDefects(receipt: Receipt): ReceiptDefect[] {
  const defects: ReceiptDefect[] = [];

  if (receipt.payment?.settled === true && receipt.payment.txHash === null) {
    defects.push({
      field: "payment",
      problem: "marked settled with no transaction hash — a provider's assertion is not settlement",
    });
  }

  if (receipt.decision.verdict === "BLOCK" && receipt.payment !== null) {
    defects.push({
      field: "payment",
      problem: "a BLOCK carries payment evidence — a refusal must produce zero movement",
    });
  }

  if (receipt.decision.verdict === "BLOCK" && receipt.decision.reasonCode === null) {
    defects.push({
      field: "decision.reasonCode",
      problem: "a BLOCK without a named rule-level reason code (§10.4)",
    });
  }

  if (receipt.delivery.tier === "T2_INDEPENDENT" && receipt.delivery.source === null) {
    defects.push({
      field: "delivery",
      problem: "claims independent verification without naming the independent source",
    });
  }

  if (receipt.delivery.tier === "T1_ATTESTED" && !receipt.delivery.detail.includes("PROVIDER_ATTESTED")) {
    defects.push({
      field: "delivery",
      problem: "a provider claim that is not labelled PROVIDER_ATTESTED (§15)",
    });
  }

  if (receipt.anchor.state === "ANCHORED" && receipt.anchor.txHash === null) {
    defects.push({ field: "anchor", problem: "claims ANCHORED with no anchor transaction" });
  }

  if (receipt.anchor.state === "NOT_RECORDED" && receipt.anchor.reason.trim() === "") {
    defects.push({ field: "anchor", problem: "NOT_RECORDED must carry the reason (§13.2)" });
  }

  const enforcedButUnlabelled = receipt.decision.rulesEvaluated.filter(
    (rule) => rule.result === "RULE_NOT_ENFORCED" && !rule.detail.toLowerCase().includes("not enforced"),
  );
  for (const rule of enforcedButUnlabelled) {
    defects.push({
      field: `decision.rulesEvaluated.${rule.id}`,
      problem: "a rule that is not enforced must say so in its detail (§10.1)",
    });
  }

  return defects;
}
