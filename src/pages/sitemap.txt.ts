import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const base = site?.toString().replace(/\/$/, '') ?? '';
  const nodes = await getCollection('nodes', (n) => n.data.visibility === 'public');
  const urls = [
    `${base}/`,
    `${base}/map`,
    `${base}/colophon`,
    `${base}/contact`,
    ...nodes.map((n) => `${base}/idea/${n.id}`),
  ];
  return new Response(urls.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
