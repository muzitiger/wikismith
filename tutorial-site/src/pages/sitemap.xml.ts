import type { APIRoute } from 'astro';
import { buildGroups, renderIndex } from '@/lib/sitemap';
import { SITE } from '@/config/site';

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL(SITE.url)).origin;
  const groups = await buildGroups();
  return new Response(renderIndex(groups, origin), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
