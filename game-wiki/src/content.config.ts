import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * CONTENT COLLECTIONS
 *
 * Every user-visible string on the site traces back to one of these files.
 * Astro components may NOT contain game names, descriptions, or FAQ copy.
 *
 * Collections are split by SHAPE, not by URL. One collection can feed many
 * templates (guides feed both the guide list and the tag list).
 */

/* ------------------------------------------------------------------ *
 * Shared field primitives
 * ------------------------------------------------------------------ */

/** Slug-safe ID: lowercase, digits, hyphens. Used for cross-collection joins. */
const id = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id must be kebab-case: lowercase letters, digits, single hyphens');

/** SEO block. Required everywhere — no page ships without title/description. */
const seo = z.object({
  title: z.string().min(10).max(70),
  description: z.string().min(50).max(165),
  /** Optional override; falls back to the canonical URL derived from the route. */
  canonical: z.string().url().optional(),
  noindex: z.boolean().default(false),
  /** Open Graph image path, relative to /public. Omit to fall back to site default. */
  ogImage: z.string().optional(),
});

/** FAQ entry. Rendered on-page AND emitted as FAQPage JSON-LD from the same source. */
const faqItem = z.object({
  q: z.string().min(8),
  a: z.string().min(20),
});

/** Media reference. `src` is a path under /public or an absolute URL. */
const media = z.object({
  src: z.string().min(1),
  alt: z.string().min(5),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string().optional(),
});

const video = z.object({
  /** Stable ID — referenced by guides and the game's `videoIds`. */
  id,
  title: z.string().min(10),
  description: z.string().min(20),
  /** No embed is loaded until the user clicks. `false` keeps the page JS-free. */
  thumbnail: media,
  /** YouTube/Vimeo watch URL. Parsed for the embed ID at render time. */
  url: z.string().url(),
  uploadDate: z.coerce.date(),
  duration: z.string().regex(/^PT(\d+H)?(\d+M)?(\d+S)?$/, 'ISO 8601 duration, e.g. PT12M30S'),
});

/* ------------------------------------------------------------------ *
 * game — the single source of truth for the subject of this site
 * ------------------------------------------------------------------ */

const game = defineCollection({
  loader: glob({ base: './src/content/game', pattern: '**/*.json' }),
  schema: z.object({
    /** Must equal the collection entry id. Pages assert this. */
    slug: id,
    name: z.string().min(1).max(60),
    /** Short tagline used on cards and the hero. Not the SEO description. */
    tagline: z.string().min(10).max(120),
    description: seo, // `title`/`description` here are the HOMEPAGE's, not the game's
    /** 2–3 paragraphs. Markdown-lite: blank line separates paragraphs. */
    intro: z.string().min(120),

    /** "How it plays" — the gameplay loop, in the site's own words. */
    gameplay: z.object({
      summary: z.string().min(80),
      /** Key mechanics as label/value pairs, rendered as a definition list. */
      mechanics: z
        .array(z.object({ label: z.string().min(2), value: z.string().min(10) }))
        .min(2),
    }),

    /** Controls. Split by input device so the table is honest per platform. */
    controls: z
      .array(
        z.object({
          device: z.string().min(3),
          bindings: z.array(z.object({ action: z.string().min(2), keys: z.string().min(1) })).min(2),
        })
      )
      .min(1),

    developer: z.string().min(1),
    publisher: z.string().min(1),
    releaseDate: z.coerce.date(),
    /** Free-form platform labels, e.g. ["Web", "Android", "iOS"]. */
    platforms: z.array(z.string().min(1)).min(1),
    genres: z.array(z.string().min(1)).min(1),
    /** Rendered as the tag cloud. Also drives /tags/ pages. */
    tags: z.array(id).min(1),

    /** Where the Play button goes. External by definition. */
    playUrl: z.string().url(),
    /** True if the game runs in-browser with no install (drives "unblocked" content). */
    browserPlayable: z.boolean().default(false),

    /** Official key art. 1200x630 recommended — reused as default OG image. */
    cover: media,
    screenshots: z.array(media).min(1),

    /** AggregateRating source of truth. FEEDS JSON-LD AND THE VISIBLE STARS. */
    rating: z
      .object({
        value: z.number().min(0).max(5),
        best: z.number().default(5),
        count: z.number().int().positive(),
      })
      .optional(),

    /** Cross-collection links. Order is preserved in the UI. */
    guideIds: z.array(id).default([]),
    characterIds: z.array(id).default([]),
    videoIds: z.array(id).default([]),
    codesId: id.optional(),
    reviewId: id.optional(),
    alternativeIds: z.array(id).default([]),

    /** FAQ shown on the homepage + detail page. */
    faq: z.array(faqItem).default([]),

    updated: z.coerce.date(),
  }),
});

/* ------------------------------------------------------------------ *
 * guides — how-to / walkthrough / tier-list articles
 * ------------------------------------------------------------------ */

const guides = defineCollection({
  loader: glob({ base: './src/content/guides', pattern: '**/*.json' }),
  schema: z.object({
    slug: id,
    title: z.string().min(10).max(70),
    /** The template this guide renders with. Determines available blocks. */
    kind: z.enum(['howto', 'walkthrough', 'tierlist']),
    seo,
    /** One-line summary for cards and list pages. */
    excerpt: z.string().min(40).max(200),
    /** Body as structured blocks — keeps components free of hardcoded prose. */
    blocks: z.array(
      z.discriminatedUnion('type', [
        z.object({ type: z.literal('p'), text: z.string().min(1) }),
        z.object({ type: z.literal('h2'), text: z.string().min(1) }),
        z.object({ type: z.literal('h3'), text: z.string().min(1) }),
        z.object({ type: z.literal('list'), ordered: z.boolean().default(false), items: z.array(z.string()).min(1) }),
        z.object({ type: z.literal('steps'), items: z.array(z.object({ title: z.string(), body: z.string() })).min(2) }),
        z.object({ type: z.literal('image'), media }),
        z.object({ type: z.literal('note'), tone: z.enum(['info', 'warn']).default('info'), text: z.string() }),
        z.object({
          type: z.literal('table'),
          caption: z.string().optional(),
          headers: z.array(z.string()).min(2),
          rows: z.array(z.array(z.string())).min(1),
        }),
        /** Tier rows reference character IDs, resolved at render time. */
        z.object({
          type: z.literal('tiers'),
          rows: z.array(z.object({ tier: z.string(), characterIds: z.array(id).min(1) })).min(1),
        }),
      ])
    ),
    /** Character IDs mentioned — powers "related" and internal links. */
    characterIds: z.array(id).default([]),
    tags: z.array(id).default([]),
    faq: z.array(faqItem).default([]),
    published: z.coerce.date(),
    updated: z.coerce.date(),
  }),
});

/* ------------------------------------------------------------------ *
 * characters — stat-block entries
 * ------------------------------------------------------------------ */

const characters = defineCollection({
  loader: glob({ base: './src/content/characters', pattern: '**/*.json' }),
  schema: z.object({
    slug: id,
    name: z.string().min(1).max(40),
    /** Narrow role label, e.g. "Bruiser". Not a FK — free text by design. */
    role: z.string().min(1),
    seo,
    summary: z.string().min(60).max(240),
    body: z.string().min(120),
    portrait: media,
    /** Ordered stat rows; `value` is pre-formatted for display. */
    stats: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).min(1),
    /** 1–5, drives the tier chip and sort order. */
    tier: z.number().int().min(1).max(5),
    abilities: z.array(z.object({ name: z.string().min(1), description: z.string().min(20) })).min(1),
    tips: z.array(z.string().min(10)).default([]),
    /** Guides that mention this character. Reverse-linked for breadcrumbs. */
    guideIds: z.array(id).default([]),
    tags: z.array(id).default([]),
    faq: z.array(faqItem).default([]),
    updated: z.coerce.date(),
  }),
});

/* ------------------------------------------------------------------ *
 * codes — redeemable code list
 * ------------------------------------------------------------------ */

const codes = defineCollection({
  loader: glob({ base: './src/content/codes', pattern: '**/*.json' }),
  schema: z.object({
    slug: id,
    seo,
    /** Where codes are entered, in the user's words. */
    redeemSteps: z.array(z.string().min(10)).min(2),
    /** Grouped by status so the page can render sections in a fixed order. */
    entries: z
      .array(
        z.object({
          code: z.string().min(2).max(64),
          reward: z.string().min(3),
          status: z.enum(['active', 'expired']),
          /** ISO date; rendered as "Added Jan 5" and used for sort. */
          added: z.coerce.date(),
          /** Optional source citation for trust. */
          source: z.string().url().optional(),
        })
      )
      .min(1),
    faq: z.array(faqItem).default([]),
    updated: z.coerce.date(),
  }),
});

/* ------------------------------------------------------------------ *
 * reviews — opinion / comparison
 * ------------------------------------------------------------------ */

const reviews = defineCollection({
  loader: glob({ base: './src/content/reviews', pattern: '**/*.json' }),
  schema: z.object({
    slug: id,
    seo,
    /** Structured verdict so the page never needs hardcoded pros/cons markup. */
    verdict: z.string().min(80),
    score: z.number().min(0).max(10),
    pros: z.array(z.string().min(10)).min(2),
    cons: z.array(z.string().min(10)).min(1),
    /** Comparison rows; headline feature comparison table. */
    comparison: z
      .array(z.object({ feature: z.string(), ours: z.string(), theirs: z.string() }))
      .default([]),
    faq: z.array(faqItem).default([]),
    published: z.coerce.date(),
    updated: z.coerce.date(),
  }),
});

/* ------------------------------------------------------------------ *
 * alternatives — similar-game list (ItemList JSON-LD source)
 * ------------------------------------------------------------------ */

const alternatives = defineCollection({
  loader: glob({ base: './src/content/alternatives', pattern: '**/*.json' }),
  schema: z.object({
    slug: id,
    seo,
    intro: z.string().min(80),
    items: z
      .array(
        z.object({
          name: z.string().min(1),
          url: z.string().url(),
          why: z.string().min(40),
          platforms: z.array(z.string()).default([]),
          free: z.boolean().default(true),
        })
      )
      .min(3),
    faq: z.array(faqItem).default([]),
    updated: z.coerce.date(),
  }),
});

/* ------------------------------------------------------------------ *
 * videos — standalone so guides and the game can share one entry
 * ------------------------------------------------------------------ */

const videos = defineCollection({
  loader: glob({ base: './src/content/videos', pattern: '**/*.json' }),
  schema: video,
});

/* ------------------------------------------------------------------ *
 * tags — display labels for the tag cloud and /tags/<tag>/ pages
 * ------------------------------------------------------------------ */

const tags = defineCollection({
  loader: glob({ base: './src/content/tags', pattern: '**/*.json' }),
  schema: z.object({
    slug: id,
    label: z.string().min(1).max(30),
    description: z.string().min(40).max(200).optional(),
  }),
});

/* ------------------------------------------------------------------ *
 * legal — about / privacy / terms, content-driven so pages stay dumb
 * ------------------------------------------------------------------ */

const legal = defineCollection({
  loader: glob({ base: './src/content/legal', pattern: '**/*.json' }),
  schema: z.object({
    slug: id,
    title: z.string().min(3),
    seo,
    updated: z.coerce.date(),
    blocks: z.array(
      z.discriminatedUnion('type', [
        z.object({ type: z.literal('p'), text: z.string() }),
        z.object({ type: z.literal('h2'), text: z.string() }),
        z.object({ type: z.literal('list'), items: z.array(z.string()).min(1) }),
      ])
    ),
  }),
});

/* ------------------------------------------------------------------ *
 * pages — per-route copy for list/utility pages
 *
 * List pages are not content items, but they still need an h1, a lede, and
 * SEO fields. Putting them here keeps every string on the site in src/content/,
 * so a fork never edits an .astro file to change wording.
 * `slug` must match the route family: guides, characters, codes, review,
 * alternatives, tags, play, home.
 * ------------------------------------------------------------------ */

const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.json' }),
  schema: z.object({
    slug: z.enum([
      'home',
      'play',
      'guides',
      'characters',
      'codes',
      'review',
      'alternatives',
      'tags',
      'not-found',
    ]),
    seo,
    /** The single <h1>. Required — no page may fall back to a hardcoded one. */
    h1: z.string().min(3).max(80),
    /** One or two sentences under the h1. Optional for pages that are pure lists. */
    lede: z.string().min(20).max(300).optional(),
    /** Optional eyebrow label above the h1. */
    eyebrow: z.string().max(40).optional(),
    /** Section headings where a page has fixed groups (codes, guides by kind). */
    sectionLabels: z.record(z.string(), z.string()).default({}),
  }),
});

export const collections = {
  game,
  guides,
  characters,
  codes,
  reviews,
  alternatives,
  videos,
  tags,
  legal,
  pages,
};
