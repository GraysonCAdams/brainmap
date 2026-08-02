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
  linkedin: '', // filled in before deploy
  /**
   * Email is never written in plaintext in markup. These fragments are
   * assembled client-side (see ContactEmail component, phase 6).
   */
  emailUser: 'gray',
  emailDomain: 'grayada.ms',
} as const;
