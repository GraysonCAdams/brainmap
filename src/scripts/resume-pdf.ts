/**
 * Client-side PDF builder replicating the layout of "Grayson Adams Resume
 * 2025.pdf": US Letter, Helvetica family, centered bold name, bullet-separated
 * contact line, centered ALL-CAPS section headers between hairline rules,
 * two-column skillsets, company blocks with right-aligned italic dates,
 * hanging-indent bullets. The design is fixed; only text content varies.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import facts from '../data/resume-facts.json';

export interface GeneratedContent {
  skillsets: { label: string; value: string }[];
  selectedProjects: { title: string; bullets: string[] }[];
  experienceBullets: { id: string; bullets: string[] }[];
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;
const WIDTH = PAGE_W - MARGIN * 2;
const BLACK = rgb(0, 0, 0);

export async function buildResumePdf(gen: GeneratedContent): Promise<Uint8Array> {
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
    ensure(34);
    y -= 6;
    rule();
    y -= 13;
    centered(title, bold, 10);
    y -= 5;
    rule();
    y -= 13;
  };

  const bulletList = (bullets: string[], size = 9.3) => {
    const indent = 12;
    for (const b of bullets) {
      const lines = wrap(b, helv, size, WIDTH - indent);
      ensure(lines.length * (size + 2.2) + 2);
      page.drawText('•', { x: MARGIN + 2, y, size, font: helv, color: BLACK });
      for (const [i, line] of lines.entries()) {
        page.drawText(line, { x: MARGIN + indent, y, size, font: helv, color: BLACK });
        if (i < lines.length - 1) y -= size + 2.2;
      }
      y -= size + 3;
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
    ensure(lines.length * (size + 2.2) + 2);
    page.drawText(row.label, { x: MARGIN, y, size, font: bold, color: BLACK });
    for (const [i, line] of lines.entries()) {
      page.drawText(line, { x: MARGIN + labelW, y, size, font: helv, color: BLACK });
      if (i < lines.length - 1) y -= size + 2.2;
    }
    y -= size + 3;
  }

  // ---- Selected projects (tailored to the visitor's picks)
  if (gen.selectedProjects.length > 0) {
    sectionHeader('SELECTED PROJECTS');
    for (const proj of gen.selectedProjects.slice(0, 4)) {
      ensure(16);
      page.drawText(proj.title, { x: MARGIN, y, size: 10, font: bold, color: BLACK });
      y -= 13;
      bulletList(proj.bullets.slice(0, 2));
      y -= 2;
    }
  }

  // ---- Experience: structure from facts, bullets from the generation
  sectionHeader('PROFESSIONAL EXPERIENCE');
  const genBullets = new Map(gen.experienceBullets.map((e) => [e.id, e.bullets]));
  let lastCompany = '';
  for (const job of facts.experience) {
    const bullets = genBullets.get(job.id) ?? job.bullets;
    if (job.company !== lastCompany) {
      ensure(28);
      page.drawText(job.company, { x: MARGIN, y, size: 10, font: bold, color: BLACK });
      y -= 13;
      lastCompany = job.company;
    }
    ensure(15);
    const roleText = job.role;
    page.drawText(roleText, { x: MARGIN + 6, y, size: 9.6, font: bold, color: BLACK });
    const roleW = bold.widthOfTextAtSize(roleText, 9.6);
    page.drawText(` - ${job.location}`, { x: MARGIN + 6 + roleW, y, size: 9.6, font: helv, color: BLACK });
    const dateW = italic.widthOfTextAtSize(job.dates, 9.3);
    page.drawText(job.dates, { x: PAGE_W - MARGIN - dateW, y, size: 9.3, font: italic, color: BLACK });
    y -= 12.5;
    // Cap at the original bullet count: the model may emphasize, never expand.
    bulletList(bullets.slice(0, job.bullets.length));
    y -= 3;
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

  return doc.save();
}
