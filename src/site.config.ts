/**
 * Site-wide configuration. Everything identity- or domain-specific lives here
 * so the rest of the codebase stays domain-agnostic.
 */
export const SITE = {
  name: 'Grayson Adams',
  title: 'Brain Map',
  description:
    'A living map of ideas and the projects they became: how I frame problems, the edge cases I hit, and what shipped.',
  /** Flip when job hunting; renders the "open to opportunities" banner. */
  openToOpportunities: false,
  github: 'GraysonCAdams',
  linkedin: 'graysonchaseadams',
  /**
   * Email is never written in plaintext in markup. These fragments are
   * assembled client-side (see ContactEmail component, phase 6).
   */
  emailUser: 'gray',
  emailDomain: 'grayada.ms',

  /* ---- link previews and structured data ---- */

  /** og:locale wants the underscore form; <html lang> wants the hyphen form. */
  locale: 'en_US',
  lang: 'en',
  /**
   * Default link-preview card. Rasterised from public/og.svg, which carries
   * the regeneration recipe in a comment at the top of the file.
   */
  ogImage: '/og.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt:
    'gray@brainmap:~$ terminal wordmark on a dark ground, with the map of ideas drawn as coloured dots joined by faint threads.',
  /**
   * Browser chrome and PWA colour. Tracks --ground in src/styles/tokens.css;
   * change both together or the address bar stops matching the page. It is
   * spelled out a third time in public/site.webmanifest, which is static JSON
   * and cannot read either of them.
   */
  themeColor: '#0c1214',
  /**
   * Title used in Person structured data. Matches the current role in
   * src/data/resume-facts.json, which is the canonical employment record.
   */
  jobTitle: 'Lead Software Engineer (Platform/DevOps)',
  /** Both from src/data/resume-facts.json. Never state either from memory. */
  employer: 'Harris Associates',
  alumniOf: 'Kennesaw State University',
} as const;

/**
 * Tech slugs whose canonical spelling is not just the slug with the hyphens
 * knocked out. Everything else falls through to that, which is right for the
 * long tail (`terraform`, `kubernetes`, `docker`).
 */
const TECH_DISPLAY: Record<string, string> = {
  nodejs: 'Node.js',
  nextjs: 'Next.js',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  php: 'PHP',
  html: 'HTML',
  css: 'CSS',
  sqlite: 'SQLite',
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  oauth: 'OAuth',
  mcp: 'Model Context Protocol',
  'home-assistant': 'Home Assistant',
  'anthropic-api': 'Anthropic API',
  tts: 'text to speech',
  imap: 'IMAP',
  aws: 'AWS',
  gcp: 'Google Cloud',
  ci: 'CI/CD',
};

/** Presentable form of a `tech:` slug, for schema.org knowsAbout. */
export function techLabel(slug: string): string {
  return TECH_DISPLAY[slug] ?? slug.replace(/-/g, ' ');
}
