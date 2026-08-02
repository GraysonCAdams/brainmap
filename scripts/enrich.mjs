#!/usr/bin/env node
/**
 * Build-time GitHub enrichment: for every node with a `repo:` frontmatter
 * field, fetch last-push date, primary language, and stars. Writes
 * src/data/enrichment.json consumed by graph.json and node pages.
 *
 * Failure posture (link-integrity layer 2):
 *  - API error / rate limit: keep the previous entry (stale beats broken),
 *    warn, never fail the build.
 *  - 404 (renamed/deleted/privated repo): record { missing: true } so the UI
 *    and the weekly report can surface it.
 *
 * Auth: GITHUB_TOKEN env var if present (CF Pages env var in CI); anonymous
 * otherwise (60 req/h is plenty at this scale).
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nodesDir = join(root, 'src/content/nodes');
const outPath = join(root, 'src/data/enrichment.json');

const files = (await readdir(nodesDir)).filter((f) => f.endsWith('.md'));
const repos = [];
for (const f of files) {
  const text = await readFile(join(nodesDir, f), 'utf8');
  const m = text.match(/^repo:\s*([\w.-]+\/[\w.-]+)\s*$/m);
  if (m) repos.push({ slug: f.replace(/\.md$/, ''), repo: m[1] });
}

let previous = {};
try {
  previous = JSON.parse(await readFile(outPath, 'utf8'));
} catch {
  /* first run */
}

const headers = { 'User-Agent': 'brainmap-enrich' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

/** last push age -> 0..1 freshness: 1 inside a week, linear decay to 0 at 180 days */
const freshness = (pushedAt) => {
  const days = (Date.now() - new Date(pushedAt).valueOf()) / 86400000;
  if (days <= 7) return 1;
  if (days >= 180) return 0;
  return +(1 - (days - 7) / 173).toFixed(3);
};

const out = {};
for (const { slug, repo } of repos) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (res.status === 404) {
      console.warn(`enrich: ${slug}: repo ${repo} returned 404 (renamed/deleted/private?)`);
      out[slug] = { repo, missing: true, checkedAt: new Date().toISOString() };
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    out[slug] = {
      repo,
      missing: false,
      pushedAt: data.pushed_at,
      freshness: freshness(data.pushed_at),
      language: data.language,
      stars: data.stargazers_count,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`enrich: ${slug}: ${err.message}; keeping previous entry`);
    if (previous[slug]) out[slug] = previous[slug];
  }
}

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`enrich: wrote ${Object.keys(out).length} entries for ${repos.length} repos`);
