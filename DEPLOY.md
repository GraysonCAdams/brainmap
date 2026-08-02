# Deployment runbook (Cloudflare Pages)

Build config: framework Astro, build command `npm run build`, output `dist`,
Node 20+. Functions in `functions/` deploy automatically.

## One-time Cloudflare setup (dashboard)

1. **Pages project**: Workers & Pages -> Create -> Pages -> connect
   `GraysonCAdams/brainmap`, branch `main`.
2. **Turnstile**: create a widget (domain: the pages.dev domain + real domain
   later). Note the site key + secret.
3. **KV**: create namespace `brainmap-resume-limits`; bind to the Pages project
   as `RESUME_KV`.
4. **Env vars / secrets** on the Pages project (record each secret in the
   1Password MCP vault per the deploy-secrets rule):
   | Name | Type | Value |
   |---|---|---|
   | `PUBLIC_TURNSTILE_SITEKEY` | build var | Turnstile site key |
   | `TURNSTILE_SECRET` | secret | Turnstile secret |
   | `ANTHROPIC_API_KEY` | secret | dedicated key, spend cap recommended |
   | `NTFY_URL` | secret | ntfy topic URL for contact-form delivery |
   | `NTFY_TOKEN` | secret | ntfy bearer token (if the topic needs auth) |
   | `GITHUB_TOKEN` | secret | fine-grained read-only PAT for enrichment |
   | `SITE_URL` | build var | canonical URL once the domain is chosen |
5. **Deploy hook**: create one; add its URL as GitHub Actions secret
   `CF_PAGES_DEPLOY_HOOK_URL` (`gh secret set CF_PAGES_DEPLOY_HOOK_URL`).
6. **AI-crawler blocking**: zone (or account) level -> enable "Block AI
   scrapers and crawlers". robots.txt in this repo is the polite layer.

## Post-deploy verification

- `/graph.json` serves; map renders; `/idea/<slug>` + `.md` mirror serve.
- Grep a teaser node's body text against the deployed site: zero hits.
- Contact form round-trips to ntfy; `/api/resume` generates and the PDF
  downloads; 6th generation of the day returns the budget message.
- `curl -A GPTBot <site>` blocked at CF edge; `curl <site>/llms.txt` fine.
- Lighthouse 95+ on `/` and one node page.
