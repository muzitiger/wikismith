/**
 * SITE CONFIG — technical settings only.
 * Content lives in src/content/. This file holds what the build needs
 * BEFORE content loads (canonical origin, locale) plus feature switches.
 *
 * FORK CHECKLIST: change `url`, `locale`, `timezone`, `wordCountMode`.
 */

export const SITE = {
  /** Canonical origin, no trailing slash. Used for sitemap, robots, canonical. */
  url: 'https://example.com',

  locale: 'en',
  ogLocale: 'en_US',
  timezone: 'UTC',
  trailingSlash: true,

  /**
   * How `scripts/check-content.ts` counts body length.
   * 'words' → English article (default, 1000 floor)
   * 'chars' → CJK article (1800 floor, set via minChars)
   */
  wordCountMode: 'words' as 'words' | 'chars',
} as const;

export const FEATURES = {
  ads: false,
  analytics: false,
} as const;

/**
 * ROUTE VISIBILITY — the launch switchboard.
 *
 * A key in SITEMAP_OPEN is: built, indexable, in sitemap, linked in nav.
 * A key NOT in SITEMAP_OPEN is: still built (local preview), but
 *   noindex,nofollow + excluded from sitemap + hidden from internal links.
 *
 * Because this template is multi-topic, gating is two-dimensional:
 * the global key below AND each topic's own `status`.
 */
export type RouteKey =
  | 'hub' // "/" — the all-topics landing page
  | 'topic' // "/{topic}/"
  | 'tutorials'
  | 'errors'
  | 'comparisons'
  | 'series'
  | 'tags'
  | 'legal';

export const SITEMAP_OPEN: RouteKey[] = [
  'hub',
  'topic',
  'tutorials',
  'errors',
  'comparisons',
  'series',
  'tags',
  'legal',
];

export function isOpen(key: RouteKey): boolean {
  return SITEMAP_OPEN.includes(key);
}

/**
 * Slugs that may NOT be used as a topic slug, because they already own a
 * root-level path. Enforced at build time in scripts/check-content.ts.
 */
export const RESERVED_SLUGS = [
  'about',
  'privacy',
  'terms',
  '404',
  'sitemap',
  'sitemap-pages',
  'sitemap-tutorials',
  'sitemap-errors',
  'sitemap-comparisons',
  'sitemap-topics',
  'robots',
  'tags',
  'search',
  '_astro',
  'api',
] as const;
