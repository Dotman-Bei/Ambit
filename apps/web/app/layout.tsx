import type { Metadata } from "next";
import { Barlow_Condensed, B612, B612_Mono } from "next/font/google";
import "./tokens.css";

/*
 * Three faces, strictly divided, and all three self-hosted.
 *
 * `next/font/google` downloads the files at build time and serves them from this origin, so the
 * visitor never makes a request to a third party they did not agree to make. That is the same
 * reasoning behind the base64-embedded fonts in the original system, reached by the mechanism this
 * stack already provides.
 *
 * B612 was drawn by Airbus for cockpit displays — legibility at a glance under stress. That is the
 * actual reading a decision console asks for, which is why the pairing works rather than being a
 * costume.
 */

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
  variable: "--display",
});

const text = B612({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--text",
});

const mono = B612_Mono({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--mono",
});

export const metadata: Metadata = {
  /**
   * The tab reads "Ambit" and nothing else. A tab is about 18 characters wide before it truncates,
   * so a positioning line put there is not read — it is cut mid-word next to a favicon. The template
   * gives inner pages "Docs — Ambit" so the brand still travels, and the full line lives in the
   * description and the share card, which are the places with room for it.
   */
  title: { default: "Ambit", template: "%s · Ambit" },
  openGraph: {
    title: "Ambit: delegated signing authority for autonomous agents",
    description:
      "Ambit decides whether an agent may spend, before the money moves, using a deterministic policy engine and a Dynamic wallet the user still owns and can revoke at any moment.",
  },
  description:
    "Ambit decides whether an agent may spend, before the money moves, using a deterministic policy engine and a Dynamic wallet the user still owns and can revoke at any moment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${mono.variable}`}>
      {/*
        The root layout owns the fonts and the token module and nothing else. Chrome belongs to the
        shells: Shell A (public) brings SiteHeader/SiteFooter, Shell B (console) brings the rail and
        the auth bar, and Shell C (approve) deliberately brings neither — one page, one job, no rail.
        A header hard-coded here would force it onto all three.
      */}
      <body>{children}</body>
    </html>
  );
}
