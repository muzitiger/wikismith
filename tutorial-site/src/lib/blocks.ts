/**
 * BLOCK HELPERS
 *
 * Content bodies are typed block arrays. These helpers do the two things
 * components must never do inline: flatten to plain text (for JSON-LD and
 * meta descriptions) and count words (for the build-time length gate).
 */

import type { CollectionEntry } from 'astro:content';

export type Block = CollectionEntry<'tutorials'>['data']['body'][number];
export type Step = CollectionEntry<'tutorials'>['data']['steps'][number];

/**
 * Flatten blocks to plain text.
 * Used by HowTo.step.text — schema.org requires plain text here, no HTML,
 * no markdown. Code blocks are excluded on purpose: `text` is prose the
 * reader follows, and a code dump both bloats the payload and reads badly
 * in a rich result.
 */
export function blocksToPlainText(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'p':
      case 'h2':
      case 'h3':
        out.push(stripMarkdown(b.text));
        break;
      case 'list':
        out.push(b.items.map((i) => stripMarkdown(i)).join(' '));
        break;
      case 'note':
        out.push(stripMarkdown(b.text));
        break;
      case 'table':
        // Header + every cell, each stripped. The earlier version joined raw
        // cells, which leaked backticks and `<a href>` into HowTo.step.text —
        // schema.org requires plain text, and a raw tag there fails validation.
        out.push(b.headers.map((h) => stripMarkdown(h)).join(', '));
        out.push(
          b.rows
            .map((r) => r.map((cell) => stripMarkdown(cell)).join(', '))
            .join('; ')
        );
        break;
      case 'code':
        // Intentionally skipped — see function doc.
        break;
      case 'image':
        out.push(b.media.alt);
        break;
      case 'errorRef':
        // Resolved at render time; the JSON-LD text doesn't need it twice.
        break;
    }
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Strip inline markdown AND any embedded HTML, so the result is safe as a
 * JSON-LD string and reads as prose.
 *
 * Order matters: code spans are unwrapped before tag-stripping, because a
 * legitimate code span can contain `<a href>` (a comparison table listing HTML
 * elements, for instance). Once unwrapped, the tag-stripper would eat it — so
 * the tag-strip runs first, on the raw string, and the code-span unwrap second.
 * That keeps `<a href>` out of the output without deleting the words around it.
 */
export function stripMarkdown(s: string | null | undefined): string {
  // Defensive: optional content fields (list descriptions, legacy documents)
  // reach this from several call sites. A missing string is empty text, not a
  // build failure.
  if (typeof s !== 'string') return '';
  return s
    /* Remove HTML tags before unwrapping code, so `<a href>` inside a code span
       still disappears rather than surviving as pseudo-text. */
    .replace(/<[^>]{0,200}>/g, '')
    /* Tag removal can empty a code span: `<a href>` becomes ``. Drop the empty
       pair, otherwise it survives as literal punctuation in JSON-LD text. */
    .replace(/`\s*`/g, '')
    .replace(/`([^`]+)`/g, '$1')
    /* Any backtick left at this point was unmatched in the source. It is
       punctuation, never content, so it must not reach plain text. */
    .replace(/`/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Render inline markdown to safe HTML: `code`, **bold**, *em*, [link](url).
 *
 * Everything is escaped BEFORE any tag is introduced, so a `<script>` written
 * in content stays literal text. This is the only place content becomes HTML,
 * which keeps the escaping auditable.
 *
 * Used for the answer box and step prose, where backticks around an identifier
 * must render as code rather than showing up as literal punctuation.
 */
export function inlineHtml(s: string): string {
  const esc = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return esc
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*]+)\*(?=[\s).,;:]|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, href: string) => {
      /* Only http(s) and site-relative links. Avoids javascript: URLs. */
      const safe = /^(https?:\/\/|\/)/.test(href) ? href : '#';
      const ext = safe.startsWith('http')
        ? ' rel="nofollow noopener" target="_blank"'
        : '';
      return `<a href="${safe}"${ext}>${text}</a>`;
    });
}

/** Heading anchor id. Must be deterministic so TOC links always resolve. */
export function slugifyHeading(text: string): string {
  return stripMarkdown(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Word count for the content-length gate.
 *
 * Counts prose only. Code blocks and URLs are excluded because a page can hit
 * 1000 "words" with six code dumps and zero explanation — which is exactly the
 * thin content this gate exists to catch.
 */
export function countWords(text: string): number {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`[^`]+`/g, ' ') // inline code
    .replace(/https?:\/\/\S+/g, ' ') // bare URLs
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ');
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0 && /\p{L}|\p{N}/u.test(t));
  return tokens.length;
}

/** Word count for a whole tutorial: answer + prereqs + steps + body + faq. */
export function countTutorialWords(t: {
  answer: string;
  excerpt: string;
  prerequisites: Array<{ text: string }>;
  steps: Array<{ title: string; body: Block[]; expected: string; subSteps: Array<{ title: string; text: string }> }>;
  body: Block[];
  faq: Array<{ q: string; a: string }>;
}): number {
  const parts: string[] = [t.answer, t.excerpt];
  for (const p of t.prerequisites) parts.push(p.text);
  for (const s of t.steps) {
    parts.push(s.title, s.expected, blocksToPlainText(s.body));
    for (const sub of s.subSteps) parts.push(sub.title, sub.text);
  }
  parts.push(blocksToPlainText(t.body));
  for (const f of t.faq) parts.push(f.q, f.a);
  return countWords(parts.join(' '));
}
