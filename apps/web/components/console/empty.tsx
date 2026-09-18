/**
 * Empty and failure states. `pagestructure.md` §7 names five, and the distinction between them is
 * the difference between a page that looks broken and a page that is correctly empty.
 *
 * Ambit needs a case the usual two-state pattern does not have: **delegation sits between
 * "not signed in" and "no data"**. A wallet can be signed in, with no delegation, and therefore
 * correctly unable to do anything — which is neither an auth failure nor an absence of data.
 */

export type EmptyState =
  | "NOT_SIGNED_IN"
  | "NO_DELEGATION"
  | "NO_DATA"
  | "REVOKED"
  | "UNREACHABLE";

const COPY: Record<EmptyState, { mark: "caution" | "never"; title: string; body: string; action?: { label: string; href: string } }> = {
  NOT_SIGNED_IN: {
    mark: "caution",
    title: "Sign in to see your decisions.",
    body: "No wallet is connected, so there is no owner to scope this view to.",
    action: { label: "Get started", href: "/console/start" },
  },
  NO_DELEGATION: {
    mark: "caution",
    title: "Ambit cannot sign anything yet.",
    body: "The wallet is connected but no delegation has been granted, so Ambit holds no signing share. Decisions can still be made; nothing can be executed.",
    action: { label: "Grant authority", href: "/console/wallet" },
  },
  NO_DATA: {
    mark: "caution",
    title: "No decisions for this wallet yet.",
    body: "This is an empty record, not a failure. Propose a spend to put something in it.",
    action: { label: "Get started", href: "/console/start" },
  },
  REVOKED: {
    mark: "never",
    title: "Delegation revoked. Ambit can no longer sign.",
    body: "The credentials were deleted when the revocation webhook arrived. Every spend request now returns 403 DELEGATION_REVOKED.",
    action: { label: "Re-grant", href: "/console/wallet" },
  },
  UNREACHABLE: {
    mark: "never",
    title: "The authority service could not be reached.",
    body: "This is a failure to reach the service, which is a different thing from an empty result — and it is reported as such rather than as a spinner that never resolves.",
  },
};

export function Empty({ state, detail }: { state: EmptyState; detail?: string }) {
  const copy = COPY[state];
  return (
    <div className="panel" style={{ borderColor: copy.mark === "never" ? "var(--never)" : "var(--edge)" }}>
      <span className={`tag ${copy.mark}`}>{state.toLowerCase().replace(/_/g, " ")}</span>
      <p style={{ marginTop: ".7rem", fontWeight: 700 }}>{copy.title}</p>
      <p className="note" style={{ marginTop: ".35rem" }}>{copy.body}</p>
      {detail ? <p className="bytes dim" style={{ marginTop: ".5rem" }}>{detail}</p> : null}
      {copy.action ? (
        <a className="button" href={copy.action.href} style={{ display: "inline-block", marginTop: ".9rem", textDecoration: "none" }}>
          {copy.action.label}
        </a>
      ) : null}
    </div>
  );
}
