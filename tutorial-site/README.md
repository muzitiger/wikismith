# Tutorial Site Template

A programmatic-SEO tutorial site. Astro 5 + Tailwind 4, pure static SSG, multi-topic.

One `src/content/` directory = one site. Switching topics means editing content and
three config fields — never a component.

## Quick start

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # content gate -> astro build -> output verification
npm run check      # astro check (types + .astro diagnostics)
npm run reset      # strip the sample content, keep the structure
```

`npm run build` is three gates in a row and stops at the first failure:

1. `scripts/check-content.ts` — content rules (word floors, references, keywords)
2. `astro build` — renders all pages
3. `scripts/check-build.mjs` + `scripts/check-content-purity.mjs` — output rules
   (canonical, JSON-LD, links, og:image, no hardcoded prose)

## Fork checklist

1. `src/config/site.ts` — `url` (production origin, no trailing slash), `locale`
2. `src/config/ui.ts` — site name, nav labels, button text
3. `src/config/pages.ts` — homepage and `/vs/` title/description/FAQ
   (these are template pages with no content file behind them)
4. `src/content/topics/` — one JSON per technology (`kind: primary` or `stub`)
5. `src/content/` — tutorials, errors, comparisons, series, tags, legal
6. `public/og-default.png` — already 1200x630; edit `scripts/og-card.html` and
   re-shoot it if the name or tagline changes

Run `npm run reset` after step 1–3 to delete the Astro sample content but keep
every route, component and check in place.

## URL model

```
/                                   all-topics hub
/{topic}/                           topic hub
/{topic}/tutorials/                 tutorial index
/{topic}/tutorials/{slug}/          tutorial detail (5 templates, 1 route)
/{topic}/errors/                    error index, grouped by category
/{topic}/errors/{slug}/             one error, one canonical URL
/{topic}/series/{slug}/             ordered learning path
/{topic}/tags/  /{topic}/tags/{tag}/
/vs/  /vs/{a}-vs-{b}/               comparisons — at ROOT, cross-topic
/legal/{slug}/                      about, privacy
```

Comparisons live at the root on purpose: "astro vs nextjs" belongs to neither side.
Nesting it under `/astro/` would make one article reachable from two paths.

## The five templates

`template` on a tutorial selects the block order. There is one page file for all
five, because the step rendering is identical and five near-identical files drift.

| template | For | JSON-LD |
|---|---|---|
| `howto` | "how to X in Y" | HowTo + FAQPage + BreadcrumbList |
| `pillar` | "{topic} {feature} tutorial" | TechArticle + ItemList |
| `getting-started` | "{topic} for beginners" | HowTo + FAQPage |
| `checklist` | "{topic} best practices" | TechArticle + FAQPage |
| `migration` | "migrate from X to Y" | HowTo + FAQPage |

Errors and comparisons are separate collections with their own templates.

## Non-negotiables

These are enforced, not advisory:

- **No tutorial prose in components.** All copy comes from `src/content/`.
- **`<title>` / description / canonical are read from `seo`**, never assembled in a page.
- **JSON-LD is generated from the same object the page renders.** No hand-written schema.
- **Steps are H2 (`Step 2 — Title`), sub-actions are H3.** The heading index and
  `HowToStep.position` must match, which is why steps cannot be H3 under one "Steps" H2.
- **`expected` is not a step.** It is a fixed block inside each step. Folding it into
  `HowTo.step` shifts every position and breaks the rich result.
- **Prerequisites are not steps.** They become `HowTo.tool` / `HowTo.supply`.

## Content gate

`scripts/check-content.ts` runs before every build and exits non-zero on failure.

It enforces what a Zod schema cannot:

- word floor (1000 for tutorials, 600 for errors; code blocks excluded)
- `steps[].n` continuity and unique step names
- cross-collection reference integrity (every id resolves, in the right topic)
- series bidirectionality (`itemIds` ↔ `seriesId`)
- comparison slug must be alphabetical, else `/vs/` gets duplicate URLs
- reserved topic slugs (`tags`, `vs`, `legal`, `sitemap`, …)
- keyword coverage by token overlap, and per-token density ceiling

Keyword coverage is measured on **tokens, not exact phrase**. Demanding the literal
query is what produces stuffed copy: a migration guide legitimately writes "Next.js"
where the searcher types "nextjs". Forcing one spelling everywhere is the disease,
not the cure.

## Internal linking

Three layers, max three clicks from the hub:

```
/  →  pillar + indexes  →  cluster
```

Links are derived from fields, never hardcoded:

| Edge | Source |
|---|---|
| cluster → pillar | `tutorial.pillarId` |
| pillar → cluster | reverse lookup, automatic |
| tutorial → error | `steps[].errorIds` ∪ `errorIds` |
| error → tutorials | reverse lookup, automatic |
| series prev/next | `series.itemIds` + `tutorial.order` |

`relatedIds` are resolved in `lib/content.ts` with a fixed precedence: manual →
pillar siblings → series → tag overlap. Deterministic across builds.

## Adding content

After adding files:

```bash
npx astro sync        # regenerate types, validates schemas
npm run check:content # gate only, fast
npm run build
```

## Where copy lives

| Copy | File | Enforced by |
|---|---|---|
| Tutorials, errors, comparisons, series, tags | `src/content/*.json` | Zod + content gate |
| Nav, buttons, section headings, empty states | `src/config/ui.ts` | purity check |
| Homepage + `/vs/` SEO and FAQ | `src/config/pages.ts` | purity check |
| Social card artwork | `scripts/og-card.html` | og:image check |

A `.astro` file with a sentence in it fails the build. That is the point: the
rule is cheap to keep on day one and expensive to restore in month three.

## What the build verifies

20 output checks, including: every page has one `<h1>`, an absolute canonical
and a unique title; all JSON-LD parses; every `HowToStep` has 1..n positions,
unique names and plain text; every internal link resolves; every og:image
resolves to a raster file; no ad or analytics host appears anywhere.

## Known gaps

- Only one primary topic ships. The multi-topic routes are wired and a stub topic
  (7 of them) exercises the comparison path, but the pagination and search a
  100-topic site would need are not built.
- No search. At this size it would be furniture; add Pagefind when the tutorial
  count passes ~40.
