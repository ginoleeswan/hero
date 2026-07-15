import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLISHER_BRANDS } from '../../src/constants/publishers';
import {
  UNIVERSE_BRANDS,
  universeBrandForPublisher,
  universeBrandBySlug,
  universeHref,
} from '../../src/constants/universeBrands';

// universeBrands.ts is a hand-maintained, asset-free MIRROR of PUBLISHER_BRANDS
// so the RN-free crawler bundle and the sitemap script can canonicalize
// universe URLs. These guards fail CI the moment the registry drifts from the
// mirror (or the sitemap's slug list), forcing all three back into sync.

describe('UNIVERSE_BRANDS mirrors PUBLISHER_BRANDS', () => {
  it('matches slug/name/query/match exactly, in registry order', () => {
    const expected = PUBLISHER_BRANDS.map((b) => ({
      slug: b.slug,
      name: b.name,
      query: b.query,
      match: b.match,
    }));
    expect(UNIVERSE_BRANDS).toEqual(expected);
  });

  it('resolves raw publishers to the same brand the registry would', () => {
    expect(universeBrandForPublisher('Marvel Comics')?.slug).toBe('marvel');
    expect(universeBrandForPublisher('DC Comics')?.slug).toBe('dc');
    expect(universeBrandForPublisher('George Lucas')?.slug).toBe('star-wars');
    expect(universeBrandForPublisher('Totally Unknown Press')).toBeUndefined();
  });

  it('resolves slugs and produces canonical hrefs', () => {
    expect(universeBrandBySlug('dc')?.name).toBe('DC');
    expect(universeHref('Marvel Comics')).toBe('/universe/marvel');
    expect(universeHref('Some Indie Press')).toBe('/universe/Some%20Indie%20Press');
    expect(universeHref('Creator-Owned')).toBeNull();
  });
});

describe('sitemap UNIVERSE_SLUGS stays in sync with the registry', () => {
  it('lists exactly the registered brand slugs, in order', () => {
    const src = readFileSync(join(__dirname, '../../scripts/generate-sitemap.mjs'), 'utf8');
    const block = src.match(/const UNIVERSE_SLUGS = \[([\s\S]*?)\];/);
    expect(block).not.toBeNull();
    const slugs = [...block![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(slugs).toEqual(UNIVERSE_BRANDS.map((b) => b.slug));
  });
});
