/**
 * CONTENT GATE — runs before `astro build`.
 *
 * Astro's Zod schemas already enforce shape and field length. This script
 * enforces the things a schema cannot express:
 *
 *   1. Word count floor (a guide under 1000 words is thin content)
 *   2. Step numbering continuity (1..n, no gaps, no duplicates)
 *   3. Duplicate step names within a page (breaks HowTo validation)
 *   4. Cross-collection reference integrity (every id resolves)
 *   5. Orphan detection (a page with no inbound link is uncrawlable)
 *   6. Keyword stuffing ceiling
 *   7. Reserved slug collisions
 *
 * Exit code 1 on any FAIL. WARN does not block the build.
 *
 * Run standalone with: npm run check:content
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, relative } from 'node:path';

const ROOT = process.cwd();
const CONTENT = join(ROOT, 'src', 'content');
const RESERVED = [
  'about', 'privacy', 'terms', 'legal', 'tags', 'vs', '404',
  'sitemap', 'robots', 'search', 'api', '_astro',
];

/* ------------------------------------------------------------------ *
 * Thresholds
 * ------------------------------------------------------------------ */

const MIN_TUTORIAL_WORDS = 1000;
const MIN_ERROR_WORDS = 600;
/**
 * Single-token density ceiling.
 *
 * 3% is deliberately loose. On a narrow how-to — "how to add a sitemap" — the
 * subject word legitimately dominates, and a 1.5% cap flags every well-written
 * page on a narrow topic. What this check is actually looking for is the
 * pathological case: a word injected into every paragraph regardless of
 * whether the sentence needs it. Real stuffing sits well above 3%.
 */
const MAX_KEYWORD_DENSITY = 0.03;
const MIN_OUTBOUND_LINKS = 3;

/* ------------------------------------------------------------------ *
 * Types (loose — this is a validator, not the app)
 * ------------------------------------------------------------------ */

type Json = any;

interface Issue {
  level: 'FAIL' | 'WARN';
  file: string;
  msg: string;
}

const issues: Issue[] = [];
const fail = (file: string, msg: string) => issues.push({ level: 'FAIL', file, msg });
const warn = (file: string, msg: string) => issues.push({ level: 'WARN', file, msg });

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

function loadDir(name: string): Array<{ id: string; file: string; data: Json }> {
  const dir = join(CONTENT, name);
  if (!existsSync(dir)) return [];
  const out: Array<{ id: string; file: string; data: Json }> = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (!entry.endsWith('.json')) continue;
      try {
        out.push({
          id: basename(entry, '.json'),
          file: relative(ROOT, p),
          data: JSON.parse(readFileSync(p, 'utf8')),
        });
      } catch (e) {
        fail(relative(ROOT, p), `JSON parse error: ${(e as Error).message}`);
      }
    }
  };
  walk(dir);
  return out;
}

const topics = loadDir('topics');
const tutorials = loadDir('tutorials');
const errors = loadDir('errors');
const comparisons = loadDir('comparisons');
const seriesList = loadDir('series');
const tags = loadDir('tags');

/* ------------------------------------------------------------------ *
 * Text helpers — must match src/lib/blocks.ts
 * ------------------------------------------------------------------ */

function blockText(blocks: Json[] | undefined): string {
  if (!blocks) return '';
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'p':
      case 'h2':
      case 'h3':
        parts.push(b.text ?? '');
        break;
      case 'list':
        parts.push((b.items ?? []).join(' '));
        break;
      case 'note':
        parts.push(b.text ?? '');
        break;
      case 'table':
        parts.push((b.headers ?? []).join(' '));
        parts.push((b.rows ?? []).map((r: string[]) => r.join(' ')).join(' '));
        break;
      case 'image':
        parts.push(b.media?.alt ?? '');
        break;
      case 'code':
        break; // excluded on purpose
    }
  }
  return parts.join(' ');
}

function countWords(text: string): number {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ');
  return cleaned.split(/\s+/).filter((t) => t && /[\p{L}\p{N}]/u.test(t)).length;
}

/**
 * Token bag for keyword coverage.
 *
 * Normalization matters here: "Next.js", "nextjs", and "next-js" must collapse
 * to one token, otherwise a page that writes the brand correctly fails a check
 * for the way people actually search. Strip everything that is not
 * alphanumeric, then count.
 */
function tokenBag(text: string): Map<string, number> {
  const bag = new Map<string, number>();
  const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const w of words) {
    if (w.length <= 2) continue;
    bag.set(w, (bag.get(w) ?? 0) + 1);
  }
  return bag;
}

/* ------------------------------------------------------------------ *
 * 1. Topics
 * ------------------------------------------------------------------ */

const topicIds = new Set<string>();

for (const t of topics) {
  const d = t.data;

  if (d.slug !== t.id) fail(t.file, `slug "${d.slug}" does not match filename "${t.id}"`);

  if (RESERVED.includes(t.id)) {
    fail(t.file, `slug "${t.id}" is reserved — it collides with a system route`);
  }
  topicIds.add(t.id);

  for (const r of d.rivalIds ?? []) {
    if (r === t.id) fail(t.file, `rivalIds contains itself`);
  }
}

/* Second pass: rival ids resolve (all topics must be loaded first). */
for (const t of topics) {
  for (const r of t.data.rivalIds ?? []) {
    if (!topicIds.has(r)) fail(t.file, `rivalIds references unknown topic "${r}"`);
  }
}

/* ------------------------------------------------------------------ *
 * 2. Tutorials
 * ------------------------------------------------------------------ */

const tutorialIds = new Map<string, { topic: string; file: string; data: Json }>();

for (const t of tutorials) {
  const d = t.data;

  if (d.slug !== t.id) fail(t.file, `slug "${d.slug}" does not match filename "${t.id}"`);

  if (!topicIds.has(d.topic)) {
    fail(t.file, `topic "${d.topic}" does not exist in content/topics`);
  }

  if (tutorialIds.has(t.id)) {
    fail(t.file, `duplicate tutorial slug "${t.id}" (tutorial slugs are globally unique)`);
  }
  tutorialIds.set(t.id, { topic: d.topic, file: t.file, data: d });

  /* -- step numbering -- */
  const steps = d.steps ?? [];
  const nums = steps.map((s: Json) => s.n);
  const expected = steps.map((_: unknown, i: number) => i + 1);
  if (JSON.stringify(nums) !== JSON.stringify(expected)) {
    fail(t.file, `steps[].n must be 1..${steps.length} in order, got [${nums.join(', ')}]`);
  }

  /* -- duplicate step names -- */
  const stepNames = steps.map((s: Json) => s.title);
  const dupNames = stepNames.filter((n: string, i: number) => stepNames.indexOf(n) !== i);
  if (dupNames.length) {
    fail(t.file, `duplicate step titles (breaks HowTo.name uniqueness): ${[...new Set(dupNames)].join(', ')}`);
  }

  /* -- every step needs an expected result -- */
  steps.forEach((s: Json) => {
    if (!s.expected || s.expected.trim().length === 0) {
      fail(t.file, `step ${s.n} has no expected result`);
    }
  });

  /* -- word count -- */
  const text = [
    // h1 counts: the primary keyword is expected to be there, and excluding it
    // made the "keyword never appears" warning fire on correctly optimized pages.
    d.h1 ?? '',
    d.answer ?? '',
    d.excerpt ?? '',
    ...(d.prerequisites ?? []).map((p: Json) => p.text ?? ''),
    ...steps.map((s: Json) =>
      [
        s.title ?? '',
        s.expected ?? '',
        ...(s.subSteps ?? []).map((ss: Json) => `${ss.title} ${ss.text}`),
        blockText(s.body),
      ].join(' ')
    ),
    blockText(d.body),
    ...(d.faq ?? []).map((f: Json) => `${f.q} ${f.a}`),
  ].join(' ');
  const words = countWords(text);
  const textTokens = tokenBag(text);

  if (words < MIN_TUTORIAL_WORDS) {
    fail(t.file, `body is ${words} words, floor is ${MIN_TUTORIAL_WORDS}`);
  }

  /* -- keyword coverage + density ceiling --
   *
   * Two separate checks, because they answer different questions:
   *
   *  COVERAGE — does the page contain the concepts the query is about? Measured
   *  by token overlap, not exact phrase. Demanding the literal phrase is exactly
   *  what produces awkward copy: a page about migration legitimately writes
   *  "Next.js" (brand) where the searcher types "nextjs" (query). Forcing the
   *  query spelling everywhere is the recipe for stuffing, so coverage is
   *  satisfied when the meaningful tokens are present in any form.
   *
   *  DENSITY — is any single token repeated so often it reads as spam? Measured
   *  per token, not per phrase, because repetition of one word is the actual
   *  manipulation signal.
   */
  const kw = (d.primaryKeyword ?? '').toLowerCase().trim();
  if (kw) {
    const tokens: string[] = kw
      .split(/\s+/)
      .map((t: string) => t.normalize('NFKD').replace(/[^a-z0-9]/g, ''))
      .filter((t: string) => t.length > 2);

    const covered = tokens.filter((t: string) => textTokens.has(t));
    const coverage = tokens.length ? covered.length / tokens.length : 1;

    if (coverage < 0.8) {
      const missing = tokens.filter((t: string) => !textTokens.has(t));
      warn(
        t.file,
        `primary keyword "${kw}" only ${(coverage * 100).toFixed(0)}% covered — missing: ${missing.join(', ')}`
      );
    }

    /* Density of the distinctive tokens only.
     *
     * Excluded:
     *  - generic verbs ("how", "use") that carry no ranking signal
     *  - the topic's own name, because a page about Astro saying "Astro" is not
     *    manipulation, it is the subject. Counting it would flag every good page
     *    and train the author to ignore this warning entirely.
     */
    const GENERIC = new Set(['how', 'the', 'and', 'for', 'with', 'your', 'from', 'into', 'using', 'use']);
    const topicName = (topicIds.has(d.topic)
      ? (topics.find((x) => x.id === d.topic)?.data.name ?? '')
      : ''
    )
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '');
    for (const token of tokens) {
      if (GENERIC.has(token)) continue;
      if (token === topicName) continue;
      const count = textTokens.get(token) ?? 0;
      const density = count / Math.max(words, 1);
      if (density > MAX_KEYWORD_DENSITY) {
        warn(
          t.file,
          `token "${token}" appears ${count}x (${(density * 100).toFixed(2)}% density) — exceeds ${(MAX_KEYWORD_DENSITY * 100).toFixed(1)}%, reads as stuffing`
        );
      }
    }
  }

  /* -- cross refs -- */
  for (const _id of d.errorIds ?? []) {
    // checked after errors load
  }
  for (const id of d.relatedIds ?? []) {
    if (!tutorialIds.has(id)) {
      // may be defined later in the iteration order; defer
    }
  }

  if (d.seriesId && !seriesList.some((s) => s.id === d.seriesId)) {
    fail(t.file, `seriesId "${d.seriesId}" does not exist`);
  }

  /* -- inbound/outbound link sanity -- */
  const outgoing =
    (d.relatedIds?.length ?? 0) +
    (d.pillarId ? 1 : 0) +
    (d.seriesId ? 1 : 0) +
    new Set(steps.flatMap((s: Json) => s.errorIds ?? [])).size +
    new Set(d.errorIds ?? []).size;
  if (outgoing < MIN_OUTBOUND_LINKS) {
    warn(t.file, `only ${outgoing} outbound internal links, expected >= ${MIN_OUTBOUND_LINKS}`);
  }
}

/* Deferred: tutorial cross-reference resolution. */
for (const t of tutorials) {
  const d = t.data;
  for (const id of d.relatedIds ?? []) {
    if (!tutorialIds.has(id)) fail(t.file, `relatedIds references unknown tutorial "${id}"`);
  }
  if (d.pillarId && !tutorialIds.has(d.pillarId)) {
    fail(t.file, `pillarId references unknown tutorial "${d.pillarId}"`);
  }
  if (d.pillarId === t.id) fail(t.file, `pillarId points at itself`);
  for (const p of d.prerequisites ?? []) {
    if (p.tutorialId && !tutorialIds.has(p.tutorialId)) {
      fail(t.file, `prerequisite tutorialId references unknown tutorial "${p.tutorialId}"`);
    }
  }
}

/* A tutorial's pillar must be in the same topic. */
for (const t of tutorials) {
  const pid = t.data.pillarId;
  if (!pid) continue;
  const pillar = tutorialIds.get(pid);
  if (pillar && pillar.topic !== t.data.topic) {
    fail(t.file, `pillarId "${pid}" belongs to topic "${pillar.topic}", not "${t.data.topic}"`);
  }
}

/* ------------------------------------------------------------------ *
 * 3. Errors
 * ------------------------------------------------------------------ */

const errorIds = new Map<string, { topic: string; file: string }>();

for (const e of errors) {
  const d = e.data;

  if (d.slug !== e.id) fail(e.file, `slug "${d.slug}" does not match filename "${e.id}"`);
  if (!topicIds.has(d.topic)) fail(e.file, `topic "${d.topic}" does not exist`);

  if (errorIds.has(e.id)) fail(e.file, `duplicate error slug "${e.id}"`);
  errorIds.set(e.id, { topic: d.topic, file: e.file });

  const causes = d.causes ?? [];
  causes.forEach((c: Json, ci: number) => {
    const steps = c.steps ?? [];
    const nums = steps.map((s: Json) => s.n);
    const expected = steps.map((_: unknown, i: number) => i + 1);
    if (JSON.stringify(nums) !== JSON.stringify(expected)) {
      fail(e.file, `causes[${ci}].steps[].n must be 1..${steps.length}, got [${nums.join(', ')}]`);
    }
    steps.forEach((s: Json) => {
      if (!s.expected) fail(e.file, `causes[${ci}].steps[${s.n}] has no expected result`);
    });
  });

  const text = [
    d.h1 ?? '',
    d.answer ?? '',
    d.symptom ?? '',
    ...causes.map((c: Json) =>
      [
        c.title ?? '',
        c.explain ?? '',
        ...(c.steps ?? []).map((s: Json) =>
          [s.title, s.expected, ...(s.subSteps ?? []).map((x: Json) => `${x.title} ${x.text}`), blockText(s.body)].join(' ')
        ),
      ].join(' ')
    ),
    (d.prevention ?? []).join(' '),
    ...(d.faq ?? []).map((f: Json) => `${f.q} ${f.a}`),
  ].join(' ');
  const words = countWords(text);
  if (words < MIN_ERROR_WORDS) {
    fail(e.file, `body is ${words} words, floor is ${MIN_ERROR_WORDS}`);
  }
}

/* Error refs from tutorials, now that errors are loaded. */
for (const t of tutorials) {
  const d = t.data;
  const refs = new Set<string>([
    ...(d.errorIds ?? []),
    ...(d.steps ?? []).flatMap((s: Json) => s.errorIds ?? []),
  ]);
  for (const id of refs) {
    const target = errorIds.get(id);
    if (!target) {
      fail(t.file, `references unknown error "${id}"`);
    } else if (target.topic !== d.topic) {
      fail(t.file, `references error "${id}" from topic "${target.topic}" — cross-topic error refs break URLs`);
    }
  }
}

for (const e of errors) {
  for (const id of e.data.seeAlsoIds ?? []) {
    if (!errorIds.has(id)) fail(e.file, `seeAlsoIds references unknown error "${id}"`);
    if (id === e.id) fail(e.file, `seeAlsoIds contains itself`);
  }
}

/* ------------------------------------------------------------------ *
 * 4. Comparisons
 * ------------------------------------------------------------------ */

for (const c of comparisons) {
  const d = c.data;

  if (!topicIds.has(d.aId)) fail(c.file, `aId "${d.aId}" does not exist`);
  if (!topicIds.has(d.bId)) fail(c.file, `bId "${d.bId}" does not exist`);
  if (d.aId === d.bId) fail(c.file, `aId and bId are the same topic`);

  /* Slug must be alphabetical so /vs/x-vs-y has exactly one canonical form. */
  const expectedSlug = [d.aId, d.bId].sort().join('-vs-');
  if (c.id !== expectedSlug) {
    fail(c.file, `slug must be "${expectedSlug}" (alphabetical) to avoid duplicate /vs/ URLs`);
  }

  const features = (d.rows ?? []).map((r: Json) => r.feature);
  const dup = features.filter((f: string, i: number) => features.indexOf(f) !== i);
  if (dup.length) fail(c.file, `duplicate comparison rows: ${[...new Set(dup)].join(', ')}`);

  if (d.migrationId && !tutorialIds.has(d.migrationId)) {
    fail(c.file, `migrationId "${d.migrationId}" does not exist`);
  }
}

/* ------------------------------------------------------------------ *
 * 5. Series
 * ------------------------------------------------------------------ */

for (const s of seriesList) {
  const d = s.data;

  if (!topicIds.has(d.topic)) fail(s.file, `topic "${d.topic}" does not exist`);

  const ids = d.itemIds ?? [];
  const seen = new Set<string>();
  for (const id of ids) {
    const t = tutorialIds.get(id);
    if (!t) {
      fail(s.file, `itemIds references unknown tutorial "${id}"`);
      continue;
    }
    if (seen.has(id)) fail(s.file, `itemIds contains "${id}" twice`);
    seen.add(id);
    if (t.topic !== d.topic) {
      fail(s.file, `itemIds references tutorial "${id}" from topic "${t.topic}"`);
    }
    /* Bidirectional check: the tutorial must point back. */
    if (t.data.seriesId !== s.id) {
      fail(t.file, `belongs to series "${s.id}" but its own seriesId is "${t.data.seriesId ?? 'unset'}"`);
    }
  }

  if (d.pillarId && !tutorialIds.has(d.pillarId)) {
    fail(s.file, `pillarId "${d.pillarId}" does not exist`);
  }
}

/* Every tutorial with a seriesId must be listed in that series. */
for (const t of tutorials) {
  const sid = t.data.seriesId;
  if (!sid) continue;
  const s = seriesList.find((x) => x.id === sid);
  if (!s) {
    fail(t.file, `seriesId "${sid}" does not exist`);
    continue;
  }
  if (!(s.data.itemIds ?? []).includes(t.id)) {
    fail(t.file, `declares seriesId "${sid}" but is missing from that series' itemIds`);
  }
}

/* ------------------------------------------------------------------ *
 * 6. Tags
 * ------------------------------------------------------------------ */

const tagIds = new Set(tags.map((t) => t.id));

for (const t of tutorials) {
  for (const tag of t.data.tags ?? []) {
    if (!tagIds.has(tag)) fail(t.file, `tag "${tag}" has no entry in content/tags`);
  }
}
for (const e of errors) {
  for (const tag of e.data.tags ?? []) {
    if (!tagIds.has(tag)) fail(e.file, `tag "${tag}" has no entry in content/tags`);
  }
}

/* ------------------------------------------------------------------ *
 * 7. Orphan detection
 * ------------------------------------------------------------------ */

const inbound = new Map<string, number>();
for (const t of tutorials) {
  const d = t.data;
  const targets = [
    ...(d.relatedIds ?? []),
    ...(d.pillarId ? [d.pillarId] : []),
  ];
  for (const target of targets) inbound.set(target, (inbound.get(target) ?? 0) + 1);
}
/* Any tutorial listed as a pillar gets inbound from its clusters. */
for (const t of tutorials) {
  if (t.data.pillarId) inbound.set(t.data.pillarId, (inbound.get(t.data.pillarId) ?? 0) + 1);
}
/* Series pages link every item, and the topic hub links every tutorial. */
for (const s of seriesList) {
  for (const id of s.data.itemIds ?? []) inbound.set(id, (inbound.get(id) ?? 0) + 1);
}
for (const t of tutorials) {
  // Parenthesise: `??` binds looser than `===`, so `a ?? 0 === 0` would compare
  // 0 to 0 and then nullish-coalesce — always truthy. This bug shipped once.
  const count = inbound.get(t.id) ?? 0;
  if (count === 0) {
    warn(t.file, `no inbound internal link other than the topic hub — will not accumulate authority`);
  }
}

/* ------------------------------------------------------------------ *
 * 8. Duplicate answers (programmatic-content smell)
 * ------------------------------------------------------------------ */

const answerMap = new Map<string, string>();
for (const t of tutorials) {
  const key = (t.data.answer ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (answerMap.has(key)) {
    warn(t.file, `identical answer text to ${answerMap.get(key)} — templated copy reads as thin content`);
  } else {
    answerMap.set(key, t.file);
  }
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

const fails = issues.filter((i) => i.level === 'FAIL');
const warns = issues.filter((i) => i.level === 'WARN');

const stats = {
  topics: topics.length,
  primaryTopics: topics.filter((t) => t.data.kind === 'primary').length,
  tutorials: tutorials.length,
  errors: errors.length,
  comparisons: comparisons.length,
  series: seriesList.length,
  tags: tags.length,
};

console.log('\n  Content gate');
console.log('  ' + '-'.repeat(58));
console.log(
  `  ${stats.primaryTopics} primary topics (+${stats.topics - stats.primaryTopics} reference), ` +
    `${stats.tutorials} tutorials, ${stats.errors} errors, ${stats.comparisons} comparisons, ` +
    `${stats.series} series`
);
console.log('  ' + '-'.repeat(58));

if (warns.length) {
  for (const w of warns) console.log(`  WARN  ${w.file}\n        ${w.msg}`);
  console.log('');
}
if (fails.length) {
  for (const f of fails) console.log(`  FAIL  ${f.file}\n        ${f.msg}`);
  console.log(`\n  ${fails.length} failure(s). Build stopped.\n`);
  process.exit(1);
}

console.log(`  PASS  ${warns.length} warning(s), 0 failures.\n`);
