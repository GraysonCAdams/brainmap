import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../site.config';

/**
 * llms.txt: the site's map for assistive AI (recruiter-side screeners and
 * chat assistants). Every public node links its clean markdown mirror.
 * Teaser nodes are deliberately absent.
 */
export const GET: APIRoute = async ({ site }) => {
  const nodes = (await getCollection('nodes', (n) => n.data.visibility === 'public')).sort(
    (a, b) => b.data.started.valueOf() - a.data.started.valueOf(),
  );
  const base = site?.toString().replace(/\/$/, '') ?? '';
  const lines = [
    `# ${SITE.name} · ${SITE.title}`,
    '',
    `> ${SITE.description}`,
    '',
    '## Ideas and projects (full write-ups as markdown)',
    '',
    ...nodes.map(
      (n) =>
        `- [${n.data.title}](${base}/idea/${n.id}.md): ${n.data.tagline} (${n.data.status}, ${n.data.domain})`,
    ),
    '',
    '## Other',
    '',
    `- [Every write-up above, concatenated into one file](${base}/llms-full.txt)`,
    `- [Bio and full project log](${base}/bio)`,
    `- [Colophon: how this site is made, and its license](${base}/colophon)`,
  ];
  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
