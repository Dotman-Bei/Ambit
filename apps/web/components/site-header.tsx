"use client";

import { usePathname } from "next/navigation";

/**
 * The marketing nav. Five links plus one CTA.
 *
 * `pagestructure.md` §1: Pricing and Changelog are deliberately cut — *"there is no pricing and a
 * two-day changelog is noise."*
 */

const NAV = [
  { label: "The problem", href: "/#problem" },
  { label: "How it works", href: "/#loop" },
  { label: "Ownership", href: "/#ownership" },
  { label: "Receipts", href: "/explorer" },
  { label: "Docs", href: "/docs" },
];

const PRIMARY_CTA = { label: "Set a spend ambit", href: "/console" };

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <a className="wordmark" href="/">
          Ambit
        </a>
        <nav className="nav" aria-label="Main">
          {NAV.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </a>
          ))}
          <a className="button keep" href={PRIMARY_CTA.href} style={{ textDecoration: "none" }}>
            {PRIMARY_CTA.label}
          </a>
        </nav>
      </div>
    </header>
  );
}
