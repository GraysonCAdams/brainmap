import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

/**
 * Markdown mirror of a node page, for assistive AI and anyone who prefers
 * plain text. Public nodes only; teasers never get a mirror.
 */
export async function getStaticPaths() {
  const nodes = await getCollection('nodes', (n) => n.data.visibility === 'public');
  return nodes.map((node) => ({ params: { slug: node.id }, props: { node } }));
}

export const GET: APIRoute = ({ props }) => {
  const { node } = props as { node: Awaited<ReturnType<typeof getCollection>>[number] };
  const d = node.data;
  const header = [
    `# ${d.title}`,
    '',
    `> ${d.tagline}`,
    '',
    `- Status: ${d.status}`,
    `- Domain: ${d.domain}`,
    `- Since: ${d.started.toISOString().slice(0, 10)}`,
    ...(d.repo ? [`- Repo: https://github.com/${d.repo}`] : []),
    ...(d.tech.length ? [`- Tech: ${d.tech.join(', ')}`] : []),
    '',
  ].join('\n');
  return new Response(header + (node.body ?? ''), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
