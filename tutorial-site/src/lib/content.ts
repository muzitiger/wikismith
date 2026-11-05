/**
 * CONTENT ACCESS LAYER — the only place pages read content.
 *
 * Pages never touch Astro's collection API directly. When a collection is
 * restructured, only this file changes.
 *
 * Every cross-collection join is done here so the link graph stays in one place.
 */

import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export type Topic = CollectionEntry<'topics'>;
export type Tutorial = CollectionEntry<'tutorials'>;
export type ErrorDoc = CollectionEntry<'errors'>;
export type Comparison = CollectionEntry<'comparisons'>;
export type Series = CollectionEntry<'series'>;
export type Tag = CollectionEntry<'tags'>;
export type Legal = CollectionEntry<'legal'>;

/* ------------------------------------------------------------------ *
 * Topics
 * ------------------------------------------------------------------ */

/** All topics, primaries first, then alphabetical. */
export async function getTopics(): Promise<Topic[]> {
  const all = await getCollection('topics');
  return all.sort((a, b) => {
    if (a.data.kind !== b.data.kind) return a.data.kind === 'primary' ? -1 : 1;
    return a.data.name.localeCompare(b.data.name);
  });
}

/** Only topics that ship tutorials. */
export async function getPrimaryTopics(): Promise<Topic[]> {
  const all = await getTopics();
  return all.filter((t) => t.data.kind === 'primary');
}

export async function getTopic(slug: string): Promise<Topic | undefined> {
  return getEntry('topics', slug);
}

/** Throws when a slug resolves to nothing — surfaces typos at build time. */
export async function requireTopic(slug: string): Promise<Topic> {
  const t = await getTopic(slug);
  if (!t) throw new Error(`Unknown topic "${slug}". Add src/content/topics/${slug}.json`);
  return t;
}

/* ------------------------------------------------------------------ *
 * Tutorials
 * ------------------------------------------------------------------ */

export async function getTutorials(): Promise<Tutorial[]> {
  const all = await getCollection('tutorials');
  return all.sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf());
}

export async function getTutorialsByTopic(topic: string): Promise<Tutorial[]> {
  const all = await getTutorials();
  return all.filter((t) => t.data.topic === topic);
}

export async function getTutorialByTopicAndSlug(
  topic: string,
  slug: string
): Promise<Tutorial | undefined> {
  const t = await getEntry('tutorials', slug);
  if (!t || t.data.topic !== topic) return undefined;
  return t;
}

export async function getTutorialsByTemplate(
  topic: string,
  template: Tutorial['data']['template']
): Promise<Tutorial[]> {
  const all = await getTutorialsByTopic(topic);
  return all.filter((t) => t.data.template === template);
}

/** Tutorials whose pillarId points at `pillarSlug` — the hub-spoke back-links. */
export async function getCluster(topic: string, pillarSlug: string): Promise<Tutorial[]> {
  const all = await getTutorialsByTopic(topic);
  return all
    .filter((t) => t.data.pillarId === pillarSlug)
    .sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999));
}

export async function getPillars(topic: string): Promise<Tutorial[]> {
  return getTutorialsByTemplate(topic, 'pillar');
}

/**
 * Everything a topic exposes, minus pillars (which have their own list).
 * Used by the tutorial index and the orphan check.
 */
export async function getNonPillarTutorials(topic: string): Promise<Tutorial[]> {
  const all = await getTutorialsByTopic(topic);
  return all.filter((t) => t.data.template !== 'pillar');
}

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

export async function getErrors(): Promise<ErrorDoc[]> {
  const all = await getCollection('errors');
  return all.sort((a, b) => a.data.category.localeCompare(b.data.category));
}

export async function getErrorsByTopic(topic: string): Promise<ErrorDoc[]> {
  const all = await getErrors();
  return all.filter((e) => e.data.topic === topic);
}

export async function getErrorByTopicAndSlug(
  topic: string,
  slug: string
): Promise<ErrorDoc | undefined> {
  const e = await getEntry('errors', slug);
  if (!e || e.data.topic !== topic) return undefined;
  return e;
}

/**
 * Reverse index: which tutorials reference this error?
 * Scans both `errorIds` and per-step `errorIds`. Computed at build, never stored.
 */
export async function getTutorialsReferencingError(
  topic: string,
  errorSlug: string
): Promise<Tutorial[]> {
  const all = await getTutorialsByTopic(topic);
  return all.filter((t) => {
    if (t.data.errorIds.includes(errorSlug)) return true;
    return t.data.steps.some((s) => s.errorIds.includes(errorSlug));
  });
}

/** How often an error is referenced — drives the /errors/ index sort order. */
export async function errorReferenceCount(topic: string, errorSlug: string): Promise<number> {
  const refs = await getTutorialsReferencingError(topic, errorSlug);
  return refs.length;
}

/**
 * Resolve a list of error slugs into docs, silently dropping missing ones.
 * Called from step rendering and `errorRef` body blocks.
 */
export async function resolveErrors(
  topic: string,
  slugs: string[]
): Promise<ErrorDoc[]> {
  if (slugs.length === 0) return [];
  const all = await getErrorsByTopic(topic);
  const bySlug = new Map(all.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const out: ErrorDoc[] = [];
  for (const slug of slugs) {
    if (seen.has(slug)) continue;
    const e = bySlug.get(slug);
    if (e) {
      out.push(e);
      seen.add(slug);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Comparisons
 * ------------------------------------------------------------------ */

export async function getComparisons(): Promise<Comparison[]> {
  const all = await getCollection('comparisons');
  return all.sort((a, b) => b.data.updated.valueOf() - a.data.updated.valueOf());
}

export async function getComparison(slug: string): Promise<Comparison | undefined> {
  return getEntry('comparisons', slug);
}

/** Comparisons that involve a given topic, on either side. */
export async function getComparisonsForTopic(topic: string): Promise<Comparison[]> {
  const all = await getComparisons();
  return all.filter((c) => c.data.aId === topic || c.data.bId === topic);
}

/* ------------------------------------------------------------------ *
 * Series
 * ------------------------------------------------------------------ */

export async function getSeriesList(): Promise<Series[]> {
  return getCollection('series');
}

export async function getSeriesForTopic(topic: string): Promise<Series[]> {
  const all = await getSeriesList();
  return all.filter((s) => s.data.topic === topic);
}

export async function getSeries(topic: string, slug: string): Promise<Series | undefined> {
  const s = await getEntry('series', slug);
  if (!s || s.data.topic !== topic) return undefined;
  return s;
}

/** Resolve a series' ordered items, dropping broken refs (validated separately). */
export async function resolveSeriesItems(s: Series): Promise<Tutorial[]> {
  const out: Tutorial[] = [];
  for (const id of s.data.itemIds) {
    const t = await getEntry('tutorials', id);
    if (t) out.push(t);
  }
  return out;
}

/** Prev/next within a series. */
export async function seriesNeighbors(
  s: Series,
  slug: string
): Promise<{ prev: Tutorial | null; next: Tutorial | null; index: number; total: number }> {
  const items = await resolveSeriesItems(s);
  const idx = items.findIndex((t) => t.id === slug);
  return {
    prev: idx > 0 ? items[idx - 1]! : null,
    next: idx >= 0 && idx < items.length - 1 ? items[idx + 1]! : null,
    index: idx + 1,
    total: items.length,
  };
}

/* ------------------------------------------------------------------ *
 * Tags / legal
 * ------------------------------------------------------------------ */

export async function getTags(): Promise<Tag[]> {
  const all = await getCollection('tags');
  return all.sort((a, b) => a.data.label.localeCompare(b.data.label));
}

export async function getTag(slug: string): Promise<Tag | undefined> {
  return getEntry('tags', slug);
}

/** Tag slugs actually used inside a topic, with counts. */
export async function getTopicTagCounts(
  topic: string
): Promise<Array<{ slug: string; count: number }>> {
  const tutorials = await getTutorialsByTopic(topic);
  const errors = await getErrorsByTopic(topic);
  const counts = new Map<string, number>();
  for (const t of tutorials) {
    for (const tag of t.data.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  for (const e of errors) {
    for (const tag of e.data.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
}

export async function getLegal(slug: string): Promise<Legal | undefined> {
  return getEntry('legal', slug);
}

/** Every legal page, sorted by id so getStaticPaths output is deterministic. */
export async function getAllLegal(): Promise<Legal[]> {
  const all = await getCollection('legal');
  return [...all].sort((a, b) => a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------------ *
 * Related-content resolver
 * ------------------------------------------------------------------ */

/**
 * Final related list. Order of precedence:
 *   1. manual `relatedIds` (author intent wins)
 *   2. same-pillar siblings ordered by `order`
 *   3. same-series items
 *   4. tag-overlap fallback
 * Deduped, self excluded, truncated to `limit`.
 *
 * Deterministic by design — no embeddings, nothing that changes between builds.
 */
export async function resolveRelated(
  tutorial: Tutorial,
  limit = 6
): Promise<Tutorial[]> {
  const topic = tutorial.data.topic;
  const all = await getTutorialsByTopic(topic);
  const byId = new Map(all.map((t) => [t.id, t]));
  const picked: Tutorial[] = [];
  const seen = new Set<string>([tutorial.id]);

  const push = (t: Tutorial | undefined) => {
    if (!t || seen.has(t.id)) return;
    seen.add(t.id);
    picked.push(t);
  };

  for (const id of tutorial.data.relatedIds) push(byId.get(id));

  if (tutorial.data.pillarId) {
    const siblings = all
      .filter((t) => t.data.pillarId === tutorial.data.pillarId)
      .sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999));
    for (const s of siblings) {
      if (picked.length >= limit) break;
      push(s);
    }
  }

  if (tutorial.data.seriesId) {
    const s = await getSeries(topic, tutorial.data.seriesId);
    if (s) {
      for (const t of await resolveSeriesItems(s)) {
        if (picked.length >= limit) break;
        push(t);
      }
    }
  }

  if (picked.length < limit) {
    const mine = new Set(tutorial.data.tags);
    const scored = all
      .filter((t) => t.id !== tutorial.id)
      .map((t) => ({ t, score: t.data.tags.filter((tag) => mine.has(tag)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.t.id.localeCompare(b.t.id));
    for (const { t } of scored) {
      if (picked.length >= limit) break;
      push(t);
    }
  }

  return picked.slice(0, limit);
}
