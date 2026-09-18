import type { ProviderRegistryEntry } from "@ambit/payments-x402";

/**
 * §18 SSRF control: *"provider base URLs come only from the registry table. Nothing user-supplied
 * becomes a fetch target."*
 *
 * The registry is the *only* source of a URL the authority service will fetch. A `SpendIntent`
 * names a provider and a capability — two lookup keys — and never a URL. That is why the intent
 * schema in `@ambit/shared` has no URL field: it is not that URLs are validated, it is that there
 * is nowhere to put one.
 */

export const PROVIDER_REGISTRY: readonly ProviderRegistryEntry[] = [
  /**
   * §12.4 and §28 kill-criterion 3: preference order is a real third-party x402 endpoint first,
   * then an Ambit-operated seller **clearly labelled** `PROJECT_OPERATED`.
   *
   * This entry is the project-operated seller. It is labelled here, that label travels onto every
   * receipt through `PaymentEvidence.providerKind`, and §28 requires it to be said on camera too.
   * *"A labelled project-operated payment is still a real payment. An unlabelled one is a
   * misrepresentation."*
   *
   * When a third-party endpoint is confirmed live, it is added here with kind THIRD_PARTY and the
   * demo uses it in preference. Nothing else in the code changes.
   */
  {
    id: "ambit-seller",
    baseUrl: process.env["AMBIT_SELLER_BASE_URL"] ?? "http://127.0.0.1:4021/",
    kind: "PROJECT_OPERATED",
    capabilities: {
      "domains.check": "x402/domains/check",
    },
  },
];

export function findProvider(id: string): ProviderRegistryEntry | undefined {
  return PROVIDER_REGISTRY.find((entry) => entry.id === id);
}

/** The registry as the console shows it — with the label, never without. */
export function registrySummary(): Array<{ id: string; kind: string; capabilities: string[]; baseUrl: string }> {
  return PROVIDER_REGISTRY.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    capabilities: Object.keys(entry.capabilities),
    baseUrl: entry.baseUrl,
  }));
}
