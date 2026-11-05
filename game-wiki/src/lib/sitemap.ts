/**
 * SITEMAP REGISTRY — the single source of truth for what gets listed.
 *
 * Both /sitemap.xml (the index) and /sitemap-<group>.xml (the children) call
 * buildGroups(), so it is structurally impossible for the index to advertise
 * a child file that was never generated.
 *
 * Gating: a group only appears when its RouteKey is in SITEMAP_OPEN.
 * On a fresh fork SITEMAP_OPEN = ['home'], so the only listed URL is "/".
 */

import { isOpen, type RouteKey } from '@/config/site';
import {
  getGame,
  getGuides,
  getCharacters,
  getCodes,
  getAlternatives,
  getReview,
  getTags,
} from '@/lib/content';
import { routes } from '@/lib/routes';

export interface SitemapEntry {
  path: string;
  lastmod: string;
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
}

export interface SitemapGroup {
  slug: string;
  key: RouteKey;
  entries: SitemapEntry[];
}

const d = (date: Date) => date.toISOString().slice(0, 10);

/** Groups that are open AND have at least one URL. Empty groups are dropped. */
export async function buildGroups(): Promise<SitemapGroup[]> {
  const game = await getGame();
  const gameUpdated = d(game.data.updated);
  const groups: SitemapGroup[] = [];

  if (isOpen('home')) {
    groups.push({
      slug: 'pages',
      key: 'home',
      entries: [{ path: routes.home(), lastmod: gameUpdated, changefreq: 'weekly', priority: 1 }],
    });
  }

  if (isOpen('guides')) {
    const guides = await getGuides();
    if (guides.length > 0) {
      groups.push({
        slug: 'guides',
        key: 'guides',
        entries: [
          { path: routes.guides(), lastmod: gameUpdated, changefreq: 'weekly', priority: 0.8 },
          ...guides.map((g) => ({
            path: routes.guide(g.id),
            lastmod: d(g.data.updated),
            changefreq: 'monthly' as const,
            priority: 0.7,
          })),
        ],
      });
    }
  }

  if (isOpen('characters')) {
    const chars = await getCharacters();
    if (chars.length > 0) {
      groups.push({
        slug: 'characters',
        key: 'characters',
        entries: [
          { path: routes.characters(), lastmod: gameUpdated, changefreq: 'weekly', priority: 0.8 },
          ...chars.map((c) => ({
            path: routes.character(c.id),
            lastmod: d(c.data.updated),
            changefreq: 'monthly' as const,
            priority: 0.6,
          })),
        ],
      });
    }
  }

  if (isOpen('codes') && game.data.codesId) {
    const codes = await getCodes(game.data.codesId);
    if (codes) {
      groups.push({
        slug: 'codes',
        key: 'codes',
        entries: [
          { path: routes.codes(), lastmod: d(codes.data.updated), changefreq: 'daily', priority: 0.9 },
        ],
      });
    }
  }

  if (isOpen('review') && game.data.reviewId) {
    const review = await getReview(game.data.reviewId);
    if (review) {
      groups.push({
        slug: 'review',
        key: 'review',
        entries: [
          { path: routes.review(), lastmod: d(review.data.updated), changefreq: 'monthly', priority: 0.7 },
        ],
      });
    }
  }

  if (isOpen('alternatives') && game.data.alternativeIds.length > 0) {
    const alt = await getAlternatives(game.data.alternativeIds[0]!);
    if (alt) {
      groups.push({
        slug: 'alternatives',
        key: 'alternatives',
        entries: [
          { path: routes.alternatives(), lastmod: d(alt.data.updated), changefreq: 'monthly', priority: 0.7 },
        ],
      });
    }
  }

  if (isOpen('tags')) {
    const tags = await getTags();
    if (tags.length > 0) {
      groups.push({
        slug: 'tags',
        key: 'tags',
        entries: [
          { path: routes.tags(), lastmod: gameUpdated, changefreq: 'weekly', priority: 0.5 },
          ...tags.map((t) => ({
            path: routes.tag(t.id),
            lastmod: gameUpdated,
            changefreq: 'weekly' as const,
            priority: 0.4,
          })),
        ],
      });
    }
  }

  return groups.filter((g) => g.entries.length > 0);
}

/** XML for one group's URLs. */
export function renderUrlset(entries: SitemapEntry[], origin: string): string {
  const urls = entries
    .map((e) => {
      const parts = [`    <loc>${escapeXml(origin + e.path)}</loc>`, `    <lastmod>${e.lastmod}</lastmod>`];
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority !== undefined) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** XML for the sitemap index (references each child). */
export function renderIndex(groups: SitemapGroup[], origin: string): string {
  const items = groups
    .map((g) => `  <sitemap>\n    <loc>${escapeXml(`${origin}/sitemap-${g.slug}.xml`)}</loc>\n  </sitemap>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
