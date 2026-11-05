import type { APIRoute, GetStaticPaths } from 'astro';
import { buildGroups, renderUrlset } from '@/lib/sitemap';
import { SITE } from '@/config/site';

export const getStaticPaths: GetStaticPaths = async () => {
  const groups = await buildGroups();
  return groups.map((g) => ({
    params: { group: g.slug },
    props: { entries: g.entries },
  }));
};

export const GET: APIRoute = async ({ site, props }) => {
  const origin = (site ?? new URL(SITE.url)).origin;
  const { entries } = props as { entries: Parameters<typeof renderUrlset>[0] };
  return new Response(renderUrlset(entries, origin), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
