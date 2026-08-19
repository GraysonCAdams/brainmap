/**
 * Rasterises public/favicon.svg into every icon the head and the web manifest
 * ask for.
 *
 *     node scripts/icon-render.mjs
 *
 * Writes favicon.ico (16 and 32), apple-touch-icon.png (180), icon-192.png and
 * icon-512.png. Run it after editing favicon.svg and commit the results: the
 * SVG is the source of record, these are its output.
 *
 * No fonts are involved, unlike scripts/og-render.mjs, because the mark is
 * geometry only. That is deliberate rather than incidental, since it is the
 * reason the same file can serve a 16px tab strip and a 512px launcher tile.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const SVG = readFileSync(join(PUBLIC, 'favicon.svg'));
/** favicon.svg's own viewBox, which is what density is measured against. */
const SOURCE_SIZE = 32;

async function render(size) {
  // libvips scales an SVG by density: 72 dpi renders it at its intrinsic size,
  // so the multiple that reaches `size` is the density to ask for.
  const density = (72 * size) / SOURCE_SIZE;
  const png = await sharp(SVG, { density }).png({ compressionLevel: 9 }).toBuffer();
  const meta = await sharp(png).metadata();
  if (meta.width !== size || meta.height !== size) {
    throw new Error(`rendered ${meta.width}x${meta.height}, expected ${size}x${size}`);
  }
  return png;
}

/**
 * ICO container around already-encoded PNGs. Every browser that is still
 * shipping understands PNG-in-ICO, and the alternative is a BMP encoder with
 * an inverted-mask quirk to get wrong.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(images.length * 16);
  let offset = header.length + directory.length;
  images.forEach(({ size, png }, i) => {
    const e = i * 16;
    directory.writeUInt8(size === 256 ? 0 : size, e); // 0 stands for 256
    directory.writeUInt8(size === 256 ? 0 : size, e + 1);
    directory.writeUInt8(0, e + 2); // palette size, 0 for truecolour
    directory.writeUInt8(0, e + 3); // reserved
    directory.writeUInt16LE(1, e + 4); // colour planes
    directory.writeUInt16LE(32, e + 6); // bits per pixel
    directory.writeUInt32LE(png.length, e + 8);
    directory.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });

  return Buffer.concat([header, directory, ...images.map((i) => i.png)]);
}

const sizes = [16, 32, 180, 192, 512];
const rendered = new Map();
for (const size of sizes) rendered.set(size, await render(size));

writeFileSync(
  join(PUBLIC, 'favicon.ico'),
  ico([16, 32].map((size) => ({ size, png: rendered.get(size) }))),
);
writeFileSync(join(PUBLIC, 'apple-touch-icon.png'), rendered.get(180));
writeFileSync(join(PUBLIC, 'icon-192.png'), rendered.get(192));
writeFileSync(join(PUBLIC, 'icon-512.png'), rendered.get(512));

console.log('public/favicon.ico          16x16, 32x32');
console.log('public/apple-touch-icon.png 180x180');
console.log('public/icon-192.png         192x192');
console.log('public/icon-512.png         512x512');
