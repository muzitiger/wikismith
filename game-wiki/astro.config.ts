import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { SITE } from './src/config/site';

export default defineConfig({
  site: SITE.url,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  vite: {
    // Cast to `never`: @tailwindcss/vite ships its own copy of Vite's types,
    // which are structurally identical but nominally incompatible with the
    // copy Astro resolves. Runtime is unaffected; without the cast, `astro
    // check` reports a false-positive type error on every build.
    plugins: [tailwindcss()] as never,
  },
  devToolbar: { enabled: false },
});
