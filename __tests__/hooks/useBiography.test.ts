// Parsing tests for the shared biography brain. The two screens are thin views
// over this, so the HTML transforms are the part worth pinning: they run on
// arbitrary ComicVine markup and used to be duplicated per platform.
import {
  splitLead,
  flattenTables,
  resolveBioLink,
  splitSections,
} from '../../src/hooks/useBiography';

jest.mock('../../src/lib/db/heroes', () => ({
  getHeroByComicvineId: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getHeroByComicvineId } = require('../../src/lib/db/heroes') as {
  getHeroByComicvineId: jest.Mock;
};

describe('splitLead', () => {
  it('lifts the first letter off the opening paragraph', () => {
    const { cap, rest, body } = splitLead('<p>Bruce Wayne is Batman.</p><p>More.</p>');
    expect(cap).toBe('B');
    expect(rest).toBe('ruce Wayne is Batman.');
    expect(body).toBe('<p>More.</p>');
  });

  it('keeps inline markup inside the lead remainder', () => {
    const { cap, rest } = splitLead('<p>After <b>the</b> fall.</p>');
    expect(cap).toBe('A');
    expect(rest).toBe('fter <b>the</b> fall.');
  });

  it('declines when the document opens with a tag', () => {
    // An opening <img> or <em> has no bare letter to enlarge — hoisting one
    // would pull markup into the cap slot.
    const html = '<p><em>Editor’s note.</em></p><p>Body.</p>';
    expect(splitLead(html)).toEqual({ cap: '', rest: '', body: html });
  });

  it('declines when the document opens with a heading', () => {
    const html = '<h2>Origin</h2><p>Body.</p>';
    expect(splitLead(html)).toEqual({ cap: '', rest: '', body: html });
  });

  it('declines on a leading entity or punctuation', () => {
    const html = '<p>“I am vengeance.”</p>';
    expect(splitLead(html).cap).toBe('');
  });

  it('leaves the whole document as body when it declines', () => {
    // The views render `body` unconditionally, so a decline must not drop copy.
    const html = '<h2>Origin</h2><p>Body.</p>';
    expect(splitLead(html).body).toBe(html);
  });
});

describe('flattenTables', () => {
  it('keeps every row as a list item instead of dropping the table', () => {
    // Native used to bin <table> wholesale via ignoredDomTags, silently losing
    // the power/appearance grids ComicVine writes as tables.
    const html =
      '<table><tr><td>Strength</td><td>Class 100</td></tr>' +
      '<tr><td>Speed</td><td>Mach 3</td></tr></table>';
    expect(flattenTables(html)).toBe(
      '<ul><li><b>Strength</b> — Class 100</li><li><b>Speed</b> — Mach 3</li></ul>',
    );
  });

  it('joins three-plus cells and strips inner markup', () => {
    const html =
      '<table><tr><th>Debut</th><td><a href="/x">Detective</a></td><td>1939</td></tr></table>';
    expect(flattenTables(html)).toBe('<ul><li><b>Debut</b> — Detective · 1939</li></ul>');
  });

  it('emits a bare item for a single-cell row', () => {
    expect(flattenTables('<table><tr><td>Solo</td></tr></table>')).toBe(
      '<ul><li><b>Solo</b></li></ul>',
    );
  });

  it('drops an empty table rather than leaving an empty list', () => {
    expect(flattenTables('<table></table>')).toBe('');
    expect(flattenTables('<table><tr></tr></table>')).toBe('');
  });

  it('leaves non-table markup untouched', () => {
    const html = '<p>Plain.</p>';
    expect(flattenTables(html)).toBe(html);
  });
});

describe('resolveBioLink', () => {
  beforeEach(() => getHeroByComicvineId.mockReset());

  it('routes a ComicVine character link to the hero we have', async () => {
    getHeroByComicvineId.mockResolvedValue({ id: 'hero-7' });
    await expect(resolveBioLink('/batman/slug/4005-1699/')).resolves.toEqual({
      kind: 'hero',
      heroId: 'hero-7',
    });
  });

  it('falls out to ComicVine when we do not have the character', async () => {
    getHeroByComicvineId.mockResolvedValue(null);
    await expect(resolveBioLink('/batman/slug/4005-1699/')).resolves.toEqual({
      kind: 'external',
      url: 'https://comicvine.gamespot.com/batman/slug/4005-1699/',
    });
  });

  it('falls out to ComicVine when the lookup throws', async () => {
    // A failed lookup must not dead-end the link.
    getHeroByComicvineId.mockRejectedValue(new Error('offline'));
    await expect(resolveBioLink('/batman/slug/4005-1699/')).resolves.toEqual({
      kind: 'external',
      url: 'https://comicvine.gamespot.com/batman/slug/4005-1699/',
    });
  });

  it('absolutises other relative ComicVine links', async () => {
    await expect(resolveBioLink('/slug/4060-42/')).resolves.toEqual({
      kind: 'external',
      url: 'https://comicvine.gamespot.com/slug/4060-42/',
    });
    expect(getHeroByComicvineId).not.toHaveBeenCalled();
  });

  it('passes absolute urls through', async () => {
    await expect(resolveBioLink('https://example.com/x')).resolves.toEqual({
      kind: 'external',
      url: 'https://example.com/x',
    });
  });

  it('ignores anchors and anything else', async () => {
    await expect(resolveBioLink('#origin')).resolves.toEqual({ kind: 'ignore' });
  });
});

describe('splitSections', () => {
  const H = (n: string) => `<h2 id="bio-s${n}">Section ${n}</h2>`;

  it('cuts one chunk per heading', () => {
    const html = `${H('0')}<p>a</p>${H('1')}<p>b</p>${H('2')}<p>c</p>`;
    const out = splitSections(html);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe(`${H('0')}<p>a</p>`);
    expect(out[2]).toBe(`${H('2')}<p>c</p>`);
  });

  it('keeps prose before the first heading as its own chunk', () => {
    // Otherwise the opening paragraphs of a document that starts with prose
    // would be silently dropped from the render.
    const out = splitSections(`<p>intro</p>${H('0')}<p>a</p>`);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe('<p>intro</p>');
    expect(out[1]).toBe(`${H('0')}<p>a</p>`);
  });

  it('returns the whole document when it has no headings', () => {
    expect(splitSections('<p>just prose</p>')).toEqual(['<p>just prose</p>']);
  });

  it('returns nothing for an empty document', () => {
    expect(splitSections('')).toEqual([]);
  });

  it('loses no content — the chunks rejoin to the original', () => {
    // The whole point is a pure re-slicing. Anything else would mean the
    // progressive mount silently changes what the reader sees.
    const html = `<p>intro</p>${H('0')}<p>a</p><img src="x.jpg">${H('1')}<ul><li>b</li></ul>`;
    expect(splitSections(html).join('')).toBe(html);
  });

  it('handles headings with attributes and mixed case', () => {
    const html = `<H2 class="x">One</H2><p>a</p><h2>Two</h2><p>b</p>`;
    expect(splitSections(html)).toHaveLength(2);
  });
});
