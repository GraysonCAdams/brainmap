/**
 * Renders canonical-resume.json and fails if it does not land on one page.
 *
 *     npm run resume:check
 *
 * The monthly refresh job runs this between rewriting the JSON and deploying
 * it. /resume/view renders that file on every request with no fitting loop
 * behind it: the tailored path trims and refills until the document fits,
 * because a model wrote it, but the canonical document is supposed to already
 * fit, so the server-side renderer has nothing to catch an overrun with. A
 * spill would just quietly serve a two-page resume from the permalink. This is
 * the check that stops that reaching a deploy.
 *
 * bottomGap is printed rather than asserted. Empty space at the foot of the
 * page is a judgement call, not a failure, and the number is there so a refresh
 * that leaves a third of the sheet blank is visible without opening the PDF.
 *
 * Run through tsx because the renderer is TypeScript and imports JSON; nothing
 * else here needs a build step.
 */
import canonical from '../src/data/canonical-resume.json' with { type: 'json' };
import { buildResumePdf } from '../src/scripts/resume-pdf.ts';

const { pageCount, bottomGap } = await buildResumePdf(canonical.content);

const roles = canonical.content.experienceBullets.length;
const bullets = canonical.content.experienceBullets.reduce((n, e) => n + e.bullets.length, 0);
console.log(`canonical resume: ${roles} roles, ${bullets} bullets, assessed ${canonical.generatedAt}`);
console.log(`pages: ${pageCount}, bottom gap: ${bottomGap.toFixed(1)}pt`);

if (pageCount !== 1) {
  console.error(`FAIL: the canonical resume renders as ${pageCount} pages. Cut content or the permalink serves it.`);
  process.exit(1);
}
console.log('ok: one page.');
