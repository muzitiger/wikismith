import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * CONTENT COLLECTIONS — multi-topic tutorial site.
 *
 * Every user-visible string traces back to one of these files.
 * Components may NOT contain tutorial prose, step text, or error copy.
 *
 * Collections are split by SHAPE, not by URL. One shape can feed many routes.
 *
 * MULTI-TOPIC MODEL
 *   topics       — one entry per technology. `kind: 'primary'` ships tutorials;
 *                  `kind: 'stub'` exists only to be a comparison rival.
 *   tutorials    — belong to exactly one topic via `topic` slug.
 *   errors       — belong to one topic; referenced BY tutorials, never inlined.
 *   comparisons  — cross-topic. Live at /vs/<a>-vs-<b>/, owned by no single topic.
 *   series       — ordered learning paths inside one topic.
 */

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

/** Slug-safe ID: lowercase, digits, single hyphens. Used for cross-collection joins. */
const id = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id must be kebab-case');

/**
 * SEO block. Required everywhere — no page ships without title/description.
 * Length bounds are enforced here so bad metadata fails the build, not the SERP.
 */
const seo = z.object({
  title: z.string().min(15).max(60),
  description: z.string().min(70).max(158),
  /** Optional override; falls back to the canonical URL derived from the route. */
  canonical: z.string().url().optional(),
  noindex: z.boolean().default(false),
  ogImage: z.string().optional(),
});

const faqItem = z.object({
  q: z.string().min(10),
  a: z.string().min(40),
});

const media = z.object({
  src: z.string().min(1),
  alt: z.string().min(5),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string().optional(),
});

/**
 * Body block union. Long-form prose goes here — never raw HTML in JSON.
 * `errorRef` is how a body paragraph pulls in an error page without
 * duplicating its content (the error's text lives in the errors collection).
 */
const block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('p'), text: z.string().min(1) }),
  z.object({ type: z.literal('h2'), text: z.string().min(1) }),
  z.object({ type: z.literal('h3'), text: z.string().min(1) }),
  z.object({
    type: z.literal('list'),
    ordered: z.boolean().default(false),
    items: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal('code'),
    lang: z.string().min(1),
    code: z.string().min(1),
    filename: z.string().optional(),
  }),
  z.object({
    type: z.literal('table'),
    caption: z.string().optional(),
    headers: z.array(z.string()).min(2),
    rows: z.array(z.array(z.string())).min(1),
  }),
  z.object({
    type: z.literal('note'),
    tone: z.enum(['info', 'warn', 'danger']).default('info'),
    text: z.string().min(1),
  }),
  z.object({ type: z.literal('image'), media }),
  /** Inline pointer to an error page. Renders summary + link, not full copy. */
  z.object({ type: z.literal('errorRef'), errorId: id }),
]);

/* ------------------------------------------------------------------ *
 * Steps — the single source of HowToStep JSON-LD
 * ------------------------------------------------------------------ */

const prerequisite = z.object({
  text: z.string().min(10),
  kind: z.enum(['tool', 'account', 'knowledge', 'file']),
  version: z.string().optional(),
  required: z.boolean().default(true),
  /** Rendered as a copyable check block. Also a HowTo "prep" signal. */
  verify: z.object({ cmd: z.string(), expect: z.string() }).optional(),
  /** Internal link to the tutorial that satisfies this prerequisite. */
  tutorialId: id.optional(),
});

const step = z.object({
  /** 1-based. Continuity is validated in scripts/check-content.ts. */
  n: z.number().int().positive(),
  /** Renders as H2 "Step {n} — {title}". Keep under 70 chars. */
  title: z.string().min(8).max(70),
  /** Renders as H3 inside this step. Zero is allowed (flat step). */
  subSteps: z
    .array(z.object({ title: z.string().min(5), text: z.string().min(10) }))
    .default([]),
  body: z.array(block).min(1),
  /** REQUIRED. How the reader knows this step worked. Drives trust + dwell time. */
  expected: z.string().min(15).max(220),
  verify: z.object({ cmd: z.string(), expect: z.string() }).optional(),
  /** Errors this step can produce → linked at /{topic}/errors/<id>/. */
  errorIds: z.array(id).default([]),
  minutes: z.number().positive().optional(),
});

/* ------------------------------------------------------------------ *
 * topics
 * ------------------------------------------------------------------ */

const topics = defineCollection({
  loader: glob({ base: './src/content/topics', pattern: '**/*.json' }),
  schema: z.object({
    /** Must equal the file name. Pages assert this. */
    slug: id,
    name: z.string().min(2).max(60),
    /** Short label for nav and chips, if the full name is long. */
    nameShort: z.string().min(1).max(30).optional(),
    tagline: z.string().min(10).max(120),
    /** Homepage SEO for this topic's hub. */
    seo,

    /**
     * 'primary' — full tutorial site under /{slug}/.
     * 'stub'    — no tutorials. Exists only as a comparison rival / migration
     *             target. Renders a minimal page with a verdict + outbound link.
     */
    kind: z.enum(['primary', 'stub']).default('primary'),

    /** 'live' | 'draft' — draft topics render but stay noindex and out of sitemap. */
    status: z.enum(['live', 'draft']).default('live'),

    intro: z.string().min(200),
    category: z.string().min(3),
    currentVersion: z.string().min(1),
    officialUrl: z.string().url(),
    docsUrl: z.string().url(),

    /** Drives K2 expansion: "{name} {feature} tutorial". */
    features: z.array(z.object({ id, label: z.string().min(3) })).default([]),

    /** Drives K4/K7 expansion. References other topic slugs. */
    rivalIds: z.array(id).default([]),

    /** External brand assets. */
    logo: z.string().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),

    faq: z.array(faqItem).default([]),
    updated: z.coerce.date(),
  }),
});

/* ------------------------------------------------------------------ *
 * tutorials — T1 / T2 / T3 / T6 / T7 share this shape
 * ------------------------------------------------------------------ */

const tutorials = defineCollection({
  loader: glob({ base: './src/content/tutorials', pattern: '**/*.json' }),
  schema: z.object({
    slug: id,
    /** Which topic this belongs to. Must exist in topics. */
    topic: id,
    /** Template selector. Determines block order on the detail page. */
    template: z.enum(['howto', 'pillar', 'getting-started', 'checklist', 'migration']),
    seo,
    /** H1 may be longer / chattier than seo.title. */
    h1: z.string().min(15).max(90),

    /** One-sentence answer. First block on the page. Feeds HowTo.description. */
    answer: z.string().min(40).max(320),
    /** Card / list summary. */
    excerpt: z.string().min(60).max(220),

    /** Keyword targeting, for the build-time audit only. Never rendered as meta keywords. */
    primaryKeyword: z.string().min(3),
    secondaryKeywords: z.array(z.string()).default([]),

    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    totalMinutes: z.number().int().positive().optional(),

    /** E-E-A-T signal: what was tested, when, on what. */
    testedWith: z.object({
      version: z.string().min(1),
      date: z.coerce.date(),
      environment: z.string().optional(),
    }),

    prerequisites: z.array(prerequisite).default([]),
    /** Min 2: a "how to" with one step is not a how-to. */
    steps: z.array(step).min(2),
    /** Deeper prose rendered AFTER the steps so it never interrupts the flow. */
    body: z.array(block).default([]),

    /** All errors this page mentions, for the reverse-link index. */
    errorIds: z.array(id).default([]),
    faq: z.array(faqItem).default([]),

    /** Internal link graph — see DESIGN.md §4. */
    pillarId: id.optional(),
    seriesId: id.optional(),
    order: z.number().int().positive().optional(),
    relatedIds: z.array(id).max(6).default([]),

    tags: z.array(id).default([]),
    published: z.coerce.date(),
    updated: z.coerce.date(),
  }),
});

/* ------------------------------------------------------------------ *
 * errors — standalone, one canonical URL each
 * ------------------------------------------------------------------ */

const errors = defineCollection({
  loader: glob({ base: './src/content/errors', pattern: '**/*.json' }),
  schema: z.object({
    slug: id,
    topic: id,
    seo,
    h1: z.string().min(15).max(90),

    /** The literal error text. Users paste this whole line into search. */
    message: z.string().min(10),
    /** errno / HTTP status / tool-specific code. Omit when there is none. */
    code: z.string().optional(),

    answer: z.string().min(40).max(320),
    symptom: z.string().min(60),
    category: z.enum(['build', 'runtime', 'config', 'network', 'types', 'deploy', 'other']),

    affected: z.object({
      versions: z.string().optional(),
      platforms: z.array(z.string()).default([]),
    }),

    /** 1–3 causes. Each carries its own numbered fix steps. */
    causes: z
      .array(
        z.object({
          title: z.string().min(10),
          explain: z.string().min(60),
          steps: z.array(step).min(1),
        })
      )
      .min(1),

    verification: z.object({ cmd: z.string(), expect: z.string() }),
    prevention: z.array(z.string().min(20)).min(1),
    /** Triage chain: "still broken? try these". */
    seeAlsoIds: z.array(id).default([]),

    faq: z.array(faqItem).default([]),
    tags: z.array(id).default([]),
    published: z.coerce.date(),
    updated: z.coerce.date(),
  }),
});

/* ------------------------------------------------------------------ *
 * comparisons — cross-topic, one canonical URL per pair
 * ------------------------------------------------------------------ */

const comparisons = defineCollection({
  loader: glob({ base: './src/content/comparisons', pattern: '**/*.json' }),
  schema: z.object({
    slug: id,
    seo,
    h1: z.string().min(15).max(90),
    /** Must state when to pick each side. Never "it depends" alone. */
    answer: z.string().min(60).max(400),

    /** Alphabetical by slug: a-vs-b. Resolved against topics. */
    aId: id,
    bId: id,

    testedWith: z.object({
      aVersion: z.string().min(1),
      bVersion: z.string().min(1),
      date: z.coerce.date(),
    }),

    rows: z
      .array(
        z.object({
          feature: z.string().min(3),
          a: z.string().min(1),
          b: z.string().min(1),
          edge: z.enum(['a', 'b', 'tie']).default('tie'),
          note: z.string().optional(),
        })
      )
      .min(6),

    /** Where the A side wins. 2+ required so a comparison is never one-sided. */
    winsA: z.array(z.string().min(40)).min(2),
    winsB: z.array(z.string().min(40)).min(2),
    verdicts: z
      .array(
        z.object({
          scenario: z.string().min(10),
          pick: z.enum(['a', 'b', 'either']),
          why: z.string().min(40),
        })
      )
      .min(2),

    /** Link to the migration tutorial, if one exists. */
    migrationId: id.optional(),
    faq: z.array(faqItem).default([]),
    tags: z.array(id).default([]),
    published: z.coerce.date(),
    updated: z.coerce.date(),
  }),
});

/* ------------------------------------------------------------------ *
 * series — ordered paths
 * ------------------------------------------------------------------ */

const series = defineCollection({
  loader: glob({ base: './src/content/series', pattern: '**/*.json' }),
  schema: z.object({
    slug: id,
    topic: id,
    seo,
    h1: z.string().min(10).max(80),
    intro: z.string().min(120),
    /** Ordered. Validated at build: each tutorial exists, belongs to `topic`,
     *  and points back via its own `seriesId`. */
    itemIds: z.array(id).min(2),
    pillarId: id.optional(),
    tags: z.array(id).default([]),
    updated: z.coerce.date(),
  }),
});

/* ------------------------------------------------------------------ *
 * tags / legal
 * ------------------------------------------------------------------ */

const tags = defineCollection({
  loader: glob({ base: './src/content/tags', pattern: '**/*.json' }),
  schema: z.object({
    slug: id,
    label: z.string().min(1).max(30),
    description: z.string().min(40).max(200).optional(),
  }),
});

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

export const collections = { topics, tutorials, errors, comparisons, series, tags, legal };
