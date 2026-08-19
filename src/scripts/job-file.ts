/**
 * Reading a job description out of a file the visitor uploaded.
 *
 * Both ends of the upload import this. The browser reads the file so the page
 * can say what it accepted before anything leaves the machine; the Pages
 * Function reads the same bytes again and believes none of what the browser
 * said about them. Every check here sniffs bytes: the type on a File object is
 * whatever the OS guessed from the extension, and the type in a JSON body is
 * whatever the caller felt like typing.
 *
 * No dependency, by design. A PDF never needs parsing because the Messages API
 * takes it whole as a document block; .docx is a zip and the platform can
 * already inflate one (DecompressionStream exists in browsers and in the
 * Workers runtime alike); .txt and .md are already text. Legacy .doc is the
 * only format here that would need a real library, and it is refused instead.
 */

/**
 * 4 MB. A job posting exported to PDF runs tens of kilobytes; this leaves room
 * for one that was scanned rather than exported, and still bounds the request
 * far below the API's own 32 MB ceiling.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Characters of job description handed to the model, per source. The old
 * 6,000 was about a page and a half and cut real postings off partway through
 * the requirements. A full posting carrying its benefits and EEO boilerplate
 * runs 10,000 to 15,000 characters; 20,000 clears that with room to spare and
 * costs roughly 5,600 input tokens.
 */
export const MAX_DESCRIPTION_CHARS = 20_000;

/**
 * Pages of PDF accepted. Each page is billed twice over, as extracted text and
 * as an image of the page, so a page lands somewhere around 3,000 to 4,500
 * input tokens. Ten pages is about four times longer than any job posting and
 * already the most expensive thing this endpoint can be asked to read.
 */
export const PDF_PAGE_CAP = 10;

/**
 * Ceiling on what one zip member is allowed to inflate to.
 *
 * A .docx is unzipped on the server, and deflate reaches about 1000:1 on
 * repetitive input, so an attacker who is allowed to send 4 MB of compressed
 * data is otherwise allowed to allocate gigabytes inside the Worker with it.
 * Nothing is trusted to be small because it arrived small. 8 MB is far more
 * XML than a job description in Word has any way to produce, and the read
 * stops the moment it is passed rather than after the whole thing is in hand.
 */
export const MAX_INFLATED_BYTES = 8 * 1024 * 1024;

/** Extensions offered to the file picker. Matched again by byte sniffing. */
export const ACCEPT_ATTR = '.pdf,.docx,.txt,.md,.markdown';

/** What the model is given: a PDF whole, or text pulled out of the file. */
export type UploadKind = 'pdf' | 'docx' | 'text';

/** What the file name claims to be, before any bytes are looked at. */
export type NamedKind = UploadKind | 'doc' | null;

export function classifyName(name: string): NamedKind {
  const ext = name.toLowerCase().replace(/^.*\./, '');
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'doc') return 'doc';
  if (ext === 'txt' || ext === 'md' || ext === 'markdown' || ext === 'text') return 'text';
  return null;
}

/** What the bytes actually are. `ole` is the legacy .doc/.xls container. */
export type Sniffed = 'pdf' | 'zip' | 'ole' | 'other';

const startsWith = (bytes: Uint8Array, sig: readonly number[]): boolean => {
  if (bytes.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (bytes[i] !== sig[i]) return false;
  return true;
};

export function sniff(bytes: Uint8Array): Sniffed {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'zip'; // PK\x03\x04
  // OLE2 compound binary: Word 97-2003, and nothing this can read.
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole';
  return 'other';
}

/** Thrown for anything a visitor should be told about in the page's own words. */
export class UploadError extends Error {}

// ---------------------------------------------------------------------------
// base64
// ---------------------------------------------------------------------------

/** Chunked because String.fromCharCode blows the argument limit on a whole file. */
export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const isPdfSpace = (b: number): boolean =>
  b === 0x00 || b === 0x09 || b === 0x0a || b === 0x0c || b === 0x0d || b === 0x20;

/** PDF's own definition: whitespace plus ()<>[]{}/% . Everything else is regular. */
const isPdfDelimiter = (b: number): boolean =>
  isPdfSpace(b) ||
  b === 0x28 ||
  b === 0x29 ||
  b === 0x3c ||
  b === 0x3e ||
  b === 0x5b ||
  b === 0x5d ||
  b === 0x7b ||
  b === 0x7d ||
  b === 0x2f ||
  b === 0x25;

const TYPE_KEY = [0x2f, 0x54, 0x79, 0x70, 0x65]; // "/Type"
const PAGE_NAME = [0x2f, 0x50, 0x61, 0x67, 0x65]; // "/Page"

const matchesAt = (bytes: Uint8Array, at: number, sig: readonly number[]): boolean => {
  if (at + sig.length > bytes.length) return false;
  for (let i = 0; i < sig.length; i++) if (bytes[at + i] !== sig[i]) return false;
  return true;
};

/**
 * Page count, or null when it cannot be told from the bytes.
 *
 * Counts `/Type /Page` dictionaries, taking care not to count the `/Pages`
 * tree node that sits above them. This is best effort and says so: a PDF that
 * packs its page tree into a compressed object stream (common from newer
 * exporters) hides every one of those dictionaries, and the count comes back
 * null rather than wrong. The size cap is what actually bounds such a file,
 * with the API's own 600-page limit behind it.
 */
export function countPdfPages(bytes: Uint8Array): number | null {
  let count = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (!matchesAt(bytes, i, TYPE_KEY)) continue;
    let j = i + TYPE_KEY.length;
    while (j < bytes.length && isPdfSpace(bytes[j]!)) j++;
    if (!matchesAt(bytes, j, PAGE_NAME)) continue;
    const after = bytes[j + PAGE_NAME.length];
    if (after !== undefined && !isPdfDelimiter(after)) continue;
    count++;
  }
  return count > 0 ? count : null;
}

// ---------------------------------------------------------------------------
// docx
// ---------------------------------------------------------------------------

const u16 = (b: Uint8Array, at: number): number => b[at]! | (b[at + 1]! << 8);
const u32 = (b: Uint8Array, at: number): number =>
  (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;

/** Inflate a raw deflate stream. Present in browsers and in the Workers runtime. */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate-raw');
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  // Read while writing. A single write of a whole file exceeds the transform's
  // internal queue, and waiting for the write to settle before draining the
  // readable end deadlocks.
  let bomb = false;
  const draining = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value as Uint8Array;
      chunks.push(chunk);
      total += chunk.length;
      // Bail on the chunk that crosses the line, not after the whole stream is
      // in memory, which is the entire point of checking.
      if (total > MAX_INFLATED_BYTES) {
        bomb = true;
        await reader.cancel();
        break;
      }
    }
  })();
  const writer = stream.writable.getWriter();
  // Copied into a freshly allocated buffer rather than written straight
  // through. The zip member is a subarray of the whole file, and the two
  // runtimes' stream typings only accept a view whose buffer is a plain
  // ArrayBuffer, which a subarray's is not guaranteed to be.
  // Cancelling the readable end errors the writable one, so refusing a bomb
  // shows up here as a rejected write rather than as a clean finish.
  await writer.write(new Uint8Array(data)).catch(() => {});
  await writer.close().catch(() => {});
  await draining;
  if (bomb) {
    throw new UploadError(
      'That file expands to far more than a job description. Paste the text instead.',
    );
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * Pull one member out of a zip by name.
 *
 * Reads the central directory rather than walking local headers, because the
 * central directory is the authoritative copy of the compressed size. A local
 * header written with a data descriptor carries zeroes there, and trusting it
 * yields an empty file with no error raised.
 */
async function zipEntry(bytes: Uint8Array, wanted: string): Promise<Uint8Array | null> {
  // End of central directory: PK\x05\x06, then up to 65535 bytes of comment.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65535; i--) {
    if (matchesAt(bytes, i, [0x50, 0x4b, 0x05, 0x06])) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new UploadError('That .docx is not a readable Word file.');

  const entries = u16(bytes, eocd + 10);
  let at = u32(bytes, eocd + 16);
  const decoder = new TextDecoder();

  for (let n = 0; n < entries; n++) {
    if (!matchesAt(bytes, at, [0x50, 0x4b, 0x01, 0x02])) break;
    const method = u16(bytes, at + 10);
    const compressedSize = u32(bytes, at + 20);
    const nameLen = u16(bytes, at + 28);
    const extraLen = u16(bytes, at + 30);
    const commentLen = u16(bytes, at + 32);
    const localAt = u32(bytes, at + 42);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
    if (name !== wanted) continue;

    // The local header repeats the name and extra fields, and its extra field
    // length routinely differs from the central one, so the data offset has to
    // be computed from the local header.
    if (!matchesAt(bytes, localAt, [0x50, 0x4b, 0x03, 0x04])) return null;
    const dataAt = localAt + 30 + u16(bytes, localAt + 26) + u16(bytes, localAt + 28);
    const raw = bytes.subarray(dataAt, dataAt + compressedSize);
    if (method === 0) return raw;
    if (method === 8) return await inflateRaw(raw);
    throw new UploadError('That .docx uses a compression method this page cannot read.');
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

const decodeEntities = (s: string): string =>
  s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body] ?? whole;
  });

/**
 * Flatten WordprocessingML to plain text.
 *
 * Only the structure that changes the reading matters here: a paragraph or a
 * break ends a line, a tab is a tab. Two element types are dropped rather than
 * flattened, because including them would put text on the page that the
 * document does not say: `w:instrText` holds field codes (the machinery behind
 * a hyperlink or a page number, not prose), and `w:delText` holds text a
 * tracked change has already deleted.
 */
function wordXmlToText(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/g, '')
      .replace(/<w:delText\b[^>]*>[\s\S]*?<\/w:delText>/g, '')
      .replace(/<w:tab\b[^>]*\/?>/g, '\t')
      .replace(/<w:(?:br|cr)\b[^>]*\/?>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Text of a .docx. Throws UploadError with a visitor-facing message on failure. */
export async function docxToText(bytes: Uint8Array): Promise<string> {
  const doc = await zipEntry(bytes, 'word/document.xml');
  if (!doc) throw new UploadError('That .docx has no document body in it.');
  const text = wordXmlToText(new TextDecoder().decode(doc));
  if (!text) throw new UploadError('That .docx read as empty. Paste the text instead.');
  return text;
}

// ---------------------------------------------------------------------------
// shared refusals
// ---------------------------------------------------------------------------

/** Formatted for the visitor, not for a log. */
export const sizeLabel = (bytes: number): string =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const TOO_BIG = `That file is over the ${sizeLabel(MAX_UPLOAD_BYTES)} limit. Attach just the posting, or paste the text.`;

export const LEGACY_DOC =
  'That is a legacy .doc, which this page cannot read. Re-save it as .docx or PDF, or paste the text.';

export const WRONG_TYPE = 'Attach a .pdf, .docx, .txt or .md, or paste the text instead.';

export const TOO_MANY_PAGES = `That PDF is longer than ${PDF_PAGE_CAP} pages. Attach just the posting, or paste the part that matters.`;
