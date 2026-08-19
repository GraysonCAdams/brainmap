/**
 * Outbound mail for the Pages Functions, over Fastmail's JMAP API.
 *
 * Both senders on this site (the contact form, the resume-generation
 * notification) are anonymous public endpoints with his real mail identity
 * behind them, so this module hard-codes the envelope: everything goes TO
 * him and only to him. A caller chooses subject, body, attachments and an
 * optional Reply-To; it never chooses a recipient, because a stranger's form
 * post must not be able to point his identity at a third party.
 *
 * Sending identity, in his stated preference order: the Gmail identity first
 * (Fastmail relays it through Google's own SMTP; submission verified working
 * 2026-08-19 despite its "unverified" flag), then his name on the site's own
 * domain if that external credential ever lapses. Owned-domain identities are
 * wildcards ("*@graysonadams.com"), so each preference matches
 * exact-or-wildcard and the wildcard carries the concrete address.
 */

/** Where every mail this module sends is delivered. */
export const MAIL_TO = 'grayson@graysonadams.com';

const FROM_PREFERENCE = ['graysonadams@gmail.com', 'grayson@graysonadams.com'];

const JMAP_USING = [
  'urn:ietf:params:jmap:core',
  'urn:ietf:params:jmap:mail',
  'urn:ietf:params:jmap:submission',
];

export interface MailAttachment {
  name: string;
  type: string;
  bytes: Uint8Array;
}

export interface OutboundMail {
  subject: string;
  body: string;
  replyTo?: { name: string; email: string };
  attachments?: MailAttachment[];
}

/**
 * Send one email. Returns null on success, or a short stage name for the log
 * on failure; the visitor-facing wording is the caller's job. Two round trips
 * after the session fetch (plus one blob upload per attachment): lookups have
 * no creation-state to reference, while the submission can name the draft it
 * is sending with a `#creation-id`. The draft is destroyed on successful
 * send; the copy that matters is the one arriving in the inbox.
 */
export async function sendMail(token: string, mail: OutboundMail): Promise<string | null> {
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const session = (await (
    await fetch('https://api.fastmail.com/jmap/session', { headers: auth })
  ).json()) as {
    apiUrl?: string;
    uploadUrl?: string;
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

  let identity: { id: string; email: string } | undefined;
  let fromAddress = '';
  for (const want of FROM_PREFERENCE) {
    identity =
      identities?.find((i) => i.email === want) ??
      identities?.find((i) => i.email === `*@${want.split('@')[1]}`);
    if (identity) {
      fromAddress = want;
      break;
    }
  }
  if (!identity && identities?.[0]) {
    // No preferred identity exists any more; any identity keeps mail flowing,
    // sending as itself since it cannot carry an address it does not own.
    identity = identities[0];
    fromAddress = identity.email.startsWith('*@') ? MAIL_TO : identity.email;
  }
  if (!draftsId || !identity) return 'lookup';

  // Attachments become blobs first; the upload endpoint is a plain POST of
  // the bytes, outside the method-call protocol.
  const uploaded: { blobId: string; type: string; name: string; disposition: string }[] = [];
  for (const a of mail.attachments ?? []) {
    if (!session.uploadUrl) return 'upload';
    const up = (await (
      await fetch(session.uploadUrl.replace('{accountId}', accountId), {
        method: 'POST',
        headers: { Authorization: auth.Authorization, 'Content-Type': a.type },
        body: a.bytes as unknown as BodyInit,
      })
    ).json()) as { blobId?: string };
    if (!up.blobId) return 'upload';
    uploaded.push({ blobId: up.blobId, type: a.type, name: a.name, disposition: 'attachment' });
  }

  const send = await call([
    [
      'Email/set',
      {
        accountId,
        create: {
          msg: {
            mailboxIds: { [draftsId]: true },
            keywords: { $draft: true, $seen: true },
            from: [{ name: 'Grayson Adams', email: fromAddress }],
            to: [{ name: 'Grayson Adams', email: MAIL_TO }],
            ...(mail.replyTo ? { replyTo: [mail.replyTo] } : {}),
            subject: mail.subject,
            bodyValues: { t: { value: mail.body } },
            textBody: [{ partId: 't', type: 'text/plain' }],
            ...(uploaded.length > 0 ? { attachments: uploaded } : {}),
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
