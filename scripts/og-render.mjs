/**
 * Rasterises public/og.svg to public/og.png, the site-wide link-preview card.
 *
 *     node scripts/og-render.mjs
 *
 * Run it after editing the SVG and commit both files. og.png is committed
 * rather than built on deploy because Cloudflare Pages builds should not need
 * a rasteriser, but a committed PNG nobody can regenerate is a liability, so
 * this script is the source of record and the PNG is its output.
 *
 * The font problem, and why there is a WOFF decoder in here:
 * librsvg (inside sharp) resolves font families through fontconfig, so it can
 * only set text in fonts installed on the machine, and IBM Plex is not on a
 * typical one. @fontsource ships woff and woff2; woff2 needs a brotli-based
 * table transform to undo, but plain WOFF is only per-table zlib around an
 * otherwise untouched sfnt, so it unpacks in a few lines with node's own zlib.
 * The unpacked fonts go in a scratch directory that fontconfig is pointed at
 * for the length of this run and nothing is installed on the machine.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SVG = join(ROOT, 'public', 'og.svg');
const PNG = join(ROOT, 'public', 'og.png');
const WIDTH = 1200;
const HEIGHT = 630;

/** The faces og.svg asks for, by @fontsource package and file. */
const FONTS = [
  ['@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff'],
  ['@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff'],
  ['@fontsource/ibm-plex-sans', 'ibm-plex-sans-latin-400-normal.woff'],
];

/**
 * WOFF 1.0 to sfnt. Each table is stored either verbatim or as a raw zlib
 * stream, and unlike WOFF2 nothing is re-encoded, so rebuilding the font is a
 * matter of inflating the tables and writing a fresh sfnt directory around
 * them. Checksums come across unchanged, which is what makes that safe.
 */
function woffToSfnt(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOFF') throw new Error('not a WOFF file');
  const flavor = buf.readUInt32BE(4);
  const numTables = buf.readUInt16BE(12);

  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const e = 44 + i * 20;
    const offset = buf.readUInt32BE(e + 4);
    const compLength = buf.readUInt32BE(e + 8);
    const origLength = buf.readUInt32BE(e + 12);
    const slice = buf.subarray(offset, offset + compLength);
    const data = compLength === origLength ? Buffer.from(slice) : inflateSync(slice);
    if (data.length !== origLength) throw new Error('table length mismatch after inflate');
    tables.push({ tag: buf.toString('latin1', e, e + 4), checksum: buf.readUInt32BE(e + 16), data });
  }
  // sfnt requires the table directory in ascending tag order.
  tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));

  let searchRange = 16;
  let entrySelector = 0;
  while (searchRange * 2 <= numTables * 16) {
    searchRange *= 2;
    entrySelector++;
  }

  const header = Buffer.alloc(12);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(searchRange, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE(numTables * 16 - searchRange, 10);

  const directory = Buffer.alloc(numTables * 16);
  const bodies = [];
  let cursor = 12 + numTables * 16;
  tables.forEach((t, i) => {
    directory.write(t.tag, i * 16, 4, 'latin1');
    directory.writeUInt32BE(t.checksum, i * 16 + 4);
    directory.writeUInt32BE(cursor, i * 16 + 8);
    directory.writeUInt32BE(t.data.length, i * 16 + 12);
    const padding = (4 - (t.data.length % 4)) % 4;
    bodies.push(t.data, Buffer.alloc(padding));
    cursor += t.data.length + padding;
  });

  return Buffer.concat([header, directory, ...bodies]);
}

const fontDir = mkdtempSync(join(tmpdir(), 'brainmap-fonts-'));
try {
  for (const [pkg, file] of FONTS) {
    const src = join(ROOT, 'node_modules', pkg, 'files', file);
    writeFileSync(join(fontDir, file.replace(/\.woff$/, '.ttf')), woffToSfnt(readFileSync(src)));
  }
  const conf = join(fontDir, 'fonts.conf');
  writeFileSync(
    conf,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontDir}</dir>
  <cachedir>${fontDir}</cachedir>
</fontconfig>
`,
  );
  // Must be set before sharp's native binding initialises fontconfig.
  process.env.FONTCONFIG_FILE = conf;

  const sharp = (await import('sharp')).default;
  const svg = readFileSync(SVG);
  // libvips scales an SVG by density, not by pixels: 72 dpi renders it at its
  // own width, so ask for exactly the multiple the card needs.
  const density = Math.round((72 * WIDTH) / 1200);
  await sharp(svg, { density }).png({ compressionLevel: 9 }).toFile(PNG);

  const { width, height } = await sharp(PNG).metadata();
  if (width !== WIDTH || height !== HEIGHT) {
    throw new Error(`rendered ${width}x${height}, expected ${WIDTH}x${HEIGHT}`);
  }
  console.log(`public/og.png  ${width}x${height}`);
} finally {
  rmSync(fontDir, { recursive: true, force: true });
}
