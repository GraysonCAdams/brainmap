# Design direction: "Observatory log"

Part telemetry console, part specimen catalog. Dark, information-dense app UI.
This file is the contract; tokens in `src/styles/tokens.css` implement it.

## Non-negotiables

- Ground is abyssal blue-green (`--ground`), never neutral black. Ink is warm
  paper-white, never pure white.
- Display face: Instrument Serif (sparingly: page titles, the wordmark, pull
  moments). Body: IBM Plex Sans. Data/labels/tables: IBM Plex Mono with
  `font-variant-numeric: tabular-nums`.
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
