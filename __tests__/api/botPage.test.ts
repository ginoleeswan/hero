import {
  buildCharacterBotPage,
  buildNotFoundPage,
  buildTeamBotPage,
  buildTitleBotPage,
  buildVsBotPage,
  metaDescription,
  stripHtml,
  universePath,
  type BotHero,
  type BotTitle,
} from '../../api/_lib/botPage';

const hero = (overrides: Partial<BotHero> = {}): BotHero => ({
  id: 'h_1',
  name: 'Superman',
  full_name: 'Clark Kent',
  aliases: ['Man of Steel'],
  alignment: 'good',
  publisher: 'DC Comics',
  franchise: null,
  description: '<p>The <b>Last Son</b> of Krypton.</p>',
  summary: null,
  first_appearance: 'Action Comics #1',
  occupation: 'Reporter',
  place_of_birth: 'Krypton',
  race: 'Kryptonian',
  gender: 'Male',
  height_metric: '191 cm',
  weight_metric: '107 kg',
  base: 'Metropolis',
  creators: ['Jerry Siegel', 'Joe Shuster'],
  teams: ['Justice League'],
  powers: ['Flight', 'Super strength'],
  intelligence: 94,
  strength: 100,
  speed: 100,
  durability: 100,
  power: 100,
  combat: 85,
  portrait_url: 'https://img.example/superman.jpg',
  image_url: null,
  ...overrides,
});

describe('stripHtml', () => {
  it('flattens ComicVine HTML to plain text', () => {
    expect(stripHtml('<p>The <b>Last</b>&nbsp;Son.</p>')).toBe('The Last Son.');
  });
});

describe('universePath', () => {
  it('links real universes by raw name', () => {
    expect(universePath('DC Comics')).toBe('/universe/DC%20Comics');
  });
  it('never links category buckets', () => {
    expect(universePath('Creator-Owned')).toBeNull();
    expect(universePath(null)).toBeNull();
  });
});

describe('metaDescription', () => {
  it('prefers the stripped description', () => {
    expect(metaDescription(hero())).toBe('The Last Son of Krypton.');
  });
  it('falls back to boilerplate when no prose exists', () => {
    expect(metaDescription(hero({ description: null, summary: null }))).toContain(
      'Powers, stats, allies, enemies',
    );
  });
  it('truncates long descriptions', () => {
    const long = metaDescription(hero({ description: 'x'.repeat(500) }));
    expect(long.length).toBeLessThanOrEqual(300);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('buildCharacterBotPage', () => {
  const html = buildCharacterBotPage(hero(), {
    allies: [{ id: 'h_2', name: 'Batman' }],
    enemies: [{ id: 'h_3', name: 'Lex Luthor' }],
    teammates: [{ id: 'h_4', name: 'Wonder Woman' }],
  });

  it('emits head meta, canonical and OG', () => {
    expect(html).toContain(
      '<title>Superman — Powers, Stats, Allies &amp; Enemies | Mythique</title>',
    );
    expect(html).toContain('rel="canonical" href="https://mythique.app/character/h_1"');
    expect(html).toContain('og:image');
    expect(html).toContain('/api/og?hero=h_1');
  });

  it('does NOT meta-refresh — search engines must index this URL', () => {
    expect(html).not.toContain('http-equiv="refresh"');
  });

  it('emits ProfilePage JSON-LD with the hero as main entity', () => {
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"ProfilePage"');
    expect(html).toContain('"name":"Superman"');
    expect(html).toContain('"alternateName":["Clark Kent","Man of Steel"]');
  });

  it('renders profile facts and power stats', () => {
    expect(html).toContain('Action Comics #1');
    expect(html).toContain('Jerry Siegel, Joe Shuster');
    expect(html).toContain('<td>100/100</td>');
  });

  it('links the relationship graph and versus matchups', () => {
    expect(html).toContain('href="/character/h_2"');
    expect(html).toContain('href="/character/h_3"');
    expect(html).toContain('href="/character/h_4"');
    expect(html).toContain('href="/compare/h_1/h_3"');
    expect(html).toContain('Superman vs Lex Luthor — who wins?');
    expect(html).toContain('href="/universe/DC%20Comics"');
  });

  it('escapes hero-controlled fields everywhere, including JSON-LD', () => {
    const evil = buildCharacterBotPage(
      hero({ name: '</script><script>alert(1)</script>', description: '<img onerror=x>' }),
      { allies: [], enemies: [], teammates: [] },
    );
    expect(evil).not.toContain('<script>alert(1)</script>');
  });

  it('omits empty sections instead of rendering headers for nothing', () => {
    const bare = buildCharacterBotPage(
      hero({ powers: null, teams: null, description: null, summary: null }),
      { allies: [], enemies: [], teammates: [] },
    );
    expect(bare).not.toContain('<h2>Powers</h2>');
    expect(bare).not.toContain('<h2>Allies</h2>');
    expect(bare).not.toContain('<h2>Matchups</h2>');
  });
});

describe('buildTitleBotPage', () => {
  const title: BotTitle = {
    id: 'tmdb:603',
    title: 'The Matrix',
    media_type: 'movie',
    year: 1999,
    release_date: '1999-03-31',
    runtime: 136,
    vote_average: 8.2,
    overview: 'A hacker learns the truth.',
    poster_url: 'https://img.example/matrix.jpg',
  };
  const html = buildTitleBotPage(title, [{ id: 'h_neo', name: 'Neo' }]);

  it('emits Movie JSON-LD, canonical and facts', () => {
    expect(html).toContain('"@type":"Movie"');
    expect(html).toContain('rel="canonical" href="https://mythique.app/title/tmdb%3A603"');
    expect(html).toContain('<title>The Matrix (1999) — Characters &amp; Details | Mythique</title>');
    expect(html).toContain('136 min');
  });

  it('links appearing characters', () => {
    expect(html).toContain('href="/character/h_neo"');
  });

  it('uses TVSeries for tv media', () => {
    expect(buildTitleBotPage({ ...title, media_type: 'tv' }, [])).toContain('"@type":"TVSeries"');
  });
});

describe('buildTeamBotPage', () => {
  const html = buildTeamBotPage(
    { id: 't_1', name: 'Justice League', publisher: 'DC Comics', member_count: 12 },
    [{ id: 'h_1', name: 'Superman' }],
  );

  it('emits canonical, roster links and member ItemList', () => {
    expect(html).toContain('rel="canonical" href="https://mythique.app/team/t_1"');
    expect(html).toContain('<title>Justice League — Members &amp; Roster | Mythique</title>');
    expect(html).toContain('href="/character/h_1"');
    expect(html).toContain('"@type":"ItemList"');
    expect(html).toContain('href="/universe/DC%20Comics"');
  });
});

describe('buildVsBotPage', () => {
  const a = hero();
  const b = hero({ id: 'h_9', name: 'Doomsday', strength: 100, intelligence: 40 });
  const html = buildVsBotPage(a, b, { votesA: 3, votesB: 1 }, {
    forA: [{ id: 'h_9', name: 'Doomsday' }, { id: 'h_3', name: 'Lex Luthor' }],
    forB: [{ id: 'h_1', name: 'Superman' }, { id: 'h_10', name: 'Darkseid' }],
  });

  it('canonicalizes to sorted-id order regardless of request order', () => {
    expect(html).toContain('rel="canonical" href="https://mythique.app/compare/h_1/h_9"');
    const flipped = buildVsBotPage(b, a, { votesA: 1, votesB: 3 }, { forA: [], forB: [] });
    expect(flipped).toContain('rel="canonical" href="https://mythique.app/compare/h_1/h_9"');
  });

  it('renders the tally and stat comparison', () => {
    expect(html).toContain('Community votes: Superman 3 — 1 Doomsday.');
    expect(html).toContain('<th>Superman</th><th>Doomsday</th>');
  });

  it('links both fighters and onward matchups, skipping the current pair', () => {
    expect(html).toContain('href="/character/h_1"');
    expect(html).toContain('href="/character/h_9"');
    expect(html).toContain('href="/compare/h_1/h_3"');
    expect(html).toContain('href="/compare/h_9/h_10"');
    expect(html).not.toContain('Superman vs Doomsday — who wins?');
  });
});

describe('buildNotFoundPage', () => {
  it('is noindex so crawlers drop dead URLs', () => {
    expect(buildNotFoundPage()).toContain('name="robots" content="noindex"');
  });
});
