import type { APIRoute } from 'astro';

/**
 * robots.txt is generated rather than static because the `Sitemap:` directive
 * has to be an absolute URL and the canonical origin is only known at deploy
 * time (SITE_URL, see astro.config.mjs). The static file this replaced ended
 * with a relative `Sitemap: /sitemap.txt`, which the spec does not allow and
 * which every crawler therefore ignored.
 *
 * Every user-agent token below was checked against its own vendor's current
 * documentation. That matters more than it sounds: several vendors run one
 * crawler for training and separate ones for search and for user-initiated
 * fetches, so a token written from memory tends to block the assistant a
 * reader asked to open the page while leaving the training crawler welcome.
 */
export const GET: APIRoute = ({ site }) => {
  const base = site?.toString().replace(/\/$/, '') ?? '';
  const body = `# Posture: training crawlers are disallowed; assistive fetchers are welcome.
# This is deterrence and license posture, not enforcement (see /colophon).
# Cloudflare's AI-crawler blocking backs this at the edge.
#
# The line is drawn per crawler, not per company. Blocking a vendor wholesale
# would take the retrieval fetchers down with the training one, and those are
# how a reader's assistant reaches this site at all.

# ---- corpus building for model training: disallowed ----

# OpenAI's training crawler. Its search and user-initiated fetchers are
# separate tokens and are allowed below.
User-agent: GPTBot
Disallow: /

# Anthropic's crawler. Claude-SearchBot and Claude-User are separate, below.
User-agent: ClaudeBot
Disallow: /

# Common Crawl does not train anything itself, but its archive is the raw
# material most model corpora are drawn from, so it sits on this side.
User-agent: CCBot
Disallow: /

# Google's and Apple's opt-out controls. Neither fetches a page: they only say
# whether what Googlebot and Applebot already crawled may be used to train
# Gemini and Apple Intelligence. Search indexing is unaffected by both.
User-agent: Google-Extended
Disallow: /

User-agent: Applebot-Extended
Disallow: /

# Meta's training crawler. meta-externalfetcher is the user-initiated one and
# is allowed below.
User-agent: meta-externalagent
Disallow: /

# ByteDance feeds Toutiao search and ByteDance model training from a single
# crawler with no separate token for either, so the whole thing is refused.
User-agent: Bytespider
Disallow: /

# ---- retrieval and user-initiated fetching: welcome ----
# Someone asking an assistant about this site is exactly who it is written for,
# and every fetcher here retrieves a page because a person asked for it.
#
# They share one group rather than getting a group each because a crawler only
# reads the single most specific group that matches it. Seven separate groups
# would mean seven copies of the Content-Signal line, and a copy left behind on
# the next edit is how that line ends up saying different things to different
# vendors.
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: meta-externalfetcher
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /

# Content Signals (contentsignals.org) say what may be done with a page once it
# has been fetched, which is the half robots.txt has never covered. They restate
# the license in /colophon: quote it, ground an answer in it, do not train on
# it. The signal is repeated in the wildcard group because a crawler that
# matched the group above never reads this one.
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /

# The same reservation in the W3C TDM Reservation Protocol's own format, for a
# miner that looks there rather than here: ${base}/.well-known/tdmrep.json

Sitemap: ${base}/sitemap-index.xml
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
