/**
 * JSON-LD BUILDERS
 *
 * Rules enforced here:
 *  1. AggregateRating is never emitted standalone — it is always nested inside
 *     the thing being rated (VideoGame). Google rejects orphan ratings.
 *  2. Every builder returns a plain object; the <JsonLd> component handles
 *     serialization and escaping. Never JSON.stringify in a page.
 *  3. `@id` values are deterministic (derived from URLs) so nodes can reference
 *     each other instead of duplicating data.
 */

import type { Game, Guide, Character, Video, CodesDoc, Review, Alternatives, Tag } from '@/lib/content';
import { routes } from '@/lib/routes';

export type JsonLdNode = Record<string, unknown>;

interface Ctx {
  /** Absolute site origin, no trailing slash. */
  origin: string;
  game: Game;
}

const abs = (origin: string, path: string) => `${origin}${path}`;

/* ------------------------------------------------------------------ *
 * VideoGame + AggregateRating
 * ------------------------------------------------------------------ */

export function gameNode(ctx: Ctx): JsonLdNode {
  const { game, origin } = ctx;
  const node: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': ['VideoGame', 'SoftwareApplication'],
    '@id': abs(origin, routes.home()) + '#game',
    name: game.data.name,
    description: game.data.description.description,
    url: abs(origin, routes.home()),
    image: abs(origin, game.data.cover.src),
    applicationCategory: 'GameApplication',
    operatingSystem: game.data.platforms.join(', '),
    genre: game.data.genres,
    author: { '@type': 'Organization', name: game.data.developer },
    publisher: { '@type': 'Organization', name: game.data.publisher },
    datePublished: game.data.releaseDate.toISOString().slice(0, 10),
    inLanguage: game.data.platforms.includes('Web') ? 'en' : undefined,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: game.data.playUrl,
    },
    screenshot: game.data.screenshots.map((s) => abs(origin, s.src)),
  };

  // AggregateRating MUST live inside the rated entity (VideoGame).
  if (game.data.rating) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: game.data.rating.value,
      bestRating: game.data.rating.best,
      worstRating: 0,
      ratingCount: game.data.rating.count,
    };
  }

  return node;
}

/* ------------------------------------------------------------------ *
 * VideoObject
 * ------------------------------------------------------------------ */

export function videoNode(origin: string, video: Video): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    '@id': `${origin}${routes.home()}#video-${video.id}`,
    name: video.data.title,
    description: video.data.description,
    thumbnailUrl: [abs(origin, video.data.thumbnail.src)],
    uploadDate: video.data.uploadDate.toISOString(),
    duration: video.data.duration,
    embedUrl: video.data.url,
    contentUrl: video.data.url,
  };
}

/* ------------------------------------------------------------------ *
 * BreadcrumbList
 * ------------------------------------------------------------------ */

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbNode(origin: string, crumbs: Crumb[]): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: abs(origin, c.path),
    })),
  };
}

/* ------------------------------------------------------------------ *
 * ItemList — character rosters, guide indexes, alternative games
 * ------------------------------------------------------------------ */

export function itemListNode(
  origin: string,
  opts: { name: string; description?: string; items: Array<{ name: string; path: string }> }
): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: opts.name,
    description: opts.description,
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: abs(origin, item.path),
    })),
  };
}

/** External-url variant, for "alternatives" pages. */
export function externalItemListNode(
  opts: { name: string; description?: string; items: Array<{ name: string; url: string }> }
): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: opts.name,
    description: opts.description,
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * FAQPage
 * ------------------------------------------------------------------ */

export function faqNode(faq: Array<{ q: string; a: string }>): JsonLdNode | null {
  if (faq.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Convenience aggregates per template
 * ------------------------------------------------------------------ */

/** Homepage: game + videos + faq. */
export function homeNodes(ctx: Ctx, videos: Video[]): JsonLdNode[] {
  const nodes: JsonLdNode[] = [gameNode(ctx)];
  for (const v of videos) nodes.push(videoNode(ctx.origin, v));
  const faq = faqNode(ctx.game.data.faq);
  if (faq) nodes.push(faq);
  return nodes;
}

/** Guide detail: breadcrumb + faq (+ ItemList when the guide is a tier list). */
export function guideNodes(
  ctx: Ctx,
  guide: Guide,
  crumbs: Crumb[],
  tierItems?: Array<{ name: string; path: string }>
): JsonLdNode[] {
  const nodes: JsonLdNode[] = [breadcrumbNode(ctx.origin, crumbs)];
  const faq = faqNode(guide.data.faq);
  if (faq) nodes.push(faq);
  if (tierItems && tierItems.length > 0) {
    nodes.push(
      itemListNode(ctx.origin, {
        name: guide.data.title,
        description: guide.data.excerpt,
        items: tierItems,
      })
    );
  }
  return nodes;
}

/** Character index: breadcrumb + ItemList. */
export function characterIndexNodes(
  ctx: Ctx,
  crumbs: Crumb[],
  characters: Character[]
): JsonLdNode[] {
  return [
    breadcrumbNode(ctx.origin, crumbs),
    itemListNode(ctx.origin, {
      name: `All characters in ${ctx.game.data.name}`,
      items: characters.map((c) => ({ name: c.data.name, path: routes.character(c.id) })),
    }),
  ];
}

/** Character detail: breadcrumb + faq. */
export function characterNodes(
  ctx: Ctx,
  crumbList: Crumb[],
  faq: Array<{ q: string; a: string }> = []
): JsonLdNode[] {
  const nodes: JsonLdNode[] = [breadcrumbNode(ctx.origin, crumbList)];
  const faqNode_ = faqNode(faq);
  if (faqNode_) nodes.push(faqNode_);
  return nodes;
}

/** Codes page: breadcrumb + faq. */
export function codesNodes(ctx: Ctx, crumbs: Crumb[], codes: CodesDoc): JsonLdNode[] {
  const nodes: JsonLdNode[] = [breadcrumbNode(ctx.origin, crumbs)];
  const faq = faqNode(codes.data.faq);
  if (faq) nodes.push(faq);
  return nodes;
}

/** Review page: breadcrumb + faq. */
export function reviewNodes(ctx: Ctx, crumbs: Crumb[], review: Review): JsonLdNode[] {
  const nodes: JsonLdNode[] = [breadcrumbNode(ctx.origin, crumbs)];
  const faq = faqNode(review.data.faq);
  if (faq) nodes.push(faq);
  return nodes;
}

/** Alternatives page: breadcrumb + external ItemList + faq. */
export function alternativesNodes(
  ctx: Ctx,
  crumbs: Crumb[],
  alt: Alternatives
): JsonLdNode[] {
  const nodes: JsonLdNode[] = [
    breadcrumbNode(ctx.origin, crumbs),
    externalItemListNode({
      name: alt.data.seo.title,
      description: alt.data.intro,
      items: alt.data.items.map((i) => ({ name: i.name, url: i.url })),
    }),
  ];
  const faq = faqNode(alt.data.faq);
  if (faq) nodes.push(faq);
  return nodes;
}

/** List pages (guides, tags): breadcrumb + ItemList. */
export function listNodes(
  ctx: Ctx,
  crumbs: Crumb[],
  list: { name: string; description?: string; items: Array<{ name: string; path: string }> }
): JsonLdNode[] {
  return [breadcrumbNode(ctx.origin, crumbs), itemListNode(ctx.origin, list)];
}

/** Tag detail: breadcrumb + ItemList of everything tagged. */
export function tagNodes(
  ctx: Ctx,
  crumbs: Crumb[],
  tag: Tag,
  items: Array<{ name: string; path: string }>
): JsonLdNode[] {
  return [
    breadcrumbNode(ctx.origin, crumbs),
    itemListNode(ctx.origin, {
      name: tag.data.label,
      description: tag.data.description,
      items,
    }),
  ];
}
