import {
  buildCharacterBotPage,
  buildNotFoundPage,
  metaDescription,
  stripHtml,
  universePath,
  type BotHero,
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

describe('buildNotFoundPage', () => {
  it('is noindex so crawlers drop dead URLs', () => {
    expect(buildNotFoundPage()).toContain('name="robots" content="noindex"');
  });
});
