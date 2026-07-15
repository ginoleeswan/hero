import {
  buildCategoryBotPage,
  buildCharacterBotPage,
  buildFranchiseBotPage,
  buildNotFoundPage,
  buildTeamBotPage,
  buildTitleBotPage,
  buildUniverseBotPage,
  buildVsBotPage,
  CATEGORY_SEO,
  entitySameAs,
  metaDescription,
  stripHtml,
  universePath,
  type BotHero,
  type BotTitle,
  type RelatedLite,
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
  wikidata_qid: 'Q79015',
  enwiki_title: 'Superman',
  ...overrides,
});

describe('stripHtml', () => {
  it('flattens ComicVine HTML to plain text', () => {
    expect(stripHtml('<p>The <b>Last</b>&nbsp;Son.</p>')).toBe('The Last Son.');
  });
});

describe('universePath', () => {
  it('links registered universes by their canonical slug (not raw name)', () => {
    // "DC Comics" resolves to the dc brand → /universe/dc, matching the app and
    // sitemap so the two URL forms never compete as duplicate content.
    expect(universePath('DC Comics')).toBe('/universe/dc');
    expect(universePath('Marvel Comics')).toBe('/universe/marvel');
  });
  it('links unregistered universes by encoded raw name', () => {
    expect(universePath('Some Indie Press')).toBe('/universe/Some%20Indie%20Press');
  });
  it('never links category buckets', () => {
    expect(universePath('Creator-Owned')).toBeNull();
    expect(universePath(null)).toBeNull();
  });
});

describe('entitySameAs', () => {
  it('builds Wikidata + Wikipedia URLs, encoding the article title', () => {
    expect(entitySameAs({ wikidata_qid: 'Q2', enwiki_title: 'Iron Man' })).toEqual([
      'https://www.wikidata.org/wiki/Q2',
      'https://en.wikipedia.org/wiki/Iron_Man',
    ]);
  });
  it('ignores a malformed QID and missing title', () => {
    expect(entitySameAs({ wikidata_qid: 'not-a-qid', enwiki_title: null })).toEqual([]);
    expect(entitySameAs({ wikidata_qid: null, enwiki_title: '  ' })).toEqual([]);
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

  it('links the character to its Knowledge-Graph entity via sameAs', () => {
    expect(html).toContain(
      '"sameAs":["https://www.wikidata.org/wiki/Q79015","https://en.wikipedia.org/wiki/Superman"]',
    );
  });

  it('omits sameAs entirely when no entity anchors exist', () => {
    const orphan = buildCharacterBotPage(hero({ wikidata_qid: null, enwiki_title: null }), {
      allies: [],
      enemies: [],
      teammates: [],
    });
    expect(orphan).not.toContain('sameAs');
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
    expect(html).toContain('href="/universe/dc"');
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
    expect(html).toContain(
      '<title>The Matrix (1999) — Characters &amp; Details | Mythique</title>',
    );
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
    expect(html).toContain('href="/universe/dc"');
  });
});

describe('buildVsBotPage', () => {
  const a = hero();
  const b = hero({ id: 'h_9', name: 'Doomsday', strength: 100, intelligence: 40 });
  const html = buildVsBotPage(
    a,
    b,
    { votesA: 3, votesB: 1 },
    {
      forA: [
        { id: 'h_9', name: 'Doomsday' },
        { id: 'h_3', name: 'Lex Luthor' },
      ],
      forB: [
        { id: 'h_1', name: 'Superman' },
        { id: 'h_10', name: 'Darkseid' },
      ],
    },
  );

  it('canonicalizes to sorted-id order regardless of request order', () => {
    expect(html).toContain('rel="canonical" href="https://mythique.app/compare/h_1/h_9"');
    const flipped = buildVsBotPage(b, a, { votesA: 1, votesB: 3 }, { forA: [], forB: [] });
    expect(flipped).toContain('rel="canonical" href="https://mythique.app/compare/h_1/h_9"');
  });

  it('renders the tally and stat comparison', () => {
    expect(html).toContain('Community votes: Superman 3 — 1 Doomsday.');
    expect(html).toContain('<th>Superman</th><th>Doomsday</th>');
  });

  it('emits FAQPage JSON-LD targeting the "who would win" query', () => {
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const ld = JSON.parse(m![1]);
    const faq = ld['@graph'].find((n: { '@type': string }) => n['@type'] === 'FAQPage');
    expect(faq).toBeDefined();
    expect(faq.mainEntity[0].name).toBe('Who would win in a fight, Superman or Doomsday?');
    // 3–1 tally → Superman favoured at 75% of 4 votes.
    expect(faq.mainEntity[0].acceptedAnswer.text).toContain('favours Superman, with 75% of 4');
  });

  it('gives an open-debate FAQ answer when there are no votes', () => {
    const noVotes = buildVsBotPage(a, b, { votesA: 0, votesB: 0 }, { forA: [], forB: [] });
    const ld = JSON.parse(
      noVotes.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1],
    );
    const faq = ld['@graph'].find((n: { '@type': string }) => n['@type'] === 'FAQPage');
    expect(faq.mainEntity[0].acceptedAnswer.text).toContain('open debate');
  });

  it('marks up total community votes as an InteractionCounter', () => {
    const ld = JSON.parse(
      html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1],
    );
    const page = ld['@graph'].find((n: { '@type': string }) => n['@type'] === 'WebPage');
    expect(page.interactionStatistic).toMatchObject({
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/VoteAction',
      userInteractionCount: 4, // 3 + 1
    });
  });

  it('omits the InteractionCounter when there are no votes', () => {
    const noVotes = buildVsBotPage(a, b, { votesA: 0, votesB: 0 }, { forA: [], forB: [] });
    expect(noVotes).not.toContain('InteractionCounter');
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

const roster = (): RelatedLite[] => [
  { id: 'h_1', name: 'Superman' },
  { id: 'h_2', name: 'Batman' },
  { id: 'h_3', name: 'Wonder Woman' },
];

describe('buildCategoryBotPage', () => {
  const html = buildCategoryBotPage('strongest', roster());

  it('renders the keyword-targeted title and H1 from CATEGORY_SEO', () => {
    // buildDoc HTML-escapes the title, so the ampersand becomes &amp;.
    expect(html).toContain(
      `<title>${CATEGORY_SEO.strongest.label} — Powers, Stats &amp; Rankings | Mythique</title>`,
    );
    expect(html).toContain(`<h1>${CATEGORY_SEO.strongest.label}</h1>`);
  });

  it('canonicalizes to the category path', () => {
    expect(html).toContain('rel="canonical" href="https://mythique.app/category/strongest"');
  });

  it('links every character in an ordered list', () => {
    expect(html).toContain('<ol><li><a href="/character/h_1">Superman</a></li>');
    expect(html).toContain('href="/character/h_3"');
  });

  it('emits CollectionPage + ItemList JSON-LD', () => {
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).toContain('"@type":"ItemList"');
    expect(html).toContain('"numberOfItems":3');
  });

  it('cross-links sibling hubs but not itself', () => {
    expect(html).toContain('href="/category/marvel"');
    expect(html).not.toContain('href="/category/strongest"');
  });
});

describe('buildUniverseBotPage', () => {
  // Registered brand: display name "Marvel", canonical slug "marvel".
  const html = buildUniverseBotPage('Marvel', 'marvel', roster());

  it('canonicalizes to the brand slug', () => {
    expect(html).toContain('rel="canonical" href="https://mythique.app/universe/marvel"');
  });

  it('puts the universe name in the title and heading', () => {
    expect(html).toContain('Marvel Characters — Heroes, Villains &amp; Power Stats | Mythique');
    expect(html).toContain('<h1>Marvel Characters</h1>');
  });

  it('links the roster into the character graph', () => {
    expect(html).toContain('href="/character/h_2"');
    expect(html).toContain('"@type":"CollectionPage"');
  });

  it('encodes an unregistered raw-name slug in the canonical', () => {
    const raw = buildUniverseBotPage('Some Indie Press', 'Some Indie Press', roster());
    expect(raw).toContain(
      'rel="canonical" href="https://mythique.app/universe/Some%20Indie%20Press"',
    );
  });
});

describe('buildFranchiseBotPage', () => {
  const html = buildFranchiseBotPage('Star Wars', roster());

  it('canonicalizes to the encoded franchise name under /franchise', () => {
    expect(html).toContain('rel="canonical" href="https://mythique.app/franchise/Star%20Wars"');
  });

  it('puts the franchise name in the title, heading and CollectionPage LD', () => {
    expect(html).toContain('Star Wars Characters — Full List, Powers &amp; Stats | Mythique');
    expect(html).toContain('<h1>Star Wars Characters</h1>');
    expect(html).toContain('"@type":"CollectionPage"');
  });

  it('links the roster into the character graph', () => {
    expect(html).toContain('href="/character/h_1"');
  });
});
