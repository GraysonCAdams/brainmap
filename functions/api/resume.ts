/**
 * Convert-to-resume endpoint (Cloudflare Pages Function).
 *
 * Visitor picks nodes -> Claude tailors resume TEXT (bullets, project blurbs,
 * skill emphasis) -> client renders the fixed PDF template. Layout is code;
 * the model cannot invent employers, dates, titles, or numbers because those
 * are injected from resume-facts.json client-side and the model is only asked
 * for bullet/blurb text grounded in supplied source material.
 *
 * Env (CF Pages settings; values recorded in 1Password MCP vault):
 *   ANTHROPIC_API_KEY   API key (spend-capped key recommended)
 *   TURNSTILE_SECRET    shared with the contact form
 *   RESUME_KV           KV namespace binding for rate limiting
 *
 * Rate limits are deliberate and fail closed:
 *   5 generations per UTC day GLOBALLY, 2 per IP. KV get/increment is not
 *   atomic, but at 5/day scale a lost race overruns by at most 1.
 */
import Anthropic from '@anthropic-ai/sdk';
import facts from '../../src/data/resume-facts.json';

interface Env {
  ANTHROPIC_API_KEY?: string;
  TURNSTILE_SECRET?: string;
  RESUME_KV?: KVNamespace;
  ASSETS: Fetcher;
}

const GLOBAL_LIMIT = 5;
const IP_LIMIT = 2;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['skillsets', 'selectedProjects', 'experienceBullets'],
  properties: {
    skillsets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value'],
        properties: { label: { type: 'string' }, value: { type: 'string' } },
      },
    },
    selectedProjects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'bullets'],
        properties: {
          title: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    experienceBullets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'bullets'],
        properties: {
          id: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ANTHROPIC_API_KEY || !env.TURNSTILE_SECRET || !env.RESUME_KV) {
    return json(503, { error: 'Resume generator is not configured yet.' });
  }

  let body: { interest?: unknown; turnstileToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Bad request.' });
  }
  const interest = typeof body.interest === 'string' ? body.interest.slice(0, 500) : '';

  // Turnstile. An absent token is a misconfigured page, not a failed human:
  // Cloudflare rejects an empty response even with the always-passes test
  // secret, so without this branch a missing PUBLIC_TURNSTILE_SITEKEY sends
  // every visitor to "Anti-bot check failed. Reload and try again." forever,
  // and reloading is exactly what cannot help.
  const token = String(body.turnstileToken ?? '');
  if (!token) {
    return json(400, {
      error:
        'The anti-bot widget did not load, so this form cannot be submitted. That is a site configuration problem, not you.',
    });
  }
  const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET,
      response: token,
      remoteip: request.headers.get('CF-Connecting-IP'),
    }),
  });
  const outcome = (await verify.json()) as { success: boolean };
  if (!outcome.success) return json(403, { error: 'Anti-bot check failed. Reload and try again.' });

  // Rate limits: global 5/day, per-IP 2/day (UTC), keys expire after 2 days.
  const day = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const gKey = `g:${day}`;
  const ipKey = `ip:${day}:${ip}`;
  const [gCount, ipCount] = await Promise.all([
    env.RESUME_KV.get(gKey).then((v) => Number(v ?? 0)),
    env.RESUME_KV.get(ipKey).then((v) => Number(v ?? 0)),
  ]);
  if (gCount >= GLOBAL_LIMIT) {
    return json(429, {
      error:
        "Today's generation budget (5) is used up. Try again tomorrow, or just read the write-ups.",
    });
  }
  if (ipCount >= IP_LIMIT) {
    return json(429, {
      error: 'You have hit the per-visitor limit for today.',
    });
  }
  await Promise.all([
    env.RESUME_KV.put(gKey, String(gCount + 1), { expirationTtl: 172800 }),
    env.RESUME_KV.put(ipKey, String(ipCount + 1), { expirationTtl: 172800 }),
  ]);

  // Auto-source: every public node's markdown mirror is candidate material;
  // the model selects the most relevant projects for the stated interest.
  const graphRes = await env.ASSETS.fetch(new URL('/graph.json', request.url));
  if (!graphRes.ok) return json(502, { error: 'Site data unavailable.' });
  const graph = (await graphRes.json()) as {
    nodes: { id: string; visibility: string; featured?: number | null }[];
  };
  const publicSlugs = graph.nodes
    .filter((n) => n.visibility === 'public')
    .sort((a, b) => (a.featured ?? 99) - (b.featured ?? 99))
    .map((n) => n.id)
    .slice(0, 40);
  const nodeDocs = await Promise.all(
    publicSlugs.map(async (slug) => {
      const res = await env.ASSETS.fetch(new URL(`/idea/${slug}.md`, request.url));
      return res.ok ? `--- ${slug} ---\n${await res.text()}` : null;
    }),
  );
  const material = nodeDocs.filter(Boolean).join('\n\n').slice(0, 120_000);
  if (!material) return json(502, { error: 'No project material available.' });

  // Everything from here can throw (network, auth, model error). An uncaught
  // throw in a Pages Function returns a raw stack trace to the browser, which
  // leaks file paths and internals, and it also strands the budget reserved
  // above. Both are handled below; see `refund`.
  const refund = async () => {
    await Promise.all([
      env.RESUME_KV!.put(gKey, String(gCount), { expirationTtl: 172800 }),
      env.RESUME_KV!.put(ipKey, String(ipCount), { expirationTtl: 172800 }),
    ]).catch(() => {});
  };

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let response;
  try {
    response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4096,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
      },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        "You tailor the TEXT of Grayson Adams's resume for a visitor to his portfolio site.",
        'HARD RULES:',
        "- Never invent facts. Every bullet must be grounded in the FACTS or PROJECT MATERIAL provided. You may rephrase and re-order to emphasize the visitor's interests; you may never add employers, titles, dates, metrics, or technologies that are not in the source.",
        '- skillsets: exactly 5 rows, keep the original labels, re-order items within each value to lead with what is most relevant.',
        "- selectedProjects: YOU choose the 2-4 projects from the PROJECT MATERIAL most relevant to the visitor's stated interest (if none stated, choose the strongest shipped work). Title verbatim from the material, 1-2 bullets each drawn from its Problem/Approach/Edge cases/Outcome; write in resume voice (past-tense verb first). Skip placeholder/draft material that lacks substance.",
        "- experienceBullets: one entry per experience id, bullets chosen from that job's original bullets (rephrasing allowed, count must not exceed the original count). Total across all jobs at most 12 so everything fits on one page; keep at least 1 bullet per job and weight the extra bullets toward the most relevant jobs.",
        '- No em dashes in output text; use plain ASCII punctuation.',
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: `FACTS (canonical, JSON):\n${JSON.stringify(facts)}\n\nPROJECT MATERIAL (all public projects; select the most relevant):\n${material}\n\nVISITOR'S STATED INTEREST: ${interest || '(none given)'}\n\nProduce the tailored resume text.`,
        },
      ],
    });
  } catch (err) {
    // A generation that never happened must not spend the day's budget. With
    // a global ceiling of five, a handful of upstream errors would otherwise
    // lock every visitor out until UTC midnight for requests that produced
    // nothing.
    await refund();
    console.error('resume generation failed', err);
    return json(502, {
      error: 'Generation failed upstream. Try again in a moment.',
    });
  }

  if (response.stop_reason === 'refusal') {
    await refund();
    return json(502, {
      error: 'Generation was declined. Try a different selection.',
    });
  }
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') {
    await refund();
    return json(502, { error: 'Generation failed. Try again.' });
  }
  let result: unknown;
  try {
    result = JSON.parse(text.text);
  } catch {
    // Schema-constrained output should always parse; if it somehow does not,
    // that is our failure and the visitor should not be charged for it.
    await refund();
    return json(502, {
      error: 'Generation returned malformed data. Try again.',
    });
  }

  return json(200, { result, remainingToday: GLOBAL_LIMIT - gCount - 1 });
};
