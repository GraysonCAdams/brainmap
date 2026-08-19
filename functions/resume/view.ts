/**
 * The current resume, rendered on request (Cloudflare Pages Function).
 *
 * This is the permalink: /resume/view is a stable URL that always answers with
 * a PDF, so it can go in an email or a job application without a download
 * button and a browser between the reader and the file. The tailored generator
 * still renders in the visitor's browser; only the canonical document is served
 * from here.
 *
 * Content comes from canonical-resume.json, which is bundled into the
 * deployment rather than fetched, so this endpoint cannot go stale on its own
 * and cannot serve a half-written file. The flip side is that freshness is the
 * monthly refresh job's responsibility: it re-assesses the content, runs the
 * one-page check, and redeploys. Nothing here notices a newer assessment until
 * that deploy lands.
 *
 * Layout, employers, titles, dates and education are not in that JSON at all.
 * buildResumePdf injects them from resume-facts.json exactly as it does for the
 * tailored path, so the refresh job can change the wording of the resume and
 * never its record.
 */
import canonical from '../../src/data/canonical-resume.json';
import { buildResumePdf, type GeneratedContent } from '../../src/scripts/resume-pdf';

const render = async (): Promise<{ bytes: Uint8Array; headers: HeadersInit }> => {
  const { bytes } = await buildResumePdf(canonical.content as GeneratedContent);

  // A day of caching, and Last-Modified from the assessment date rather than
  // the render: two requests a minute apart produce byte-identical files, and
  // dating them "now" would tell a cache the document changed when it did not.
  const lastModified = new Date(`${canonical.generatedAt}T00:00:00Z`).toUTCString();

  return {
    bytes,
    headers: {
      'Content-Type': 'application/pdf',
      // inline, so a click opens the resume in the browser's viewer. The page's
      // download link asks for the file instead, via the download attribute.
      'Content-Disposition': 'inline; filename="Grayson Adams Resume.pdf"',
      'Content-Length': String(bytes.length),
      'Cache-Control': 'public, max-age=86400',
      'Last-Modified': lastModified,
    },
  };
};

export const onRequestGet: PagesFunction = async () => {
  const { bytes, headers } = await render();
  // The cast is a types gap, not a conversion: @cloudflare/workers-types spells
  // BodyInit with a plain ArrayBufferView, and TypeScript's generic Uint8Array
  // does not match it even though workerd accepts the bytes as they are.
  return new Response(bytes as BodyInit, { headers });
};

// Without this, HEAD falls through to the static-asset layer and answers
// text/html 404, which reads as "the permalink is broken" to anything that
// probes before downloading (the refresh job's own verification included).
// The render is repeated because the length header has to be true.
export const onRequestHead: PagesFunction = async () => {
  const { headers } = await render();
  return new Response(null, { headers });
};
