# brainmap

A living map of my ideas and what became of them. One dot per project, placed
by year and domain, drawn on a canvas that glows brighter the more recently
the underlying repo shipped. It's also the front door of my portfolio: bio,
resume, contact, and every project write-up run through the same pipeline as
the map itself, markdown in, static site out. Design contract in `DESIGN.md`;
deployment runbook in `DEPLOY.md`.

## Content model

Every node is one markdown file in `src/content/nodes/`. The filename is the
slug, `ampere.md` becomes `/idea/ampere`, so there's no separate slug field
that can drift out of sync with a rename. Frontmatter carries the graph:
`domain` (one of eight: home, security, tools, media, ai-tooling, products,
client-work, platform, all defined in `src/content.config.ts`), `status`
(idea, building, shipped, retired), `started`/`ended`, and `scale` (1 to 5,
sets dot size). A node can name a `parent` to orbit a bigger one instead of
standing alone, useful for something like a dozen client sites that each
deserve a dot on the map but not a page saying "built a WordPress site for a
realtor."

The body follows a fixed template: Problem, Constraints, Approach, Edge cases
considered, Tradeoffs, Outcome. A node can also be `visibility: teaser`,
which puts a locked dot with just a tagline on the map. Its body never
reaches the client, never gets a static page, and never reaches the
markdown mirrors at `/llms.txt` or `/llms-full.txt`. `src/pages/graph.json.ts` is the build-time
integrity gate for all of this: a `links` or `parent` reference to a slug
that doesn't exist fails the build rather than shipping a graph that lies.

## Running it

`npm install`, then `npm run dev` for local dev. `npm run build` runs two
scripts before `astro build`: `scripts/build-kb.mjs` assembles the knowledge
base the resume generator writes from (public bullets, plus employer
material from `src/data/private-kb.local.json` when that file exists on the
machine, which it won't on a fresh checkout since it's gitignored on
purpose), and `scripts/enrich.mjs` pulls each node's last-push date and star
count from GitHub so the map's freshness glow stays current. Neither script
needs anything extra to build cleanly; missing the private file just means a
weaker knowledge base for the roles it would have covered, and the build
says so rather than failing. `npm run cf` builds and serves the site through
`wrangler pages dev`, which is how to test the contact form and resume
generator against real Cloudflare Functions locally, given a `.dev.vars` (see
`.dev.vars.example`).

## The map

Nodes place by year on one axis and domain cluster on the other, then a
d3-force simulation settles collisions and pulls satellites toward their
parent. Rendering itself is hand-rolled canvas rather than a graph library:
more code to own, but a small payload and full control of the look at this
node count (`src/scripts/map.ts`; the reasoning is in `DESIGN.md`). Every
node page also renders a small build-time SVG of its own immediate
neighborhood in its domain's color, so the constellation thread is a working
nav element rather than a decoration.

## A few decisions worth knowing about

The resume generator (`functions/api/resume.ts`) takes a pasted job
description or a stated interest and asks Claude to choose which roles are
worth showing and rewrite their bullets, but it can't invent anything: facts
like employer, title, and dates come from `src/data/resume-facts.json` and
render client-side outside the model's control, and every bullet has to
trace back to something in the knowledge base, which is all my own words
pulled from earlier resumes and the node write-ups themselves.

Dead links get caught three ways. Internal ones (a node's `links` and
`parent` fields) fail the build immediately if they don't resolve. Each
node's linked `repo:` gets checked for a 404 during the enrichment build
step and flagged rather than failing the build, since a renamed or privated
repo shouldn't take the whole site down. Everything else, every external URL
in the content and pages, gets crawled weekly by a GitHub Action that opens
an issue if something's gone dead.

AI crawlers get split treatment on purpose: training bots are disallowed in
`robots.txt` and blocked at the Cloudflare edge, while `/llms.txt` serves
clean markdown to anything reading on a visitor's behalf.

Code here is MIT. The node write-ups are CC BY-NC-ND 4.0, AI training use
not permitted. See `LICENSE` and `/colophon` for the exact split.
