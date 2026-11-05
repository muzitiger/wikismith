#!/usr/bin/env node
/**
 * RESET TEMPLATE — turn the demo site into a blank slate for a new topic.
 *
 * `npm run reset` with no arguments prints what would be deleted and exits.
 * `npm run reset -- --yes` performs it.
 *
 * What it deletes:
 *   src/content/tutorials/*, errors/*, comparisons/*, series/*
 *   src/content/topics/*        (except the one you keep, if named)
 *   public/og-default.svg       (placeholder art)
 *   dist/, .astro/              (stale build output)
 *
 * What it keeps:
 *   everything in src/ (components, layouts, pages, lib) — that IS the template
 *   src/config/ui.ts    — nav labels, section headings
 *   src/content/tags/   — tag definitions, usually reusable
 *   src/content/legal/  — about/privacy boilerplate to edit
 *
 * It also rewrites src/config/site.ts `url` if you pass --url.
 *
 * Usage:
 *   npm run reset                          # dry run
 *   npm run reset -- --yes                 # wipe all content
 *   npm run reset -- --yes --keep astro    # keep the astro topic as a filled example
 *   npm run reset -- --yes --url https://mysite.com
 */
import { readdirSync, rmSync, existsSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTENT = join(ROOT, 'src', 'content');

const args = process.argv.slice(2);
const confirmed = args.includes('--yes') || args.includes('-y');
const keepIdx = args.indexOf('--keep');
const keepTopic = keepIdx >= 0 ? args[keepIdx + 1] : null;
const urlIdx = args.indexOf('--url');
const newUrl = urlIdx >= 0 ? args[urlIdx + 1] : null;

const WIPE = ['tutorials', 'errors', 'comparisons', 'series'];
const WIPE_ALL_TOPICS = !keepTopic;

function jsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => join(dir, f));
}

function dirSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function sizeOf(path) {
  if (!existsSync(path)) return '0 B';
  const st = statSync(path);
  if (!st.isDirectory()) return dirSize(st.size);
  let total = 0;
  for (const e of readdirSync(path)) {
    const p = join(path, e);
    const s = statSync(p);
    total += s.isDirectory() ? 0 : s.size;
  }
  return dirSize(total);
}

/* ------------------------------------------------------------------ *
 * Plan
 * ------------------------------------------------------------------ */

const plan = [];

for (const name of WIPE) {
  const files = jsonFiles(join(CONTENT, name));
  if (files.length) {
    plan.push({ label: `src/content/${name}/`, count: files.length, bytes: sizeOf(join(CONTENT, name)) });
  }
}

const topicFiles = jsonFiles(join(CONTENT, 'topics'));
const topicsToDelete = WIPE_ALL_TOPICS
  ? topicFiles
  : topicFiles.filter((f) => !f.endsWith(`${keepTopic}.json`));
if (topicsToDelete.length) {
  plan.push({
    label: `src/content/topics/`,
    count: topicsToDelete.length,
    bytes: dirSize(topicsToDelete.reduce((n, f) => n + statSync(f).size, 0)),
  });
}

for (const p of ['public/og-default.svg', 'dist', '.astro']) {
  const full = join(ROOT, p);
  if (existsSync(full)) plan.push({ label: p, count: 1, bytes: sizeOf(full) });
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

console.log('\n\x1b[1mTemplate reset\x1b[0m\n');

if (plan.length === 0) {
  console.log('  Nothing to wipe — the template is already clean.\n');
  process.exit(0);
}

console.log('  Will delete:');
for (const item of plan) {
  const what = item.count > 1 ? `${item.count} files` : '1 item';
  console.log(`    \x1b[31m−\x1b[0m ${item.label.padEnd(28)} ${what.padEnd(12)} ${item.bytes}`);
}

console.log('\n  Will keep:');
console.log('    \x1b[32m+\x1b[0m src/components/ src/layouts/ src/pages/ src/lib/   (the template itself)');
console.log('    \x1b[32m+\x1b[0m src/config/ui.ts                                     (nav and section labels)');
console.log('    \x1b[32m+\x1b[0m src/content/tags/                                    (reusable tag definitions)');
console.log('    \x1b[32m+\x1b[0m src/content/legal/                                   (about/privacy to edit)');
if (keepTopic) console.log(`    \x1b[32m+\x1b[0m src/content/topics/${keepTopic}.json                         (kept as a filled example)`);

if (newUrl) {
  console.log(`\n  Will set SITE.url → ${newUrl}`);
}

if (!confirmed) {
  console.log('\n\x1b[33m  Dry run.\x1b[0m Nothing was deleted.');
  console.log('  Re-run with --yes to apply:');
  console.log('    npm run reset -- --yes');
  if (keepTopic) console.log(`    npm run reset -- --yes --keep ${keepTopic}`);
  console.log('    npm run reset -- --yes --url https://your-domain.com\n');
  process.exit(0);
}

/* ------------------------------------------------------------------ *
 * Apply
 * ------------------------------------------------------------------ */

for (const name of WIPE) {
  const dir = join(CONTENT, name);
  for (const f of jsonFiles(dir)) rmSync(f);
}

for (const f of topicsToDelete) rmSync(f);

for (const p of ['public/og-default.svg', 'dist', '.astro']) {
  const full = join(ROOT, p);
  if (existsSync(full)) rmSync(full, { recursive: true, force: true });
}

if (newUrl) {
  const cfgPath = join(ROOT, 'src', 'config', 'site.ts');
  const cfg = readFileSync(cfgPath, 'utf8');
  const next = cfg.replace(/url:\s*'[^']*'/, `url: '${newUrl.replace(/\/+$/, '')}'`);
  if (next === cfg) {
    console.log('\n  \x1b[31m✗\x1b[0m Could not find `url:` in src/config/site.ts — set it by hand.');
  } else {
    writeFileSync(cfgPath, next);
  }
}

console.log('\n\x1b[32m  Done.\x1b[0m Content wiped, template intact.\n');
console.log('  Next:');
console.log('    1. Add src/content/topics/<slug>.json   (kind: "primary")');
console.log('    2. Add src/content/tutorials/*.json     (min 2 steps, 1000 words each)');
console.log('    3. npm run check:content                (fast validation loop)');
console.log('    4. npm run build                        (content gate + build + output checks)\n');
