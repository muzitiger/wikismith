/**
 * /sitemap.xml — the index. Lists one child sitemap per category.
 */
import type { APIRoute } from 'astro';
import { buildGroups, renderIndex } from '@/lib/sitemap';
import { SITE } from '@/config/site';

export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin ?? SITE.url;
  const groups = await buildGroups();
  return new Response(renderIndex(groups, origin), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
