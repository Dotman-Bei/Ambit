"use client";

import { useState } from "react";
import { useLogout, useSendEmailOTP, useUser, useVerifyOTP } from "@dynamic-labs-sdk/react-hooks";
import { isConfigured } from "./dynamic-client";
import { clearUserId } from "../console/api";

/**
 * Email sign-in, through the hooks of the same SDK generation that performs delegation.
 *
 * The flow is Dynamic's documented one: `sendEmailOTP` then `verifyOTP`. Errors are reported with
 * their phase and any `code`/`status` the SDK attaches, because "Elevated access token required"
 * on its own sent this integration down two wrong paths.
 */
export function SignIn({ onSignedIn, signedIn }: { onSignedIn: () => void; signedIn: boolean }) {
  const user = useUser();
  const sendOtp = useSendEmailOTP();
  const verifyOtp = useVerifyOTP();
  const logout = useLogout();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isConfigured()) {
    return (
      <div className="well">
        <span className="tag caution">not configured</span>
        <p className="note" style={{ marginTop: ".5rem" }}>
          <code>NEXT_PUBLIC_DYNAMIC_ENV_ID</code> is not set in this build.
        </p>
      </div>
    );
  }

  const report = (phase: string, cause: unknown) => {
    const e = cause as { name?: string; message?: string };
    const extras: string[] = [];
    for (const k of ["code", "status", "scope"]) {
      const v = (cause as Record<string, unknown>)?.[k];
      if (v !== undefined && typeof v !== "object") extras.push(`${k}=${String(v)}`);
    }
    setError(`[${phase}] ${e?.name ?? "Error"}: ${e?.message ?? String(cause)}${extras.length ? ` — ${extras.join(" ")}` : ""}`);
    console.error("ambit sign-in failure", cause);
  };

  if (signedIn || user.data) {
    return (
      <div style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
        <span className="tag inside">signed in</span>
        <button
          className="ghost"
          onClick={async () => {
            try {
              await logout.mutateAsync(undefined as never);
              clearUserId();
              setSent(null);
              setCode("");
              setEmail("");
              onSignedIn();
            } catch (cause) {
              report("logout", cause);
            }
          }}
        >
          Sign out
        </button>
        {error ? (
          <div className="well" style={{ width: "100%" }}>
            <span className="tag never">error</span>
            <p className="note" style={{ marginTop: ".4rem" }}>{error}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: ".8rem", maxWidth: "22rem" }}>
      {sent === null ? (
        <>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <button
            disabled={sendOtp.isPending || email.trim() === ""}
            onClick={async () => {
              setError(null);
              try {
                setSent(await sendOtp.mutateAsync({ email: email.trim() } as never));
              } catch (cause) {
                report("send", cause);
              }
            }}
          >
            {sendOtp.isPending ? "Sending…" : "Send code"}
          </button>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="otp">Code sent to {email}</label>
            <input id="otp" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" />
          </div>
          <div style={{ display: "flex", gap: ".5rem" }}>
            <button
              disabled={verifyOtp.isPending || code.trim() === ""}
              onClick={async () => {
                setError(null);
                try {
                  await verifyOtp.mutateAsync({
                    otpVerification: sent,
                    verificationToken: code.trim(),
                  } as never);
                  onSignedIn();
                } catch (cause) {
                  report("verify", cause);
                }
              }}
            >
              {verifyOtp.isPending ? "Verifying…" : "Sign in"}
            </button>
            <button className="ghost" onClick={() => { setSent(null); setCode(""); setError(null); }}>
              Change email
            </button>
          </div>
        </>
      )}
      {error ? (
        <div className="well">
          <span className="tag never">sign-in failed</span>
          <p className="note" style={{ marginTop: ".4rem" }}>{error}</p>
        </div>
      ) : null}
    </div>
  );
}
