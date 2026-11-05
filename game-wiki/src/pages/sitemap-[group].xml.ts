/**
 * /sitemap-<group>.xml — per-category child sitemap.
 *
 * getStaticPaths is derived from buildGroups(), the same function the index
 * uses. A group that is locked by SITEMAP_OPEN produces no path, so no child
 * file exists and the index cannot reference it.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { buildGroups, renderUrlset, type SitemapGroup } from '@/lib/sitemap';
import { SITE } from '@/config/site';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const groups = await buildGroups();
  return groups.map((group) => ({
    params: { group: group.slug },
    props: { group },
  }));
};

export const GET: APIRoute = ({ props, site }) => {
  const { group } = props as { group: SitemapGroup };
  const origin = site?.origin ?? SITE.url;
  return new Response(renderUrlset(group.entries, origin), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
