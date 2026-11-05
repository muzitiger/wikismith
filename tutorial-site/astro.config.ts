import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { SITE } from './src/config/site';

/**
 * The `@` alias must resolve through fileURLToPath, not URL.pathname.
 * `pathname` percent-encodes non-ASCII characters, so a project living under a
 * path with CJK characters (which is common on a Chinese-locale desktop) makes
 * Vite look for a directory literally named `%E6%A8%A1...`.
 */
const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  site: SITE.url,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  vite: {
    /**
     * The Tailwind plugin is typed against the root `vite` package while Astro
     * bundles its own copy, so the two Plugin types are structurally identical
     * but nominally different. Casting at this one boundary is preferable to
     * pinning vite versions or skipping type checking on the whole config.
     */
    // @ts-expect-error — the tailwind plugin and Astro resolve different
    // copies of vite, so the Plugin types are nominally distinct though
    // structurally identical. Runtime behaviour is correct.
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': srcDir,
      },
    },
  },
  devToolbar: { enabled: false },
});
