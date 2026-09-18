"use client";

import { usePathname } from "next/navigation";
import { RailIcon, type IconName } from "./rail-icons";

/**
 * The console rail. Eleven entries, phase-aware.
 *
 * `pagestructure.md` §2: *"Phase 2 entries render at reduced opacity, are not clickable, and carry
 * `title="Not in this build"`. They are in the array so the honesty is structural rather than a
 * thing someone remembers to write."*
 *
 * That is why the phase-2 links are not commented out or filtered at build time. A reader of the
 * rail sees the whole intended shape and sees exactly which parts are not built, which is the same
 * discipline rules 8 and 14 follow in the engine.
 */

type RailLink = { href: string; label: string; icon: IconName; phase: 1 | 2 };

const LINKS: RailLink[] = [
  { href: "/console/start", label: "Get started", icon: "start", phase: 1 },
  { href: "/console", label: "Overview", icon: "overview", phase: 1 },
  { href: "/console/wallet", label: "Wallet", icon: "wallet", phase: 1 },
  { href: "/console/policy", label: "Ambit", icon: "policy", phase: 1 },
  { href: "/console/decisions", label: "Decision stream", icon: "decisions", phase: 1 },
  { href: "/console/escalations", label: "Escalations", icon: "escalations", phase: 1 },
  { href: "/console/settings", label: "Settings", icon: "settings", phase: 1 },
  { href: "/console/ledger", label: "Ledger", icon: "ledger", phase: 2 },
  { href: "/console/vendors", label: "Vendors", icon: "vendors", phase: 2 },
  { href: "/console/reports", label: "Reports", icon: "reports", phase: 2 },
  { href: "/explorer", label: "Public explorer", icon: "explorer", phase: 1 },
];

export function Rail() {
  const pathname = usePathname();

  const toggle = () => {
    const root = document.documentElement;
    const next = root.getAttribute("data-sidebar") === "collapsed" ? "expanded" : "collapsed";
    root.setAttribute("data-sidebar", next);
    try {
      localStorage.setItem("ambit.sidebar", next);
    } catch {
      // Private mode throws on write. The rail still toggles for this session; only the memory of
      // the choice is lost, which is the right thing to degrade.
    }
  };

  return (
    <nav className="rail" aria-label="Console">
      <button className="ghost rail-toggle" onClick={toggle} aria-label="Toggle sidebar" title="Toggle sidebar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <rect x="2.5" y="3" width="11" height="10" rx="1" />
          <path d="M6.5 3v10" />
        </svg>
        <span className="rail-label">Collapse</span>
      </button>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {LINKS.map((link) => {
          const current = pathname === link.href;

          if (link.phase === 2) {
            return (
              <li key={link.href}>
                <span className="rail-item rail-disabled" title="Not in this build" aria-disabled="true">
                  <RailIcon name={link.icon} />
                  <span className="rail-label">{link.label}</span>
                  <span className="rail-label rail-phase">not built</span>
                </span>
              </li>
            );
          }

          return (
            <li key={link.href}>
              <a
                className="rail-item"
                href={link.href}
                aria-current={current ? "page" : undefined}
                title={link.label}
              >
                <RailIcon name={link.icon} />
                <span className="rail-label">{link.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
