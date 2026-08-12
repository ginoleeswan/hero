import {
  buildMetaHtml,
  characterMeta,
  debateMeta,
  eventMeta,
  houseMeta,
  houseBareName,
  titleMeta,
  escapeHtml,
  siteMeta,
  vsMeta,
  vsShareLine,
} from '../../api/_lib/shareMeta';
import { nativeShare, shareLink } from '../../src/lib/share';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<b>"Lobo" & 'Bane'</b>`)).toBe(
      '&lt;b&gt;&quot;Lobo&quot; &amp; &#39;Bane&#39;&lt;/b&gt;',
    );
  });
});

describe('buildMetaHtml', () => {
  const html = buildMetaHtml(characterMeta({ id: 'h_1', name: 'Superman', publisher: 'DC' }));

  it('emits the full OG/Twitter set and canonical', () => {
    expect(html).toContain('og:title" content="Superman — Mythique"');
    expect(html).toContain('property="og:image" content="');
    expect(html).toContain('/api/og?hero=h_1');
    expect(html).toContain('twitter:card" content="summary_large_image"');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('/character/h_1');
  });

  it('redirects humans to the real page', () => {
    expect(html).toContain('http-equiv="refresh"');
  });

  it('escapes hero-controlled fields', () => {
    const evil = buildMetaHtml(
      characterMeta({ id: 'x', name: '"><script>alert(1)</script>', publisher: null }),
    );
    expect(evil).not.toContain('<script>');
  });
});

describe('vsShareLine', () => {
  it('leads with the winning side percentage', () => {
    expect(vsShareLine('Goku', 'Superman', 78, 22)).toBe('Goku vs Superman — 78% say Goku. You?');
    expect(vsShareLine('Goku', 'Superman', 1, 3)).toBe('Goku vs Superman — 75% say Superman. You?');
  });

  it('falls back with zero votes', () => {
    expect(vsShareLine('Goku', 'Superman', 0, 0)).toContain('who wins?');
  });
});

describe('vsMeta / siteMeta', () => {
  it('vs image URL carries both hero ids', () => {
    const m = vsMeta(
      { id: 'a1', name: 'A', publisher: null },
      { id: 'b2', name: 'B', publisher: null },
      0,
      0,
    );
    expect(m.image).toContain('a=a1');
    expect(m.image).toContain('b=b2');
    expect(m.path).toBe('/compare/a1/b2');
  });

  it('site fallback uses the static card', () => {
    expect(siteMeta().image).toMatch(/\/og\.png$/);
  });

  // The debate card was unreachable in production for its whole life — nothing
  // emitted type=debate but the admin preview. Assert the meta that now does.
  it('debate meta asks for the debate card, on the same page as vs', () => {
    const m = debateMeta(
      { id: 'a1', name: 'A', publisher: null },
      { id: 'b2', name: 'B', publisher: null },
      3,
      1,
    );
    expect(m.image).toContain('type=debate');
    expect(m.image).toContain('a=a1');
    expect(m.image).toContain('b=b2');
    expect(m.path).toBe('/compare/a1/b2');
  });
});

describe('shareLink', () => {
  it('every link is absolute and crawler-resolvable', () => {
    expect(shareLink.character('h_1')).toBe('https://mythique.app/character/h_1');
    expect(shareLink.versus('a', 'b')).toBe('https://mythique.app/compare/a/b');
    expect(shareLink.universe('h_1')).toBe('https://mythique.app/social-web/h_1');
    expect(shareLink.daily()).toBe('https://mythique.app/play');
  });

  // The marker the crawler rewrite keys on. Drop it and the daily share
  // silently falls back to the plain vs card.
  it('the debate link carries the debate marker', () => {
    expect(shareLink.debate('a', 'b')).toBe('https://mythique.app/compare/a/b?debate=1');
  });

  it('ids are encoded, so a slug with a slash cannot forge a path', () => {
    expect(shareLink.character('a/b')).toBe('https://mythique.app/character/a%2Fb');
  });
});

describe('nativeShare', () => {
  // Android has no `url` field; passing one drops the link silently, which is
  // half of why the app's shares were linkless.
  it('appends the url to the message off iOS', () => {
    expect(nativeShare('hello', 'https://x.test', false)).toEqual({
      message: 'hello\nhttps://x.test',
    });
  });

  it('keeps them separate on iOS, so Messages can unfurl', () => {
    expect(nativeShare('hello', 'https://x.test', true)).toEqual({
      message: 'hello',
      url: 'https://x.test',
    });
  });
});

// CodeQL caught this on the PR that added the slug-bearing builders, and it was
// right: `url` went into `href="..."` unescaped. Character/vs paths carry
// opaque generated ids, but a house or event slug is human-readable catalogue
// text — one containing a quote closes the attribute and injects markup into
// the page every link-preview crawler is handed.
describe('buildMetaHtml escaping', () => {
  it('a quote in the path cannot break out of href', () => {
    const html = buildMetaHtml({
      title: 'T',
      description: 'D',
      path: '/house/x"><script>alert(1)</script>',
      image: 'https://mythique.app/og.png',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;');
  });

  it('the slug-bearing builders percent-encode their segments too', () => {
    expect(houseMeta({ slug: 'a"b', name: 'A', universe: null, memberCount: 1 }).path).toBe(
      '/house/a%22b',
    );
    expect(eventMeta({ slug: 'a b', headline: 'H', blurb: null, ongoing: false }).path).toBe(
      '/event/a%20b',
    );
    expect(titleMeta({ id: 'a/b', title: 'T', year: null, mediaType: null }).path).toBe(
      '/title/a%2Fb',
    );
  });
});

// Houses are stored as "House Targaryen", so prepending the word produced
// "House House Targaryen" in the unfurl title — caught by probing production.
describe('house naming', () => {
  it('does not double the word House', () => {
    const m = houseMeta({
      slug: 'targaryen',
      name: 'House Targaryen',
      universe: 'GoT',
      memberCount: 9,
    });
    expect(m.title).toBe('House Targaryen — Mythique');
    expect(m.title).not.toContain('House House');
    expect(m.description).not.toContain('House House');
  });

  it('strips the prefix for surfaces that supply their own "House"', () => {
    expect(houseBareName('House Targaryen')).toBe('Targaryen');
    expect(houseBareName('house stark')).toBe('stark');
    expect(houseBareName('Wayne Family')).toBe('Wayne Family');
  });
});
