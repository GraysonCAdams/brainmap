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

  // Parent integrity. Each rule below exists because breaking it produces a
  // map that lies rather than a build that fails, which is the worse outcome.
  const byId = new Map(all.map((n) => [n.id, n]));
  const badParents: string[] = [];
  for (const n of all) {
    const pid = n.data.parent;
    if (!pid) continue;
    const p = byId.get(pid);
    if (!p) {
      badParents.push(`${n.id}: parent "${pid}" does not exist`);
      continue;
    }
    if (pid === n.id) {
      badParents.push(`${n.id}: is its own parent`);
      continue;
    }
    // One level only. Grandchildren would need an orbit-within-an-orbit the
    // renderer cannot draw, so they are rejected at the source instead.
    if (p.data.parent) {
      badParents.push(
        `${n.id}: parent "${pid}" is itself a child of "${p.data.parent}" (nesting is one level)`,
      );
    }
    // A teaser's whole point is that its content does not ship. Children
    // hanging off one would describe it by implication.
    if (p.data.visibility === 'teaser') {
      badParents.push(`${n.id}: parent "${pid}" is a teaser`);
    }
    // Children are laid out inside the parent's cluster. A cross-domain child
    // would be pulled toward two centroids and settle between them, drawn
    // inside a boundary it does not belong to.
    if (p.data.domain !== n.data.domain) {
      badParents.push(
        `${n.id}: domain "${n.data.domain}" must match parent "${pid}" domain "${p.data.domain}"`,
      );
    }
  }
  // A node that defers its detail view must have somewhere to defer TO,
  // otherwise it is a dot that cannot be opened at all.
  for (const n of all) {
    if (n.data.detail === 'parent' && !n.data.parent) {
      badParents.push(`${n.id}: detail "parent" requires a parent`);
    }
  }
  if (badParents.length > 0) {
    throw new Error(`graph.json: invalid parent references:\n  ${badParents.join('\n  ')}`);
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
      parent: n.data.parent ?? null,
      detail: n.data.detail,
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
  // Containment is emitted FIRST so that if a child also lists its parent in
  // `links`, the pair survives as the stronger of the two kinds rather than
  // the one that happened to be written down.
  const seen = new Set<string>();
  const edges: { source: string; target: string; kind: 'parent' | 'link' }[] = [];
  for (const n of all) {
    if (!n.data.parent) continue;
    seen.add([n.id, n.data.parent].sort().join('|'));
    edges.push({ source: n.id, target: n.data.parent, kind: 'parent' });
  }
  for (const n of all) {
    for (const target of n.data.links) {
      const key = [n.id, target].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: n.id, target, kind: 'link' });
    }
  }

  return new Response(JSON.stringify({ nodes, edges , domainLabels: DOMAIN_LABELS}), {
    headers: { 'Content-Type': 'application/json' },
  });
};
