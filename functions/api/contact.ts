/**
 * Contact form endpoint (Cloudflare Pages Function).
 *
 * Delivery is an email over Fastmail's JMAP API (src/scripts/jmap-mail.ts):
 * the visitor's message arrives in his inbox with Reply-To set to the address
 * they gave, so answering is a reply rather than a copy-paste. The recipient
 * is fixed inside the mail module, never chosen here: this endpoint fronts an
 * anonymous public form with his real sending identity behind it, and a form
 * that picks recipients is an open relay wearing his address.
 *
 * Env (CF Pages project settings):
 *   TURNSTILE_SECRET     server-side Turnstile secret, shared with /api/resume
 *   FASTMAIL_API_TOKEN   Fastmail API token scoped to mail submission
 *                        (vault item "Fastmail API token: portfolio-site")
 *
 * Fails closed: without configuration it refuses rather than pretending.
 */
import { sendMail } from '../../src/scripts/jmap-mail';

interface Env {
  TURNSTILE_SECRET?: string;
  FASTMAIL_API_TOKEN?: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.TURNSTILE_SECRET || !env.FASTMAIL_API_TOKEN) {
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
  // Reply-To is the only place this lands, so the bar is "a reply could
  // conceivably route", not full validation; a garbage address costs him one
  // bounced reply, never a misdelivered message.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: 'That email address does not look deliverable.' });
  }
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

  // The site's own copy runs lowercase; mail does not. These land between
  // real correspondence in his inbox, so they dress like it.
  let failure: string | null;
  try {
    failure = await sendMail(env.FASTMAIL_API_TOKEN, {
      subject: `Contact form: ${name}`,
      body: `${message}\n\n--\n${name}\n${email}\nVia the graysonadams.com contact form`,
      replyTo: { name, email },
    });
  } catch (err) {
    console.error('contact delivery threw', err);
    failure = 'exception';
  }
  if (failure) {
    console.error(`contact delivery failed at: ${failure}`);
    return json(502, { error: 'Delivery failed. Use the email link instead.' });
  }

  return json(200, { ok: true });
};
