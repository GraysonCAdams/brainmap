/**
 * Client-side PDF builder replicating the layout of "Grayson Adams Resume
 * 2025.pdf": US Letter, Helvetica family, centered bold name, bullet-separated
 * contact line, centered ALL-CAPS section headers between hairline rules,
 * two-column skillsets, company blocks with right-aligned italic dates,
 * hanging-indent bullets. The design is fixed; only text content varies.
 *
 * One page is a requirement, not an aspiration. The source document fits its
 * twenty bullets on a single sheet, so this template has to as well, and the
 * spacing constants below are set tighter than a first reading of the original
 * suggested in order to get there. Callers that feed in tailored content still
 * have to trim it (see trimForFit in resume-validate.ts); what is guaranteed
 * here is only that the canonical resume itself fits.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import facts from '../data/resume-facts.json';

export interface GeneratedContent {
  skillsets: { label: string; value: string }[];
  /**
   * The roles to print, in the order `facts.experience` declares them. A role
   * absent from this list is absent from the resume: relevance is expressed by
   * omission rather than by a separate flag.
   */
  experienceBullets: { id: string; bullets: string[] }[];
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 40;
const WIDTH = PAGE_W - MARGIN * 2;
const BLACK = rgb(0, 0, 0);

// Vertical rhythm. These are not free parameters: the canonical resume is 20
// bullets across six roles, and at the original spacing it needed 751pt inside
// a 692pt column, so it rendered as two pages. Every value below is tuned so
// that document fits on one page with headroom, which is what `fitsOnePage`
// asserts. Loosening any of them without re-running that check reintroduces a
// two-page resume, and the overflow is silent because `ensure` just starts a
// new page.
const LINE_GAP = 1.8; // between wrapped lines within one bullet or row
const ITEM_GAP = 1.6; // after a finished bullet or skillset row
const JOB_GAP = 2; // after a job block
const HEAD_GAP = 11.5; // rule-to-text and text-to-rule inside a section header

/** Identity content: the resume as advertised, straight from canonical facts. */
/**
 * Roles eligible to appear on any resume this module produces.
 *
 * Internships and student jobs never print, whatever the model selects and
 * whatever a caller passes in. The flag in resume-facts.json is the intended
 * signal; the role-text check behind it is a backstop for an entry added
 * without one. That check is deliberately word-bounded, because the substring
 * matches "internal" and "international", and a role like "Internal Tools
 * Engineer" is not an internship.
 */
export function eligibleExperience(): typeof facts.experience {
  return facts.experience.filter((e) => {
    if ((e as { internship?: boolean }).internship === true) return false;
    return !/\bintern(ship|s)?\b/i.test(e.role);
  });
}

export function currentResumeContent(): GeneratedContent {
  // Copied, not referenced. `facts` is a module singleton shared with the
  // tailored path, and trimForFit trims by mutating the arrays it is handed;
  // returning the canonical arrays directly would let one trim permanently
  // shorten the real resume for the rest of the page session.
  return {
    skillsets: facts.skillsets.map((s) => ({ ...s })),
    experienceBullets: eligibleExperience().map((e) => ({ id: e.id, bullets: [...e.bullets] })),
  };
}

export async function buildResumePdf(
  gen: GeneratedContent,
): Promise<{ bytes: Uint8Array; pageCount: number; bottomGap: number }> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${facts.name} - Resume`);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const wrap = (text: string, font: PDFFont, size: number, width: number): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const probe = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(probe, size) > width && line) {
        lines.push(line);
        line = w;
      } else {
        line = probe;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const centered = (text: string, font: PDFFont, size: number) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (PAGE_W - w) / 2, y, size, font, color: BLACK });
  };

  const rule = () => {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.6,
      color: BLACK,
    });
  };

  const sectionHeader = (title: string) => {
    ensure(30);
    y -= 5;
    rule();
    y -= HEAD_GAP;
    centered(title, bold, 10);
    y -= 4;
    rule();
    y -= HEAD_GAP;
  };

  const bulletList = (bullets: string[], size = 9.3) => {
    const indent = 12;
    for (const b of bullets) {
      const lines = wrap(b, helv, size, WIDTH - indent);
      ensure(lines.length * (size + LINE_GAP) + 2);
      page.drawText('•', { x: MARGIN + 2, y, size, font: helv, color: BLACK });
      for (const [i, line] of lines.entries()) {
        page.drawText(line, { x: MARGIN + indent, y, size, font: helv, color: BLACK });
        if (i < lines.length - 1) y -= size + LINE_GAP;
      }
      y -= size + ITEM_GAP;
    }
  };

  // ---- Header
  centered(facts.name, bold, 14.5);
  y -= 15;
  centered(facts.contactLine, helv, 9.3);
  y -= 8;

  // ---- Skillsets
  sectionHeader('SKILLSETS');
  const labelW = 128;
  for (const row of gen.skillsets.slice(0, 5)) {
    const size = 9.3;
    const lines = wrap(row.value, helv, size, WIDTH - labelW);
    ensure(lines.length * (size + LINE_GAP) + 2);
    page.drawText(row.label, { x: MARGIN, y, size, font: bold, color: BLACK });
    for (const [i, line] of lines.entries()) {
      page.drawText(line, { x: MARGIN + labelW, y, size, font: helv, color: BLACK });
      if (i < lines.length - 1) y -= size + LINE_GAP;
    }
    y -= size + ITEM_GAP;
  }

  // ---- Experience: structure from facts, bullets from the generation
  sectionHeader('PROFESSIONAL EXPERIENCE');
  const genBullets = new Map(gen.experienceBullets.map((e) => [e.id, e.bullets]));
  // Only what the generation selected, and only from the eligible set, so an
  // internship cannot reach the page even if a caller hands one over. Order
  // comes from facts rather than from the model, which keeps the reverse
  // chronology intact no matter what order the selection arrives in.
  const jobs = eligibleExperience().filter((job) => genBullets.has(job.id));
  let lastCompany = '';
  for (const job of jobs) {
    const bullets = genBullets.get(job.id)!;
    if (job.company !== lastCompany) {
      ensure(28);
      page.drawText(job.company, { x: MARGIN, y, size: 10, font: bold, color: BLACK });
      y -= 13;
      lastCompany = job.company;
    }
    // A promotion inside one employer prints as consecutive title lines above a
    // single set of bullets. The alternative, splitting the tenure into two
    // entries, would force every bullet to be attributed to the title it
    // happened under, and that is not recorded anywhere. Stacking the titles
    // states the progression and the dates without claiming which half of the
    // tenure each accomplishment belongs to.
    const titles = (job as { titles?: { role: string; dates: string }[] }).titles ?? [
      { role: job.role, dates: job.dates },
    ];
    for (const [i, t] of titles.entries()) {
      ensure(15);
      page.drawText(t.role, { x: MARGIN + 6, y, size: 9.6, font: bold, color: BLACK });
      const roleW = bold.widthOfTextAtSize(t.role, 9.6);
      // The location belongs to the tenure, not to each title, so it is stated
      // once against the earliest title rather than repeated up the stack.
      if (i === titles.length - 1) {
        page.drawText(` - ${job.location}`, { x: MARGIN + 6 + roleW, y, size: 9.6, font: helv, color: BLACK });
      }
      const dateW = italic.widthOfTextAtSize(t.dates, 9.3);
      page.drawText(t.dates, { x: PAGE_W - MARGIN - dateW, y, size: 9.3, font: italic, color: BLACK });
      y -= i === titles.length - 1 ? 12.5 : 11;
    }
    // Cap at the original bullet count: the model may emphasize, never expand.
    bulletList(bullets.slice(0, job.bullets.length));
    y -= JOB_GAP;
  }

  // ---- Education
  sectionHeader('EDUCATION');
  ensure(14);
  const edu = facts.education;
  page.drawText(edu.school, { x: MARGIN, y, size: 10, font: bold, color: BLACK });
  const schoolW = bold.widthOfTextAtSize(edu.school, 10);
  page.drawText(` - ${edu.degree}`, { x: MARGIN + schoolW, y, size: 9.6, font: helv, color: BLACK });
  const eduDateW = italic.widthOfTextAtSize(edu.dates, 9.3);
  page.drawText(edu.dates, { x: PAGE_W - MARGIN - eduDateW, y, size: 9.3, font: italic, color: BLACK });

  // Unused vertical space below the last line. The fill loop is what closes
  // this; reporting it makes "the page looks empty" a number rather than an
  // impression, and a regression visible without opening the file.
  const bottomGap = y - MARGIN;
  return { bytes: await doc.save(), pageCount: doc.getPageCount(), bottomGap };
}
