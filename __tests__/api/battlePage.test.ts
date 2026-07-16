import {
  buildBattleHtml,
  compareHref,
  sanitizeUtmQuery,
  type BattleHero,
  type BattleTally,
} from '../../api/_lib/battlePage';

const hero = (over: Partial<BattleHero> = {}): BattleHero => ({
  id: 'h_a',
  name: 'Aquaman',
  publisher: 'DC Comics',
  portrait_url: 'https://cdn.example/aquaman.jpg',
  image_url: null,
  ...over,
});

const tally: BattleTally = { votesA: 120, votesB: 80, total: 200 };

const build = (a = hero(), b = hero({ id: 'h_b', name: 'Namor', publisher: 'Marvel Comics' })) =>
  buildBattleHtml({
    a,
    b,
    tally,
    utmQuery: 'utm_source=tiktok&utm_medium=paid&utm_campaign=aqua',
    supabaseUrl: 'https://proj.supabase.co',
    supabaseKey: 'anon-key',
  });

describe('sanitizeUtmQuery', () => {
  it('keeps only utm_* params', () => {
    expect(
      sanitizeUtmQuery({
        utm_source: 'tiktok',
        utm_campaign: 'x',
        a: 'h_a',
        evil: '<script>',
      }),
    ).toBe('utm_source=tiktok&utm_campaign=x');
  });

  it('encodes values and caps length', () => {
    const q = sanitizeUtmQuery({ utm_source: 'a b&c', utm_term: 'x'.repeat(300) });
    expect(q).toContain('utm_source=a%20b%26c');
    expect(q).toContain(`utm_term=${'x'.repeat(120)}`);
  });

  it('is empty for untagged requests and ignores array params', () => {
    expect(sanitizeUtmQuery({})).toBe('');
    expect(sanitizeUtmQuery({ utm_source: ['a', 'b'] })).toBe('');
  });
});

describe('compareHref', () => {
  it('appends the utm query when present', () => {
    expect(compareHref('h_a', 'h_b', 'utm_source=t')).toBe('/compare/h_a/h_b?utm_source=t');
  });
  it('omits the ? when untagged', () => {
    expect(compareHref('h_a', 'h_b', '')).toBe('/compare/h_a/h_b');
  });
  it('encodes hero ids', () => {
    expect(compareHref('a/b', 'c', '')).toBe('/compare/a%2Fb/c');
  });
});

describe('buildBattleHtml', () => {
  it('renders both fighters with portraits and the vote CTA', () => {
    const html = build();
    expect(html).toContain('Aquaman');
    expect(html).toContain('Namor');
    expect(html).toContain('https://cdn.example/aquaman.jpg');
    expect(html).toContain('TAP TO VOTE');
  });

  it('links the CTA into /compare with the utm tags carried through', () => {
    const html = build();
    expect(html).toContain(
      'href="/compare/h_a/h_b?utm_source=tiktok&amp;utm_medium=paid&amp;utm_campaign=aqua"',
    );
  });

  it('teases the live vote total without revealing the split', () => {
    const html = build();
    expect(html).toContain('200 fans have picked a side');
  });

  it('invites the first vote when the tally is empty', () => {
    const html = buildBattleHtml({
      a: hero(),
      b: hero({ id: 'h_b', name: 'Namor' }),
      tally: { votesA: 0, votesB: 0, total: 0 },
      utmQuery: '',
      supabaseUrl: 'https://proj.supabase.co',
      supabaseKey: 'k',
    });
    expect(html).toContain('Cast the first vote');
  });

  it('escapes hostile hero names everywhere they appear', () => {
    const html = build(hero({ name: '<script>alert(1)</script>', portrait_url: null }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders an initial-letter plate when a hero has no art', () => {
    const html = build(hero({ portrait_url: null, image_url: null }));
    expect(html).toContain('class="noart"');
  });

  it('embeds the vote RPC target and voter-key handoff in the inline script', () => {
    const html = build();
    expect(html).toContain('cast_matchup_vote_v2');
    expect(html).toContain('mythique.voterKey');
    expect(html).toContain('https:\\/\\/proj.supabase.co');
  });

  it('blocks indexing (ad landing, canonical points at the real compare page)', () => {
    const html = build();
    expect(html).toContain('name="robots" content="noindex"');
    expect(html).toContain('rel="canonical" href="https://mythique.app/compare/h_a/h_b"');
  });
});
