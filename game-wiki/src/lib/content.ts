/**
 * CONTENT ACCESS LAYER — the only place pages read content.
 *
 * Pages must never touch Astro's collection API directly. That way when a
 * collection is restructured, only this file changes.
 */

import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export type Game = CollectionEntry<'game'>;
export type Guide = CollectionEntry<'guides'>;
export type Character = CollectionEntry<'characters'>;
export type CodesDoc = CollectionEntry<'codes'>;
export type Review = CollectionEntry<'reviews'>;
export type Alternatives = CollectionEntry<'alternatives'>;
export type Video = CollectionEntry<'videos'>;
export type Tag = CollectionEntry<'tags'>;
export type Legal = CollectionEntry<'legal'>;
export type Page = CollectionEntry<'pages'>;

/**
 * The site describes exactly ONE game. Loading all entries and taking the
 * first is deliberate: it makes a multi-game mistake fail loudly at build
 * (via the assert below) instead of silently rendering one of two games.
 */
let gameCache: Game | null = null;

export async function getGame(): Promise<Game> {
  if (gameCache) return gameCache;
  const all = await getCollection('game');
  if (all.length === 0) {
    throw new Error(
      'No game entry found. Add src/content/game/<slug>.json — every page depends on it.'
    );
  }
  if (all.length > 1) {
    throw new Error(
      `This template renders one game per site, but found ${all.length}: ${all
        .map((g) => g.id)
        .join(', ')}. Delete the extras or split into separate sites.`
    );
  }
  gameCache = all[0]!;
  return gameCache;
}

/** Guides sorted newest-first. */
export async function getGuides(): Promise<Guide[]> {
  const all = await getCollection('guides');
  return all.sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf());
}

/** Guides of one kind, for the per-template list sections. */
export async function getGuidesByKind(kind: Guide['data']['kind']): Promise<Guide[]> {
  const all = await getGuides();
  return all.filter((g) => g.data.kind === kind);
}

export async function getGuide(slug: string): Promise<Guide | undefined> {
  return getEntry('guides', slug);
}

/** Characters sorted by tier (best first), then by name for stable pagination. */
export async function getCharacters(): Promise<Character[]> {
  const all = await getCollection('characters');
  return all.sort((a, b) => a.data.tier - b.data.tier || a.data.name.localeCompare(b.data.name));
}

export async function getCharacter(slug: string): Promise<Character | undefined> {
  return getEntry('characters', slug);
}

/** Resolve a list of character IDs, silently dropping missing ones. */
export async function resolveCharacters(ids: string[]): Promise<Character[]> {
  if (ids.length === 0) return [];
  const all = await getCollection('characters');
  const byId = new Map(all.map((c) => [c.id, c]));
  return ids.map((id) => byId.get(id)).filter((c): c is Character => Boolean(c));
}

export async function getCodes(slug: string): Promise<CodesDoc | undefined> {
  return getEntry('codes', slug);
}

export async function getReview(slug: string): Promise<Review | undefined> {
  return getEntry('reviews', slug);
}

export async function getAlternatives(slug: string): Promise<Alternatives | undefined> {
  return getEntry('alternatives', slug);
}

export async function getVideos(): Promise<Video[]> {
  return getCollection('videos');
}

/** Resolve video IDs in the order given, dropping missing ones. */
export async function resolveVideos(ids: string[]): Promise<Video[]> {
  if (ids.length === 0) return [];
  const all = await getCollection('videos');
  const byId = new Map(all.map((v) => [v.id, v]));
  return ids.map((id) => byId.get(id)).filter((v): v is Video => Boolean(v));
}

export async function getTags(): Promise<Tag[]> {
  const all = await getCollection('tags');
  return all.sort((a, b) => a.data.label.localeCompare(b.data.label));
}

export async function getTag(slug: string): Promise<Tag | undefined> {
  return getEntry('tags', slug);
}

export async function getLegal(slug: string): Promise<Legal | undefined> {
  return getEntry('legal', slug);
}

/**
 * Per-route copy (h1, lede, SEO) for list and utility pages.
 *
 * Throws rather than falling back: a page without its `pages` entry would
 * have to hardcode an h1, which is exactly what this template forbids.
 */
export async function getPage(
  slug: Page['data']['slug']
): Promise<Page> {
  const entry = await getEntry('pages', slug);
  if (!entry) {
    throw new Error(
      `Missing src/content/pages/${slug}.json — this route needs its own h1 and SEO copy. ` +
        `Add the file rather than hardcoding text in the page.`
    );
  }
  return entry;
}

/**
 * Related content for a detail page: same-tag items, excluding self.
 * Deliberately simple (tag overlap, not embeddings) — it must be
 * deterministic at build time and explainable to a human.
 */
export async function relatedByTags<T extends Guide | Character>(
  items: T[],
  self: T,
  limit = 6
): Promise<T[]> {
  const mine = new Set(self.data.tags);
  if (mine.size === 0) {
    return items.filter((i) => i.id !== self.id).slice(0, limit);
  }
  const scored = items
    .filter((i) => i.id !== self.id)
    .map((item) => ({
      item,
      score: item.data.tags.filter((t) => mine.has(t)).length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
