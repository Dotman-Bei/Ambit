"use client";

/**
 * The console's read layer.
 *
 * Every console page talks to the authority service through these helpers, so the principal headers
 * are set in one place. The public receipt page deliberately does **not** use this: it goes to the
 * public endpoint instead, because the server handler is the single definition of which fields may
 * be published, and a second field-selection in a page component is a second place to forget.
 */

export const API = process.env.NEXT_PUBLIC_AMBIT_API ?? "http://127.0.0.1:4020";

/**
 * Phase 1 principal. The owner address is asserted by the caller rather than proved — see
 * SECURITY.md's open issue and DECISIONS.md D-009. It is stored per browser so a demo can switch
 * wallets without rebuilding, and it is not a credential.
 */
export const DEMO_OWNER = "0x1111111111111111111111111111111111111111";

export function owner(): string {
  try {
    return localStorage.getItem("ambit.owner") ?? DEMO_OWNER;
  } catch {
    return DEMO_OWNER;
  }
}

export function setOwner(value: string): void {
  try {
    localStorage.setItem("ambit.owner", value);
  } catch {
    // Private mode. The session still works; the choice just is not remembered.
  }
}

/**
 * The Dynamic user id of the signed-in user.
 *
 * This must match the `userId` the delegation webhook carried, because that is the key the
 * authority service stores credentials under. A hardcoded placeholder here meant the credentials
 * were stored correctly and then looked up under a different name — `delegationsHeld: 1` on the
 * server while the console read `granted: false`, which looks exactly like a webhook failure and is
 * not one.
 *
 * Written by the auth bar once Dynamic reports a user; read on every request.
 */
export function userId(): string {
  try {
    return localStorage.getItem("ambit.userId") ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

export function setUserId(value: string): void {
  try {
    localStorage.setItem("ambit.userId", value);
  } catch {
    /* private mode; the session still works, the id just is not remembered */
  }
}

/**
 * Forget the signed-in user.
 *
 * Without this, signing out leaves the previous id in storage and every later request asks the
 * authority service about someone who is no longer here — which reads as a delegation that will not
 * load rather than as a stale session.
 */
export function clearUserId(): void {
  try {
    localStorage.removeItem("ambit.userId");
  } catch {
    /* nothing to clear */
  }
}

export function headers(): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-ambit-owner": owner(),
    "x-ambit-user": userId(),
  };
}

export type Fetched<T> =
  | { state: "loading" }
  | { state: "ok"; data: T }
  | { state: "unreachable"; detail: string }
  | { state: "error"; code: string; detail: string };

export async function get<T>(path: string): Promise<Fetched<T>> {
  try {
    const res = await fetch(`${API}${path}`, { headers: headers(), cache: "no-store" });
    const body = (await res.json()) as T & { error?: string; detail?: string };
    if (!res.ok) {
      return { state: "error", code: body.error ?? String(res.status), detail: body.detail ?? "" };
    }
    return { state: "ok", data: body };
  } catch (cause) {
    return { state: "unreachable", detail: cause instanceof Error ? cause.message : String(cause) };
  }
}

export async function post<T>(path: string, body?: unknown): Promise<Fetched<T>> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: headers(),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const parsed = (await res.json()) as T & { error?: string; detail?: string };
    if (!res.ok) {
      return { state: "error", code: parsed.error ?? String(res.status), detail: parsed.detail ?? "" };
    }
    return { state: "ok", data: parsed };
  } catch (cause) {
    return { state: "unreachable", detail: cause instanceof Error ? cause.message : String(cause) };
  }
}

export async function put<T>(path: string, body: unknown): Promise<Fetched<T>> {
  try {
    const res = await fetch(`${API}${path}`, { method: "PUT", headers: headers(), body: JSON.stringify(body) });
    const parsed = (await res.json()) as T & { error?: string; detail?: string };
    if (!res.ok) {
      return { state: "error", code: parsed.error ?? String(res.status), detail: parsed.detail ?? "" };
    }
    return { state: "ok", data: parsed };
  } catch (cause) {
    return { state: "unreachable", detail: cause instanceof Error ? cause.message : String(cause) };
  }
}

/* ------------------------------------------------------------------ shapes */

export type Health = {
  capabilities: Record<string, string | number>;
  pauses: string[];
  providers: Array<{ id: string; kind: string; capabilities: string[]; baseUrl: string }>;
};

export type Delegation = {
  granted: boolean;
  walletAddress: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
  dynamicConfigured: boolean;
};

export type DecisionRow = {
  id: string;
  createdAt: string;
  verdict: "ALLOW" | "ESCALATE" | "BLOCK";
  reason: string;
  reasonCode: string | null;
  execution: string;
  amount: string;
  asset: string;
  recipient: string;
  capability: string;
  digest: string | null;
};

export type RuleCatalogueEntry = {
  ordinal: number;
  id: string;
  enforces: string;
  phase: string;
  enforced: boolean;
};

export type PolicyShape = {
  id: string;
  owner: string;
  expiresAt: string;
  hardCapAbsolute: string;
  perCallCap: string;
  dailyBudget: string;
  rateLimitPerHour: number;
  duplicateWindowSeconds: number;
  cooldownSecondsPerService: number;
  recipientAllowList: string[];
  recipientDenyList: string[];
  workerDenyList: string[];
  categoryDenyList: string[];
  escalateAboveAmount?: string;
  asset: string;
  network: string;
};
