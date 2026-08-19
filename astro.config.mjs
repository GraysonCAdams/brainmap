// @ts-check
import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Domain-agnostic: the canonical URL is injected at deploy time (CF Pages env var).
// Falls back to a placeholder so local builds and previews work without config.
const site = process.env.SITE_URL || 'https://brainmap.pages.dev';

const nodesDir = fileURLToPath(new URL('./src/content/nodes/', import.meta.url));

/**
 * `<lastmod>` for each node page, keyed by pathname.
 *
 * The frontmatter is read straight off disk because the sitemap integration
 * serialises URLs from config land, where the content collection is not
 * reachable. Only two fields are wanted and both are plain ISO dates, hence a
 * regex rather than a YAML parser; it stops at the date so that a trailing
 * `# UNVERIFIED:` note on the same line does not come along with it.
 *
 * The value is `ended ?? started`, which is the project's own timeline rather
 * than the day its prose was last edited, and is the same date Base.astro
 * publishes as article:modified_time. File mtimes would be the more literal
 * answer and are the wrong one: git does not restore them, so a fresh clone on
 * the build machine would tell every crawler that every page changed today.
 */
function nodeLastmod() {
  const dates = new Map();
  // Paths rather than Dirents: entry.parentPath is not on every Node release
  // Astro still supports, and the relative path is what the slug needs anyway.
  for (const rel of readdirSync(nodesDir, { recursive: true, encoding: 'utf8' })) {
    if (!rel.endsWith('.md')) continue;
    const src = readFileSync(join(nodesDir, rel), 'utf8');
    // Teaser nodes get no page, so they are never in the sitemap to begin with.
    if (/^visibility:\s*teaser\b/m.test(src)) continue;
    const started = src.match(/^started:\s*(\d{4}-\d{2}-\d{2})/m)?.[1];
    if (!started) continue;
    const ended = src.match(/^ended:\s*(\d{4}-\d{2}-\d{2})/m)?.[1];
    // The slug is the path under the collection root, minus the extension,
    // which is the id the glob loader gives the same file.
    const slug = rel.slice(0, -'.md'.length).split(sep).join('/');
    dates.set(`/idea/${slug}`, new Date(`${ended ?? started}T00:00:00Z`).toISOString());
  }
  return dates;
}

const lastmod = nodeLastmod();
/** The map and the project log both render every node, so both move when any node does. */
const newestNode = [...lastmod.values()].sort().pop();

export default defineConfig({
  site,
  trailingSlash: 'never',
  // The map moved from /map to the landing page; keep old links working.
  redirects: {
    '/map': '/',
  },
  build: {
    format: 'file',
  },
  integrations: [
    sitemap({
      // The text routes are their own thing (/llms.txt, /sitemap.txt) and
      // graph.json is data the map fetches, not a page a crawler should index.
      filter: (page) => !/\.(txt|json|md)$/.test(new URL(page).pathname),
      // The integration writes the root as a bare origin, since trailingSlash
      // is 'never', while the page's own canonical keeps the slash. The two
      // are the same URL under RFC 3986, so this is left alone; overriding the
      // href here is silently discarded anyway.
      serialize(item) {
        const path = new URL(item.url).pathname.replace(/(.)\/$/, '$1');
        const when = lastmod.get(path) ?? (path === '/' || path === '/bio' ? newestNode : undefined);
        return when ? { ...item, lastmod: when } : item;
      },
    }),
  ],
});
