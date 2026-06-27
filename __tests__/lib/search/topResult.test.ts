import { pickTopResult, topResultKey } from '../../../src/lib/search/topResult';
import type { UniverseResult } from '../../../src/lib/db/universes';
import type { TeamSearchResult } from '../../../src/lib/db/teams';
import type { HeroSearchResult } from '../../../src/lib/db/heroes';
import type { TitleSearchResult } from '../../../src/lib/db/titles';

const uni = (slug: string, exact = false): UniverseResult =>
  ({ slug, name: slug, color: '#000', exact }) as UniverseResult;
const team = (id: string, name: string): TeamSearchResult =>
  ({ id, name, publisher: null, logo_url: null, member_count: 5 });
const hero = (id: string, name: string, fame_score = 100): HeroSearchResult =>
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
    fame_score,
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

  it('features a famous prefix-match hero (bat → Batman)', () => {
    const top = pickTopResult('bat', {
      ...empty,
      heroes: [hero('h1', 'Batman', 100), hero('h2', 'Batwoman', 40)],
    });
    expect(top).toEqual({ kind: 'hero', hero: hero('h1', 'Batman', 100) });
  });

  it('does NOT feature an obscure prefix-match hero (end → no top result)', () => {
    const top = pickTopResult('end', {
      ...empty,
      heroes: [hero('h1', 'Endless Winter', 4), hero('h2', 'Endgame', 2)],
    });
    expect(top).toBeNull();
  });

  it('features an exact-name hero regardless of fame', () => {
    const top = pickTopResult('endgame', {
      ...empty,
      heroes: [hero('h1', 'Endgame', 2)],
    });
    expect(top?.kind).toBe('hero');
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
