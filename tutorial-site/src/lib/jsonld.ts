/**
 * JSON-LD BUILDERS
 *
 * Rules enforced here:
 *  1. Every builder takes a content object. No page hand-writes structured data,
 *     so the markup and the visible page can never drift apart.
 *  2. `@id` values are deterministic (derived from URLs) so nodes reference
 *     each other instead of duplicating data.
 *  3. HowToStep.text is PLAIN TEXT, never HTML or markdown. Google rejects
 *     markup inside `text`, and empty text fails validation outright.
 *  4. No fake AggregateRating / Review. We have no real ratings; emitting them
 *     is a spam signal.
 *
 * Docs: https://developers.google.com/search/docs/appearance/structured-data
 */

import type { Topic, Tutorial, ErrorDoc, Comparison, Series } from '@/lib/content';
import type { Block } from '@/lib/blocks';
import { blocksToPlainText, stripMarkdown } from '@/lib/blocks';

export type JsonLdNode = Record<string, unknown>;

export interface Ctx {
  origin: string;
}

const abs = (origin: string, path: string) => {
  const p = path.endsWith('/') ? path : `${path}/`;
  return origin + p;
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** ISO 8601 duration from minutes. */
function isoDuration(minutes: number | undefined): string | undefined {
  if (!minutes || minutes <= 0) return undefined;
  return `PT${Math.round(minutes)}M`;
}

/** Drop undefined keys so the emitted JSON stays clean. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ *
 * HowTo
 * ------------------------------------------------------------------ */

/**
 * Build a HowTo from a tutorial.
 *
 * Critical detail: prerequisites are NOT steps. Google renders `step` as the
 * numbered instructions, so folding a prerequisite into that array shifts every
 * position by one and corrupts the rich result. Prereqs go into `tool` and
 * `supply` instead.
 */
export function howToNode(
  ctx: Ctx,
  tutorial: Tutorial,
  canonicalPath: string
): JsonLdNode {
  const d = tutorial.data;

  const steps = [...d.steps]
    .sort((a, b) => a.n - b.n)
    .map((s) => {
      // Step text = the step's prose + its substeps, flattened.
      // Every part goes through stripMarkdown: `expected` and substep text are
      // authored with backticks too, and a raw backtick or `<tag>` in
      // HowToStep.text fails Google's validation.
      const parts: string[] = [];
      const prose = blocksToPlainText(s.body);
      if (prose) parts.push(prose);
      for (const sub of s.subSteps) {
        parts.push(stripMarkdown(`${sub.title}: ${sub.text}`));
      }
      if (s.expected) parts.push(`Expected result: ${stripMarkdown(s.expected)}`);

      return compact({
        '@type': 'HowToStep',
        position: s.n,
        name: stripMarkdown(s.title),
        text: parts.join(' ').trim(),
        url: `${abs(ctx.origin, canonicalPath)}#step-${s.n}`,
        itemListElement: s.subSteps.length
          ? s.subSteps.map((sub, i) => ({
              '@type': 'HowToDirection',
              position: i + 1,
              text: stripMarkdown(`${sub.title}: ${sub.text}`),
            }))
          : undefined,
      });
    })
    // A step with empty text is invalid; drop rather than ship bad markup.
    .filter((s) => typeof s.text === 'string' && s.text.length > 0);

  const tools = d.prerequisites
    .filter((p) => p.kind === 'tool')
    .map((p) => compact({
      '@type': 'HowToTool',
      name: stripMarkdown(p.text),
    }));

  const supplies = d.prerequisites
    .filter((p) => p.kind === 'file')
    .map((p) => compact({
      '@type': 'HowToSupply',
      name: stripMarkdown(p.text),
    }));

  return compact({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${abs(ctx.origin, canonicalPath)}#howto`,
    name: stripMarkdown(d.h1),
    description: stripMarkdown(d.answer),
    totalTime: isoDuration(d.totalMinutes),
    tool: tools,
    supply: supplies,
    step: steps,
    image: d.seo.ogImage ? abs(ctx.origin, d.seo.ogImage) : undefined,
    inLanguage: 'en',
    datePublished: dateOnly(d.published),
    dateModified: dateOnly(d.updated),
  });
}

/* ------------------------------------------------------------------ *
 * TechArticle — for pillar / error / comparison pages
 * ------------------------------------------------------------------ */

export function techArticleNode(
  ctx: Ctx,
  opts: {
    headline: string;
    description: string;
    path: string;
    published: Date;
    updated: Date;
    keywords?: string[];
    about?: string;
    proficiencyLevel?: string;
  }
): JsonLdNode {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    '@id': `${abs(ctx.origin, opts.path)}#article`,
    headline: stripMarkdown(opts.headline),
    description: stripMarkdown(opts.description),
    url: abs(ctx.origin, opts.path),
    mainEntityOfPage: { '@type': 'WebPage', '@id': abs(ctx.origin, opts.path) },
    datePublished: dateOnly(opts.published),
    dateModified: dateOnly(opts.updated),
    inLanguage: 'en',
    proficiencyLevel: opts.proficiencyLevel,
    keywords: opts.keywords?.length ? opts.keywords.join(', ') : undefined,
    about: opts.about ? { '@type': 'Thing', name: opts.about } : undefined,
  });
}

/** Error pages render an article about the error itself. */
export function errorArticleNode(ctx: Ctx, err: ErrorDoc, path: string): JsonLdNode {
  return techArticleNode(ctx, {
    headline: err.data.h1,
    description: err.data.answer,
    path,
    published: err.data.published,
    updated: err.data.updated,
    keywords: [
      err.data.message,
      ...(err.data.code ? [err.data.code] : []),
      ...err.data.tags,
    ],
    about: err.data.message,
  });
}

export function comparisonArticleNode(
  ctx: Ctx,
  cmp: Comparison,
  aName: string,
  bName: string,
  path: string
): JsonLdNode {
  return techArticleNode(ctx, {
    headline: cmp.data.h1,
    description: cmp.data.answer,
    path,
    published: cmp.data.published,
    updated: cmp.data.updated,
    keywords: [`${aName} vs ${bName}`, aName, bName, 'comparison'],
  });
}

/* ------------------------------------------------------------------ *
 * BreadcrumbList
 * ------------------------------------------------------------------ */

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbNode(ctx: Ctx, crumbs: Crumb[]): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${abs(ctx.origin, crumbs[crumbs.length - 1]?.path ?? '/')}#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: abs(ctx.origin, c.path),
    })),
  };
}

/* ------------------------------------------------------------------ *
 * FAQPage
 * ------------------------------------------------------------------ */

export function faqNode(
  faq: ReadonlyArray<{ q: string; a: string }>
): JsonLdNode | null {
  if (!faq.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: stripMarkdown(item.q),
      acceptedAnswer: { '@type': 'Answer', text: stripMarkdown(item.a) },
    })),
  };
}

/* ------------------------------------------------------------------ *
 * ItemList / CollectionPage
 * ------------------------------------------------------------------ */

export function itemListNode(
  ctx: Ctx,
  opts: {
    name: string;
    description?: string;
    path: string;
    items: Array<{ name: string; path: string }>;
  }
): JsonLdNode {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${abs(ctx.origin, opts.path)}#list`,
    name: opts.name,
    description: stripMarkdown(opts.description),
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: abs(ctx.origin, item.path),
    })),
  });
}

export function collectionPageNode(
  ctx: Ctx,
  opts: { name: string; description: string; path: string; updated: Date }
): JsonLdNode {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${abs(ctx.origin, opts.path)}#page`,
    name: opts.name,
    description: stripMarkdown(opts.description),
    url: abs(ctx.origin, opts.path),
    dateModified: dateOnly(opts.updated),
    inLanguage: 'en',
  });
}

/* ------------------------------------------------------------------ *
 * WebSite / Organization (root)
 * ------------------------------------------------------------------ */

export function webSiteNode(ctx: Ctx, opts: { name: string; description: string }): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${ctx.origin}/#website`,
    name: opts.name,
    description: stripMarkdown(opts.description),
    url: `${ctx.origin}/`,
    inLanguage: 'en',
  };
}

/** A topic hub is a WebPage about a software product. */
export function topicNode(ctx: Ctx, topic: Topic, path: string): JsonLdNode {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${abs(ctx.origin, path)}#webpage`,
    name: topic.data.seo.title,
    description: topic.data.seo.description,
    url: abs(ctx.origin, path),
    inLanguage: 'en',
    about: {
      '@type': 'SoftwareApplication',
      name: topic.data.name,
      applicationCategory: topic.data.category,
      softwareVersion: topic.data.currentVersion,
      url: topic.data.officialUrl,
    },
    dateModified: dateOnly(topic.data.updated),
  });
}

/* ------------------------------------------------------------------ *
 * Per-template aggregates
 * ------------------------------------------------------------------ */

/** T1/T3/T7: HowTo + FAQ + Breadcrumb. */
export function howToPageNodes(
  ctx: Ctx,
  tutorial: Tutorial,
  path: string,
  crumbs: Crumb[]
): JsonLdNode[] {
  const nodes: JsonLdNode[] = [breadcrumbNode(ctx, crumbs), howToNode(ctx, tutorial, path)];
  const faq = faqNode(tutorial.data.faq);
  if (faq) nodes.push(faq);
  return nodes;
}

/** T2/T6: TechArticle + FAQ + Breadcrumb (+ ItemList for pillar clusters). */
export function articlePageNodes(
  ctx: Ctx,
  tutorial: Tutorial,
  path: string,
  crumbs: Crumb[],
  cluster?: Array<{ name: string; path: string }>
): JsonLdNode[] {
  const nodes: JsonLdNode[] = [
    breadcrumbNode(ctx, crumbs),
    techArticleNode(ctx, {
      headline: tutorial.data.h1,
      description: tutorial.data.answer,
      path,
      published: tutorial.data.published,
      updated: tutorial.data.updated,
      keywords: [tutorial.data.primaryKeyword, ...tutorial.data.secondaryKeywords],
      proficiencyLevel: tutorial.data.difficulty,
    }),
  ];
  const faq = faqNode(tutorial.data.faq);
  if (faq) nodes.push(faq);
  if (cluster && cluster.length) {
    nodes.push(
      itemListNode(ctx, {
        name: tutorial.data.h1,
        description: tutorial.data.excerpt,
        path,
        items: cluster,
      })
    );
  }
  return nodes;
}

/** T5: TechArticle + FAQ + Breadcrumb (+ HowTo when a cause has fix steps). */
export function errorPageNodes(
  ctx: Ctx,
  err: ErrorDoc,
  path: string,
  crumbs: Crumb[]
): JsonLdNode[] {
  const nodes: JsonLdNode[] = [breadcrumbNode(ctx, crumbs), errorArticleNode(ctx, err, path)];
  const faq = faqNode(err.data.faq);
  if (faq) nodes.push(faq);
  return nodes;
}

/** T4: TechArticle + FAQ + Breadcrumb. */
export function comparisonPageNodes(
  ctx: Ctx,
  cmp: Comparison,
  aName: string,
  bName: string,
  path: string,
  crumbs: Crumb[]
): JsonLdNode[] {
  const nodes: JsonLdNode[] = [
    breadcrumbNode(ctx, crumbs),
    comparisonArticleNode(ctx, cmp, aName, bName, path),
  ];
  const faq = faqNode(cmp.data.faq);
  if (faq) nodes.push(faq);
  return nodes;
}

/** Series page: CollectionPage + ItemList + Breadcrumb. */
export function seriesPageNodes(
  ctx: Ctx,
  s: Series,
  path: string,
  crumbs: Crumb[],
  items: Array<{ name: string; path: string }>
): JsonLdNode[] {
  return [
    breadcrumbNode(ctx, crumbs),
    collectionPageNode(ctx, {
      name: s.data.h1,
      description: s.data.intro.slice(0, 155),
      path,
      updated: s.data.updated,
    }),
    itemListNode(ctx, { name: s.data.h1, path, items }),
  ];
}

export type { Block };
