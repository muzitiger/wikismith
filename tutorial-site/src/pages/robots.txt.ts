import type { APIRoute } from 'astro';
import { SITE } from '@/config/site';

/**
 * robots.txt is generated, not static, so the sitemap URL is always the
 * canonical origin. A hand-written file with a hardcoded domain is the most
 * common way a staging sitemap leaks into production.
 */
export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL(SITE.url)).origin;

  const body = `# Generated at build time by src/pages/robots.txt.ts
User-agent: *
Allow: /

# No crawl-delay. Nothing here requires rate limiting.

Sitemap: ${origin}/sitemap.xml
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
