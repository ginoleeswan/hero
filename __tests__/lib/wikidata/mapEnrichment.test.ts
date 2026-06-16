import {
  mapWorkRow,
  mapPersonRow,
  type WorkRow,
  type MappedTitle,
} from '../../../src/lib/wikidata/mapEnrichment';

describe('mapWorkRow', () => {
  it('classifies a TMDB movie work as a film title', () => {
    const r: WorkRow = {
      workLabel: 'The Dark Knight',
      year: '2008',
      tmdbMovie: '155',
      tmdbTv: null,
      igdb: null,
    };
    expect(mapWorkRow(r)).toEqual<MappedTitle>({
      id: 'tmdb:155',
      source: 'tmdb',
      mediaType: 'film',
      externalId: '155',
      title: 'The Dark Knight',
      year: 2008,
    });
  });

  it('classifies a TMDB TV work as a tv title', () => {
    const r: WorkRow = {
      workLabel: 'The Brave and the Bold',
      year: null,
      tmdbMovie: null,
      tmdbTv: '15804',
      igdb: null,
    };
    expect(mapWorkRow(r)?.mediaType).toBe('tv');
    expect(mapWorkRow(r)?.id).toBe('tmdb:15804');
  });

  it('classifies an IGDB slug work as a game title', () => {
    const r: WorkRow = {
      workLabel: 'Lego Batman',
      year: null,
      tmdbMovie: null,
      tmdbTv: null,
      igdb: 'lego-batman-the-videogame',
    };
    expect(mapWorkRow(r)).toMatchObject({
      id: 'igdb:lego-batman-the-videogame',
      source: 'igdb',
      mediaType: 'game',
    });
  });

  it('prefers movie over tv over game when several ids are present', () => {
    const r: WorkRow = { workLabel: 'X', year: null, tmdbMovie: '1', tmdbTv: '2', igdb: 's' };
    expect(mapWorkRow(r)?.mediaType).toBe('film');
  });

  it('parses a full publication date down to the year', () => {
    const r: WorkRow = {
      workLabel: 'X',
      year: '2008-07-18T00:00:00Z',
      tmdbMovie: '1',
      tmdbTv: null,
      igdb: null,
    };
    expect(mapWorkRow(r)?.year).toBe(2008);
  });

  it('returns null when no external id is present', () => {
    expect(
      mapWorkRow({ workLabel: 'X', year: '2000', tmdbMovie: null, tmdbTv: null, igdb: null }),
    ).toBeNull();
  });
});

describe('mapPersonRow', () => {
  it('flags voice actors vs live performers', () => {
    expect(mapPersonRow('Kevin Conroy', true)).toEqual({
      personName: 'Kevin Conroy',
      role: 'voice_actor',
    });
    expect(mapPersonRow('Michael Keaton', false)).toEqual({
      personName: 'Michael Keaton',
      role: 'performer',
    });
  });
});
