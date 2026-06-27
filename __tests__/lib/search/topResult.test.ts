import { pickTopResult, topResultKey } from '../../../src/lib/search/topResult';
import type { UniverseResult } from '../../../src/lib/db/universes';
import type { TeamSearchResult } from '../../../src/lib/db/teams';
import type { HeroSearchResult } from '../../../src/lib/db/heroes';
import type { TitleSearchResult } from '../../../src/lib/db/titles';

const uni = (slug: string, exact = false): UniverseResult =>
  ({ slug, name: slug, color: '#000', exact }) as UniverseResult;
const team = (id: string, name: string): TeamSearchResult =>
  ({ id, name, publisher: null, logo_url: null, member_count: 5 });
const hero = (id: string, name: string): HeroSearchResult =>
  ({
    id,
    name,
    publisher: null,
    alignment: null,
    image_md_url: null,
    image_url: null,
    portrait_url: null,
    full_name: null,
    aliases: null,
  }) as HeroSearchResult;
const title = (id: string, t: string): TitleSearchResult =>
  ({ id, title: t, media_type: 'tv', year: 2020, poster_url: null });

const empty = { universes: [], teams: [], heroes: [], titles: [] };

describe('pickTopResult', () => {
  it('returns null for an empty query or no results', () => {
    expect(pickTopResult('', empty)).toBeNull();
    expect(pickTopResult('x', empty)).toBeNull();
  });

  it('prefers an exact-match universe', () => {
    const top = pickTopResult('disney', {
      ...empty,
      universes: [uni('disney', true)],
      heroes: [hero('h1', 'Disney Hero')],
    });
    expect(top).toEqual({ kind: 'universe', universe: uni('disney', true) });
  });

  it('prefers an exact-match team over the top hero', () => {
    const top = pickTopResult('avengers', {
      ...empty,
      teams: [team('t1', 'Avengers')],
      heroes: [hero('h1', 'Avengers Member')],
    });
    expect(top?.kind).toBe('team');
  });

  it('falls to the top (fame-ranked) hero for a character query', () => {
    const top = pickTopResult('spider', {
      ...empty,
      heroes: [hero('h1', 'Spider-Man'), hero('h2', 'Spider')],
      teams: [team('t1', 'Spider Society')], // not exact
    });
    expect(top).toEqual({ kind: 'hero', hero: hero('h1', 'Spider-Man') });
  });

  it('prefers an exact title when the top hero is only a weak match', () => {
    const top = pickTopResult('the boys', {
      ...empty,
      titles: [title('tt1', 'The Boys')],
      heroes: [hero('h1', 'Theodore')], // weak: not exact/prefix of "the boys"
    });
    expect(top).toEqual({ kind: 'title', title: title('tt1', 'The Boys') });
  });

  it('keeps the strong hero even when an exact title exists', () => {
    const top = pickTopResult('watchmen', {
      ...empty,
      titles: [title('tt1', 'Watchmen')],
      heroes: [hero('h1', 'Watchmen')], // exact hero match
    });
    expect(top?.kind).toBe('hero');
  });

  it('topResultKey gives a stable per-kind id for de-duping', () => {
    expect(topResultKey({ kind: 'hero', hero: hero('h1', 'X') })).toBe('hero:h1');
    expect(topResultKey({ kind: 'universe', universe: uni('disney') })).toBe('universe:disney');
    expect(topResultKey({ kind: 'team', team: team('t1', 'A') })).toBe('team:t1');
  });
});
