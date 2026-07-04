import {
  buildMetaHtml,
  characterMeta,
  escapeHtml,
  siteMeta,
  vsMeta,
  vsShareLine,
} from '../../api/_lib/shareMeta';

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
});
