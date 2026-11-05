/**
 * UI STRINGS — every label, button, and heading that appears on the site.
 *
 * Components import from here instead of writing literal copy. This is what
 * makes the template translatable without touching a single .astro file:
 * replace this object (or add a lookup keyed by SITE.locale).
 */

export const UI = {
  siteName: 'Wikismith Demo',
  skipToContent: 'Skip to content',

  nav: {
    home: 'Home',
    play: 'Play',
    guides: 'Guides',
    characters: 'Characters',
    codes: 'Codes',
    review: 'Review',
    alternatives: 'Alternatives',
    menuLabel: 'Main navigation',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },

  cta: {
    playNow: 'Play now',
    playFree: 'Play free',
    readGuide: 'Read guide',
    viewAll: 'View all',
    viewAllGuides: 'View all guides',
    viewAllCharacters: 'View all characters',
    seeCodes: 'See all codes',
    copyCode: 'Copy',
    copied: 'Copied',
  },

  labels: {
    updated: 'Updated',
    published: 'Published',
    lastUpdated: 'Last updated',
    by: 'By',
    developer: 'Developer',
    publisher: 'Publisher',
    released: 'Released',
    platforms: 'Platforms',
    genres: 'Genres',
    rating: 'Rating',
    ratings: 'ratings',
    outOf: 'out of',
    tags: 'Tags',
    screenshots: 'Screenshots',
    video: 'Video',
    videoNote: 'Tap to watch on the platform. Nothing loads until you do.',
    trailer: 'Trailer',
    contents: 'On this page',
    related: 'Related',
    relatedGuides: 'Related guides',
    relatedCharacters: 'Related characters',
    moreGames: 'More games like this',
    faq: 'Frequently asked questions',
    pros: 'Pros',
    cons: 'Cons',
    verdict: 'Verdict',
    score: 'Score',
    activeCodes: 'Active codes',
    expiredCodes: 'Expired codes',
    reward: 'Reward',
    code: 'Code',
    added: 'Added',
    howToRedeem: 'How to redeem',
    free: 'Free',
    tier: 'Tier',
    controls: 'Controls',
    comparison: 'How it compares',
    stats: 'Stats',
    abilities: 'Abilities',
    tips: 'Tips',
    breadcrumb: 'Breadcrumb',
    home: 'Home',
    page: 'Page',
    showingAll: 'Showing all',
    noResults: 'Nothing here yet.',
    readingTime: 'min read',
  },

  ads: {
    /** Shown inside the placeholder so you can see the slot in dev. Off in prod. */
    slotLabel: 'Ad slot',
  },

  footer: {
    aboutTitle: 'About this site',
    aboutFallback:
      'An independent fan resource. Not affiliated with the game developer or publisher.',
    linksTitle: 'Explore',
    legalTitle: 'Legal',
    rights: 'All rights reserved.',
  },

  empty: {
    guides: 'No guides published yet.',
    characters: 'No characters documented yet.',
    codes: 'No codes tracked yet.',
    tags: 'No tags yet.',
  },
} as const;

/** Format a date for display. One place, so every page matches. */
export function formatDate(date: Date, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Sentence templates used when content omits an optional field. */
export const UI_TEMPLATES = {
  tagDescription: (label: string, game: string) => `All ${game} content tagged ${label}.`,
  tagTitle: (label: string, game: string) => `${label} · ${game}`,
  notFoundTitle: (game: string) => `Page not found · ${game}`,
};

/** ISO date-only string for <time datetime> and JSON-LD. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
