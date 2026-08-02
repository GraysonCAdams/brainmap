/**
 * Post-generation vetting. These checks are real, not theater:
 *
 *  - facts-integrity is structural (employers/titles/dates/education never
 *    come from the model; buildResumePdf injects them from resume-facts.json)
 *  - bullet volume is clamped to the per-job originals
 *  - every quantified claim (any number) in generated text must literally
 *    appear in the source corpus (canonical facts + the public write-ups);
 *    unverifiable claims are REMOVED, not published
 *  - project titles must exist in the source corpus
 */
import facts from '../data/resume-facts.json';
import type { GeneratedContent } from './resume-pdf';

export interface VetReport {
  gen: GeneratedContent;
  numbersChecked: number;
  removedClaims: string[];
  droppedProjects: string[];
}

const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;
const norm = (s: string) => s.replace(/,/g, '');

/** Fetch the public write-ups to serve as the verification corpus. */
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
  return norm(JSON.stringify(facts) + '\n' + docs.join('\n'));
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
  const droppedProjects: string[] = [];

  // Bullet volume: never more bullets than the job originally had.
  const originals = new Map(facts.experience.map((e) => [e.id, e.bullets]));
  const experienceBullets = gen.experienceBullets
    .filter((e) => originals.has(e.id))
    .map((e) => {
      const source = originals.get(e.id)!;
      const kept: string[] = [];
      for (const b of e.bullets.slice(0, source.length)) {
        const bad = numbersVerified(b, corpus);
        numbersChecked += (b.match(NUM_RE) ?? []).length;
        if (bad.length > 0) removedClaims.push(b);
        else kept.push(b);
      }
      // A job never disappears: fall back to its first canonical bullet.
      return { id: e.id, bullets: kept.length > 0 ? kept : [source[0]] };
    });

  const selectedProjects = [];
  for (const p of gen.selectedProjects.slice(0, 4)) {
    if (!corpus.toLowerCase().includes(p.title.toLowerCase())) {
      droppedProjects.push(p.title);
      continue;
    }
    const kept: string[] = [];
    for (const b of p.bullets.slice(0, 2)) {
      const bad = numbersVerified(b, corpus);
      numbersChecked += (b.match(NUM_RE) ?? []).length;
      if (bad.length > 0) removedClaims.push(b);
      else kept.push(b);
    }
    if (kept.length > 0) selectedProjects.push({ title: p.title, bullets: kept });
    else droppedProjects.push(p.title);
  }

  return {
    gen: { skillsets: gen.skillsets.slice(0, 5), selectedProjects, experienceBullets },
    numbersChecked,
    removedClaims,
    droppedProjects,
  };
}

/** Trim one lowest-priority bullet; returns false when nothing is trimmable. */
export function trimForFit(gen: GeneratedContent): boolean {
  const fattest = [...gen.experienceBullets].sort((a, b) => b.bullets.length - a.bullets.length)[0];
  if (fattest && fattest.bullets.length > 1) {
    fattest.bullets.pop();
    return true;
  }
  const fatProject = gen.selectedProjects.find((p) => p.bullets.length > 1);
  if (fatProject) {
    fatProject.bullets.pop();
    return true;
  }
  if (gen.selectedProjects.length > 2) {
    gen.selectedProjects.pop();
    return true;
  }
  return false;
}
