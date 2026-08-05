// PostgREST has no "all columns except" syntax, so `HERO_ROW_COLUMNS` spells
// out 83 of the 84 columns on `heroes`. Left alone that rots the moment someone
// adds a column: the field would exist in the database, exist in the generated
// types, typecheck everywhere — and simply never arrive at runtime. Exactly the
// kind of silent gap this codebase keeps turning up.
//
// So the list is checked against the schema rather than trusted. The generated
// types are read as text because types themselves vanish at runtime.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  HERO_ROW_COLUMNS,
  HERO_COLUMN_OMITTED,
  HERO_ROW_SELECT,
} from '../../src/lib/db/heroes/columns';

/** Field names of the `heroes` Row type in src/types/database.generated.ts. */
function heroesRowColumns(): string[] {
  const src = readFileSync(
    join(__dirname, '..', '..', 'src', 'types', 'database.generated.ts'),
    'utf8',
  );
  const table = src.indexOf('      heroes: {');
  expect(table).toBeGreaterThan(-1);
  const rowStart = src.indexOf('Row: {', table);
  const rowEnd = src.indexOf('\n        }', rowStart);
  expect(rowStart).toBeGreaterThan(-1);
  expect(rowEnd).toBeGreaterThan(rowStart);

  return src
    .slice(rowStart, rowEnd)
    .split('\n')
    .map((l) => l.match(/^\s{10}([a-z0-9_]+)\??:/i))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => m[1]);
}

describe('HERO_ROW_COLUMNS', () => {
  const schema = heroesRowColumns();

  it('reads a plausible schema out of the generated types', () => {
    // Guard the guard: a parser that silently matched nothing would make every
    // assertion below vacuously true.
    expect(schema.length).toBeGreaterThan(50);
    expect(schema).toContain('id');
    expect(schema).toContain(HERO_COLUMN_OMITTED);
  });

  it('covers every column except the one it deliberately omits', () => {
    const expected = schema.filter((c) => c !== HERO_COLUMN_OMITTED).sort();
    // If this fails after a migration, add the new column to HERO_ROW_COLUMNS —
    // it is not reaching the app until you do.
    expect([...HERO_ROW_COLUMNS].sort()).toEqual(expected);
  });

  it('never asks for the biography HTML', () => {
    // The whole point: `description` is 45 MB across the catalogue and is
    // fetched only by the screen that renders it.
    expect(HERO_ROW_COLUMNS as readonly string[]).not.toContain('description');
    expect(HERO_ROW_SELECT).not.toMatch(/\bdescription\b/);
  });

  it('asks for the computed flag that replaced it', () => {
    expect(HERO_ROW_SELECT.endsWith(',has_description')).toBe(true);
  });

  it('has no duplicates', () => {
    expect(new Set(HERO_ROW_COLUMNS).size).toBe(HERO_ROW_COLUMNS.length);
  });
});
