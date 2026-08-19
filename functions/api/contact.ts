/**
 * Contact form endpoint (Cloudflare Pages Function).
 *
 * Delivery is an email he sends to himself over Fastmail's JMAP API: the
 * visitor's message arrives in his inbox with Reply-To set to the address they
 * gave, so answering is a reply rather than a copy-paste. The recipient is
 * fixed to the site's own contact address on purpose. This endpoint fronts an
 * anonymous public form with his real sending identity behind it; letting the
 * form choose a recipient would make it an open relay wearing his address.
 *
 * Env (CF Pages project settings):
 *   TURNSTILE_SECRET     server-side Turnstile secret, shared with /api/resume
 *   FASTMAIL_API_TOKEN   Fastmail API token scoped to mail submission
 *                        (vault item "Fastmail API token: portfolio-site")
 *
 * Fails closed: without configuration it refuses rather than pretending.
 */
import { SITE } from '../../src/site.config';

interface Env {
  TURNSTILE_SECRET?: string;
  FASTMAIL_API_TOKEN?: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const JMAP_USING = [
  'urn:ietf:params:jmap:core',
  'urn:ietf:params:jmap:mail',
  'urn:ietf:params:jmap:submission',
];

/**
 * Send the message to the site's own address via JMAP.
 *
 * Two round trips after the session fetch: mailbox and identity lookups have
 * no creation-state to reference, while the submission can name the email it
 * is sending with a `#creation-id`, so draft and submission share one call.
 * The draft is destroyed on successful send rather than moved to Sent; the
 * copy that matters is the one arriving in the inbox this is addressed to.
 *
 * Returns null on success, or a short reason for the log on failure. The
 * visitor only ever sees the generic delivery error either way; the reason
 * names which JMAP step balked, which is what debugging actually needs.
 */
async function deliver(
  token: string,
  visitor: { name: string; email: string; message: string },
): Promise<string | null> {
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const session = (await (
    await fetch('https://api.fastmail.com/jmap/session', { headers: auth })
  ).json()) as {
    apiUrl?: string;
    primaryAccounts?: Record<string, string>;
  };
  const accountId = session.primaryAccounts?.['urn:ietf:params:jmap:mail'];
  if (!session.apiUrl || !accountId) return 'session';

  const call = async (methodCalls: unknown[]) =>
    (await (
      await fetch(session.apiUrl!, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ using: JMAP_USING, methodCalls }),
      })
    ).json()) as { methodResponses: [string, Record<string, unknown>, string][] };

  const lookup = await call([
    ['Mailbox/query', { accountId, filter: { role: 'drafts' } }, 'mb'],
    ['Identity/get', { accountId }, 'id'],
  ]);
  const draftsId = (
    lookup.methodResponses.find(([m]) => m === 'Mailbox/query')?.[1].ids as string[] | undefined
  )?.[0];
  const identities = lookup.methodResponses.find(([m]) => m === 'Identity/get')?.[1].list as
    | { id: string; email: string }[]
    | undefined;
  const address = `${SITE.emailUser}@${SITE.emailDomain}`;
  // Fastmail identities for owned domains are wildcards ("*@grayada.ms"), so
  // an exact match on the published address usually misses. Prefer exact,
  // then the domain wildcard, and only then any identity at all; the last
  // case sends from that identity's own address because a wildcard literal
  // is not a deliverable From and an unrelated identity cannot carry ours.
  const identity =
    identities?.find((i) => i.email === address) ??
    identities?.find((i) => i.email === `*@${SITE.emailDomain}`) ??
    identities?.[0];
  if (!draftsId || !identity) return 'lookup';
  const fromAddress = identity.email.startsWith('*@') ? address : identity.email;

  const send = await call([
    [
      'Email/set',
      {
        accountId,
        create: {
          msg: {
            mailboxIds: { [draftsId]: true },
            keywords: { $draft: true, $seen: true },
            from: [{ name: SITE.name, email: fromAddress }],
            to: [{ name: SITE.name, email: address }],
            replyTo: [{ name: visitor.name, email: visitor.email }],
            subject: `contact form: ${visitor.name}`,
            bodyValues: {
              t: {
                value: `${visitor.message}\n\n--\n${visitor.name}\n${visitor.email}\nvia the graysonadams.com contact form`,
              },
            },
            textBody: [{ partId: 't', type: 'text/plain' }],
          },
        },
      },
      'e',
    ],
    [
      'EmailSubmission/set',
      {
        accountId,
        onSuccessDestroyEmail: ['#sub'],
        create: { sub: { emailId: '#msg', identityId: identity.id } },
      },
      's',
    ],
  ]);
  const created = send.methodResponses.find(([m]) => m === 'EmailSubmission/set')?.[1].created as
    | Record<string, unknown>
    | undefined;
  return created?.sub ? null : 'submission';
}

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

  let failure: string | null;
  try {
    failure = await deliver(env.FASTMAIL_API_TOKEN, { name, email, message });
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
