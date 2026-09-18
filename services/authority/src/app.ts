import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { AmbitStore } from "@ambit/policy-store";
import { ProofEngine } from "@ambit/proof-engine";
import { toPublicReceipt } from "@ambit/receipts";
import {
  AmbitError,
  PolicySchema,
  SpendIntentSchema,
  UMBRELLA_REASON_CLASS,
  type Receipt,
} from "@ambit/shared";
import { CredentialStore, lastMatchedKeyForm, verifyWebhookSignature } from "./dynamic/credentials.js";
import { isDynamicConfigured, executionEnabled } from "./dynamic/delegated-client.js";
import { applyWebhook, parseWebhook } from "./dynamic/webhook.js";
import { registrySummary } from "./registry.js";
import { AuthorityService } from "./service.js";

/**
 * The HTTP surface: `/propose`, `/decide`, `/execute`, `/webhooks/dynamic`, plus the read routes the
 * console and the public receipt page need.
 *
 * Authentication in phase 1 is a bearer principal header, and `LIMITATIONS.md` says so plainly: the
 * signature-and-nonce flow described in §18 is implemented in the store (`consumeNonce`) but the
 * route layer does not yet require a signed proof. Shipping that honestly labelled is the §0.9 rule
 * — *"do not claim functionality that has not executed"* — applied to our own auth.
 */

export type AppDeps = {
  store: AmbitStore;
  credentials: CredentialStore;
  proof: ProofEngine;
  env: Record<string, string | undefined>;
  now?: () => Date;
  fetchImpl?: typeof fetch;
};

const ProposeBodySchema = z
  .object({
    policyId: z.string().min(1),
    intent: SpendIntentSchema,
  })
  .strict();

/** In-memory receipt index. Phase 1; see LIMITATIONS.md on durability. */
const receipts = new Map<string, Receipt>();

export function createApp(deps: AppDeps) {
  const service = new AuthorityService({
    store: deps.store,
    credentials: deps.credentials,
    proof: deps.proof,
    env: deps.env,
    now: deps.now ?? (() => new Date()),
    ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
  });

  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => {
        // §18 CSRF: an explicit Origin check that also rejects sibling subdomains. An allowlist of
        // exact origins does that by construction — `endsWith(".example.com")` does not, which is
        // the mistake this comment exists to prevent someone making later.
        const allowed = (deps.env["ALLOWED_ORIGINS"] ?? "http://localhost:3000")
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean);
        return allowed.includes(origin) ? origin : null;
      },
      credentials: true,
    }),
  );

  /* ---------------------------------------------------------------- principal */

  /**
   * Phase 1 principal resolution. The owner address and the Dynamic user id arrive as headers.
   * This is the piece §18's "tenant isolation" depends on, and in phase 1 it is *asserted* by the
   * caller rather than *proved*. Named here so nobody mistakes it for the finished thing.
   */
  const principal = (c: Context) => {
    const owner = c.req.header("x-ambit-owner");
    const userId = c.req.header("x-ambit-user") ?? owner;
    if (!owner || !/^0x[0-9a-fA-F]{40}$/.test(owner)) {
      throw new AmbitError("NOT_POLICY_OWNER", "x-ambit-owner must be a 0x EVM address", 401);
    }
    return { owner, userId: userId! };
  };

  /* ---------------------------------------------------------------- health */

  app.get("/health", (c) =>
    c.json({
      ok: true,
      // Every one of these is a *capability label*, not a claim of success. §9: a blocked capability
      // is visible and labelled, never hidden behind a substitute.
      capabilities: {
        policyEngine: "READY",
        dynamicDelegation: isDynamicConfigured(deps.env) ? "CONFIGURED" : "NOT_CONFIGURED",
        execution: executionEnabled(deps.env) ? "ENABLED" : "DISABLED",
        delegationsHeld: deps.credentials.count(),
        anchoring: "NOT_IN_SCOPE",
        deliveryVerification: deps.proof.registered().length > 0 ? "REGISTERED" : "NONE_REGISTERED",
      },
      pauses: deps.store.listPauses(),
      providers: registrySummary(),
    }),
  );

  app.get("/rules", (c) => c.json({ rules: service.ruleCatalogue() }));

  /* ---------------------------------------------------------------- policy */

  app.put("/policy", async (c) => {
    const { owner } = principal(c);
    const body = await c.req.json();
    const policy = PolicySchema.parse(body);
    if (policy.owner.toLowerCase() !== owner.toLowerCase()) {
      throw new AmbitError("NOT_POLICY_OWNER", "a policy may only be written by its owner", 403);
    }
    deps.store.putPolicy(policy);
    const { hashPolicy } = await import("@ambit/policy-engine");
    return c.json({ policyId: policy.id, policyHash: hashPolicy(policy) });
  });

  app.get("/policy", (c) => {
    const { owner } = principal(c);
    return c.json({ policies: deps.store.listPoliciesForOwner(owner) });
  });

  /* ---------------------------------------------------------------- propose */

  /**
   * §17's SDK calls this `propose`. `/decide` is an alias for the same operation, because §8.1
   * names both routes and they are one act: proposing *is* what triggers the decision. Two routes
   * that did different things here would mean a decision could be made without being recorded.
   */
  const proposeHandler = async (c: Context) => {
    const { owner } = principal(c);
    const body = ProposeBodySchema.parse(await c.req.json());
    const result = service.propose({
      owner,
      policyId: body.policyId,
      intent: body.intent,
      requesterPrincipal: body.intent.context.requestedBy,
    });

    const { record } = result;
    if (record.decision.verdict === "BLOCK") {
      const receipt = service.refusalReceipt(record);
      receipts.set(receipt.id, receipt);
    }

    return c.json({
      decisionId: result.decisionId,
      verdict: record.decision.verdict,
      reason: record.decision.reason,
      reasonCode: record.decision.reasonCode,
      // §10.4 The umbrella class travels *alongside* the specific code, never instead of it.
      reasonClass: record.decision.reasonCode ? UMBRELLA_REASON_CLASS : null,
      rulesEvaluated: record.decision.rulesEvaluated,
      proposal: record.decision.proposal,
      policyHash: record.decision.policyHash,
      intentHash: record.decision.intentHash,
      decidedAt: record.decision.decidedAt,
    });
  };

  app.post("/propose", proposeHandler);
  app.post("/decide", proposeHandler);

  /* ---------------------------------------------------------------- execute */

  app.post("/execute/:id", async (c) => {
    const { owner, userId } = principal(c);
    const receipt = await service.execute(owner, c.req.param("id"), userId);
    receipts.set(receipt.id, receipt);
    return c.json({
      receiptId: receipt.id,
      txHash: receipt.payment?.txHash ?? null,
      explorerUrl: receipt.payment?.explorerUrl ?? null,
      delivery: receipt.delivery,
      anchor: receipt.anchor,
    });
  });

  /* ---------------------------------------------------------------- decisions */

  app.get("/decisions", (c) => {
    const { owner } = principal(c);
    return c.json({
      decisions: deps.store.listDecisionsForOwner(owner, 50).map((record) => ({
        id: record.id,
        createdAt: record.createdAt,
        verdict: record.decision.verdict,
        reason: record.decision.reason,
        reasonCode: record.decision.reasonCode,
        execution: record.execution,
        amount: record.intent.amount,
        asset: record.intent.asset,
        recipient: record.intent.recipient,
        capability: record.intent.capability,
        digest: record.digest,
      })),
    });
  });

  /**
   * §10.2 The ledger. **Reserved authority and settled spend are reported separately and never
   * summed**, because they are different facts: a decision reserves budget, it does not move money,
   * and no surface may report a reservation as spend.
   *
   * The two totals come from separate accessors on the store for exactly that reason — there is no
   * query that could accidentally add them together and call the result "spent".
   */
  app.get("/ledger", (c) => {
    const { owner } = principal(c);
    const now = (deps.now ?? (() => new Date()))().toISOString();

    const decisions = deps.store.listDecisionsForOwner(owner, 200);
    const entries = decisions.map((record) => {
      const reservation = record.decision.proposal
        ? deps.store.getReservation(record.decision.proposal.reservationId)
        : undefined;
      return {
        id: record.id,
        createdAt: record.createdAt,
        capability: record.intent.capability,
        amount: record.intent.amount,
        asset: record.intent.asset,
        recipient: record.intent.recipient,
        verdict: record.decision.verdict,
        reasonCode: record.decision.reasonCode,
        execution: record.execution,
        /** HELD, SETTLED, RELEASED — or null where the decision reserved nothing (a BLOCK). */
        reservationState: reservation?.state ?? null,
        amountAtomic: record.decision.proposal?.budgetDeltaAtomic ?? null,
        expiresAt: record.decision.proposal?.expiresAt ?? null,
      };
    });

    return c.json({
      asOf: now,
      // Kept apart deliberately. See the note above.
      settledTodayAtomic: deps.store.settledToday(owner, now).toString(),
      reservedTodayAtomic: deps.store.reservedToday(owner, now).toString(),
      entries,
    });
  });

  /* ---------------------------------------------------------------- receipts */

  /** §13.3 The public receipt. No account needed, and built from the field allowlist. */
  app.get("/receipt/:id", (c) => {
    const receipt = receipts.get(c.req.param("id"));
    if (receipt === undefined) {
      // §13.2 NOT_FOUND is distinguished from PENDING. A missing receipt is an inconsistency,
      // not something to wait for.
      return c.json(
        { error: "NOT_FOUND", detail: "no receipt exists under that id. This is not a pending state." },
        404,
      );
    }
    return c.json(toPublicReceipt(receipt));
  });

  /* ---------------------------------------------------------------- delegation */

  app.get("/delegation/status", (c) => {
    const { userId } = principal(c);
    const status = deps.credentials.status(userId);
    return c.json({
      ...status,
      // The authoritative answer, as SURFACE.md explains: the client's `hasDelegatedAccess` reports
      // the browser's view, and only the server knows whether the webhook arrived and decrypted.
      source: "authority-service",
      dynamicConfigured: isDynamicConfigured(deps.env),
    });
  });

  /**
   * The delegation liveness probe — `engineering/00-dynamic-delegation-spike` LOCK condition 4.
   *
   * Signs a fixed, harmless message with the user's delegated share and returns the signature. It
   * proves the credentials are **usable**, not merely decryptable, and it does so **without needing
   * a funded wallet** — which matters because an unfunded wallet and a broken delegation look
   * identical if the only test you have is a payment.
   *
   * It moves no money and touches no policy: `delegatedSignMessage` signs a string, it does not
   * authorise a transfer. The message names itself and carries the instant, so a signature captured
   * here can never be replayed as anything meaningful.
   */
  app.post("/delegation/probe", async (c) => {
    const { userId } = principal(c);

    if (!isDynamicConfigured(deps.env)) {
      throw new AmbitError("CONFIG_INCOMPLETE", "Dynamic is not configured", 503);
    }

    const credentials = deps.credentials.open(userId, deps.env["CREDENTIAL_ENCRYPTION_KEY"]);
    const now = (deps.now ?? (() => new Date()))().toISOString();
    const message = `ambit-delegation-probe ${now}`;

    const { createClient, readDynamicConfig, signProbeMessage } = await import("./dynamic/delegated-client.js");

    let signature: string;
    try {
      signature = await signProbeMessage(createClient(readDynamicConfig(deps.env)), credentials, message);
    } catch (sdkError) {
      /**
       * The SDK surfaces a failed call with the response body still an unread `ReadableStream`, so
       * its message is only ever "Forbidden" — the status text, not Dynamic's explanation. This
       * repeats the request directly with the same two credentials and reads the body, which is the
       * only way to learn *why* the call was refused.
       *
       * It is a diagnostic, not a fallback: it cannot succeed where the SDK failed, and its result
       * is logged rather than returned. The original error is always what propagates.
       */
      const cfg = readDynamicConfig(deps.env);
      const url = `https://app.dynamicauth.com/api/v0/environments/${cfg.environmentId}/waas/${credentials.walletId}/delegatedAccess/signMessage`;
      try {
        const raw = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${cfg.apiKey}`,
            "x-dyn-wallet-api-key": credentials.walletApiKey,
          },
          body: JSON.stringify({ message, isFormatted: false }),
          signal: AbortSignal.timeout(20_000),
        });
        const body = (await raw.text()).slice(0, 600);
        console.warn(`[dynamic probe] direct call -> ${raw.status} ${raw.statusText} body=${body}`);
      } catch (probeError) {
        console.warn(
          `[dynamic probe] direct call failed: ${probeError instanceof Error ? probeError.message : String(probeError)}`,
        );
      }
      throw sdkError;
    }

    return c.json({
      ok: true,
      message,
      // The signature is evidence and is safe to show. The key share that produced it is not, and
      // is never included in any response (§18).
      signature,
      walletAddress: credentials.walletAddress,
      signedAt: now,
    });
  });

  /* ---------------------------------------------------------------- webhook */

  app.post("/webhooks/dynamic", async (c) => {
    // §18 Verified **before the body is parsed**. The raw text is needed anyway, because Dynamic's
    // HMAC is computed over the exact bytes it sent — re-serialising parsed JSON would change them.
    const rawBody = await c.req.text();
    const verified = verifyWebhookSignature({
      rawBody,
      signatureHeader:
        c.req.header("x-dynamic-signature-256") ?? c.req.header("x-dynamic-signature") ?? null,
      secretHeader: c.req.header("x-webhook-secret") ?? null,
      secret: deps.env["DYNAMIC_WEBHOOK_SECRET"],
    });
    if (!verified) {
      /**
       * Diagnostic for a rejected delivery.
       *
       * Logs the header NAMES and the body's event name — never a header value, because the
       * signature and any shared secret are exactly what must not reach a log (§18). Without this,
       * a 401 from a real Dynamic delivery is indistinguishable from a wrong secret, a wrong
       * header name, or a body that was re-serialised somewhere in the proxy chain.
       */
      const headerNames = [...new Headers(c.req.raw.headers).keys()].sort();
      let eventName = "unparseable";
      try {
        eventName = String((JSON.parse(rawBody) as { eventName?: string }).eventName ?? "none");
      } catch {
        /* body is not JSON; the header list is still the useful part */
      }
      console.warn(
        `[webhook] rejected delivery: event=${eventName} bytes=${rawBody.length} headers=${headerNames.join(",")}`,
      );
      return c.json({ error: "UNAUTHORIZED", detail: "webhook signature did not verify" }, 401);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "INVALID_REQUEST", detail: "webhook body is not JSON" }, 400);
    }

    // Records which secret derivation verified, so the convention can be pinned once observed.
    console.log(`[webhook] accepted delivery, hmac key form: ${lastMatchedKeyForm ?? "shared-secret"}`);

    let parsed;
    try {
      parsed = parseWebhook(body, deps.env["DELEGATION_PRIVATE_KEY"]);
    } catch (error) {
      /**
       * A verified delivery that will not parse. Logs the reason and the envelope's *shape* —
       * top-level keys, and the keys of `data` — never a value, because `data` carries the encrypted
       * credentials. Without this a 400 here is silent, and an accepted-but-unparseable delivery is
       * the hardest state to diagnose: the signature was right, so everything upstream looks fine.
       */
      const shape = (() => {
        try {
          const b = body as Record<string, unknown>;
          const data = (b?.["data"] ?? {}) as Record<string, unknown>;
          const dataKeys = Object.keys(data)
            .map((k) => `${k}:${Array.isArray(data[k]) ? "array" : typeof data[k]}`)
            .join(",");
          return `top=[${Object.keys(b ?? {}).join(",")}] data=[${dataKeys}]`;
        } catch {
          return "unreadable";
        }
      })();

      // Everything an error might carry. The previous version printed only `String(error)`, which
      // for a zod failure renders as an empty-looking array and says nothing about what was wrong.
      const e = error as {
        name?: string;
        message?: string;
        code?: unknown;
        detail?: unknown;
        issues?: unknown;
        stack?: string;
      };
      const parts = [
        `name=${e?.name ?? typeof error}`,
        `message=${JSON.stringify(e?.message ?? String(error))}`,
        e?.code !== undefined ? `code=${String(e.code)}` : "",
        e?.detail !== undefined ? `detail=${JSON.stringify(e.detail)}` : "",
        e?.issues !== undefined ? `issues=${JSON.stringify(e.issues)}` : "",
      ].filter(Boolean);
      console.warn(`[webhook] verified but unparseable: ${parts.join(" ")} | ${shape}`);
      if (e?.stack) console.warn(e.stack.split("\n").slice(0, 4).join(" | "));
      throw error;
    }
    const result = applyWebhook(
      parsed,
      deps.credentials,
      deps.env["CREDENTIAL_ENCRYPTION_KEY"],
      (deps.now ?? (() => new Date()))().toISOString(),
    );
    return c.json(result);
  });

  /* ---------------------------------------------------------------- pauses */

  app.post("/admin/pause", async (c) => {
    const body = await c.req.json();
    const scope = z.string().min(1).parse(body?.scope);
    deps.store.pause(scope);
    return c.json({ paused: deps.store.listPauses() });
  });

  app.post("/admin/resume", async (c) => {
    const body = await c.req.json();
    const scope = z.string().min(1).parse(body?.scope);
    deps.store.resume(scope);
    return c.json({ paused: deps.store.listPauses() });
  });

  /* ---------------------------------------------------------------- errors */

  /**
   * §10.4 Every refusal carries a specific reason code. This handler is what guarantees that no
   * route can return a bare 500 with a stack trace in place of a named refusal.
   */
  app.onError((error, c) => {
    if (error instanceof AmbitError) {
      return c.json(
        {
          error: error.code,
          reasonClass: UMBRELLA_REASON_CLASS,
          detail: error.detail ?? null,
        },
        error.httpStatus as 400,
      );
    }
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: "INVALID_REQUEST",
          detail: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        },
        400,
      );
    }
    // Unexpected failures are not dressed up as policy refusals. An internal error is its own thing
    // and saying so is more useful than mapping it onto the nearest reason code.
    return c.json({ error: "INTERNAL", detail: error.message }, 500);
  });

  return app;
}

export { receipts as receiptIndex };
