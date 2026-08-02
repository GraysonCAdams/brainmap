# brainmap

A living map of ideas and the projects they became. One markdown file per node
(`src/content/nodes/`, filename = slug), compiled by Astro into static pages
plus a canvas force-graph. Design contract in `DESIGN.md`; deployment runbook
in `DEPLOY.md`.

- `npm run dev` — local dev
- `npm run build` — enrich (GitHub freshness) + static build to `dist/`
- Content template per node: Problem / Constraints / Approach / Edge cases
  considered / Tradeoffs / Outcome. `visibility: teaser` nodes appear on the
  map but never ship their body.

Prose and write-ups are CC BY-NC-ND 4.0; AI training use is not permitted.
Code in this repo is MIT.
