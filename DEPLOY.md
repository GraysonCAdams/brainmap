# Deployment runbook (Cloudflare Pages)

The site deploys by **direct upload from GRAYTHINKPAD**, not from a
git-connected Pages build. This is deliberate: `functions/api/resume.ts`
bundles `src/data/experience-kb.json`, and that file is only complete on a
machine that has the gitignored `src/data/private-kb.local.json`. A build on
Cloudflare's or GitHub's runners would quietly ship a weaker knowledge base
for exactly the roles the generator most needs. The bundle is server-side
only; nothing in it is served as a page.

`.github/workflows/build.yml` still builds every push as a smoke check. It
deploys nothing.

## Standing infrastructure (created 2026-08-19, via API)

| Thing | Value |
|---|---|
| Pages project | `brainmap`, production branch `main`, `brainmap-3vg.pages.dev` |
| Custom domains | `graysonadams.com` (apex), `www.graysonadams.com` |
| KV namespace | `brainmap-resume-limits` (`4ba18f2f072746d89b407cf2ca34fcf1`), bound as `RESUME_KV` |
| Turnstile widget | `brainmap`, sitekey `0x4AAAAAAEV4etU7ANRMW3Dw`, domains: apex + pages.dev |
| `TURNSTILE_SECRET` | set on the project (production + preview) as a secret. Its system of record is the Turnstile dashboard; it was wired without ever entering a transcript, so there is no 1Password copy |
| AI-crawler blocking | zone-level `ai_bots_protection: block` is ON; robots.txt stays the polite layer |
| Zone page rules | `*graysonadams.com/meet*` -> calendarbridge 301 KEPT. The old catch-all `/*` -> grayada.ms 302 was deleted at cutover; restoring it would shadow the whole site |

Runtime env still to be set on the project (Settings -> Environment variables,
or the same PATCH used above; record per the deploy-secrets rule when set from
a machine that can):

| Name | Type | Value |
|---|---|---|
| `ANTHROPIC_API_KEY` | secret | dedicated key, spend cap recommended. Until set, `/api/resume` answers 503 and the page says the generator is not configured |
| `NTFY_URL` / `NTFY_TOKEN` | secret | contact-form delivery. Blocked on exposing an authed ntfy endpoint (the box's ntfy is tunnel-internal and feeds the security stack); until then the form 503s and points at the email link |

## Deploying

Build vars are passed to the local build; only Functions runtime config lives
on the project.

```bash
cd ~/repos/brainmap
SITE_URL=https://graysonadams.com \
PUBLIC_TURNSTILE_SITEKEY=0x4AAAAAAEV4etU7ANRMW3Dw \
GITHUB_TOKEN=$(gh auth token) \
npm run build
```

(`GITHUB_TOKEN` lifts enrich.mjs over the anonymous rate limit; command
substitution keeps it out of any transcript.)

The upload runs under sandbroker so the Cloudflare credential is never seen.
The broker executes as its own user with a private /tmp and no read access
into $HOME, but it shares the host's loopback, so the tree is handed over as
a tarball on 127.0.0.1:

```bash
tar czf /tmp/claude-*/…/scratchpad/brainmap-deploy.tgz \
    dist functions src package.json node_modules
(cd <scratchpad> && python3 -m http.server 8917 --bind 127.0.0.1 &)
```

Then one brokered command (Production vault; it is unlock-gated, so a human
may need `sudo sandbroker unlock Production --minutes 30` first):

```
mcp__sandbroker-production__run
  secrets: CF_EMAIL=op://Production/Cloudflare Global API Key/username
           CF_KEY=op://Production/Cloudflare Global API Key/password
  command: mkdir -p /tmp/bm && cd /tmp/bm \
    && curl -s http://127.0.0.1:8917/brainmap-deploy.tgz | tar xz \
    && HOME=/tmp/bm/.home CLOUDFLARE_API_KEY="$CF_KEY" CLOUDFLARE_EMAIL="$CF_EMAIL" \
       ./node_modules/wrangler/bin/wrangler.js pages deploy dist \
       --project-name brainmap --branch main --commit-dirty=true
```

Kill the loopback server and delete the tarball afterwards. Wrangler finds
`functions/` relative to its cwd and bundles it with the repo's own
node_modules, which is why the tarball carries more than `dist`.

## /resume/view and the monthly refresh

`GET /resume/view` (functions/resume/view.ts) renders the canonical PDF from
`src/data/canonical-resume.json`, which is committed and bundled at deploy
time, so freshness comes from redeploying. `npm run resume:check` proves the
content still fits one page.

The re-assessment is a scheduled headless Claude run:
`resume-refresh.timer` (dotfiles `systemd` package, monthly on the 1st,
Persistent=true) runs `scripts/refresh-resume-prompt.md` in this repo, which
rewrites canonical-resume.json from the rebuilt knowledge base, re-runs the
checks, deploys as above, and commits only the JSON.

## DNS (zone graysonadams.com)

Apex and `www` are proxied CNAMEs to `brainmap-3vg.pages.dev`, registered as
custom domains on the Pages project. Fastmail MX/DKIM/SPF records in the zone
are load-bearing; never touch them when editing site records.

## Post-deploy verification

- `/graph.json` serves; map renders; `/idea/<slug>` + `.md` mirror serve.
- Grep a teaser node's body text against the deployed site: zero hits.
- Contact form round-trips to ntfy once configured; `/api/resume` generates
  and the PDF downloads once `ANTHROPIC_API_KEY` is set; 6th generation of
  the day returns the budget message.
- `/resume/view` returns 200 `application/pdf`, one page, `Last-Modified`
  matching canonical-resume.json's `generatedAt`.
- AI-crawler blocking: the zone setting targets verified crawlers by IP, so a
  spoofed `curl -A GPTBot` still gets 200 and proves nothing; confirm the
  setting itself (`GET /zones/<id>/bot_management` -> `ai_bots_protection:
  block`). `curl <site>/llms.txt` fine.
- `/og.png`, `/favicon.ico`, `/favicon.svg`, `/apple-touch-icon.png`,
  `/site.webmanifest` and `/sitemap-index.xml` all return 200. The head
  references every one of them, and a reference to a missing file is worse
  than no reference: the link preview falls back to a bare URL.
- Paste the URL into Slack or LinkedIn and confirm the card renders.
- Lighthouse 95+ on `/` and one node page.
