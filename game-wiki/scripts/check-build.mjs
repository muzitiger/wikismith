#!/usr/bin/env node
/**
 * BUILD VERIFICATION — fails the build if any hard requirement regressed.
 *
 * Runs after `astro build`. Checks the things that silently break in template
 * sites: 404 output location, sitemap gating, single-h1, canonical presence,
 * noindex on locked routes, and absence of ad/third-party scripts.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
let checks = 0;

function ok(msg) {
  checks++;
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}
function fail(msg) {
  checks++;
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

console.log('\n\x1b[1mBuild verification\x1b[0m\n');

/* 1. dist exists */
if (!existsSync(DIST)) {
  fail('dist/ not found — did the build run?');
  process.exit(1);
}

const allFiles = walk(DIST);
const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));

/* 2. top-level 404.html */
if (existsSync(join(DIST, '404.html'))) ok('dist/404.html exists at top level');
else fail('dist/404.html MISSING — hosting will fall back to the index');

/* 3. sitemap.xml + at least one child */
if (existsSync(join(DIST, 'sitemap.xml'))) ok('dist/sitemap.xml exists');
else fail('dist/sitemap.xml missing');

const childSitemaps = allFiles.filter((f) => /sitemap-[a-z]+\.xml$/.test(f));
if (childSitemaps.length > 0) ok(`${childSitemaps.length} child sitemap(s) generated`);
else fail('no child sitemaps generated');

/* 4. robots.txt references the sitemap */
const robotsPath = join(DIST, 'robots.txt');
if (existsSync(robotsPath)) {
  const robots = readFileSync(robotsPath, 'utf8');
  if (/^Sitemap:\s*https?:\/\/\S+\/sitemap\.xml$/m.test(robots)) ok('robots.txt has an absolute Sitemap line');
  else fail('robots.txt Sitemap line missing or not absolute');
} else fail('robots.txt missing');

/* 5. sitemap gating: only open routes are listed */
const sitemapUrls = [];
for (const f of [join(DIST, 'sitemap.xml'), ...childSitemaps]) {
  const xml = readFileSync(f, 'utf8');
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapUrls.push(m[1]);
}
const listedPaths = sitemapUrls.filter((u) => !u.endsWith('.xml')).map((u) => new URL(u).pathname);

// Load the gate config to compare against.
const siteConfig = readFileSync(join(ROOT, 'src/config/site.ts'), 'utf8');
const openMatch = siteConfig.match(/SITEMAP_OPEN[^=]*=\s*\[([^\]]*)\]/s);
const openKeys = openMatch
  ? [...openMatch[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1])
  : [];

const prefixByKey = {
  home: ['/'],
  play: ['/play/'],
  guides: ['/guides/'],
  characters: ['/characters/'],
  codes: ['/codes/'],
  review: ['/review/'],
  alternatives: ['/alternatives/'],
  tags: ['/tags/'],
  legal: ['/about/', '/privacy-policy/', '/terms-of-service/'],
};

const allowedPrefixes = openKeys.flatMap((k) => prefixByKey[k] ?? []);
const illegal = listedPaths.filter(
  (p) => !allowedPrefixes.some((pre) => (pre === '/' ? p === '/' : p.startsWith(pre)))
);

if (illegal.length === 0) {
  ok(`sitemap lists ${listedPaths.length} URL(s), all within SITEMAP_OPEN [${openKeys.join(', ')}]`);
} else {
  fail(`sitemap lists locked routes: ${illegal.join(', ')}`);
}

/* 6. per-HTML checks */
let h1Problems = [];
let canonicalProblems = [];
let noindexProblems = [];

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const rel = relative(DIST, file);

  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1Count !== 1) h1Problems.push(`${rel} (${h1Count} h1)`);

  if (!/<link rel="canonical" href="https?:\/\/[^"]+"/.test(html)) canonicalProblems.push(rel);

  // A page whose route family is locked must carry noindex.
  const isLocked =
    rel !== '404.html' &&
    allowedPrefixes.length > 0 &&
    !allowedPrefixes.some((pre) =>
      pre === '/' ? rel === 'index.html' : ('/' + rel.replace(/index\.html$/, '')).startsWith(pre)
    );
  const hasNoindex = /<meta name="robots" content="noindex/.test(html);
  if (isLocked && !hasNoindex) noindexProblems.push(rel);
}

if (h1Problems.length === 0) ok(`all ${htmlFiles.length} pages have exactly one <h1>`);
else fail(`h1 count wrong on: ${h1Problems.join(', ')}`);

if (canonicalProblems.length === 0) ok('all pages emit an absolute canonical');
else fail(`canonical missing on: ${canonicalProblems.join(', ')}`);

if (noindexProblems.length === 0) ok('every locked-route page carries noindex');
else fail(`locked pages without noindex: ${noindexProblems.join(', ')}`);

/* 7. no ad / third-party scripts anywhere */
const adHostPattern =
  /(pagead2\.googlesyndication|adsterra|ezoic|mediavine|adsbygoogle|doubleclick|propellerads|googletagmanager|google-analytics)/i;
const adHits = allFiles
  .filter((f) => f.endsWith('.html') || f.endsWith('.js'))
  .filter((f) => adHostPattern.test(readFileSync(f, 'utf8')));

if (adHits.length === 0) ok('no ad network or analytics hosts referenced');
else fail(`ad/analytics references found in: ${adHits.map((f) => relative(DIST, f)).join(', ')}`);

/* 8. 404 must be noindex */
const nf = readFileSync(join(DIST, '404.html'), 'utf8');
if (/<meta name="robots" content="noindex/.test(nf)) ok('404.html is noindex');
else fail('404.html is missing noindex');

/* 9. JSON-LD parses as valid JSON on every page that has it */
let badJsonLd = [];
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const b of blocks) {
    try {
      JSON.parse(b[1]);
    } catch (e) {
      badJsonLd.push(`${relative(DIST, file)}: ${e.message}`);
    }
  }
}
if (badJsonLd.length === 0) ok('all JSON-LD blocks parse');
else fail(`invalid JSON-LD: ${badJsonLd.join(' | ')}`);

/* Summary */
console.log(`\n${failures === 0 ? '\x1b[32m' : '\x1b[31m'}${checks - failures}/${checks} checks passed\x1b[0m\n`);
process.exit(failures === 0 ? 0 : 1);
