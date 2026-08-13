import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMICVINE_CREDIT, TMDB_CREDIT } from '../../../src/components/legal/Attribution';

const ROOT = join(__dirname, '../../..');

describe('TMDB attribution', () => {
  // TMDB's API terms require this acknowledgement in these words. The clause
  // that matters is "not endorsed or certified by TMDB" — the whole point is
  // that a reader must not think TMDB vouched for this app. A tidier rewrite
  // would be a licence breach, so the string is pinned rather than trusted.
  it('carries the exact required wording', () => {
    expect(TMDB_CREDIT).toBe(
      'This product uses the TMDB API but is not endorsed or certified by TMDB.',
    );
  });

  it('credits Comic Vine too', () => {
    expect(COMICVINE_CREDIT).toContain('Comic Vine');
  });

  // A credit nothing renders is not a credit. These are the surfaces a reader
  // can actually reach: settings on both platforms, and the page the TMDB data
  // is actually on.
  it.each([
    ['app/settings.tsx', 'Attribution'],
    ['app/settings.web.tsx', 'Attribution'],
    ['app/title/[id].tsx', 'TmdbCreditLine'],
  ])('is rendered by %s', (file, symbol) => {
    const src = readFileSync(join(ROOT, file), 'utf8');
    expect(src).toContain(`<${symbol}`);
    expect(src).toContain("components/legal/Attribution'");
  });
});
