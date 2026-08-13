import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { shareLink } from '../../src/lib/share';

const ROOT = resolve(__dirname, '../..');

/** The claimed paths, read out of the association document itself. */
function claimedPaths(): string[] {
  const src = readFileSync(resolve(ROOT, 'api/aasa.ts'), 'utf8');
  const block = src.match(/const PATHS = \[([\s\S]*?)\n\];/);
  if (!block) throw new Error('PATHS not found in api/aasa.ts');
  // Strip line comments first — the block explains which paths are DELIBERATELY
  // absent, and those are quoted too. Reading them as claims inverted the test.
  const code = block[1].replace(/\/\/[^\n]*/g, '');
  return [...code.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((p) => !p.startsWith('NOT '));
}

/** Does expo-router have a screen for this path? */
function hasRoute(path: string): boolean {
  // '/character/*' → the dynamic route file app/character/[id].tsx
  const segs = path.replace(/^\//, '').split('/');
  const dir = resolve(ROOT, 'app', segs[0]);
  if (segs.length === 1) {
    return (
      existsSync(`${dir}.tsx`) ||
      existsSync(resolve(dir, 'index.tsx')) ||
      existsSync(resolve(ROOT, 'app/(tabs)', `${segs[0]}.tsx`))
    );
  }
  if (!existsSync(dir)) return false;
  // A wildcard needs SOME dynamic segment file in that directory.
  const entries = require('node:fs').readdirSync(dir) as string[];
  return entries.some((e) => e.startsWith('['));
}

describe('universal links', () => {
  const claimed = claimedPaths();

  it('claims something', () => {
    expect(claimed.length).toBeGreaterThan(5);
  });

  // A claimed path with no screen behind it opens the app to a dead end —
  // strictly worse than letting Safari have it.
  it('every claimed path has a route to land on', () => {
    const orphans = claimed.filter((p) => !hasRoute(p));
    expect(orphans).toEqual([]);
  });

  // THE invariant. Every link the app sends must be one the app claims, or the
  // share loop hands its own traffic to the website — which is precisely the
  // bug this file exists to prevent.
  it('every shared link is a claimed path', () => {
    const sent = [
      shareLink.character('x'),
      shareLink.versus('a', 'b'),
      shareLink.debate('a', 'b'),
      shareLink.universe('x'),
      shareLink.house('x'),
      shareLink.event('x'),
      shareLink.title('x'),
      shareLink.daily(),
    ];
    // Escape EVERY regex metacharacter, then re-open the one wildcard the AASA
    // path syntax has. Escaping only `/` (which does not even need it inside a
    // RegExp built from a string) left `.` `+` `?` `(` matching as operators, so
    // a claimed path containing one would have quietly matched more than it
    // claims — and this test's whole job is to be strict about that.
    const patterns = claimed.map(
      (p) =>
        new RegExp('^' + p.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&').replace(/\\\*/g, '.*') + '$'),
    );
    const unmatched = sent.filter((url) => {
      const path = new URL(url).pathname;
      return !patterns.some((re) => re.test(path));
    });
    expect(unmatched).toEqual([]);
  });

  it('keeps the web-only surfaces out of the app', () => {
    const src = readFileSync(resolve(ROOT, 'api/aasa.ts'), 'utf8');
    expect(src).toContain('NOT /admin/*');
    // The marketing root and the legal pages are simply absent rather than
    // excluded — an unlisted path already falls through to Safari.
    expect(claimed).not.toContain('/');
    expect(claimed).not.toContain('/privacy');
  });
});
