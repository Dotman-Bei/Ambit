import type { DeliveryEvidence } from "@ambit/shared";
import { deliveryIndependent, deliveryNotVerified, deliveryProviderAttested } from "@ambit/receipts";

/**
 * §15 Delivery verification. Independent proof that the thing was delivered, not the vendor's word.
 *
 * Phase 2. What ships in phase 1 is the *tier discipline*: the three tiers exist, the engine reports
 * which one it reached, and `T2_INDEPENDENT` is the only tier that satisfies `proof.tierRequired`.
 * A capability with no independent source available returns `T0_NONE` with a reason rather than
 * falling back to the provider's claim — §15 names that fallback as the thing not to do.
 */

export type VerifierContext = {
  /** What the provider returned. Available to a verifier as a *subject*, never as evidence. */
  providerResponse: string;
  /** The resource that was paid for. */
  resource: string;
  now: string;
  fetchImpl?: typeof fetch;
};

export type Verifier = {
  capability: string;
  /** The best tier this verifier can reach. */
  tier: "T1_ATTESTED" | "T2_INDEPENDENT";
  /** Names the source, so `deliveryIndependent` can record who was asked. */
  source: string;
  verify(context: VerifierContext): Promise<DeliveryEvidence>;
};

/**
 * A public HTTP probe: fetch the resource independently and report what an unrelated caller sees.
 *
 * This is T2 because the answer comes from the resource itself rather than from the merchant's
 * response to us. It is a narrow kind of independence and the detail string says so — it proves the
 * resource resolves, not that its contents are correct.
 */
export function httpProbeVerifier(capability: string, probeUrl: string): Verifier {
  return {
    capability,
    tier: "T2_INDEPENDENT",
    source: probeUrl,
    async verify(context) {
      const doFetch = context.fetchImpl ?? fetch;
      try {
        const response = await doFetch(probeUrl, {
          method: "GET",
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          return deliveryNotVerified(
            `T0_NONE — the independent probe of ${probeUrl} returned ${response.status}, so delivery is unconfirmed. ` +
              `The provider's own response is not substituted here (§15).`,
          );
        }
        return deliveryIndependent(
          `an independent GET of ${probeUrl} returned ${response.status}. This confirms the resource resolves; ` +
            `it does not confirm the contents are correct.`,
          probeUrl,
          context.now,
        );
      } catch (cause) {
        return deliveryNotVerified(
          `T0_NONE — the independent probe of ${probeUrl} failed (${cause instanceof Error ? cause.message : String(cause)}). ` +
            `Delivery is unconfirmed and the provider's claim is not substituted (§15).`,
        );
      }
    },
  };
}

/** The provider's own claim, correctly labelled. Never satisfies `proof.tierRequired`. */
export function attestationVerifier(capability: string): Verifier {
  return {
    capability,
    tier: "T1_ATTESTED",
    source: "provider",
    async verify(context) {
      return deliveryProviderAttested(context.providerResponse.slice(0, 200), context.now);
    },
  };
}

export class ProofEngine {
  readonly #verifiers = new Map<string, Verifier>();

  register(verifier: Verifier): void {
    this.#verifiers.set(verifier.capability, verifier);
  }

  /**
   * Verifies delivery for a capability.
   *
   * With no verifier registered the answer is `T0_NONE` **with the reason**, which is the phase 1
   * state for every capability. §29.5: *"Delivery verification is not universal. Where an
   * independent source does not exist, the receipt says T0_NONE."*
   */
  async verify(capability: string, context: VerifierContext): Promise<DeliveryEvidence> {
    const verifier = this.#verifiers.get(capability);
    if (verifier === undefined) {
      return deliveryNotVerified(
        `T0_NONE — no independent verifier is registered for "${capability}". Delivery verification is ` +
          `phase 2 (§15) and is not claimed for this capability. The provider's response is recorded ` +
          `separately as its own assertion, not as verification.`,
      );
    }
    return verifier.verify(context);
  }

  /** §10.1 rule 14's input: the best tier actually available for this capability, or null. */
  availableTier(capability: string): "T1_ATTESTED" | "T2_INDEPENDENT" | null {
    return this.#verifiers.get(capability)?.tier ?? null;
  }

  registered(): string[] {
    return [...this.#verifiers.keys()].sort();
  }
}
