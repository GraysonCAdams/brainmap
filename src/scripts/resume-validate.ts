/**
 * Post-generation vetting. These checks are real, not theater:
 *
 *  - facts-integrity is structural (employers/titles/dates/education never
 *    come from the model; buildResumePdf injects them from resume-facts.json)
 *  - bullet volume is clamped to the per-job originals
 *  - every quantified claim (any number) in generated text must literally
 *    appear in the source corpus (canonical facts + the public write-ups);
 *    unverifiable claims are REMOVED, not published
 *  - internships never appear, whatever the model selected
 */
import facts from '../data/resume-facts.json';
import kb from '../data/experience-kb.json';
import { eligibleExperience, type GeneratedContent } from './resume-pdf';

export interface VetReport {
  gen: GeneratedContent;
  numbersChecked: number;
  removedClaims: string[];
  droppedRoles: string[];
}

/**
 * The most recent role always prints. A resume whose history starts two jobs
 * ago reads as a gap rather than as a focused selection, and the current role
 * is the one every reader looks for first.
 */
const ALWAYS_KEEP_MOST_RECENT = true;
/** Below this the section looks thin rather than selective. */
const MIN_ROLES = 3;

const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;
const norm = (s: string) => s.replace(/,/g, '');

/**
 * The corpus every quantified claim is checked against.
 *
 * The knowledge base has to be in here. The generator now writes from earlier
 * resume iterations as well as the canonical record, so a figure like "10+
 * legacy apps" is real and his, but appears nowhere in the 2025 resume; without
 * the knowledge base in the corpus the check would strip exactly the specific
 * detail the rewrite was supposed to surface.
 */
export async function buildCorpus(): Promise<string> {
  const graph = (await (await fetch('/graph.json')).json()) as {
    nodes: { id: string; visibility: string }[];
  };
  const slugs = graph.nodes.filter((n) => n.visibility === 'public').map((n) => n.id);
  const docs = await Promise.all(
    slugs.map(async (s) => {
      try {
        const r = await fetch(`/idea/${s}.md`);
        return r.ok ? await r.text() : '';
      } catch {
        return '';
      }
    }),
  );
  return norm(JSON.stringify(facts) + '\n' + JSON.stringify(kb) + '\n' + docs.join('\n'));
}

const numbersVerified = (text: string, corpus: string): string[] => {
  const bad: string[] = [];
  for (const m of text.match(NUM_RE) ?? []) {
    if (!corpus.includes(norm(m))) bad.push(m);
  }
  return bad;
};

export function vetGeneration(gen: GeneratedContent, corpus: string): VetReport {
  let numbersChecked = 0;
  const removedClaims: string[] = [];
  const droppedRoles: string[] = [];

  const eligible = eligibleExperience();
  const originals = new Map(eligible.map((e) => [e.id, e.bullets]));
  const selected = new Set(gen.experienceBullets.map((e) => e.id));

  // Relevance is the model's call, but the shape of the result is not. Anything
  // it did not select is dropped, then the floors below put back whatever the
  // resume cannot credibly go without.
  for (const job of eligible) {
    if (!selected.has(job.id)) droppedRoles.push(job.id);
  }
  if (ALWAYS_KEEP_MOST_RECENT && eligible.length > 0) selected.add(eligible[0].id);
  for (const job of eligible) {
    if (selected.size >= MIN_ROLES) break;
    selected.add(job.id);
  }

  // Roles at one company travel together. Dropping a promotion's earlier half
  // does not shorten the resume so much as falsify it: keeping only the
  // three-month Principal role at AT&T and cutting the three-year Senior role
  // beneath it prints a three-month stint at a company he was at for years,
  // and leaves the intervening time looking unaccounted for. Relevance can
  // decide which employers appear; it does not get to restate how long one
  // lasted.
  for (const job of eligible) {
    if (!selected.has(job.id)) continue;
    for (const sibling of eligible) {
      if (sibling.company === job.company) selected.add(sibling.id);
    }
  }

  const supplied = new Map(gen.experienceBullets.map((e) => [e.id, e.bullets]));
  const experienceBullets = eligible
    .filter((job) => selected.has(job.id))
    .map((job) => {
      const source = originals.get(job.id)!;
      const kept: string[] = [];
      // Bullet volume: never more bullets than the job originally had.
      for (const b of (supplied.get(job.id) ?? source).slice(0, source.length)) {
        const bad = numbersVerified(b, corpus);
        numbersChecked += (b.match(NUM_RE) ?? []).length;
        if (bad.length > 0) removedClaims.push(b);
        else kept.push(b);
      }
      // A printed job never appears empty: fall back to its first canonical bullet.
      return { id: job.id, bullets: kept.length > 0 ? kept : [source[0]] };
    });

  return {
    gen: { skillsets: gen.skillsets.slice(0, 5), experienceBullets },
    numbersChecked,
    removedClaims,
    droppedRoles: droppedRoles.filter((id) => !selected.has(id)),
  };
}

/**
 * Trim one lowest-priority bullet; returns false when nothing is trimmable.
 *
 * With the projects section gone this only has experience to work with, so the
 * rule is simply to take from whichever role is currently fattest and never to
 * empty a role entirely. Taking from the fattest keeps the roles balanced
 * instead of stripping the oldest one bare while the newest keeps five bullets.
 */
export function trimForFit(gen: GeneratedContent): boolean {
  const fattest = [...gen.experienceBullets].sort((a, b) => b.bullets.length - a.bullets.length)[0];
  if (fattest && fattest.bullets.length > 1) {
    fattest.bullets.pop();
    return true;
  }
  return false;
}

export function cloneGen(gen: GeneratedContent): GeneratedContent {
  return {
    skillsets: gen.skillsets.map((s) => ({ ...s })),
    experienceBullets: gen.experienceBullets.map((e) => ({ id: e.id, bullets: [...e.bullets] })),
  };
}

/**
 * Add the next-best thing that is not on the page yet. Returns a key naming
 * what it added, or null when nothing is left. The caller renders the result,
 * and on a spill reverts and passes that key back in `skip` so the next call
 * offers something else: giving up at the first candidate that does not fit
 * strands a page with room on it, because the candidates are not the same size.
 * Restoring a whole role is the most expensive addition available, since it
 * brings an employer heading and a title line with it, so a page can have room
 * for another bullet and no room for another job.
 *
 * Trimming alone leaves half-empty resumes. A generation that selects four
 * roles and writes twelve bullets fits on the first try, the loop declares
 * success, and the bottom third of the page is white: the reader is told less
 * than the page had room to say. Growing after trimming means the document
 * converges on the largest version that still fits rather than the first one
 * that does.
 *
 * The hazard when refilling a role is duplication: the model rewrites bullets,
 * so a canonical bullet cannot be matched against what is already on the page
 * by string equality. Word overlap separates the two cases cleanly. Measured
 * against a real generation, a model bullet scored 0.68 to 1.00 against the
 * canonical bullet it was rewriting, while two genuinely different canonical
 * bullets from the same job never exceeded 0.23. The threshold sits in the gap.
 */
const WORDS = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);

/** Shared words as a fraction of the shorter bullet, so length does not skew it. */
const overlap = (a: string, b: string): number => {
  const A = WORDS(a);
  const B = WORDS(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);
};

/** Above this, treat a canonical bullet as already said in different words. */
const SAME_BULLET = 0.45;

export function growForFill(gen: GeneratedContent, skip: Set<string> = new Set()): string | null {
  const eligible = eligibleExperience();
  const canonical = new Map(eligible.map((e) => [e.id, e.bullets]));
  const present = new Set(gen.experienceBullets.map((e) => e.id));

  // 1. Deepen a role already on the page with a canonical bullet it has not
  //    made in any form yet.
  for (const entry of gen.experienceBullets) {
    const source = canonical.get(entry.id);
    if (!source || entry.bullets.length >= source.length) continue;
    const unsaid = source.filter(
      (b) => !entry.bullets.some((shown) => overlap(b, shown) >= SAME_BULLET),
    );
    // Shortest first, so a page with one line spare gets the bullet that fits
    // in one line rather than being told there was nothing left to say.
    const next = unsaid.sort((a, b) => a.length - b.length).find((b) => !skip.has(`bullet:${entry.id}:${b}`));
    if (next) {
      entry.bullets.push(next);
      return `bullet:${entry.id}:${next}`;
    }
  }

  // 2. Otherwise bring back a role relevance dropped, in resume order. A less
  //    relevant role beats white space, and it closes the gap its absence left.
  for (const job of eligible) {
    if (present.has(job.id) || skip.has(`role:${job.id}`)) continue;
    const shortest = [...job.bullets].sort((a, b) => a.length - b.length)[0];
    gen.experienceBullets.push({ id: job.id, bullets: [shortest] });
    return `role:${job.id}`;
  }

  return null;
}
