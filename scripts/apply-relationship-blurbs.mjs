// Relationship-blurb batch tool. Two directions, so a migration file and the
// live table can always be reconciled against each other.
//
//   node scripts/apply-relationship-blurbs.mjs <file.sql> [--dry-run]
//     Parse a batch migration's VALUES tuples, run the local assertions, and
//     POST the rows to PostgREST. --dry-run stops after the assertions.
//
//   node scripts/apply-relationship-blurbs.mjs --dump <iso-timestamp> <out.sql>
//     Rebuild a migration file from rows already in the table, matched by their
//     updated_at. Recovers a batch that was applied without its file being
//     written, which is otherwise silent DB/repo drift.
//
// The parser is a real tokenizer rather than a regex: blurb text contains commas,
// parentheses and '' escapes, all of which defeat splitting.
import { readFile, writeFile } from 'node:fs/promises';

const COLS = ['hero_a', 'hero_b', 'blurb', 'author', 'verified', 'status', 'note', 'kind_correction'];

function parseValues(sql) {
  const start = sql.indexOf('\nvalues\n');
  if (start < 0) throw new Error('no values block');
  let i = start + '\nvalues\n'.length;
  const rows = [];
  let cur = null; // current tuple's fields
  let field = null; // accumulating literal
  let inStr = false;
  let depth = 0;

  while (i < sql.length) {
    const c = sql[i];
    if (inStr) {
      if (c === "'") {
        if (sql[i + 1] === "'") { field += "'"; i += 2; continue; }
        inStr = false; cur.push({ t: 'str', v: field }); field = null; i++; continue;
      }
      field += c; i++; continue;
    }
    // Skip `--` line comments. Section headers between tuples legitimately
    // contain apostrophes ("-- Spider-Man's people"), and without this the
    // tokenizer reads one as opening a string literal and derails.
    if (c === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }
    if (c === "'") { inStr = true; field = ''; i++; continue; }
    if (c === '(') {
      depth++;
      if (depth === 1) cur = [];
      i++; continue;
    }
    if (c === ')') {
      depth--;
      if (depth === 0) { rows.push(cur); cur = null; }
      i++; continue;
    }
    if (depth === 1 && /[a-z]/i.test(c)) {
      // bare keyword: null / false / true
      const m = /^(null|false|true)/i.exec(sql.slice(i));
      if (m) { cur.push({ t: 'kw', v: m[1].toLowerCase() }); i += m[1].length; continue; }
    }
    if (/^on conflict/i.test(sql.slice(i))) break;
    i++;
  }
  return rows;
}

function toRow(fields) {
  if (fields.length !== COLS.length) {
    throw new Error(`expected ${COLS.length} fields, got ${fields.length}: ` +
      JSON.stringify(fields.map((f) => f.v).slice(0, 3)));
  }
  const o = {};
  COLS.forEach((col, idx) => {
    const f = fields[idx];
    if (f.t === 'kw') o[col] = f.v === 'null' ? null : f.v === 'true';
    else o[col] = f.v;
  });
  return o;
}

function env() {
  return readFile('.env.local', 'utf8').then((raw) =>
    Object.fromEntries(
      raw
        .split('\n')
        .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
        .map((l) => {
          const k = l.slice(0, l.indexOf('='));
          const v = l.slice(l.indexOf('=') + 1);
          return [k.trim(), v.trim().replace(/^["']|["']$/g, '')];
        }),
    ),
  );
}

/** SQL single-quoted literal, or the bare keyword null. */
function lit(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

if (process.argv[2] === '--dump') {
  const [, , , since, out] = process.argv;
  if (!since || !out) throw new Error('usage: --dump <iso-timestamp> <out.sql>');
  const e = await env();
  // A one-second window, not eq: updated_at carries microseconds, so an exact
  // match against a second-precision timestamp finds nothing.
  const until = new Date(new Date(since).getTime() + 1000).toISOString();
  const q =
    `${e.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/hero_relationship_blurbs` +
    `?select=${COLS.join(',')}` +
    `&updated_at=gte.${encodeURIComponent(since)}&updated_at=lt.${encodeURIComponent(until)}` +
    `&order=status.asc,hero_a.asc,hero_b.asc&limit=1000`;
  const r = await fetch(q, {
    headers: { apikey: e.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!r.ok) throw new Error(`dump failed ${r.status}: ${(await r.text()).slice(0, 400)}`);
  const got = await r.json();
  if (!got.length) throw new Error(`no rows at updated_at = ${since}`);
  const tuples = got
    .map((x) => `(${COLS.map((c) => lit(x[c])).join(', ')})`)
    .join(',\n');
  const body =
    `insert into public.hero_relationship_blurbs\n  (${COLS.join(', ')})\nvalues\n${tuples}\non conflict (hero_a, hero_b) do nothing;\n`;
  await writeFile(out, body);
  console.log(`dumped ${got.length} rows -> ${out}`);
  console.log(`  written        : ${got.filter((x) => x.status === 'written').length}`);
  console.log(`  nothing_to_say : ${got.filter((x) => x.status === 'nothing_to_say').length}`);
  console.log(`  no_relationship: ${got.filter((x) => x.status === 'no_relationship').length}`);
  process.exit(0);
}

const file = process.argv[2];
const sql = await readFile(file, 'utf8');
const rows = parseValues(sql).map(toRow);

// Local assertions before anything touches the database.
const problems = [];
for (const r of rows) {
  if (!(r.hero_a < r.hero_b)) problems.push(`misordered: ${r.hero_a} / ${r.hero_b}`);
  if (r.status === 'written') {
    if (!r.blurb) problems.push(`written with no blurb: ${r.hero_a}/${r.hero_b}`);
    else {
      if (r.blurb.length < 125) problems.push(`too short (${r.blurb.length}): ${r.hero_a}/${r.hero_b}`);
      if (r.blurb.length > 320) problems.push(`over DB ceiling (${r.blurb.length}): ${r.hero_a}/${r.hero_b}`);
    }
  } else if (r.blurb !== null) {
    problems.push(`decline carrying text: ${r.hero_a}/${r.hero_b}`);
  }
  if (!['written', 'no_relationship', 'nothing_to_say'].includes(r.status)) {
    problems.push(`bad status: ${r.status}`);
  }
  if (r.kind_correction && !['family', 'enemy', 'ally', 'teammate'].includes(r.kind_correction)) {
    problems.push(`bad kind_correction: ${r.kind_correction}`);
  }
}

const written = rows.filter((r) => r.status === 'written');
const lens = written.map((r) => r.blurb.length);
console.log(`parsed rows      : ${rows.length}`);
console.log(`  written        : ${written.length}`);
console.log(`  nothing_to_say : ${rows.filter((r) => r.status === 'nothing_to_say').length}`);
console.log(`  no_relationship: ${rows.filter((r) => r.status === 'no_relationship').length}`);
console.log(`  kind corrected : ${rows.filter((r) => r.kind_correction).length}`);
console.log(`blurb length     : min ${Math.min(...lens)} / max ${Math.max(...lens)}`);
console.log(`over 220 (soft)  : ${lens.filter((l) => l > 220).length}`);
if (problems.length) {
  console.error(`\nPROBLEMS (${problems.length}):\n` + problems.join('\n'));
  process.exit(1);
}
console.log('local assertions : all pass');

if (process.argv.includes('--dry-run')) process.exit(0);

const e = await env();
const url = e.EXPO_PUBLIC_SUPABASE_URL;
const key = e.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

const res = await fetch(`${url}/rest/v1/hero_relationship_blurbs`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    // Matches the migration's `on conflict (hero_a, hero_b) do nothing`.
    Prefer: 'resolution=ignore-duplicates,return=representation',
  },
  body: JSON.stringify(rows),
});
const body = await res.text();
console.log(`\nPOST status      : ${res.status}`);
if (!res.ok) { console.error(body.slice(0, 2000)); process.exit(1); }
console.log(`rows returned    : ${JSON.parse(body).length}`);
