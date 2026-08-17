// scripts/store/check-copy.mjs — App Store copy fits Apple's fields.
//
// The limits are silent until you paste into App Store Connect and it truncates
// or refuses, which is a slow way to find out. `store/metadata.md` holds the
// copy in fenced blocks under known headings; this reads them back and counts.
//
// Counting rule: Apple counts UTF-16 code units, and the fields are plain text
// — so a soft-wrapped paragraph in the Markdown source is ONE line to Apple.
// Blocks that are prose get their newlines collapsed to spaces before counting
// (that is how they will be pasted); blocks that are genuinely multi-line
// (description, what's new) keep theirs.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const md = readFileSync(join(ROOT, 'store', 'metadata.md'), 'utf8');

/** heading fragment → [limit, collapseNewlines] */
const FIELDS = {
  'App name': [30, true],
  Subtitle: [30, true],
  Keywords: [100, true],
  'Promotional text': [170, true],
  Description: [4000, false],
  "What's New": [4000, false],
};

/** The first fenced block after a heading containing `frag`. */
function blockAfter(frag) {
  const h = md.indexOf(`## ${frag}`);
  if (h === -1) return null;
  const open = md.indexOf('```', h);
  if (open === -1) return null;
  const start = md.indexOf('\n', open) + 1;
  const close = md.indexOf('```', start);
  return close === -1 ? null : md.slice(start, close).replace(/\n$/, '');
}

let bad = 0;
for (const [frag, [limit, collapse]] of Object.entries(FIELDS)) {
  const raw = blockAfter(frag);
  if (raw === null) {
    console.error(`✗ ${frag} — no fenced block found under that heading`);
    bad++;
    continue;
  }
  const text = collapse ? raw.replace(/\s*\n\s*/g, ' ').trim() : raw;
  const n = [...text].length;
  const mark = n > limit ? '✗' : '✓';
  if (n > limit) bad++;
  console.log(`${mark} ${frag.padEnd(18)} ${String(n).padStart(4)} / ${limit}`);
}

// Keywords have their own rules worth enforcing: comma-separated, and spaces
// after commas are counted by Apple while buying nothing.
const kw = blockAfter('Keywords');
if (kw && /,\s/.test(kw)) {
  console.error('✗ Keywords — contains a space after a comma; Apple counts it');
  bad++;
}

if (bad) {
  console.error(`\n${bad} problem(s) — fix store/metadata.md before pasting.`);
  process.exit(1);
}
console.log('\nStore copy fits every field.');
