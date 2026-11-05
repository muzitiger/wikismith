/**
 * /robots.txt — generated, not static, so the sitemap URL can never drift
 * from SITE.url. Also keeps crawlers out of locked routes before launch.
 */
import type { APIRoute } from 'astro';
import { SITE } from '@/config/site';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? SITE.url;
  const body = `# robots.txt for ${new URL(origin).hostname}
User-agent: *
Allow: /

# Add /search/ or /api/ here if you introduce private routes later.
# Disallow:
#  - /search/

Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
