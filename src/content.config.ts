import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Domains cluster the graph and drive the color encoding.
 * Adding a domain: extend this tuple, then give it a validated color token in
 * the design tokens (one place each; re-run the dataviz palette validator).
 */
/**
 * One axis: who was this for, and what was it for them.
 *
 * The previous set mixed three axes at once, problem domain (media, home),
 * artifact type (apps, utilities, workflows) and technology era (ai-tooling),
 * and a mixed axis always grows a sink bucket. `apps` became it, holding 30 of
 * 77 nodes and telling a reader nothing: a 200,000-user product and a personal
 * Todoist bridge rendered the same colour.
 *
 * The split that carries the most information is who used the thing, so that
 * is the axis. `ai-tooling` stays deliberately, despite being time-stamped:
 * on a map whose primary axis is time, marking when the work happened is a
 * feature rather than a wart.
 */
export const DOMAINS = [
  'home',
  'security',
  'tools',
  'media',
  'ai-tooling',
  'products',
  'client-work',
  'platform',
] as const;

/**
 * Display names. The slugs above key the schema, the colour tokens and every
 * node's frontmatter, so they are awkward to change; these are just what a
 * reader sees. Renaming a category is a one-line edit here, not a migration.
 * No hyphens: a slug reads as a slug, and these are meant to read as words.
 */
export const DOMAIN_LABELS: Record<(typeof DOMAINS)[number], string> = {
  home: 'home',
  security: 'security',
  tools: 'tools',
  media: 'media',
  'ai-tooling': 'ai tooling',
  products: 'products',
  'client-work': 'client work',
  platform: 'platform',
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
    /**
     * Slug of the node this one is a part of. Children orbit their parent on
     * the map and inherit an implicit edge to it, so a node like a single
     * client engagement can stand on its own without the parent's essay being
     * shattered into a dozen thin ones.
     *
     * Deliberately ONE level deep and validated as such: a tree would need a
     * layout that can nest, and the map has no such affordance. If a child
     * ever needs children of its own, that is a signal it should be promoted
     * to a top-level node, not that the schema should grow.
     */
    parent: z.string().optional(),
    /**
     * Where this node's detail view lives.
     *
     * 'own' (default) gets a static page at /idea/<slug>.
     * 'parent' gets NO page: the dot is real and named on the map, but
     * clicking it opens the parent's card instead.
     *
     * This exists for the case where a set of things is worth SEEING as
     * twenty distinct dots and worth READING as one essay. Twenty client
     * websites each deserve their place on the map, and not one of them
     * deserves a page saying "built a WordPress site for a realtor".
     * Requires `parent`, since without one there is nothing to defer to.
     */
    detail: z.enum(['own', 'parent']).default('own'),
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
