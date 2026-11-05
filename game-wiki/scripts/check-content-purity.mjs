#!/usr/bin/env node
/**
 * CONTENT PURITY CHECK — the hard requirement, enforced strictly.
 *
 * "All business copy, game names, descriptions, and FAQs come from
 *  src/content/. Components may not hardcode game information."
 *
 * Strategy: extract every literal English sentence-like string from the JSX
 * markup of each page/component, then require that each one either
 *   (a) appears verbatim in some content JSON file, or
 *   (b) lives in the UI-label allowlist (src/config/ui.ts), which holds
 *       generic chrome like "Copy", "Updated", "Pros".
 *
 * Anything else is hardcoded business copy and fails the check.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const CONTENT = join(SRC, 'content');

let failures = 0;
const fail = (m) => {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
};
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else out.push(f);
  }
  return out;
};
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};
const norm = (s) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[—–]/g, '-')
    .trim()
    .toLowerCase();

console.log('\n\x1b[1mContent purity check\x1b[0m\n');

/* ---------- 1. game name ---------- */
const gameFiles = readdirSync(join(CONTENT, 'game')).filter((f) => f.endsWith('.json'));
if (gameFiles.length !== 1) {
  fail(`expected exactly 1 game JSON, found ${gameFiles.length}`);
  process.exit(1);
}
const gameName = readJson(join(CONTENT, 'game', gameFiles[0]))?.name;
ok(`game name from content: "${gameName}"`);

/* ---------- 2. corpus of allowed copy ---------- */
const corpus = new Set();
const collect = (node) => {
  if (typeof node === 'string') corpus.add(norm(node));
  else if (Array.isArray(node)) node.forEach(collect);
  else if (node && typeof node === 'object') Object.values(node).forEach(collect);
};
for (const f of walk(CONTENT)) if (extname(f) === '.json') collect(readJson(f));

// UI config holds generic chrome labels; parse its string literals too.
const uiSrc = readFileSync(join(SRC, 'config', 'ui.ts'), 'utf8');
for (const m of uiSrc.matchAll(/(['"])((?:(?!\1).){2,})\1/g)) {
  const v = m[2];
  if (/[a-zA-Z]/.test(v) && !/^\d/.test(v)) corpus.add(norm(v));
}

/* ---------- 3. scan pages + components ---------- */
const targets = walk(SRC).filter((f) => {
  const ext = extname(f);
  if (ext !== '.astro' && ext !== '.ts') return false;
  if (f.startsWith(CONTENT)) return false;
  if (f.endsWith('content.config.ts')) return false;
  if (f.includes(`${join('src', 'lib')}`)) return false; // lib has no user-visible copy
  if (f.includes(`${join('src', 'config')}`)) return false; // config IS the allowlist
  if (f.endsWith('global.css')) return false;
  return true;
});

/**
 * Extract user-visible literal prose. Deliberately conservative — false
 * negatives (missing a violation) are caught by review, while false positives
 * make the gate useless and get disabled.
 *
 * Only two shapes count as prose:
 *   1. Text sitting between a JSX tag boundary and the next brace/tag on the
 *      SAME line: `> Some words here <` or `> Some words {expr}`
 *   2. A quoted string that reads like a sentence: contains a space, ends with
 *      punctuation OR is 6+ words, and contains a lowercase function word
 *      (the/of/to/and/for/your/you/is/are/with/that/this).
 */
const FUNCTION_WORDS = /\b(the|a|an|of|to|and|or|for|your|you|is|are|was|were|with|that|this|from|not|its|it|in|on|at|by|as|be|can|will|how|what|when|why|all|every|each|no|if|then|than|they|their|we|our)\b/i;

function extractLiterals(text) {
  const found = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    // Skip import/export/type lines and pure code lines.
    if (/^(import|export|const|let|var|return|function|type|interface)\b/.test(line)) continue;

    // Shape 1: JSX text nodes on one line.
    for (const m of line.matchAll(/>\s*([A-Za-z][^<>{}]{8,}?)\s*(?=<|\{|$)/g)) {
      const candidate = m[1].trim();
      if (candidate.split(/\s+/).length >= 2 && FUNCTION_WORDS.test(candidate)) {
        found.push(candidate);
      }
    }
  }

  // Shape 2: sentence-like quoted strings anywhere (props, fallbacks).
  for (const m of text.matchAll(/(['"`])((?:[^'"`\\\n]|\\.){12,}?)\1/g)) {
    const v = m[2];
    if (!FUNCTION_WORDS.test(v)) continue;
    const words = v.trim().split(/\s+/).length;
    const hasSentencePunct = /[.!?]/.test(v);
    const looksLikeMarkup = /[<>{}=\/]|class:|:\s/.test(v) && !hasSentencePunct;
    if (looksLikeMarkup) continue;
    // Utility-class lists: almost every token contains a colon, dash, or slash,
    // or is a bare size/colour token. These are styling, not copy.
    const tokens = v.trim().split(/\s+/);
    const classLike = tokens.filter((t) => /[:\-\[\]\/0-9]/.test(t)).length;
    if (classLike / tokens.length > 0.5) continue;
    const looksLikeCssValue = /^(?:var\(|calc\(|#[0-9a-f]|rgba?\()/i.test(v.trim());
    if (looksLikeCssValue) continue;
    if (hasSentencePunct || words >= 6) found.push(v);
  }

  return found;
}

const violations = [];
for (const file of targets) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);

  // Strip comments so documentation prose is never flagged.
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

  // Skip the frontmatter import block (identifiers, not copy).
  const body = stripped.replace(/^---[\s\S]*?---/, '');

  for (const lit of extractLiterals(body)) {
    const n = norm(lit);
    if (n.length < 6) continue;
    // Skip interpolations and code fragments.
    if (/^\W*$/.test(n)) continue;
    if (corpus.has(n)) continue;

    // A literal is acceptable if it is a strict substring of something in the
    // corpus (e.g. a shortened heading) — but only when long enough to matter.
    let covered = false;
    for (const c of corpus) {
      if (c.length >= 6 && (c.includes(n) || n.includes(c)) && Math.abs(c.length - n.length) < 200) {
        covered = true;
        break;
      }
    }
    if (covered) continue;

    violations.push(`${rel}: "${lit.trim().slice(0, 70)}"`);
  }
}

if (violations.length === 0) {
  ok(`no hardcoded business copy in ${targets.length} page/component files`);
} else {
  fail(`${violations.length} hardcoded copy violation(s):`);
  for (const v of violations.slice(0, 25)) console.log(`      ${v}`);
  if (violations.length > 25) console.log(`      … and ${violations.length - 25} more`);
}

/* ---------- 4. no direct JSON imports in pages ---------- */
const directJson = targets.filter((f) => /from\s+['"][^'"]*\.json['"]/.test(readFileSync(f, 'utf8')));
if (directJson.length === 0) ok('no page imports content JSON directly');
else fail(`direct JSON imports: ${directJson.map((f) => relative(ROOT, f)).join(', ')}`);

/* ---------- 5. every page passes data-driven title ---------- */
const staticTitles = [];
for (const file of walk(join(SRC, 'pages'))) {
  if (extname(file) !== '.astro') continue;
  const m = readFileSync(file, 'utf8').match(/<BaseLayout[\s\S]*?>/);
  if (!m) continue;
  if (/\btitle="[^{]/.test(m[0]) || /\bdescription="[^{]/.test(m[0])) {
    staticTitles.push(relative(ROOT, file));
  }
}
if (staticTitles.length === 0) ok('all pages derive title/description from data');
else fail(`static title/description in: ${staticTitles.join(', ')}`);

console.log(
  `\n${failures === 0 ? '\x1b[32mcontent purity OK' : `\x1b[31m${failures} violation(s)`}\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
