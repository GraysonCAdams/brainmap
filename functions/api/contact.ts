/**
 * Contact form endpoint (Cloudflare Pages Function).
 *
 * Env (CF Pages project settings; values recorded in 1Password MCP vault):
 *   TURNSTILE_SECRET  server-side Turnstile secret
 *   NTFY_URL          full ntfy topic URL to deliver to
 *   NTFY_TOKEN        optional bearer token for the ntfy server
 *
 * Fails closed: without configuration it refuses rather than pretending.
 */
interface Env {
  TURNSTILE_SECRET?: string;
  NTFY_URL?: string;
  NTFY_TOKEN?: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.TURNSTILE_SECRET || !env.NTFY_URL) {
    return json(503, { error: 'Contact form is not configured yet. Use the email link instead.' });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: 'Bad request.' });
  }

  const name = String(form.get('name') ?? '').slice(0, 120).trim();
  const email = String(form.get('email') ?? '').slice(0, 200).trim();
  const message = String(form.get('message') ?? '').slice(0, 4000).trim();
  const token = String(form.get('cf-turnstile-response') ?? '');
  if (!name || !email || !message) return json(400, { error: 'All fields are required.' });
  if (!token) return json(400, { error: 'Anti-spam check did not load. Reload and try again.' });

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
  if (!outcome.success) return json(403, { error: 'Anti-spam check failed. Reload and try again.' });

  const delivered = await fetch(env.NTFY_URL, {
    method: 'POST',
    headers: {
      Title: `brainmap contact: ${name}`,
      Tags: 'email',
      ...(env.NTFY_TOKEN ? { Authorization: `Bearer ${env.NTFY_TOKEN}` } : {}),
    },
    body: `From: ${name} <${email}>\n\n${message}`,
  });
  if (!delivered.ok) return json(502, { error: 'Delivery failed. Use the email link instead.' });

  return json(200, { ok: true });
};
