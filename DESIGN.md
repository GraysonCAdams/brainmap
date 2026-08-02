# Design direction: "Terminal observatory"

A working engineer's terminal pointed at a map of his own head. Dark,
information-dense app UI with a deliberate terminal idiom, kept away from
acid-green hacker cliche by the warm ink and the polychrome lamp palette.
This file is the contract; tokens in `src/styles/tokens.css` implement it.

Owner direction (2026-08-02): terminal aesthetic, explicitly NOT serif.
The map IS the landing page; a dismissable `$ whoami` modal introduces him;
top nav is bio / resume / contact.

## Non-negotiables

- Ground is abyssal blue-green (`--ground`), never neutral black. Ink is warm
  paper-white, never pure white. Never a green-phosphor monochrome scheme.
- Display + data face: IBM Plex Mono (h1s are prompt lines with a faint `$ `
  prefix; the wordmark is `gray@brainmap:~$` with a blinking block cursor).
  Body prose: IBM Plex Sans, because paragraphs of mono fatigue. Tables/labels
  keep `font-variant-numeric: tabular-nums`.
- Terminal idiom is allowed exactly where it encodes something (prompt = a
  place you type, `./link` = navigation, `## header` = markdown-style section);
  never as scattered ASCII decoration.
- Six domain lamp colors, one per domain in `content.config.ts`. They are the
  only saturated colors on the site. Everything else is ground/ink/line tones.
- Signature element: the constellation thread. Every node page renders a small
  build-time SVG of the node's immediate link neighborhood in its domain color,
  and it is a working nav element (neighbors are links).
- Index mode is a dense lab-log table, not a card grid. No decorative numbered
  markers; the only numbered thing is the curated "start here" path, which is
  genuinely ordered.
- Structure labels must encode real data (dates, domains, status). No fake
  meta-chrome ("SECTION 01", decorative eyebrows).
- Motion: graph nodes breathe by repo freshness; hover states glow like lamps;
  respect `prefers-reduced-motion`; no scroll animation, no transition: all.
- Graph-paper grid texture appears only on the map surface.
- Radii: 2px on chips/inputs, 0 on rules and tables. Never uniform rounding on
  nested elements.

## Failure modes this direction exists to avoid

Near-black + single acid accent console; uniform card grids with status-dot
pills; Inter-by-default; centered marketing hero with gradient accent.
