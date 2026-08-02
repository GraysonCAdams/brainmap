import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Domains cluster the graph and drive the color encoding.
 * Adding a domain: extend this tuple, then give it a validated color token in
 * the design tokens (one place each; re-run the dataviz palette validator).
 */
export const DOMAINS = [
  'home-automation',
  'security',
  'utilities',
  'media',
  'ai-tooling',
  'apps',
  'infra',
  'workflows',
] as const;

/**
 * Display names. The slugs above key the schema, the colour tokens and every
 * node's frontmatter, so they are awkward to change; these are just what a
 * reader sees. Renaming a category is a one-line edit here, not a migration.
 * No hyphens: a slug reads as a slug, and these are meant to read as words.
 */
export const DOMAIN_LABELS: Record<(typeof DOMAINS)[number], string> = {
  'home-automation': 'home',
  security: 'security',
  utilities: 'utilities',
  media: 'media',
  'ai-tooling': 'ai tooling',
  apps: 'apps',
  infra: 'infra',
  workflows: 'workflows',
};

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
    /** when the project stopped being active; open-ended if omitted */
    ended: z.coerce.date().optional(),
    /**
     * Secondary domains. `domain` stays singular (one lamp color, one cluster
     * home on the map); tags make the node match additional domain filters.
     */
    tags: z.array(z.enum(DOMAINS)).default([]),
    /**
     * The company this was built for, when it was not personal work.
     * Surfaces above the title in the map tooltip so employer projects are
     * never mistaken for side projects. Omit for personal work.
     */
    org: z.string().optional(),
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
    /**
     * Project caliber, 1-5: codebase size, user reach, ambition. Drives dot
     * size on the map. 1 = weekend hack, 5 = flagship.
     */
    scale: z.number().int().min(1).max(5).default(2),
    /** flagship nodes surface in the "start here" path, lowest number first */
    featured: z.number().int().positive().optional(),
  }),
});

export const collections = { nodes };
