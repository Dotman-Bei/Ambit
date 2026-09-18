# Frontend Style Guide — "Batas" system

Extracted from [`PugarHuda/batas`](https://github.com/PugarHuda/batas) (MIT).

**The one-line description:** an aeronautical chart and a pilot's handbook, printed in daylight. A cool chart-white ground, condensed uppercase placard display over the B612 cockpit face, hairline rules instead of boxes, hatched fills for loss and refusal, and airspace colour semantics borrowed whole — magenta for the limit that must not be crossed, blue for controlled structure, and the airspeed indicator's three arcs for state. Nothing moves unless the visitor moves it.

**Three things to know before reading on:**

1. **The repo documents its own system, and the documentation is exact.** `DESIGN.md` is 27KB of frontmatter tokens plus prose, and every value in it checks out against `agent/world.mjs` and `agent/ui.mjs`. It includes measured WCAG contrast ratios for every text colour against all three surfaces. This spec verifies rather than transcribes, and fills in what the prose leaves implicit.
2. **There is no framework, no build step, and no CDN.** The pages are strings returned by JS modules (`landing.mjs`, `ui.mjs`, `surface-render.mjs`) sharing one token module (`world.mjs`). The three fonts are **base64-embedded in a source file** — `fonts.mjs` — because a woff2 read from disk at runtime is a file the bundler may not trace, and a font fetched from a third party is a request the visitor never agreed to make.
3. **The system is built around named rules, not just tokens.** The Airspace Rule, the Daylight Rule, the Readable Figure Rule, the Placard Voice Rule, the Drawn Mark Rule, the Hairline Chart Rule, the Still Chart Rule. Each names a constraint and says what breaks if you violate it. That structure is the most portable thing here — more than the palette.

---

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | **None.** Pages are template strings returned from ES modules; served by Express |
| CSS | Hand-written custom properties in one shared module, composed per page |
| Fonts | **Barlow Condensed 700** (display), **B612 400/700** (body/figures), **B612 Mono 400** (bytes) — all SIL OFL 1.1, base64-embedded, `font-display: swap` |
| Motion | Effectively none. No `@keyframes` on either page |
| Third-party requests | Exactly one, deliberately: the public Hedera mirror node |

B612 was drawn by Airbus for cockpit displays — legibility at a glance under stress. That is the actual reading this page asks for, and it's why the pairing works rather than being a costume.

### The one allowed external host

Hedera ledger readings go to the public mirror node directly from the browser, and the reasoning is worth copying even if the specifics aren't: *reading the payment ledger through this service would leave the service as the only witness to its own payments.* The QA spec allows that host and nothing else. A self-audit that routes through the thing being audited isn't an audit.

---

## 2. Colour tokens

Seventeen colours plus a white. Saturated colour is spent **only on meaning** — a limit, a structure, or a state.

```css
:root {
  color-scheme: light;

  /* neutral — the chart */
  --ground: #f3f6f4;   /* page ground; top bar at 88% */
  --paper:  #fbfcfb;   /* raised plates, panels, placards, the final band */
  --sunk:   #e9eeeb;   /* code blocks, inputs, tape and bar tracks */
  --ink:    #0f1a22;   /* primary text, 2px section rules, placard head fill */
  --ink-2:  #33414d;   /* lead paragraphs, notes, chart axes, nav links */
  --dim:    #56636f;   /* table heads, captions, timestamps, tick labels */
  --rule:   #d2dad5;   /* every 1px divider */
  --grid:   #e3e9e5;   /* the 48px graticule, envelope grid lines */
  --edge:   #a9b5ae;   /* frames of plates, panels, inputs, tracks */

  /* the limit, and the way forward */
  --boundary:      #a0146c;   /* airspace magenta */
  --boundary-soft: #f6e3ee;   /* the 3px input focus halo. Nothing else. */

  /* controlled structure */
  --structure: #1b4d99;       /* airspace blue */

  /* the airspeed arcs */
  --inside:       #17753b;    /* green arc — inside the envelope */
  --caution:      #8f5c00;    /* yellow arc — not yet confirmed */
  --caution-fill: #f0b429;
  --never:        #c0141a;    /* red radial — never exceed */

  --on-boundary: #ffffff;     /* text on magenta, 7.47:1 */
}
```

### The named rules

**The Airspace Rule.** Magenta means a limit or the single action forward. Blue means structure. *A decorative use of either is a misread chart.* Magenta gets: the cap wall, the primary button, the focus outline, text selection, the range accent, the input caret and focus border, the paid fare row, and the emphasised clause of the hero headline. Blue gets: links, the pool's rate curve, instruction names, legend symbols. One exception — the hero chart draws airspace boundaries in magenta and a navaid in blue, at low opacity, with their chart meanings intact.

**The Daylight Rule.** One scheme, and it is light. `color-scheme: light` with **no `prefers-color-scheme` block at all**. The final band is `paper` under a 2px ink rule, not an ink-black band. Measured against WCAG on ground/paper/sunk: `ink` 16.20/17.14/15.02, `ink-2` 9.63/10.19/8.93, `dim` 5.66/5.99/5.25, `boundary` 6.86/7.26/6.37, `structure` 7.52/7.95/6.97, `inside` 5.30/5.60/4.91, `caution` 5.22/5.52/4.84, `never` 5.75/6.08/5.33. The lowest is 4.84, which clears 4.5:1.

Publishing the full matrix is the part to copy. It makes the palette auditable, and it means adding a colour has a defined test rather than a vibe.

### The three-arc state system

Borrowed from the airspeed indicator, and consistent everywhere:

| State | Colour | Meaning |
|---|---|---|
| inside | `--inside` green | inside the envelope, settled, kept, healthy, `yes` |
| caution | `--caution` yellow | **not yet confirmed** — a live reading in flight |
| never | `--never` red | never exceed — the floor, the lost portion, errors, `no` |

The caution arc is doing real work: it exists *so that "not checked yet" never looks like "fine" or "failed."* Most systems collapse pending into either a spinner or a success-coloured skeleton. This one gives it its own semantic slot.

---

## 3. Typography

Three faces, strictly divided.

| Role | Font | Size / line | Weight | Tracking |
|---|---|---|---|---|
| Display | Barlow Condensed | clamp(2.6rem, 5vw, 4.4rem) / 0.92 | 700 | -0.01em |
| Name | Barlow Condensed | clamp(2rem, 3.4vw, 2.8rem) / 1 | 700 | +0.06em |
| Headline | Barlow Condensed | clamp(2rem, 4vw, 3.1rem) / 0.95 | 700 | -0.005em |
| Title | Barlow Condensed | 1.6rem / 1 | 700 | +0.03em |
| Placard label | Barlow Condensed | 1.05rem / 1 | 700 | +0.08em |
| Wordmark | Barlow Condensed | 1.45rem / 1 | 700 | +0.06em |
| Lead | B612 | clamp(1rem, 1.3vw, 1.1rem) / 1.65 | 400 | — |
| Body | B612 | 0.9375rem / 1.65 | 400 | tnum |
| Button | B612 | 0.92rem / 1 | 700 | +0.01em |
| Label | B612 | 0.8rem | 700 | — |
| Tag | B612 | 0.72rem / 1.5 | 700 | +0.04em |
| Bytes | B612 Mono | 0.82rem / 1.7 | 400 | tnum |

All display roles are **uppercase**. Tracking is negative on the large display sizes and positive on the small uppercase ones — the standard crossover, cleanly applied.

### The Readable Figure Rule

*A figure is read, not typed.* Every number a reader actually reads is set in **B612 with `tabular-nums lining-nums`** — the proportional face, not the mono. The reason is specific and correct: the mono sets a decimal point as wide as a digit, so `1.941` reads as "1. 941". B612 Mono is kept for bytes, code, timestamps and scale ticks only.

This is the detail most systems get backwards. Mono for data feels right and reads worse. Copy this one.

### The Placard Voice Rule

Barlow Condensed is *always* 700 and uppercase, and only for display, headings, placard labels, the name and the wordmark. It never sets running text or a figure inside a sentence. Its one numeric use is the fare price, as a placard value.

### The Drawn Mark Rule

*A text character is never an icon.* Buttons are text only. State marks, legend symbols and the product mark are drawn in CSS or SVG. The `never` mark is two crossed gradient strokes rather than a typed `×`, and the code says why: a typed × sits on the text baseline and changes shape with every fallback face.

```css
.tag.no::before {
  content: ""; width: .5rem; height: .5rem; flex: none;
  background:
    linear-gradient(45deg,  transparent 40%, currentColor 40% 60%, transparent 60%),
    linear-gradient(-45deg, transparent 40%, currentColor 40% 60%, transparent 60%);
}
```

---

## 4. Geometry and elevation

### Shapes — nearly square, three steps

```
2px  hairline objects (tags, tape and bar tracks, pending bars, focus outline)
3px  controls (buttons, inputs)
4px  plates, panels, placards, code blocks
6px  the favicon tile only
```

Borders are 1px `edge` on objects, 2px `ink` for the placard frame.

### Elevation — tonal and ruled

Depth comes from `sunk` wells below the ground, `paper` plates above it, hairlines for structure, 1px `edge` frames for objects, and 2px `ink` rules to open a major group.

```css
--shadow: 0 1px 1px rgb(15 26 34 / .06), 0 12px 32px -18px rgb(15 26 34 / .28);
```

**The Hairline Chart Rule.** Structure is drawn with rules, not boxes. A new grouping gets a hairline or a 2px ink rule. *The plate lift is for a chart plate, never for a row of cards.* Only three things get it: the envelope plate, the limitations placard, and app panels.

**The Hairline Side Rule.** No coloured side stripe wider than 1px. A note is set off by a 1px `rule` hairline on its left; heavier rules run across the *top* of a group, never down its side.

Two other shadows exist and nothing else: a button seat (`0 1px 0 rgb(0 0 0 / .08)`) and the input halo (`0 0 0 3px var(--boundary-soft)`).

### Hatching for loss and refusal

Loss and refused zones are **hatched, never flat-filled**:

```css
.bar .track {
  background: repeating-linear-gradient(135deg,
    var(--sunk) 0 6px,
    color-mix(in oklab, var(--never) 20%, var(--sunk)) 6px 8px);
}
```

The envelope's floor and cap zones use 7px rotated line patterns at 35% opacity. Hatching is chart vocabulary for "this region is not available," and it carries the meaning without relying on colour alone.

---

## 5. Layout

One container everywhere: **76rem max width, centred, 1.25rem gutter**, shared by the top bar, the bands, the app `main` and the footer.

```
--gutter:    1.25rem
--container: 76rem
--band:      clamp(3.5rem, 8vw, 6.5rem)
--graticule: 48px
--cell:      1rem
```

**Two rooms, one world.** The landing is spacious: full-bleed bands separated by hairlines, alternating with a `sunk` band, a 48px graticule behind the hero, one plate carrying the live envelope. The app is the same world set for work: denser panels, hairline-ruled facts lists, byte tables, section heads opened by a 2px ink rule. Both share one top bar, one token set, one footer.

Two-column grids use `minmax(0, 1fr)` tracks with `gap: clamp(2rem, 5vw, 4rem)` — hero at 1fr/1.05fr, proof split at 1fr/1fr, final band at 1.1fr/1fr. Facts and reach lists are `max-content 1fr` definition grids with row hairlines. Health bars run `11rem 1fr 11rem`.

### Breakpoints

- **60rem** — hero, split, final grids and legend collapse to one column. The hero's text column *dissolves* so the order becomes headline → envelope plate → lead → meaning → actions. The envelope follows the headline directly rather than trailing the copy.
- **46rem** — nav keeps only its button; bars, facts and reach lists stack; the cost table and instruction arguments reflow.
- **40rem** — the placard and fare table become stacked rows; chart labels step up in size.

Pages hold at 390px without horizontal scroll. Wide byte tables sit in an `overflow-x: auto` wrapper.

---

## 6. Components

### Buttons

```css
button {
  font: 700 .9rem/1 var(--text); padding: .72rem 1.1rem; border-radius: 3px;
  border: 1px solid var(--boundary); background: var(--boundary); color: var(--on-boundary);
  transition: background-color .13s ease-out, border-color .13s ease-out, transform .08s ease-out;
}
button:hover:not(:disabled) { background: color-mix(in oklab, var(--boundary) 86%, var(--ink)); }
button:active:not(:disabled) { transform: translateY(1px); }
button:disabled { opacity: .5; cursor: progress; }
button.ghost { background: transparent; color: var(--ink); border-color: var(--edge); }
button.ghost:hover { background: var(--paper); border-color: var(--ink); }
```

Firm and plain, like a labelled switch. Hover mixes 14% toward ink; press shifts down 1px. `cursor: progress` on disabled tells you it's working, not broken.

### Top bar

Sticky, `ground` at 88% with `saturate(1.2) blur(10px)`, hairline below — translucent rather than shadowed. Wordmark left (drawn mark at 26px plus uppercase name); nav right in `ink-2` at 0.88rem, hover and current page underlined in magenta.

### Inputs

`sunk` well, 1px `edge` border, 3px corners, B612 Mono, **magenta caret**. Border darkens to `dim` on hover; focus sets a magenta border plus the 3px magenta-wash halo. Textareas resize vertically from 5.5rem.

### State marks and tags

B612 700 at 0.8rem with a 0.7rem drawn mark before the text: **inside** a filled disc, **caution** an open square with a 2px border, **never** a drawn diagonal cross. Tags are compact outlined labels — 1px `currentColor` border, 2px corners, uppercase 0.72rem — so setting the colour sets the border and the mark together.

### Pending readings

While a live reading loads, the app shows **static bars**: 0.75rem tall, `sunk` fill, 1px `rule` border, 2px corners, at varied widths, on a container marked `aria-busy` with a screen-reader sentence naming what is being read. The landing shows the caution mark with the same sentence.

Static, not shimmering. A skeleton that animates implies progress it can't measure.

### Envelope plate (the signature)

A chart panel, not a card: `paper` fill, 1px `edge` frame, 4px corners, plate lift, no outer margin. The head pairs a placard-label title with a mono "as of" timestamp.

The SVG is 560×340 units: axes in `ink-2`, horizontal grid lines in `grid`, the inside zone as a 13% green tint, the floor as a 2px `never` line, the cap as a 2px magenta dashed wall (`6 4`), refused zones hatched, and the pool curve in 2.25px blue labelled "what the pool pays today". Settled trades plot as green dots (radius 5.5, 2px `paper` ring) with a bold green count.

Chart label sizing is handled with unusual care: **13 units at full container width** (renders near 12px), **16 units between 60rem and 76rem** where the plate is narrower so desktop labels never render under 11px, **18 units below 40rem** so they render near 10px on a phone. Same visual size across every breakpoint, achieved by changing the unit rather than hoping.

### Hero chart (decoration)

A sectional-chart drawing: a VOR compass rose in `structure` (radius 150, ticks every 5° at 6 units, every 10° at 10, every 30° at 16, a magnetic-north arrow) **turned 13 degrees off true north, as a printed rose is**, around the chart's hexagonal VOR symbol. A solid Class C ring in `boundary` (radius 320) with a 9-unit shelf band at 7%. A dashed Class E surface ring (radius 236, dashes `9 6`). A meridian and parallel in `edge` with minute ticks.

Rose at 32% opacity, rings at 30–34%, graticule at 55%, strokes non-scaling. One inline SVG (760 units), `aria-hidden`, `pointer-events: none`, built once at module load, no raster and no request.

Two details worth naming. It **carries no labels and no numbers, so it cannot be read as a claim about a place** — the decoration can't accidentally assert something. And its placement was verified rather than eyeballed: at two-column width its centre sits 60px right of the plate's right edge, vertically centred, so the opaque plate covers its middle; checked at 1440×900 and 390×844 by hit-testing the painted linework against every text line box, both buttons and the plate. No overlap.

### Limitations placard

The artefact a pilot reads first: 2px ink frame, `paper` body, ink-filled head in placard label at +0.12em with a mono aside. Rows are hairline-ruled — uppercase row label (7.5rem), a bold figure, an `ink-2` explanation at 0.84rem.

### Fuel tape

A 2.6rem hatched track with a solid fill for what was kept (`inside`) or lost (`never`), **drawn at its measured width**. Placard-label head with the figure right-aligned, a mono scale beneath, a foot line ending in a state mark. App health bars share the form on 1.6rem tracks.

```css
/* Drawn at the measured width and left there: a chart is still, and a bar that grows on load
   shows a number that was never measured on its way to the one that was. */
```

That comment is the whole motion philosophy in one sentence.

### Capability panels

Four live readings, rendered once in `surface-render.mjs` and injected into both pages. Each is a ruled register (`max-content 1fr` definition grid, stacking below 46rem) or a hairline list — **never a card**. While reading: `aria-busy` plus the caution mark and a sentence naming the source. On failure: the never mark, what failed, and a "try again" button.

URLs are set in the **text** face, not the mono, because B612 Mono gives a colon and a full stop a digit-wide cell.

---

## 7. Motion

**The Still Chart Rule.** Nothing moves on its own: no fills, draws, loops or shimmer on load. There is no `@keyframes` rule on either page.

The trade-size probe is the only moving thing, and the visitor moves it. Its marker jumps to the new position with no transition. Pointer responses stay brief — button fill 0.13–0.14s, press 0.08s, input border and halo 0.12s, all `ease-out`. The global reduced-motion guard clamps any animation or transition to 0.001ms.

The confirmed anti-reference is stated outright: *the DeFi landing default — black ground, glowing 3D object, headline metric row.* Naming what you're not building is a useful discipline; it makes the constraint checkable by someone else.

---

## 8. Accessibility floor

- **One focus style, global:** `:focus-visible { outline: 2px solid var(--boundary); outline-offset: 3px; border-radius: 2px; }` — and a Don't that says never suppress or restyle it away.
- **Every state carries a mark as well as a colour.** Disc, open square, drawn cross. Colour alone never carries a state.
- Full measured contrast matrix, with 4.5:1 as the stated floor for any new value.
- `aria-busy` on pending containers with a screen-reader sentence naming the source.
- `aria-labelledby` / `aria-describedby` on the envelope figure, with a real prose description of what the chart shows.
- `aria-hidden` and `pointer-events: none` on the hero linework.
- `scrollbar-color`, `::placeholder` at full opacity, `-webkit-text-size-adjust: 100%`.
- `overflow-wrap: anywhere` on definition values; `overflow-x: auto` wrappers on wide tables.

---

## 9. Copy voice

- **Placard grammar throughout.** Labels read like limitations placards: uppercase, terse, noun-first.
- **Figures are always real.** A stated Don't: *no illustrative or placeholder numbers.* Show only figures read from a chain, a mirror node, or a measured test; show caution while a reading is pending.
- **Provenance is part of the copy.** Fare rows take their range from the same manifest read, *so neither page prints a flat price.*
- **Chart labels are sentences, not jargon:** "what the pool pays today" rather than "AMM curve".
- **The screen-reader description explains the chart in plain language** — axes, what each line means, and which trades settle.
- No mascots, no emoji, no decorative crypto imagery.

---

## 10. Build checklist

1. One token module (`world.mjs` equivalent) exporting the `:root` block, a base reset, the font faces and the favicon. Every page composes from it.
2. Declare `color-scheme: light` and write no `prefers-color-scheme` block.
3. Self-host the faces. If your deploy target traces bundles, embed them as bytes rather than reading from disk.
4. Set the global `:focus-visible` outline in the base block, before anything can forget it.
5. Body at B612 400 / 0.9375rem / 1.65 with `font-variant-numeric: tabular-nums`.
6. Build the three-step radius scale and the three-shadow vocabulary. Nothing else gets a shadow.
7. Assign colour by meaning: one hue for the limit, one for structure, three for the state arcs. Everything else neutral.
8. Every figure a reader reads goes in the proportional face with tabular lining numerals. Mono only for bytes, code, timestamps, ticks.
9. Every state gets a drawn mark alongside its colour.
10. Hatch loss and refused zones; open major groups with a 2px ink rule across the top.
11. Static pending bars with `aria-busy` and a naming sentence. No shimmer.
12. Publish the contrast matrix for your palette and keep 4.5:1 as the gate for new values.

---

## 11. What to change when reusing

| Keep | Change |
|---|---|
| The named-rule structure (each rule states what breaks if violated) | The rules themselves, if your domain differs |
| Colour spent only on meaning; one hue for limits, one for structure | The chart metaphor, and therefore the hues |
| The three-state arc system with a distinct **pending** state | The specific colours |
| Figures in the proportional face with tabular lining numerals | — this is right regardless of domain |
| A drawn mark alongside every state colour | Which shapes |
| Hairline-and-rule structure; shadows for chart plates only | The shadow values |
| Static pending bars over shimmer skeletons | — |
| Hatching for loss and refusal | — |
| A published contrast matrix and a stated floor | The floor, if you need AAA |
| Light-only with no dark block | Only if your users genuinely need dark — but then commit to it as fully as this commits to light |

**The idea to think hardest about:** the metaphor. This design works because aeronautical charts are a real, mature visual language for *bounded operation under hard limits*, and the product is literally about scoped, expiring authority. The vocabulary transfers because the problem transfers. Borrowed wholesale onto a product with no limits to draw, the same palette and placards would be costume — you'd have chart linework decorating something that isn't a chart, which is exactly what the Airspace Rule forbids. Find the domain whose visual language already solves your product's problem, then borrow it with its meanings intact.

**One thing to watch:** the no-CDN, no-build, string-returning architecture is right for a service whose other output is JSON and whose page is genuinely one surface. It does not scale to a multi-page product with shared interactive components. The constraint that produced it — pages must survive bundling with no runtime file reads — is worth understanding before you inherit the shape.
