#!/usr/bin/env node
/**
 * CONTENT PURITY — proves the "no hardcoded tutorial content" rule still holds.
 *
 * The requirement is: components must not contain tutorial prose. That is easy
 * to satisfy on day one and easy to violate in month three, when someone adds
 * a helpful sentence to a template instead of the content JSON.
 *
 * Four checks:
 *   1. No prose literal in a .astro file unless it is in the UI allowlist.
 *   2. No page imports content JSON directly (all reads go through lib/content).
 *   3. No page passes a static string as title/description to BaseLayout.
 *   4. Every content collection the schema declares actually has files.
 *
 * Prose detection is a heuristic, not a proof: it looks for quoted strings with
 * spaces and letters long enough to be a sentence. That catches the realistic
 * failure mode without flagging every CSS class.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

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
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

console.log('\n\x1b[1mContent purity\x1b[0m\n');

const astroFiles = walk(SRC).filter((f) => f.endsWith('.astro'));
const rel = (f) => relative(ROOT, f).replace(/\\/g, '/');

/* ------------------------------------------------------------------ *
 * Allowlist — UI chrome that is allowed to be literal.
 *
 * Everything here is a label, an accessibility string, or a symbol. None of it
 * is tutorial content. Anything not on this list and not sourced from
 * src/config/ui.ts is treated as a violation.
 * ------------------------------------------------------------------ */

const ALLOWED_LITERALS = new Set([
  'application/ld+json',
  'index, follow, max-image-preview:large, max-snippet:-1',
  'noindex, nofollow',
  'summary_large_image',
  'image/svg+xml',
  'text/plain; charset=utf-8',
  'application/xml; charset=utf-8',
  'This is a static site.',
]);


/* ------------------------------------------------------------------ *
 * 1. Prose literals in .astro files
 * ------------------------------------------------------------------ */

/**
 * Find quoted strings that read as sentences.
 *
 * Criteria: contains a space, at least 20 characters, at least two words of
 * 3+ letters, and is not a URL / path / code snippet. This deliberately does
 * not flag short labels, because a template is allowed to say "Related".
 */
function proseLiterals(source) {
  const hits = [];

  /* Strip frontmatter — it holds code, not rendered copy. */
  const withoutFrontmatter = source.replace(/^---[\s\S]*?---/, '');

  /* Strip HTML comments and style blocks. */
  const cleaned = withoutFrontmatter
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '');

  /* Single-line only: a `"` closing one attribute and a `"` opening the next
     would otherwise be read as one long "string" spanning the markup. Prose in
     an attribute never wraps lines in this codebase. */
  for (const m of cleaned.matchAll(/(?<![=\w])"([^"\\\n]{20,300})"/g)) {
    const s = m[1];
    if (ALLOWED_LITERALS.has(s)) continue;
    if (/^(https?:\/\/|\/|\.\/|#|@)/.test(s)) continue;   // url or path
    if (!/\s/.test(s)) continue;                            // single token
    if (/^[\w-]+(\s+[\w-]+)*$/.test(s) && s.split(/\s+/).length <= 3) continue;
    /* Class lists look like prose to a naive check; require a lowercase word
       followed by a space and another lowercase word, and no Tailwind-ish tokens. */
    if (/^(flex|grid|mt-|mb-|text-|bg-|border-|rounded-|px-|py-|size-|w-|h-|space-)/.test(s)) continue;
    if (/[\d.]+(px|rem|em|%|ms)/.test(s)) continue;

    const words = s.split(/\s+/).filter((w) => /[a-zA-Z]{3,}/.test(w));
    if (words.length >= 3) hits.push(s);
  }

  /* Single-quoted attributes too, but only for known content-bearing keys. */
  for (const key of ['title', 'description', 'aria-label', 'alt', 'placeholder']) {
    const re = new RegExp(`${key}='([^']{20,300})'`, 'g');
    for (const m of cleaned.matchAll(re)) {
      const s = m[1];
      if (ALLOWED_LITERALS.has(s)) continue;
      if (/^(https?:\/\/|\/|\.\/|#)/.test(s)) continue;
      const words = s.split(/\s+/).filter((w) => /[a-zA-Z]{3,}/.test(w));
      if (words.length >= 3) hits.push(`${key}="${s}"`);
    }
  }

  return hits;
}

const proseHits = [];
for (const f of astroFiles) {
  for (const hit of proseLiterals(readFileSync(f, 'utf8'))) {
    proseHits.push(`${rel(f)}: "${hit.slice(0, 70)}${hit.length > 70 ? '…' : ''}"`);
  }
}

if (proseHits.length === 0) {
  ok(`${astroFiles.length} .astro files contain no hardcoded prose`);
} else {
  fail(`hardcoded prose found in ${proseHits.length} place(s):\n      ${proseHits.slice(0, 10).join('\n      ')}`);
}

/* ------------------------------------------------------------------ *
 * 2. No direct content JSON imports in pages
 * ------------------------------------------------------------------ */

const pageFiles = walk(join(SRC, 'pages'));
const directImports = [];
for (const f of pageFiles) {
  const src = readFileSync(f, 'utf8');
  /* Importing the collection API directly is also a violation — pages must go
     through lib/content.ts so the access layer stays the only place that knows
     about collection shapes. */
  if (/from\s+['"]astro:content['"]/.test(src)) {
    directImports.push(`${rel(f)}: imports astro:content directly`);
  }
  if (/from\s+['"][^'"]*content\/[^'"]*\.json['"]/.test(src)) {
    directImports.push(`${rel(f)}: imports a content JSON file`);
  }
}

if (directImports.length === 0) {
  ok('no page bypasses lib/content.ts to read content');
} else {
  fail(`page(s) bypassing lib/content.ts:\n      ${directImports.join('\n      ')}`);
}

/* ------------------------------------------------------------------ *
 * 3. No static title/description passed to BaseLayout
 * ------------------------------------------------------------------ */

const staticSeo = [];
for (const f of pageFiles) {
  const src = readFileSync(f, 'utf8');
  /* A static value looks like title="Some words" — an expression is title={...}. */
  for (const m of src.matchAll(/\b(title|description)="([^"]{10,})"/g)) {
    const value = m[2];
    /* Allow aria-label and other attributes on non-layout elements by requiring
       the value to look like a sentence and the file to actually use BaseLayout. */
    if (!/from\s+['"]@\/layouts\/BaseLayout/.test(src)) continue;
    const words = value.split(/\s+/).filter((w) => /[a-zA-Z]{3,}/.test(w));
    if (words.length >= 3) staticSeo.push(`${rel(f)}: ${m[1]}="${value.slice(0, 60)}"`);
  }
}

if (staticSeo.length === 0) {
  ok('every title/description comes from content, not a literal');
} else {
  fail(`static SEO strings found:\n      ${staticSeo.join('\n      ')}`);
}

/* ------------------------------------------------------------------ *
 * 4. Every declared collection has content
 * ------------------------------------------------------------------ */

const schemaSrc = readFileSync(join(SRC, 'content.config.ts'), 'utf8');
const declared = [...schemaSrc.matchAll(/const\s+(\w+)\s*=\s*defineCollection/g)].map((m) => m[1]);

const emptyCollections = [];
for (const name of declared) {
  /* The loader base path is the source of truth for where files live. */
  const baseMatch = schemaSrc.match(
    new RegExp(`const\\s+${name}\\s*=[\\s\\S]*?glob\\(\\{[^}]*base:\\s*'\\./src/content/([^']+)'`)
  );
  const dir = baseMatch ? join(SRC, 'content', baseMatch[1]) : join(SRC, 'content', name);
  const files = existsSync(dir) ? walk(dir).filter((f) => f.endsWith('.json')) : [];
  if (files.length === 0) emptyCollections.push(`${name} (${rel(dir)})`);
}

if (emptyCollections.length === 0) {
  ok(`all ${declared.length} declared collections contain at least one entry`);
} else {
  fail(`empty collections: ${emptyCollections.join(', ')}`);
}

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

console.log(
  `\n${failures === 0 ? '\x1b[32m' : '\x1b[31m'}${checks - failures}/${checks} checks passed\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
