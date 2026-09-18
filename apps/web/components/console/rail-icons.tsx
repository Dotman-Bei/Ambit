/**
 * Rail icons, drawn in SVG. The Drawn Mark Rule: a text character is never an icon, because a typed
 * glyph sits on the text baseline and changes shape with every fallback face.
 *
 * Each is a 16-unit chart mark on `currentColor`, so the rail sets colour once and every icon follows.
 */

export type IconName =
  | "start" | "overview" | "wallet" | "policy" | "decisions"
  | "escalations" | "settings" | "ledger" | "vendors" | "reports" | "explorer";

const PATHS: Record<IconName, React.ReactElement> = {
  // a runway threshold
  start: <><path d="M3 13h10M5 10h6M7 7h2" /></>,
  // four chart plates
  overview: <><rect x="2.5" y="2.5" width="4.5" height="4.5" /><rect x="9" y="2.5" width="4.5" height="4.5" /><rect x="2.5" y="9" width="4.5" height="4.5" /><rect x="9" y="9" width="4.5" height="4.5" /></>,
  // a wallet fold
  wallet: <><rect x="2.5" y="4" width="11" height="8" rx="1" /><path d="M10.5 8h3" /></>,
  // the bounded ring with its wall — the product mark, small
  policy: <><circle cx="7" cy="8" r="4.5" /><path d="M13 3v10" strokeDasharray="2.5 2" /></>,
  // a decision stream: rows
  decisions: <><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7" /></>,
  // an upward escalation
  escalations: <><path d="M8 12.5V4M8 4 4.5 7.5M8 4l3.5 3.5" /></>,
  settings: <><circle cx="8" cy="8" r="2.5" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" /></>,
  ledger: <><rect x="3" y="2.5" width="10" height="11" rx="1" /><path d="M5.5 6h5M5.5 9h5" /></>,
  vendors: <><circle cx="5.5" cy="6" r="2" /><circle cx="10.5" cy="10" r="2" /><path d="M7 7.5 9 8.5" /></>,
  reports: <><path d="M3 13V7M7 13V3M11 13V9" /></>,
  explorer: <><circle cx="7" cy="7" r="4" /><path d="M10 10l3.5 3.5" /></>,
};

export function RailIcon({ name }: { name: IconName }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="square" aria-hidden="true" focusable="false"
      style={{ flex: "none" }}
    >
      {PATHS[name]}
    </svg>
  );
}
