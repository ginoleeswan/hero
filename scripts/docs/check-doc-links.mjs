#!/usr/bin/env node
// Docs link checker — keeps the evergreen docs layer trustworthy.
//
// Scans the evergreen docs (docs/**/*.md excluding docs/superpowers/, plus
// CLAUDE.md and README.md) and fails if:
//   1. a relative markdown link ([text](path)) doesn't resolve, or
//   2. a backticked repo path (`src/…`, `app/…`, `api/…`, `docs/…`,
//      `scripts/…`, `supabase/…`, `public/…`, `__tests__/…`) with a file
//      extension doesn't exist.
//
// That second rule is the drift tripwire: rename or delete a file that a doc
// points at and this check names the doc that needs updating.
//
// docs/superpowers/ is historical and intentionally unchecked.
// Run locally: yarn docs:links
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';

const ROOT = resolve(process.cwd());

const collectDocs = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'superpowers') continue; // historical — unchecked
      out.push(...collectDocs(full));
    } else if (entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
};

const files = [
  ...collectDocs(join(ROOT, 'docs')),
  join(ROOT, 'CLAUDE.md'),
  join(ROOT, 'README.md'),
].filter((f) => existsSync(f));

// Backticked repo paths: must start at a known top-level dir and carry an
// extension. `[id].tsx` and `(tabs)` are literal expo-router names, so [] and
// () are allowed; `[.web]` is doc shorthand for "both halves of a pair".
const CODE_PATH = /`((?:src|app|api|docs|scripts|supabase|public|assets|__tests__)\/[\w\-./[\]()]+\.[a-z]{2,4})`/g;
// Relative markdown links (skip http(s), mailto, and in-page anchors).
const MD_LINK = /\]\(((?!https?:|mailto:|#)[^)\s]+)\)/g;

const failures = [];

for (const file of files) {
  const rel = file.slice(ROOT.length + 1);
  const text = readFileSync(file, 'utf8');

  for (const [, link] of text.matchAll(MD_LINK)) {
    const target = resolve(dirname(file), link.split('#')[0]);
    if (!target.startsWith(ROOT + sep)) continue; // outside the repo — not ours
    if (!existsSync(target)) failures.push(`${rel}: broken link → ${link}`);
  }

  for (const [, raw] of text.matchAll(CODE_PATH)) {
    // `foo[.web].ts` shorthand → check both `foo.ts` and `foo.web.ts`.
    const candidates = raw.includes('[.web]')
      ? [raw.replace('[.web]', ''), raw.replace('[.web]', '.web')]
      : [raw];
    const ok = candidates.every((c) => {
      const p = join(ROOT, c);
      return existsSync(p) && statSync(p).isFile();
    });
    if (!ok) failures.push(`${rel}: missing file → ${raw}`);
  }
}

if (failures.length) {
  console.error(`Docs link check failed (${failures.length}):\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    '\nA doc points at something that does not exist. Fix the path, or if a ' +
      'file was renamed/removed, update the doc (see docs/README.md).',
  );
  process.exit(1);
}
console.log(`Docs link check passed — ${files.length} docs scanned.`);
