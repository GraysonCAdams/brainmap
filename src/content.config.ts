import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Domains cluster the graph and drive the color encoding.
 * Adding a domain: extend this tuple, then give it a color token in the
 * design tokens (one place each).
 */
export const DOMAINS = [
  'ai-tooling',
  'home-automation',
  'media',
  'finance',
  'infra',
  'web',
] as const;

export const STATUSES = ['idea', 'building', 'shipped', 'retired'] as const;

/**
 * One markdown file per node under src/content/nodes/.
 * The FILENAME is the slug (no slug frontmatter; renames can't drift).
 *
 * Body template every public node follows:
 *   Problem -> Constraints -> Approach -> Edge cases considered -> Tradeoffs -> Outcome
 *
 * visibility: 'teaser' nodes appear on the map (locked/dim, tagline only) but
 * get NO static page, NO body content in graph.json, and are excluded from
 * llms.txt / markdown mirrors / sitemap.
 */
const nodes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/nodes' }),
  schema: z.object({
    title: z.string().min(1),
    tagline: z.string().min(1).max(140),
    status: z.enum(STATUSES),
    domain: z.enum(DOMAINS),
    started: z.coerce.date(),
    /** owner/repo on GitHub; drives build-time freshness enrichment */
    repo: z
      .string()
      .regex(/^[\w.-]+\/[\w.-]+$/, 'repo must be owner/name')
      .optional(),
    /** slugs of related nodes; validated against the collection at build time */
    links: z.array(z.string()).default([]),
    visibility: z.enum(['public', 'teaser']).default('public'),
    /** tech keywords for filtering/search */
    tech: z.array(z.string()).default([]),
    /** flagship nodes surface in the "start here" path, lowest number first */
    featured: z.number().int().positive().optional(),
  }),
});

export const collections = { nodes };
