/**
 * UI STRINGS — every label on the site.
 *
 * Components import from here instead of writing literal copy, so translating
 * the template means replacing this one object.
 *
 * NOTE: tutorial prose is NOT here. That lives in src/content/. This file is
 * chrome only: nav, buttons, section headings, empty states.
 */

export const UI = {
  siteName: 'Tutorial Index',
  siteTagline: 'Step-by-step guides, verified against real versions',
  skipToContent: 'Skip to content',

  nav: {
    home: 'Home',
    topics: 'Topics',
    tutorials: 'Tutorials',
    errors: 'Errors',
    comparisons: 'Comparisons',
    menuLabel: 'Main navigation',
  },

  section: {
    answer: 'Short answer',
    prerequisites: 'Prerequisites',
    steps: 'Steps',
    expected: 'Expected result',
    verify: 'Verify it worked',
    errors: 'Common errors',
    errorsLead: 'These are the failures people hit at this exact point.',
    faq: 'FAQ',
    related: 'Related tutorials',
    contents: 'On this page',
    referencedIn: 'Referenced in these tutorials',
    stillBroken: 'Still not working?',
    prevention: 'How to avoid it next time',
    causes: 'Why it happens',
    verdict: 'Verdict',
    wins: 'Where it wins',
    checklist: 'The checklist',
    series: 'In this series',
    prev: 'Previous',
    next: 'Next',
    allTutorials: 'All tutorials',
    allErrors: 'All errors',
    allComparisons: 'All comparisons',
    latest: 'Recently updated',
    topicIn: 'In',
  },

  meta: {
    difficulty: 'Difficulty',
    time: 'Time',
    testedWith: 'Tested with',
    updated: 'Updated',
    published: 'Published',
    minRead: 'min',
    steps: 'steps',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  },

  cta: {
    readGuide: 'Read guide',
    viewAll: 'View all',
    backToTopic: 'Back to topic',
  },

  empty: {
    noTutorials: 'No tutorials published for this topic yet.',
    noErrors: 'No error entries for this topic yet.',
    noComparisons: 'No comparisons published yet.',
  },

  topicKind: {
    primary: 'Full tutorial set',
    stub: 'Comparison reference',
  },

  /** Error-page category labels. Keys must match the errors schema enum. */
  errorCategory: {
    build: 'Build errors',
    runtime: 'Runtime errors',
    config: 'Configuration',
    network: 'Network',
    types: 'Type errors',
    deploy: 'Deployment',
    other: 'Other',
  } as Record<string, string>,

  footer: {
    builtWith: 'Static site, built with Astro',
    topics: 'Topics',
    resources: 'Resources',
    legal: 'Legal',
    about: 'About',
    privacy: 'Privacy',
  },

  notFound: {
    title: 'Page not found',
    body: 'This URL does not exist. It may have moved, or the tutorial may not have been published yet.',
    cta: 'Go to the homepage',
  },
} as const;

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export function difficultyLabel(d: Difficulty): string {
  return UI.meta[d];
}
