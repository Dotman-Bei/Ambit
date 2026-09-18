/**
 * The docs index. Grouped anchors into one page.
 *
 * Anchors rather than routes: a first-time reader loses their place every time a link reloads the
 * document, and the whole of this page is shorter than the navigation would be around it.
 */

export type DocsGroup = { group: string; links: Array<{ href: string; label: string }> };

export const DOCS_INDEX: DocsGroup[] = [
  {
    group: "Start here",
    links: [
      { href: "#what", label: "What Ambit is" },
      { href: "#who", label: "Who this is for" },
      { href: "#quickstart", label: "Quickstart" },
      { href: "#surfaces", label: "The pages" },
    ],
  },
  {
    group: "Concepts",
    links: [
      { href: "#intent", label: "The spend request" },
      { href: "#policy", label: "Your ambit" },
      { href: "#rules", label: "The fifteen rules" },
      { href: "#verdicts", label: "Verdicts" },
      { href: "#digest", label: "The approval digest" },
      { href: "#wallet", label: "Who owns the wallet" },
      { href: "#receipts", label: "Receipts" },
    ],
  },
  {
    group: "Reference",
    links: [
      { href: "#refusals", label: "Why a request is refused" },
      { href: "#limits", label: "What is not built" },
    ],
  },
];

export function DocsIndex() {
  return (
    <nav className="docs-index" aria-label="Documentation">
      {DOCS_INDEX.map((g) => (
        <div key={g.group}>
          <p className="docs-group">{g.group}</p>
          {g.links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}
