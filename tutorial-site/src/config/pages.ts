/**
 * STATIC PAGE COPY — SEO strings for index routes that have no content file.
 *
 * The homepage and the /vs/ index are template pages: there is no JSON entry
 * behind them, so their title/description/FAQ need a home that is not the
 * .astro file. Keeping them here means:
 *
 *   1. `scripts/check-content-purity.mjs` can prove no page hardcodes copy.
 *   2. A fork rewrites this one file instead of hunting attributes in markup.
 *   3. Tutorial prose still lives in src/content/ — this is landing-page copy
 *      only, not a tutorial, and it never feeds a HowTo node.
 *
 * FORK CHECKLIST: rewrite all three blocks for the new site's subject.
 */

export const PAGE_COPY = {
  home: {
    /** <title> — 45–60 chars is the SERP budget. */
    title: 'Step-by-Step Technical Tutorials With Expected Results',
    description:
      'Step-by-step technical guides with the tested version stated up front, a way to confirm every step worked, and a dedicated page for each error you are likely to hit.',
    faq: [
      {
        q: 'How are these tutorials written?',
        a: 'Each guide is worked through end to end in a clean environment and recorded as it happens. The version used is stated on the page, and every step includes a way to confirm it produced the expected result.',
      },
      {
        q: 'What does "tested with" mean on a guide?',
        a: 'It is the exact software version and environment the steps were last verified against. When a guide is re-checked on a newer release, that line and the modification date are updated together.',
      },
      {
        q: 'Why are there separate pages for errors?',
        a: 'Because one error usually shows up in several different tutorials. Each error gets a single page with the full cause-and-fix detail, and the tutorials link to it instead of repeating a shortened version.',
      },
    ],
  },

  comparisons: {
    title: 'Framework Comparisons',
    description:
      'Side-by-side comparisons of static site and app frameworks, each with a concrete verdict per use case rather than an inconclusive list of differences.',
    heading: 'Comparisons',
    intro:
      'Each comparison ends with a pick per use case. "It depends" is not a conclusion, so these pages state which scenario favours which tool and why.',
    listName: 'Framework comparisons',
    listDescription:
      'Side-by-side comparisons of static site frameworks and app frameworks, each with a use-case verdict rather than a list of differences.',
  },
} as const;
