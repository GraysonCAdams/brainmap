// @ts-check
import { defineConfig } from 'astro/config';

// Domain-agnostic: the canonical URL is injected at deploy time (CF Pages env var).
// Falls back to a placeholder so local builds and previews work without config.
const site = process.env.SITE_URL || 'https://brainmap.pages.dev';

export default defineConfig({
  site,
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
});
