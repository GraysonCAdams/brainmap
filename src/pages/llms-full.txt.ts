import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../site.config';

/**
 * llms-full.txt: every public write-up concatenated, for a fetcher that is
 * allowed one request and should not have to walk 70-odd links to read the
 * site. /llms.txt stays the index; this is the corpus behind it, and the two
 * cover the same set of nodes so a reader cannot find a link in one that is
 * missing from the other.
 *
 * Sections are ordered newest first, matching /llms.txt and the project log.
 * Teaser nodes are absent here exactly as they are there.
 */
export const GET: APIRoute = async ({ site }) => {
  const nodes = (await getCollection('nodes', (n) => n.data.visibility === 'public')).sort(
    (a, b) => b.data.started.valueOf() - a.data.started.valueOf(),
  );
  const base = site?.toString().replace(/\/$/, '') ?? '';
  const day = (d: Date) => d.toISOString().slice(0, 10);

  const sections = nodes.map((n) => {
    const d = n.data;
    const meta = [
      `- Status: ${d.status}`,
      `- Domain: ${d.domain}`,
      ...(d.tags.length ? [`- Also: ${d.tags.join(', ')}`] : []),
      ...(d.org ? [`- Built for: ${d.org}`] : []),
      `- Since: ${day(d.started)}`,
      ...(d.ended ? [`- Until: ${day(d.ended)}`] : []),
      ...(d.repo ? [`- Repo: https://github.com/${d.repo}`] : []),
      ...(d.tech.length ? [`- Tech: ${d.tech.join(', ')}`] : []),
      // The markdown mirror is the citable single-page source for this section.
      `- Source: ${base}/idea/${n.id}.md`,
    ];
    return [`## ${d.title}`, '', `> ${d.tagline}`, '', ...meta, '', (n.body ?? '').trim()].join(
      '\n',
    );
  });

  const body = [
    `# ${SITE.name} · ${SITE.title}`,
    '',
    `> ${SITE.description}`,
    '',
    `${SITE.name} is a ${SITE.jobTitle} at ${SITE.employer}. Everything below is one write-up per project, in the order the projects started, newest first. Each follows the same shape: problem, constraints, approach, edge cases considered, tradeoffs, outcome.`,
    '',
    `Index of the same set, with links: ${base}/llms.txt`,
    `Bio and full project log: ${base}/bio`,
    `Colophon, including the license these write-ups are published under: ${base}/colophon`,
    '',
    '## Contents',
    '',
    ...nodes.map((n) => `- ${n.data.title} (${n.data.status}, ${n.data.domain})`),
    '',
    ...sections.flatMap((s) => ['---', '', s, '']),
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
