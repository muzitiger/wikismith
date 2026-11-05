/**
 * URL BUILDERS — every internal link goes through this file.
 *
 * MULTI-TOPIC URL MODEL
 *   /                          all-topics hub
 *   /{topic}/                  topic hub
 *   /{topic}/tutorials/        tutorial index
 *   /{topic}/tutorials/{slug}/ detail (all templates)
 *   /{topic}/errors/           error index
 *   /{topic}/errors/{slug}/    error detail
 *   /{topic}/series/{slug}/    series path
 *   /{topic}/tags/{tag}/       tag within a topic
 *
 *   /vs/                       comparison index (cross-topic, at ROOT)
 *   /vs/{a}-vs-{b}/            comparison detail
 *
 * Comparisons live at the root on purpose: "astro vs nextjs" is not owned by
 * either topic. Nesting it under /astro/ would make the same article reachable
 * from two paths and force a canonical decision per pair.
 */

import { isOpen, type RouteKey } from '@/config/site';

const s = (p: string) => (p === '/' ? p : `${p.replace(/\/+$/, '')}/`);

export const routes = {
  hub: () => '/',

  topic: (topic: string) => s(`/${topic}`),

  tutorials: (topic: string) => s(`/${topic}/tutorials`),
  tutorial: (topic: string, slug: string) => s(`/${topic}/tutorials/${slug}`),

  errors: (topic: string) => s(`/${topic}/errors`),
  error: (topic: string, slug: string) => s(`/${topic}/errors/${slug}`),

  seriesIndex: (topic: string) => s(`/${topic}/series`),
  series: (topic: string, slug: string) => s(`/${topic}/series/${slug}`),

  tags: (topic: string) => s(`/${topic}/tags`),
  tag: (topic: string, tag: string) => s(`/${topic}/tags/${tag}`),

  comparisons: () => s('/vs'),
  comparison: (slug: string) => s(`/vs/${slug}`),

  legal: (slug: string) => s(`/legal/${slug}`),
} as const;

/**
 * Which route family owns a pathname — used for sitemap grouping and gating.
 * Returns null for system paths (sitemap.xml, robots.txt, 404).
 */
export function routeKeyFor(pathname: string): RouteKey | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/') return 'hub';
  if (p === '/vs') return 'comparisons';
  if (p.startsWith('/vs/')) return 'comparisons';
  if (p === '/tags') return 'tags';
  if (p.startsWith('/tags/')) return 'tags';
  if (p === '/privacy' || p === '/about' || p === '/terms') return 'legal';

  const seg = p.split('/')[1] ?? '';
  if (!seg) return null;
  const rest = p.slice(seg.length + 1);
  if (/^sitemap/.test(seg) || seg === 'robots.txt' || seg === '404') return null;

  if (rest.startsWith('/tutorials')) return 'tutorials';
  if (rest.startsWith('/errors')) return 'errors';
  if (rest.startsWith('/series')) return 'series';
  if (rest.startsWith('/tags')) return 'tags';
  return 'topic';
}

/** Returns href only if that route family is open for indexing. */
export function linkIfOpen(key: RouteKey, href: string): string | null {
  return isOpen(key) ? href : null;
}

/** Absolute URL for canonical / sitemap / JSON-LD. */
export function absolute(site: URL | undefined, path: string): string {
  const base = site?.origin ?? '';
  return base + s(path);
}

/** Strip trailing slash for JSON-LD @id values, which should match the URL. */
export function jsonLdUrl(origin: string, path: string): string {
  return origin + s(path);
}
