import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { DOMAIN_LABELS } from '../content.config';
import enrichment from '../data/enrichment.json';

const enriched = enrichment as Record<
  string,
  { freshness?: number; missing?: boolean }
>;

/**
 * The single data payload the graph island consumes.
 *
 * Doubles as the build-time integrity gate: an edge pointing at a slug that
 * doesn't exist fails the whole build, loudly, here.
 *
 * Teaser nodes are included as map presence only: title, tagline, status,
 * domain. No body, no repo, nothing else, so the payload can never leak a
 * stealth idea's content.
 */
export const GET: APIRoute = async () => {
  const all = await getCollection('nodes');
  const slugs = new Set(all.map((n) => n.id));

  const badEdges = all.flatMap((n) =>
    n.data.links
      .filter((target) => !slugs.has(target))
      .map((target) => `${n.id} -> ${target}`),
  );
  if (badEdges.length > 0) {
    throw new Error(
      `graph.json: links reference nonexistent node slugs:\n  ${badEdges.join('\n  ')}`,
    );
  }

  const nodes = all.map((n) => {
    const base = {
      id: n.id,
      title: n.data.title,
      tagline: n.data.tagline,
      status: n.data.status,
      domain: n.data.domain,
      tags: n.data.tags,
      visibility: n.data.visibility,
    };
    if (n.data.visibility === 'teaser') return base;
    return {
      ...base,
      started: n.data.started.toISOString().slice(0, 10),
      ended: n.data.ended ? n.data.ended.toISOString().slice(0, 10) : null,
      org: n.data.org ?? null,
      repo: n.data.repo ?? null,
      tech: n.data.tech,
      scale: n.data.scale,
      featured: n.data.featured ?? null,
      freshness: enriched[n.id]?.freshness ?? null,
    };
  });

  // Edges are deduplicated as undirected pairs (a->b and b->a are one link).
  const seen = new Set<string>();
  const edges: { source: string; target: string }[] = [];
  for (const n of all) {
    for (const target of n.data.links) {
      const key = [n.id, target].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: n.id, target });
    }
  }

  return new Response(JSON.stringify({ nodes, edges , domainLabels: DOMAIN_LABELS}), {
    headers: { 'Content-Type': 'application/json' },
  });
};
