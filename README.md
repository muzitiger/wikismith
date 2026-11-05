# Wikismith

A collection of **programmatic-SEO static site templates**. One directory per site type, each self-contained: copy it, change three config fields, replace `src/content/`, and you have a different site.

Built on **Astro 5 + Tailwind 4**, pure static SSG. The build output is plain HTML — no server, no client framework, no hydration.

```
wikismith/
├── game-wiki/          ← game wiki / guide site
└── tutorial-site/      ← how-to / tutorial site (multi-topic, 5 step templates)
```

Each template is a complete Astro project with its own `package.json`. They do not share a workspace on purpose: you fork one, you get one, and upgrading a template never touches another.

---

## Templates

| Directory | Site type | Status |
|---|---|---|
| `game-wiki/` | Game wiki / guide site (`{game} codes`, `{game} walkthrough`, `{game} characters`) | Verified: 24 pages build clean, 15 automated checks pass |
| `tutorial-site/` | How-to / tutorial site (`how to X`, `X tutorial`, `X vs Y`, `X not working`) | Verified: 43 pages build clean, 20 output checks + 4 purity checks pass |

---

## game-wiki

### What it produces

| Route | Template purpose | Indexable in phase 1 |
|---|---|---|
| `/` | Homepage — hero, intro, screenshots, video, featured guides, top characters | ✅ |
| `/play/` | Game detail — intro, gameplay, controls, tags, publisher, rating, media, FAQ, related | locked |
| `/guides/` | Guide index, grouped by kind | locked |
| `/guides/<slug>/` | Guide detail (how-to / walkthrough / tier list share one template) | locked |
| `/characters/` | Roster index, sorted by tier | locked |
| `/characters/<slug>/` | Character detail — stats, abilities, tips, FAQ | locked |
| `/codes/` | Code list — redeem steps first, then active, then expired | locked |
| `/review/` | Review — score, verdict, pros/cons, comparison table | locked |
| `/alternatives/` | Similar-games list | locked |
| `/tags/`, `/tags/<tag>/` | Tag index and tag detail | locked |
| `/about/`, `/privacy-policy/`, `/terms-of-service/` | Legal, content-driven | locked |
| `404.html` | Top-level, noindex | never |
| `/sitemap.xml` + `/sitemap-<group>.xml` | Sitemap index + per-category children | — |
| `/robots.txt` | Generated, references the sitemap | — |

### The phase-1 launch rule

`src/config/site.ts` has one switch:

```ts
export const SITEMAP_OPEN: RouteKey[] = ['home'];
```

A route key **in** the array is built, indexable, listed in the sitemap, and linked in nav.

A route key **not** in the array is still built (so you can preview it locally), but it gets `noindex, nofollow`, is excluded from every sitemap, and is hidden from navigation, footer, and internal links. There is no way to accidentally link to a page you have not published — the components ask `isOpen()` before rendering a link.

To open the site up, add keys:

```ts
export const SITEMAP_OPEN: RouteKey[] = [
  'home', 'play', 'guides', 'characters', 'codes', 'review', 'alternatives', 'tags', 'legal',
];
```

Nothing else changes. `sitemap.xml` regenerates, the child sitemaps appear, `noindex` disappears, and nav links turn on.

### Quick start

```bash
cd /Users/lilaoji/WorkBuddy/模版站开发/wikismith/game-wiki
npm install
npm run dev      # local dev server
npm run build    # build + run all checks
npm run preview  # serve dist/
```

`npm run build` runs `astro build` and then **fails the build** if any invariant regressed. That is deliberate — see [Checks](#checks).

### Forking for a new game

1. Copy `game-wiki/` to a new directory (or fork the repo).
2. `src/config/site.ts` → set `SITE.url`.
3. Replace `src/content/game/<slug>.json` with your game.
4. Replace everything else in `src/content/`.
5. Delete images in `public/images/` and add your own.
6. Set `SITEMAP_OPEN` back to `['home']` for phase 1.

No `.astro` file needs to be edited. If you find yourself editing one to change wording, that is a bug in the template — the copy belongs in `src/content/`.

---

## Architecture

Three layers, and the boundary is the whole point:

```
src/config/     ← your site settings (URL, feature flags, route visibility, UI labels)
src/content/    ← all copy, all game data, all FAQs
src/            ← template code (components, layouts, pages, lib)
```

The rule: **`src/config/` and `src/content/` are yours; `src/` is the template's.** When the template improves, you can pull the change without merge conflicts because you never edited `src/`.

### Content collections

| Collection | Feeds | Key fields |
|---|---|---|
| `game` | Homepage, `/play/`, most pages | `name`, `intro`, `gameplay`, `controls`, `rating`, `faq`, `*Ids` |
| `pages` | List/utility page h1 + SEO | `slug`, `seo`, `h1`, `lede`, `sectionLabels` |
| `guides` | `/guides/`, `/guides/<slug>/` | `kind`, `blocks[]`, `faq`, `tags` |
| `characters` | `/characters/`, `/characters/<slug>/` | `stats`, `abilities`, `tier`, `faq` |
| `codes` | `/codes/` | `redeemSteps`, `entries[]` (active/expired) |
| `reviews` | `/review/` | `score`, `verdict`, `pros`, `cons` |
| `alternatives` | `/alternatives/` | `items[]` (external) |
| `videos` | Homepage, `/play/` | `url`, `thumbnail`, `duration` |
| `tags` | `/tags/` | `label`, `description` |
| `legal` | `/[legal]/` | `blocks[]` |

Cross-collection references are **kebab-case IDs**, resolved at build time. A missing ID fails loudly rather than rendering a dead link:

```ts
// src/lib/content.ts
export async function resolveCharacters(ids: string[]): Promise<Character[]>
```

### Guides use one template for three page types

`kind` selects which block types are meaningful, but the `blocks` union is what lets one template cover a how-to, a walkthrough, and a tier list without branching in the page:

```json
{ "type": "steps", "items": [...] }
{ "type": "tiers", "rows": [{ "tier": "S", "characterIds": ["sable"] }] }
{ "type": "table", "headers": [...], "rows": [...] }
{ "type": "note", "tone": "warn", "text": "..." }
```

Adding a block type = extend the Zod union in `content.config.ts`, add one branch in `BlockRenderer.astro`. Content authors never touch Astro.

---

## SEO implementation

### One h1, one canonical, all from data

Every page passes `title`, `description`, and `canonical` into `BaseLayout` from content. `BaseLayout` renders no heading of its own — the page owns its `h1`. A page that hardcodes a title fails the purity check.

### Structured data

`src/lib/jsonld.ts` builds every node. `src/components/seo/JsonLd.astro` is the **only** place JSON-LD is written to the document, and it escapes `<`, `>`, `&` to `\u003c`, `\u003e`, `\u0026` — closing the `</script>` injection vector.

Emitted per template:

| Type | Where | Note |
|---|---|---|
| `VideoGame` + `SoftwareApplication` | `/`, `/play/` | `AggregateRating` is **nested inside**, never standalone — Google rejects orphan ratings |
| `VideoObject` | `/` | One per video, `duration` in ISO 8601 |
| `BreadcrumbList` | All inner pages | Built from the same crumbs the visible trail uses |
| `ItemList` | Guide index, character index, tier lists, tag pages, alternatives | Names resolved from collections, never raw IDs |
| `FAQPage` | Homepage, `/play/`, guides, characters, codes, review, alternatives | Generated from the same array that renders the visible FAQ |

### Sitemap

Hand-rolled, not `@astrojs/sitemap`, for two reasons: it must split **by category**, and it must be **gated** by `SITEMAP_OPEN`. `@astrojs/sitemap` does neither.

Both endpoints read `buildGroups()` in `src/lib/sitemap.ts`, so the index cannot advertise a child that was never generated. Empty groups are dropped automatically.

```
sitemap.xml              → index
sitemap-pages.xml        → homepage
sitemap-guides.xml       → guide index + every guide
sitemap-characters.xml   → roster + every character
sitemap-codes.xml        → codes page
sitemap-review.xml       → review page
sitemap-alternatives.xml → alternatives page
sitemap-tags.xml         → tag index + every tag
```

Only groups whose route key is open are generated.

### Video embeds load nothing

With `FEATURES.videoEmbeds = false` (the default), a video renders as a poster image that links out. No iframe, no third-party request, no JS. Flip the flag to embed click-to-load `youtube-nocookie` iframes instead.

### Advertising is off, structurally

`src/components/ads/AdSlot.astro` renders a dashed placeholder in dev and **nothing** in production. It contains no `<script>`, no `src=`, no fetch. `check-build.mjs` scans every built HTML/JS file for ad and analytics hosts and fails if one appears.

Turning ads on is a deliberate two-step: flip `FEATURES.ads`, then add your network's snippet to that one file.

---

## Checks

`npm run build` = `astro build` + `node scripts/check-build.mjs` + `node scripts/check-content-purity.mjs`.

**`check-build.mjs`** — 11 assertions on the built output:

1. `dist/404.html` exists at the top level
2. `dist/sitemap.xml` exists
3. At least one child sitemap generated
4. `robots.txt` has an absolute `Sitemap:` line
5. Every URL in every sitemap is inside `SITEMAP_OPEN`
6. Every page has exactly one `<h1>`
7. Every page emits an absolute canonical
8. Every locked-route page carries `noindex`
9. No ad-network or analytics host appears in any built file
10. `404.html` is noindex
11. Every JSON-LD block parses

**`check-content-purity.mjs`** — proves the "no hardcoded game info" requirement still holds:

1. The game name is read from `src/content/game/*.json`
2. No page or component contains a prose literal that is absent from content JSON and the UI-label allowlist
3. No page imports content JSON directly (all reads go through `src/lib/content.ts`)
4. No page passes a static `title=` or `description=` to `BaseLayout`

Current state: **24 pages, 11/11 build checks, purity OK, 0 TypeScript errors.**

---

## Accessibility & performance notes

- Zero JavaScript on every page except `/codes/`, which has ~10 lines for copy-to-clipboard (and degrades to selectable text without it).
- Mobile menu is a CSS-only `<details>` disclosure, no JS.
- Fonts are system fonts. No webfont request.
- Images are plain `<img>` with explicit `width`/`height` (no CLS) and `loading="lazy"` below the fold.
- `prefers-reduced-motion` is respected globally.
- `.grid > *, .flex > * { min-width: 0 }` plus `img { max-width: 100% }` — both are required, or a 1200px cover image causes horizontal overflow at 390px. Verified with DOM measurement: `scrollWidth === clientWidth` on all 11 routes.

---

## tutorial-site

A multi-topic tutorial site. Where `game-wiki` is one game, this is many products:
`/astro/`, `/nextjs/`, `/hugo/` each get their own hub, and the comparison pages sit
at the root because "astro vs nextjs" belongs to neither side.

### What it produces

| Route | Purpose |
|---|---|
| `/` | All-topics hub |
| `/{topic}/` | Topic hub — `primary` ships tutorials, `stub` exists only as a comparison referent |
| `/{topic}/tutorials/` `/{topic}/tutorials/{slug}/` | Tutorial index and detail |
| `/{topic}/errors/` `/{topic}/errors/{slug}/` | One error, one canonical URL |
| `/{topic}/series/{slug}/` | Ordered learning path |
| `/{topic}/tags/` `/{topic}/tags/{tag}/` | Tag index and detail |
| `/vs/` `/vs/{a}-vs-{b}/` | Cross-topic comparisons, at the root |
| `/legal/{slug}/` | About, privacy |

### The five step templates

`template` on a tutorial picks the block order. All five share one route file — the
step rendering is identical, and five near-identical files drift.

| `template` | For | Structured data |
|---|---|---|
| `howto` | "how to X in Y" | HowTo + FAQPage + BreadcrumbList |
| `pillar` | "{topic} {feature} tutorial" | TechArticle + ItemList |
| `getting-started` | "{topic} for beginners" | HowTo + FAQPage |
| `checklist` | "{topic} best practices" | TechArticle + FAQPage |
| `migration` | "migrate from X to Y" | HowTo + FAQPage |

### What makes it different from a blog theme

- **Every step states an expected result.** That block is not a `HowToStep` — folding
  it in shifts every `position` and breaks the rich result.
- **Prerequisites are not steps.** They become `HowTo.tool` / `HowTo.supply`.
- **Steps are `<h2>Step 2 — Title`, sub-actions are `<h3>`.** Heading order and
  `HowToStep.position` are the same list, so they cannot disagree.
- **Errors are a collection, not a section.** One error page per message, referenced
  by `errorIds` from every tutorial it appears in. No duplicated cause-and-fix text.
- **`npm run build` refuses to ship** on a broken canonical, an invalid `HowToStep`, a
  dead internal link, a missing og:image, or a sentence hardcoded in a component.

Full details: [`tutorial-site/README.md`](tutorial-site/README.md), design rationale
in [`tutorial-site/DESIGN.md`](tutorial-site/DESIGN.md).

---

## Known limitations

- **Single-game by design.** `getGame()` throws if `src/content/game/` holds more than one entry. Two games means two sites.
- **No search.** Pagefind would be the fit for a large site; this template deliberately ships none.
- **No i18n.** `SITE.locale` exists for `<html lang>` and `og:locale`, but routes are not localized. Adding locales means a `[locale]/` segment and an `availableLocales` field — a structural change, not a config flip.
- **Each template stands alone.** `game-wiki/` and `tutorial-site/` share no code, no workspace and no schema. Fixes are ported by hand, on purpose.
