// src/hooks/useBiography.ts — the one biography brain, shared by
// app/biography/[id].tsx and its .web twin.
//
// Both views were carrying their own copy of preprocessHtml and their own
// ComicVine link-interception branch, which is exactly the duplication the
// screen-pair convention exists to prevent (CLAUDE.md → "Platform-specific
// files"). Everything here is platform-neutral: HTML cleanup, heading
// extraction for the contents rail, the lead-paragraph split that the drop cap
// needs, and link *resolution*. Only the acting-on-a-link part stays in the
// views, because opening a URL is `Linking.openURL` on native and `window.open`
// on web.
import { useHeroRow } from '../lib/query/heroQueries';
import { getHeroByComicvineId } from '../lib/db/heroes';

/**
 * ComicVine biography HTML ships with lazy-load placeholders and <noscript>
 * fallbacks that render as broken/blank images. Swap the real source in and
 * strip the cruft so images actually paint.
 */
function preprocessHtml(html: string): string {
  return (
    html
      // <noscript> holds a duplicate real <img> that renders via innerHTML.
      .replace(/<noscript>[\s\S]*?<\/noscript>/gi, '')
      // Lazy-load placeholder src → the real data-src.
      .replace(/\ssrc="data:image\/gif;base64,[^"]*"/gi, '')
      .replace(/\sdata-src="/gi, ' src="')
      .replace(/\sdata-srcset="/gi, ' srcset="')
      // Hard-coded sizes fight the browser's srcset pick.
      .replace(/\ssizes="[^"]*"/gi, '')
  );
}

/**
 * Tables → lists. `react-native-render-html` has no table support without the
 * (uninstalled) plugin, so native used to drop `<table>` wholesale via
 * ignoredDomTags — silently losing real content, since ComicVine uses tables
 * for power/appearance grids. Flattening each row into a list item keeps the
 * information and renders identically well on both platforms.
 */
export function flattenTables(html: string): string {
  return html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, body: string) => {
    const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    if (!rows.length) return '';
    const items = rows
      .map((r) => {
        const cells = [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
          .map((c) => c[1].replace(/<[^>]+>/g, '').trim())
          .filter(Boolean);
        if (!cells.length) return '';
        const [head, ...rest] = cells;
        return rest.length
          ? `<li><b>${head}</b> — ${rest.join(' · ')}</li>`
          : `<li><b>${head}</b></li>`;
      })
      .filter(Boolean)
      .join('');
    return items ? `<ul>${items}</ul>` : '';
  });
}

/** Tag each <h2> with a scroll anchor and collect the headings for a contents rail. */
function extractHeadings(html: string): { processedHtml: string; toc: string[] } {
  const toc: string[] = [];
  let i = 0;
  const processedHtml = html.replace(
    /<h2([^>]*)>([\s\S]*?)<\/h2>/gi,
    (_match, attrs: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, '').trim();
      if (text) toc.push(text);
      return `<h2${attrs} id="bio-s${i++}">${inner}</h2>`;
    },
  );
  return { processedHtml, toc };
}

export interface BiographyLead {
  /** The opening letter, set as the drop cap. */
  cap: string;
  /** The rest of the opening paragraph, set one step larger than body copy. */
  rest: string;
  /** Everything after the opening paragraph. */
  body: string;
}

/**
 * Split the opening paragraph off the top of the document so the views can set
 * a drop cap. Web does this with `::first-letter`, which has no React Native
 * equivalent — react-native-render-html renders a flat tree with no
 * pseudo-element hook — so the split has to happen in the HTML, and doing it
 * here keeps both platforms working from the same definition of "the lead".
 *
 * Bails (cap: '') when the document doesn't open with a plain text paragraph —
 * an opening image or a heading has no letter to enlarge, and forcing one would
 * hoist a caption or a section title into the drop cap slot.
 */
export function splitLead(html: string): BiographyLead {
  const m = html.match(/^\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!m) return { cap: '', rest: '', body: html };
  const inner = m[1].trim();
  // Must start with a bare word character — not a tag, entity or punctuation.
  const first = inner.match(/^([A-Za-z0-9])([\s\S]*)$/);
  if (!first) return { cap: '', rest: '', body: html };
  return {
    cap: first[1],
    rest: first[2],
    body: html.slice(m[0].length),
  };
}

export type BioLinkAction =
  /** A hero we have — route to it in-app. */
  | { kind: 'hero'; heroId: string }
  /** Open this absolute URL outside the app. */
  | { kind: 'external'; url: string }
  /** Not a link we handle; let the platform do its default thing. */
  | { kind: 'ignore' };

/**
 * Resolve a link inside biography prose. ComicVine character links look like
 * `/slug/4005-{comicvineId}/` — those get looked up so an in-app character page
 * wins over bouncing the reader out to comicvine.com; everything else that
 * points back at ComicVine gets absolutised.
 */
export async function resolveBioLink(href: string): Promise<BioLinkAction> {
  const match = href.match(/\/slug\/4005-(\d+)\//);
  if (match) {
    try {
      const found = await getHeroByComicvineId(match[1]);
      if (found) return { kind: 'hero', heroId: found.id };
    } catch {
      // Lookup failed — fall through to the external link rather than dead-end.
    }
    return { kind: 'external', url: `https://comicvine.gamespot.com${href}` };
  }
  if (href.startsWith('/slug/')) {
    return { kind: 'external', url: `https://comicvine.gamespot.com${href}` };
  }
  if (href.startsWith('http')) return { kind: 'external', url: href };
  return { kind: 'ignore' };
}

/**
 * Everything the biography screens need. `hero` shares the row cache with the
 * character screen (useHeroRow), so opening a full biography straight after
 * viewing the character is instant.
 */
export function useBiography(id: string | undefined) {
  const hero = useHeroRow(id).data ?? null;

  const source = hero?.description ? flattenTables(preprocessHtml(hero.description)) : '';
  const { processedHtml, toc } = source
    ? extractHeadings(source)
    : { processedHtml: '', toc: [] as string[] };
  const lead = splitLead(processedHtml);

  return {
    hero,
    /** Full document, headings anchored. Web renders this whole. */
    processedHtml,
    /** Lead split out for a drop cap. Native renders `lead.rest` then `lead.body`. */
    lead,
    /** <h2> texts, in order, for a contents rail. */
    toc,
    hasBiography: !!processedHtml,
  };
}
