#!/usr/bin/env node
/**
 * BUILD VERIFICATION — fails the build if any hard requirement regressed.
 *
 * Runs after `astro build`. Covers the things that break silently in a
 * programmatic-SEO template: 404 output location, sitemap gating, single-h1,
 * canonical presence, noindex on draft topics, JSON-LD validity, HowTo step
 * integrity, internal link rot, and duplicate titles across pages.
 *
 * The content gate (scripts/check-content.ts) validates the SOURCE. This
 * validates the OUTPUT. They catch different classes of bug: a component can
 * render the wrong thing from correct data, and no source check would see it.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
let checks = 0;

const ok = (msg) => {
  checks++;
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
};
const fail = (msg) => {
  checks++;
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
};

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

console.log('\n\x1b[1mBuild verification\x1b[0m\n');

if (!existsSync(DIST)) {
  fail('dist/ not found — did the build run?');
  process.exit(1);
}

const allFiles = walk(DIST);
const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));
const read = (f) => readFileSync(f, 'utf8');

/* ------------------------------------------------------------------ *
 * 1. Required output files
 * ------------------------------------------------------------------ */

if (existsSync(join(DIST, '404.html'))) ok('dist/404.html exists at top level');
else fail('dist/404.html MISSING — hosting will fall back to the index');

if (existsSync(join(DIST, 'sitemap.xml'))) ok('dist/sitemap.xml exists');
else fail('dist/sitemap.xml missing');

const childSitemaps = allFiles.filter((f) => /sitemap-[a-z]+\.xml$/.test(f));
if (childSitemaps.length > 0) ok(`${childSitemaps.length} child sitemap(s) generated`);
else fail('no child sitemaps generated');

/* robots.txt must reference the sitemap absolutely */
const robotsPath = join(DIST, 'robots.txt');
if (existsSync(robotsPath)) {
  const robots = read(robotsPath);
  if (/^Sitemap:\s*https?:\/\/\S+\/sitemap\.xml$/m.test(robots)) {
    ok('robots.txt has an absolute Sitemap line');
  } else {
    fail('robots.txt Sitemap line missing or not absolute');
  }
} else fail('robots.txt missing');

/* ------------------------------------------------------------------ *
 * 2. Sitemap gating — no draft topic and no noindex page may be listed
 * ------------------------------------------------------------------ */

const sitemapUrls = [];
for (const f of [join(DIST, 'sitemap.xml'), ...childSitemaps]) {
  for (const m of read(f).matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapUrls.push(m[1]);
}
const listedPaths = sitemapUrls.filter((u) => !u.endsWith('.xml')).map((u) => new URL(u).pathname);

/* Build the set of URLs that must NOT be listed, from the pages themselves. */
const noindexPaths = new Set();
for (const file of htmlFiles) {
  const rel = relative(DIST, file).replace(/\\/g, '/');
  if (!/<meta name="robots" content="noindex/i.test(read(file))) continue;
  const path = rel === 'index.html' ? '/' : '/' + rel.replace(/index\.html$/, '');
  noindexPaths.add(path);
}

const illegal = listedPaths.filter((p) => noindexPaths.has(p));
if (illegal.length === 0) {
  ok(`sitemap lists ${listedPaths.length} URL(s), none of them noindex`);
} else {
  fail(`sitemap lists noindex pages: ${illegal.join(', ')}`);
}

/* Draft topics are declared in content; none of their URLs may appear. */
const topicsDir = join(ROOT, 'src/content/topics');
const draftTopicSlugs = [];
if (existsSync(topicsDir)) {
  for (const f of readdirSync(topicsDir).filter((x) => x.endsWith('.json'))) {
    const d = JSON.parse(read(join(topicsDir, f)));
    if (d.status === 'draft') draftTopicSlugs.push(d.slug);
  }
}
if (draftTopicSlugs.length === 0) {
  ok('no draft topics to gate');
} else {
  const leaked = listedPaths.filter((p) => draftTopicSlugs.some((s) => p.startsWith(`/${s}/`) || p === `/${s}/`));
  if (leaked.length === 0) ok(`${draftTopicSlugs.length} draft topic(s) excluded from sitemap`);
  else fail(`draft topic URLs in sitemap: ${leaked.join(', ')}`);
}

/* ------------------------------------------------------------------ *
 * 3. Per-page invariants
 * ------------------------------------------------------------------ */

const h1Problems = [];
const canonicalProblems = [];
const titleProblems = [];
const descProblems = [];
const titleMap = new Map();

for (const file of htmlFiles) {
  const html = read(file);
  const rel = relative(DIST, file).replace(/\\/g, '/');

  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1Count !== 1) h1Problems.push(`${rel} (${h1Count} h1)`);

  if (!/<link rel="canonical" href="https?:\/\/[^"]+"/.test(html)) canonicalProblems.push(rel);

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  if (!titleMatch) {
    titleProblems.push(`${rel} (no title)`);
  } else {
    const t = titleMatch[1].trim();
    if (t.length < 15 || t.length > 75) titleProblems.push(`${rel} (${t.length} chars)`);
    if (titleMap.has(t)) titleMap.get(t).push(rel);
    else titleMap.set(t, [rel]);
  }

  const descMatch = html.match(/<meta name="description" content="([^"]*)"/);
  if (!descMatch) {
    descProblems.push(`${rel} (no description)`);
  } else {
    const n = descMatch[1].length;
    // 60–170 is the practical window; shorter looks thin, longer gets truncated.
    if (n < 60 || n > 170) descProblems.push(`${rel} (${n} chars)`);
  }
}

if (h1Problems.length === 0) ok(`all ${htmlFiles.length} pages have exactly one <h1>`);
else fail(`h1 count wrong on: ${h1Problems.join(', ')}`);

if (canonicalProblems.length === 0) ok('all pages emit an absolute canonical');
else fail(`canonical missing on: ${canonicalProblems.join(', ')}`);

if (titleProblems.length === 0) ok('all titles present and within length bounds');
else fail(`title problems: ${titleProblems.join(', ')}`);

if (descProblems.length === 0) ok('all descriptions within length bounds');
else fail(`description problems: ${descProblems.join(', ')}`);

const dupTitles = [...titleMap.entries()].filter(([, v]) => v.length > 1);
if (dupTitles.length === 0) ok('no duplicate titles across pages');
else fail(`duplicate titles: ${dupTitles.map(([t, v]) => `"${t}" → ${v.join(' + ')}`).join(' | ')}`);

/* ------------------------------------------------------------------ *
 * 4. 404 must be noindex
 * ------------------------------------------------------------------ */

const nf = read(join(DIST, '404.html'));
if (/<meta name="robots" content="noindex/.test(nf)) ok('404.html is noindex');
else fail('404.html is missing noindex');

/* ------------------------------------------------------------------ *
 * 5. JSON-LD: every block parses, and HowTo steps are structurally legal
 * ------------------------------------------------------------------ */

const badJsonLd = [];
const badHowTo = [];
const badFaq = [];
const badBreadcrumb = [];

for (const file of htmlFiles) {
  const html = read(file);
  const rel = relative(DIST, file).replace(/\\/g, '/');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];

  for (const b of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(b[1]);
    } catch (e) {
      badJsonLd.push(`${rel}: ${e.message}`);
      continue;
    }

    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      /* HowTo: positions must be 1..n, names unique, text non-empty. */
      if (node['@type'] === 'HowTo') {
        const steps = node.step ?? [];
        if (!Array.isArray(steps) || steps.length === 0) {
          badHowTo.push(`${rel}: HowTo with no steps`);
          continue;
        }
        const positions = steps.map((s) => s.position);
        const expected = steps.map((_, i) => i + 1);
        if (JSON.stringify(positions) !== JSON.stringify(expected)) {
          badHowTo.push(`${rel}: positions [${positions.join(',')}]`);
        }
        const names = steps.map((s) => s.name);
        if (new Set(names).size !== names.length) {
          badHowTo.push(`${rel}: duplicate step names`);
        }
        if (steps.some((s) => !s.text || !String(s.text).trim())) {
          badHowTo.push(`${rel}: empty step text`);
        }
        /* Schema.org requires plain text here — no HTML tags. The pattern needs
           to distinguish real tags from URL placeholders like `/blog/<value>/`,
           which are legitimate prose in a routing guide. A tag has an attribute,
           a closing slash, or is a known element; a placeholder is a bare word. */
        const REAL_TAG = /<\/?(p|div|span|a|code|pre|em|strong|b|i|ul|ol|li|h[1-6]|br|img|table|tr|td|th|blockquote)\b[^>]*>/i;
        if (steps.some((s) => REAL_TAG.test(String(s.text)))) {
          badHowTo.push(`${rel}: HTML tags inside step text`);
        }
        /* Markdown emphasis must also have been stripped. */
        if (steps.some((s) => /(\*\*|`{1,2}[^`]|\[[^\]]+\]\([^)]+\))/.test(String(s.text)))) {
          badHowTo.push(`${rel}: markdown still present in step text`);
        }
      }

      /* FAQPage: every question needs an accepted answer. */
      if (node['@type'] === 'FAQPage') {
        const qs = node.mainEntity ?? [];
        if (!Array.isArray(qs) || qs.length === 0) badFaq.push(`${rel}: empty mainEntity`);
        if (qs.some((q) => !q.acceptedAnswer?.text)) badFaq.push(`${rel}: question without answer`);
      }

      /* BreadcrumbList: positions must be 1..n. */
      if (node['@type'] === 'BreadcrumbList') {
        const items = node.itemListElement ?? [];
        const positions = items.map((i) => i.position);
        const expected = items.map((_, i) => i + 1);
        if (JSON.stringify(positions) !== JSON.stringify(expected)) {
          badBreadcrumb.push(`${rel}: positions [${positions.join(',')}]`);
        }
        if (items.some((i) => !i.item)) badBreadcrumb.push(`${rel}: crumb without url`);
      }
    }
  }
}

if (badJsonLd.length === 0) ok('all JSON-LD blocks parse');
else fail(`invalid JSON-LD: ${badJsonLd.slice(0, 5).join(' | ')}`);

if (badHowTo.length === 0) ok('every HowTo has 1..n positions, unique names, plain-text bodies');
else fail(`HowTo problems: ${badHowTo.slice(0, 5).join(' | ')}`);

if (badFaq.length === 0) ok('every FAQPage question has an accepted answer');
else fail(`FAQPage problems: ${badFaq.slice(0, 5).join(' | ')}`);

if (badBreadcrumb.length === 0) ok('every BreadcrumbList has 1..n positions and URLs');
else fail(`BreadcrumbList problems: ${badBreadcrumb.slice(0, 5).join(' | ')}`);

/* ------------------------------------------------------------------ *
 * 5.5 Open Graph images must exist and be raster
 *
 * An og:image pointing at a missing file is invisible in the build and only
 * shows up as a blank card after someone shares the page. SVG is a failure
 * too: the big crawlers ignore it. Per-page paths come from content JSON, so
 * this is the one place a typo there becomes visible.
 * ------------------------------------------------------------------ */

const ogProblems = [];
for (const file of htmlFiles) {
  const html = read(file);
  const rel = relative(DIST, file).replace(/\\/g, '/');
  for (const m of html.matchAll(/<meta property="og:image" content="([^"]+)"/g)) {
    const raw = m[1];
    const path = raw.replace(/^https?:\/\/[^/]+/, '');
    if (!path.startsWith('/')) continue; // off-site image, not ours to check
    const target = join(DIST, path);
    if (!existsSync(target)) {
      ogProblems.push(`${rel}: ${path} does not exist`);
      continue;
    }
    if (!/\.(png|jpe?g|webp)$/i.test(path)) {
      ogProblems.push(`${rel}: ${path} is not a raster format`);
    }
  }
}

if (ogProblems.length === 0) ok('every og:image resolves to a raster file');
else fail(`og:image problems: ${[...new Set(ogProblems)].slice(0, 6).join(' | ')}`);

/* ------------------------------------------------------------------ *
 * 6. Internal link integrity — no dead hrefs in the built output
 * ------------------------------------------------------------------ */

const pagePaths = new Set();
const assetPaths = new Set();
for (const f of allFiles) {
  const rel = relative(DIST, f).replace(/\\/g, '/');
  if (rel.endsWith('index.html')) {
    const dir = rel.slice(0, -'index.html'.length);
    pagePaths.add('/' + dir);
  } else {
    assetPaths.add('/' + rel);
  }
}
pagePaths.add('/404.html');

const brokenLinks = [];
let linkCount = 0;
for (const file of htmlFiles) {
  const html = read(file);
  const rel = relative(DIST, file).replace(/\\/g, '/');
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = m[1];
    if (href.startsWith('//')) continue;
    linkCount++;
    if (assetPaths.has(href) || pagePaths.has(href)) continue;
    const withSlash = href.endsWith('/') ? href : href + '/';
    if (pagePaths.has(withSlash)) continue;
    brokenLinks.push(`${href} (from ${rel})`);
  }
}

if (brokenLinks.length === 0) {
  ok(`${linkCount} internal link(s) resolve, 0 broken`);
} else {
  fail(`broken internal links: ${[...new Set(brokenLinks)].slice(0, 8).join(' | ')}`);
}

/* ------------------------------------------------------------------ *
 * 7. No ad / analytics / third-party script anywhere
 * ------------------------------------------------------------------ */

const adHostPattern =
  /(pagead2\.googlesyndication|adsterra|ezoic|mediavine|adsbygoogle|doubleclick|propellerads|googletagmanager|google-analytics|plausible\.io|umami\.is)/i;
const adHits = allFiles
  .filter((f) => f.endsWith('.html') || f.endsWith('.js'))
  .filter((f) => adHostPattern.test(read(f)));

if (adHits.length === 0) ok('no ad network or analytics hosts referenced');
else fail(`ad/analytics references found in: ${adHits.map((f) => relative(DIST, f)).join(', ')}`);

/* ------------------------------------------------------------------ *
 * 8. Canonical origin must not be the placeholder
 * ------------------------------------------------------------------ */

const siteConfig = read(join(ROOT, 'src/config/site.ts'));
const urlMatch = siteConfig.match(/url:\s*'([^']+)'/);
if (urlMatch) {
  const url = urlMatch[1];
  if (url.includes('example.com')) {
    /* Not a failure: this is a template, and the fork checklist says to change
       it. A loud warning is the right weight — failing would block CI on a
       fresh clone, which trains people to skip verification entirely. */
    console.log(
      `  \x1b[33m!\x1b[0m SITE.url is still ${url} — set the production origin before deploying`
    );
    checks++;
  } else {
    ok(`SITE.url is set to ${url}`);
  }
}

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

console.log(
  `\n${failures === 0 ? '\x1b[32m' : '\x1b[31m'}${checks - failures}/${checks} checks passed\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
