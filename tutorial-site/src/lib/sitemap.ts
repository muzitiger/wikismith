/**
 * SITEMAP REGISTRY — the only place that decides what gets listed.
 *
 * Both the index (/sitemap.xml) and every child (/sitemap-<group>.xml) call
 * buildGroups(), so the index cannot advertise a child file that was never
 * generated.
 *
 * Two gates apply to every entry:
 *   1. Global route key must be in SITEMAP_OPEN (config/site.ts)
 *   2. Owning topic must have status: 'live'
 *
 * Draft topics render (for preview) but never appear here.
 */

import { isOpen, type RouteKey } from '@/config/site';
import {
  getTopics,
  getTutorials,
  getErrors,
  getComparisons,
  getSeriesList,
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

/** Topics that may be indexed at all. */
export async function liveTopicIds(): Promise<Set<string>> {
  const topics = await getTopics();
  return new Set(topics.filter((t) => t.data.status === 'live').map((t) => t.id));
}

export async function buildGroups(): Promise<SitemapGroup[]> {
  const topics = await getTopics();
  const live = new Set(topics.filter((t) => t.data.status === 'live').map((t) => t.id));
  const primaries = topics.filter((t) => t.data.kind === 'primary' && live.has(t.id));

  const [tutorials, errors, comparisons, seriesList] = await Promise.all([
    getTutorials(),
    getErrors(),
    getComparisons(),
    getSeriesList(),
  ]);

  const groups: SitemapGroup[] = [];

  /* --- Root hub --- */
  if (isOpen('hub')) {
    const newest = topics.reduce(
      (acc, t) => (t.data.updated > acc ? t.data.updated : acc),
      new Date(0)
    );
    groups.push({
      slug: 'pages',
      key: 'hub',
      entries: [{ path: routes.hub(), lastmod: d(newest), changefreq: 'weekly', priority: 1 }],
    });
  }

  /* --- Topic hubs --- */
  if (isOpen('topic')) {
    const entries: SitemapEntry[] = primaries.map((t) => ({
      path: routes.topic(t.id),
      lastmod: d(t.data.updated),
      changefreq: 'weekly',
      priority: 0.9,
    }));
    if (entries.length) groups.push({ slug: 'topics', key: 'topic', entries });
  }

  /* --- Tutorials --- */
  if (isOpen('tutorials')) {
    const entries: SitemapEntry[] = [];
    for (const t of primaries) {
      const mine = tutorials.filter((x) => x.data.topic === t.id);
      if (!mine.length) continue;
      entries.push({
        path: routes.tutorials(t.id),
        lastmod: d(t.data.updated),
        changefreq: 'weekly',
        priority: 0.8,
      });
      for (const tut of mine) {
        entries.push({
          path: routes.tutorial(t.id, tut.id),
          lastmod: d(tut.data.updated),
          changefreq: 'monthly',
          priority: tut.data.template === 'pillar' ? 0.8 : 0.7,
        });
      }
    }
    if (entries.length) groups.push({ slug: 'tutorials', key: 'tutorials', entries });
  }

  /* --- Errors --- */
  if (isOpen('errors')) {
    const entries: SitemapEntry[] = [];
    for (const t of primaries) {
      const mine = errors.filter((x) => x.data.topic === t.id);
      if (!mine.length) continue;
      entries.push({
        path: routes.errors(t.id),
        lastmod: d(t.data.updated),
        changefreq: 'weekly',
        priority: 0.6,
      });
      for (const e of mine) {
        entries.push({
          path: routes.error(t.id, e.id),
          lastmod: d(e.data.updated),
          changefreq: 'monthly',
          priority: 0.6,
        });
      }
    }
    if (entries.length) groups.push({ slug: 'errors', key: 'errors', entries });
  }

  /* --- Series --- */
  if (isOpen('series')) {
    const entries: SitemapEntry[] = [];
    for (const t of primaries) {
      const mine = seriesList.filter((s) => s.data.topic === t.id);
      if (!mine.length) continue;
      entries.push({
        path: routes.seriesIndex(t.id),
        lastmod: d(t.data.updated),
        changefreq: 'monthly',
        priority: 0.5,
      });
      for (const s of mine) {
        entries.push({
          path: routes.series(t.id, s.id),
          lastmod: d(s.data.updated),
          changefreq: 'monthly',
          priority: 0.6,
        });
      }
    }
    if (entries.length) groups.push({ slug: 'series', key: 'series', entries });
  }

  /* --- Comparisons (root-level, no topic gate) --- */
  if (isOpen('comparisons') && comparisons.length) {
    groups.push({
      slug: 'comparisons',
      key: 'comparisons',
      entries: [
        {
          path: routes.comparisons(),
          lastmod: d(
            comparisons.reduce((acc, c) => (c.data.updated > acc ? c.data.updated : acc), new Date(0))
          ),
          changefreq: 'monthly',
          priority: 0.7,
        },
        ...comparisons.map((c) => ({
          path: routes.comparison(c.id),
          lastmod: d(c.data.updated),
          changefreq: 'monthly' as const,
          priority: 0.7,
        })),
      ],
    });
  }

  return groups.filter((g) => g.entries.length > 0);
}

export function renderUrlset(entries: SitemapEntry[], origin: string): string {
  const urls = entries
    .map((e) => {
      const parts = [
        `    <loc>${esc(origin + e.path)}</loc>`,
        `    <lastmod>${e.lastmod}</lastmod>`,
      ];
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority !== undefined) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderIndex(groups: SitemapGroup[], origin: string): string {
  const items = groups
    .map(
      (g) =>
        `  <sitemap>\n    <loc>${esc(`${origin}/sitemap-${g.slug}.xml`)}</loc>\n  </sitemap>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
