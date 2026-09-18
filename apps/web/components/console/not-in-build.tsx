/**
 * The labelled disabled state for a capability that is not in this build.
 *
 * *"A blocked capability that is invisible is indistinguishable from one that silently failed."*
 * So this renders the thing's name, says plainly that it is not built, and says which phase owns it.
 * It never renders an empty success state in its place.
 */
export function NotInBuild({ what, phase, why }: { what: string; phase: 2 | 3; why: string }) {
  return (
    <div
      className="hatched-boundary"
      style={{ border: "1px solid var(--edge)", borderRadius: "4px", padding: "1.1rem" }}
    >
      <span className="tag caution">not in this build</span>
      <p style={{ marginTop: ".7rem", fontWeight: 700 }}>{what}</p>
      <p className="note" style={{ marginTop: ".35rem" }}>{why}</p>
      <p className="bytes dim" style={{ marginTop: ".5rem" }}>phase {phase}</p>
    </div>
  );
}
