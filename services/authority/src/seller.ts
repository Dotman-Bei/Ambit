import { Hono } from "hono";
import { AmbitError } from "@ambit/shared";

/**
 * §12.4 / §28 kill-criterion 3: the Ambit-operated x402 seller route.
 *
 * *"If it is Ambit-operated, it is labelled `PROJECT_OPERATED` everywhere it appears and never
 * described as a third-party integration."* It is labelled in the registry, on every receipt, and
 * §28 requires it to be said on camera as well.
 *
 * What this is: a genuine x402 seller. It emits a real 402 with a real challenge, it requires a real
 * EIP-3009 signature over the exact terms, and it settles through a real facilitator. What it is
 * **not** is evidence of third-party adoption, and §22.1 says so in the README.
 *
 * ---
 *
 * The settlement step is where honesty matters most. This route does not verify or settle payments
 * itself — it forwards the payload to an x402 facilitator. If no facilitator is configured, it
 * **refuses with a named reason and returns no resource**. It does not accept the payment on trust
 * and it does not fabricate a transaction hash. A seller that returned 200 with an invented hash
 * would make the whole product a lie, and it is the single easiest lie to tell in this codebase.
 */

export type SellerConfig = {
  payTo: string;
  network: string;
  assetAddress: string;
  priceAtomic: string;
  /** The x402 facilitator that verifies and settles. Without it, this route refuses. */
  facilitatorUrl: string | undefined;
  domainName: string;
  domainVersion: string;
};

export function readSellerConfig(env: Record<string, string | undefined>): SellerConfig {
  return {
    payTo: env["SELLER_PAY_TO"] ?? "",
    network: env["SELLER_NETWORK"] ?? "base-sepolia",
    assetAddress: env["SELLER_ASSET_ADDRESS"] ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    priceAtomic: env["SELLER_PRICE_ATOMIC"] ?? "50000",
    facilitatorUrl: env["X402_FACILITATOR_URL"],
    domainName: env["SELLER_DOMAIN_NAME"] ?? "USDC",
    domainVersion: env["SELLER_DOMAIN_VERSION"] ?? "2",
  };
}

export function createSellerApp(env: Record<string, string | undefined>) {
  const app = new Hono();
  const config = readSellerConfig(env);

  app.get("/x402/domains/check", async (c) => {
    const payment = c.req.header("X-PAYMENT");

    if (!payment) {
      // A real x402 challenge, in the response body, exactly as `x402@1.2.0` documents.
      return c.json(
        {
          x402Version: 1,
          accepts: [
            {
              scheme: "exact",
              network: config.network,
              maxAmountRequired: config.priceAtomic,
              resource: new URL("/x402/domains/check", c.req.url).href,
              description: "domain availability check (PROJECT_OPERATED seller)",
              mimeType: "application/json",
              payTo: config.payTo,
              maxTimeoutSeconds: 120,
              asset: config.assetAddress,
              extra: { name: config.domainName, version: config.domainVersion },
            },
          ],
        },
        402,
      );
    }

    if (config.facilitatorUrl === undefined || config.payTo === "") {
      // §0.4 and §12.4: a gated capability refuses with a named reason. It does not accept the
      // payment on trust and it does not return the resource for free while claiming it was paid for.
      throw new AmbitError(
        "CONFIG_INCOMPLETE",
        "this seller has no facilitator configured (X402_FACILITATOR_URL) or no payee (SELLER_PAY_TO), " +
          "so it cannot verify or settle a payment. It refuses rather than accepting the payment on " +
          "trust and returning a resource it was not paid for.",
        503,
      );
    }

    const decoded = JSON.parse(Buffer.from(payment, "base64").toString("utf8"));
    const requirements = {
      scheme: "exact",
      network: config.network,
      maxAmountRequired: config.priceAtomic,
      resource: new URL("/x402/domains/check", c.req.url).href,
      description: "domain availability check (PROJECT_OPERATED seller)",
      mimeType: "application/json",
      payTo: config.payTo,
      maxTimeoutSeconds: 120,
      asset: config.assetAddress,
      extra: { name: config.domainName, version: config.domainVersion },
    };

    const settle = await fetch(new URL("/settle", config.facilitatorUrl).href, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ x402Version: 1, paymentPayload: decoded, paymentRequirements: requirements }),
      signal: AbortSignal.timeout(30_000),
    });

    const settlement = (await settle.json()) as {
      success?: boolean;
      transaction?: string;
      errorReason?: string;
    };

    if (!settle.ok || settlement.success !== true || !settlement.transaction) {
      // The facilitator refused. This is the correct outcome for an underpaid or misdirected
      // payment — spike 01 LOCK condition 4 exists to see it happen.
      return c.json(
        { x402Version: 1, error: settlement.errorReason ?? "settlement failed", accepts: [requirements] },
        402,
      );
    }

    c.header(
      "X-PAYMENT-RESPONSE",
      Buffer.from(
        JSON.stringify({
          success: true,
          transaction: settlement.transaction,
          network: config.network,
        }),
      ).toString("base64"),
    );

    return c.json({
      capability: "domains.check",
      // The resource itself. Deliberately dull: the product is the authority layer, not the lookup.
      result: { domain: "example.test", available: true, checkedAt: new Date().toISOString() },
      sellerKind: "PROJECT_OPERATED",
    });
  });

  app.onError((error, c) => {
    if (error instanceof AmbitError) {
      return c.json({ error: error.code, detail: error.detail ?? null }, error.httpStatus as 503);
    }
    return c.json({ error: "INTERNAL", detail: error.message }, 500);
  });

  return app;
}
