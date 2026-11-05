/**
 * SITE CONFIG — technical settings only.
 *
 * Content lives in src/content/. This file holds the things the build needs
 * BEFORE content is loaded (canonical origin) plus feature switches.
 *
 * FORK CHECKLIST: change `url`, `locale`, and `timezone`. That's it.
 */

export const SITE = {
  /** Canonical origin. No trailing slash. Used for sitemap, robots, canonical tags. */
  url: 'https://example.com',

  /** BCP-47 language tag for <html lang> and og:locale. */
  locale: 'en',
  ogLocale: 'en_US',

  /** Used for date formatting and JSON-LD date defaults. */
  timezone: 'UTC',

  /** Build output is pure static HTML. Keep false. */
  trailingSlash: true,
} as const;

/**
 * FEATURE SWITCHES — all off by default.
 * Nothing here may introduce a network request on first paint.
 */
export const FEATURES = {
  /** Ad slots render as inert placeholders. No ad script is ever injected. */
  ads: false,
  /** Video embeds render as a click-to-load poster (no third-party JS at load). */
  videoEmbeds: false,
  /** Anonymous page counter. Requires an external endpoint; off = zero requests. */
  analytics: false,
} as const;

/**
 * ROUTE VISIBILITY — the single switchboard for launch.
 *
 * A route key in SITEMAP_OPEN is: built, indexable, listed in sitemap, linked in nav.
 * A route key NOT in SITEMAP_OPEN is: still built (for local preview), but
 *   noindex,nofollow + excluded from sitemap + hidden from nav and internal links.
 *
 * Phase 1 of a new site: only 'home'. Add keys as content is verified.
 */
export type RouteKey =
  | 'home'
  | 'play'
  | 'guides'
  | 'characters'
  | 'codes'
  | 'review'
  | 'alternatives'
  | 'tags'
  | 'legal';

export const SITEMAP_OPEN: RouteKey[] = ['home'];

export function isOpen(key: RouteKey): boolean {
  return SITEMAP_OPEN.includes(key);
}

/** True when the route should be crawled and listed. */
export function isIndexable(key: RouteKey): boolean {
  return isOpen(key);
}
