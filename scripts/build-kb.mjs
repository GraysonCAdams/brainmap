/**
 * Assemble the experience knowledge base the resume generator writes from.
 *
 * Four sources, all his own words:
 *   - prior-bullets.json, how he described a role on earlier resumes and on
 *     LinkedIn
 *   - the LinkedIn summary and skills taxonomy, carried through as `profile`
 *   - the employer-tagged node write-ups in src/content/nodes, which carry the
 *     detail a resume bullet compresses away
 *   - private-kb.local.json, gitignored employer material. This repo is public
 *     and those write-ups describe an employer's internal systems, so they live
 *     on disk only. A build without the file still succeeds, with a weaker KB
 *     for the roles it covers, and says so rather than passing quietly.
 *
 * Without this the generator sees one sentence per accomplishment and can only
 * reorder its words, which is exactly what it was doing. Nodes are matched to
 * roles by their `org` frontmatter against the company in resume-facts.json.
 *
 * An org with no matching role is skipped rather than guessed at, which is what
 * keeps internship write-ups (Turner, Cox, KSU) out of the file: those
 * employers have no entry in resume-facts.json, so nothing can borrow their
 * work into a full-time role.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const facts = JSON.parse(readFileSync(join(ROOT, 'src/data/resume-facts.json'), 'utf8'));
const prior = JSON.parse(readFileSync(join(ROOT, 'src/data/prior-bullets.json'), 'utf8'));
const NODES = join(ROOT, 'src/content/nodes');

// Absent by design on any machine that has not been handed the file. Reading it
// as optional is the point; throwing here would make a public checkout unbuildable.
let priv = null;
try {
  priv = JSON.parse(readFileSync(join(ROOT, 'src/data/private-kb.local.json'), 'utf8'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const roleIdsByCompany = new Map();
for (const e of facts.experience) {
  if (e.internship === true) continue;
  if (!roleIdsByCompany.has(e.company)) roleIdsByCompany.set(e.company, []);
  roleIdsByCompany.get(e.company).push(e.id);
}

const kb = { _generated: 'scripts/build-kb.mjs', profile: prior.profile ?? null, roles: {} };

// A bullet keeps its date when the source recorded one. The private file
// dates every Harris bullet so the generator can weight recency; public
// prior-bullets predate that convention and come through undated.
const toBullet = (b) => (b.date ? { text: b.text, date: b.date } : { text: b.text });
for (const e of facts.experience) {
  if (e.internship === true) continue;
  kb.roles[e.id] = { priorBullets: (prior.roles[e.id] ?? []).map(toBullet), writeups: [] };
}

// Private bullets append to the public ones rather than replacing them, so a
// role can draw on both. Order is preserved: the file lists the most recent
// title's material first and the model reads it in the order given.
for (const [id, bullets] of Object.entries(priv?.roles ?? {})) {
  if (!kb.roles[id]) throw new Error(`private-kb names an unknown role: ${id}`);
  kb.roles[id].priorBullets.push(...bullets.map(toBullet));
}

const skippedOrgs = new Set();
for (const file of readdirSync(NODES).filter((f) => f.endsWith('.md'))) {
  const raw = readFileSync(join(NODES, file), 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fm) continue;
  const org = fm[1].match(/^org:\s*(.+)$/m)?.[1]?.trim();
  if (!org) continue;
  const ids = roleIdsByCompany.get(org);
  if (!ids) {
    skippedOrgs.add(org);
    continue;
  }
  const title = fm[1].match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? file;
  const body = fm[2].replace(/\n{3,}/g, '\n\n').trim();
  // Attached to every role at that company: which of a promotion's halves a
  // given write-up belongs to is not recorded anywhere, and the generator only
  // ever prints bullets for roles it selected anyway.
  for (const id of ids) kb.roles[id].writeups.push({ title, text: body });
}

// Roles whose write-ups carry no `org` tag, because the employer was his own
// company and there is no org to tag.
for (const [id, slugs] of Object.entries(prior.writeupSlugs ?? {})) {
  if (!kb.roles[id]) throw new Error(`writeupSlugs names an unknown role: ${id}`);
  for (const slug of slugs) {
    const raw = readFileSync(join(NODES, `${slug}.md`), 'utf8');
    const fm = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fm) throw new Error(`writeupSlugs names a node with no frontmatter: ${slug}`);
    const title = fm[1].match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? slug;
    kb.roles[id].writeups.push({ title, text: fm[2].replace(/\n{3,}/g, '\n\n').trim() });
  }
}

for (const [id, writeups] of Object.entries(priv?.writeups ?? {})) {
  if (!kb.roles[id]) throw new Error(`private-kb names an unknown role: ${id}`);
  kb.roles[id].writeups.push(...writeups);
}

// What widened between two titles at one employer. Nothing else records it, and
// the renderer prints the title progression whether or not this is here.
for (const [id, text] of Object.entries(priv?.progression ?? {})) {
  if (!kb.roles[id]) throw new Error(`private-kb names an unknown role: ${id}`);
  kb.roles[id].progression = text;
}

writeFileSync(join(ROOT, 'src/data/experience-kb.json'), JSON.stringify(kb, null, 2) + '\n');

const size = JSON.stringify(kb).length;
console.log(`  profile        ${kb.profile ? 'present' : 'MISSING'}`);
for (const [id, v] of Object.entries(kb.roles)) {
  console.log(`  ${id.padEnd(15)} ${String(v.priorBullets.length).padStart(2)} prior bullets, ${v.writeups.length} write-ups`);
}
console.log(`experience-kb.json: ${size} chars`);
console.log(
  priv
    ? `  private-kb      present (${Object.keys(priv.roles ?? {}).join(', ')})`
    : '  private-kb      ABSENT: employer material not on this machine, those roles build from public bullets only',
);
if (skippedOrgs.size > 0) console.log(`skipped (no role in resume-facts): ${[...skippedOrgs].join(', ')}`);
