/**
 * URL BUILDERS — every internal link in the site goes through this file.
 *
 * Why: a URL change must be a one-line edit, not a grep across 30 components.
 * Also the single place that enforces trailing slashes.
 */

import { isOpen, type RouteKey } from '@/config/site';

const s = (p: string) => (p === '/' ? p : `${p.replace(/\/+$/, '')}/`);

export const routes = {
  home: () => '/',
  play: () => s('/play'),
  guides: () => s('/guides'),
  guide: (slug: string) => s(`/guides/${slug}`),
  characters: () => s('/characters'),
  character: (slug: string) => s(`/characters/${slug}`),
  codes: () => s('/codes'),
  review: () => s('/review'),
  alternatives: () => s('/alternatives'),
  tags: () => s('/tags'),
  tag: (slug: string) => s(`/tags/${slug}`),
  legal: (slug: string) => s(`/${slug}`),
} as const;

/** Route key that owns each path family — used for sitemap grouping + gating. */
export function routeKeyFor(pathname: string): RouteKey {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/') return 'home';
  if (p.startsWith('/play')) return 'play';
  if (p.startsWith('/guides')) return 'guides';
  if (p.startsWith('/characters')) return 'characters';
  if (p.startsWith('/codes')) return 'codes';
  if (p.startsWith('/review')) return 'review';
  if (p.startsWith('/alternatives')) return 'alternatives';
  if (p.startsWith('/tags')) return 'tags';
  return 'legal';
}

/**
 * Returns the href only if that route family is open for indexing.
 * Components render a link when this returns a string, and a dead label
 * (or nothing) when it returns null. This keeps internal links from
 * pointing at pages we've decided not to publish yet.
 */
export function linkIfOpen(key: RouteKey, href: string): string | null {
  return isOpen(key) ? href : null;
}

/** Absolute URL for canonical / sitemap / JSON-LD. */
export function absolute(site: URL | undefined, path: string): string {
  const base = site?.origin ?? '';
  return base + s(path);
}
