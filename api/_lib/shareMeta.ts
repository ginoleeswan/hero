// Pure builders for the bot-facing share-meta HTML and share copy. Kept free of
// runtime deps so they're unit-testable under jest (__tests__/api/shareMeta.test.ts)
// and reusable from the Vercel functions in api/.
import { SITE_URL } from '../../src/constants/site';
import { vsShareLine } from '../../src/lib/share';

export { vsShareLine };

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type ShareMeta = {
  title: string;
  description: string;
  /** Site-absolute path of the real page, e.g. "/character/h_abc". */
  path: string;
  /** Absolute og:image URL. */
  image: string;
};

/**
 * Minimal HTML document served to link-preview crawlers. Includes the full
 * OG/Twitter tag set plus a meta-refresh so any human (or JS-running crawler)
 * that lands here ends up on the real page.
 */
export function buildMetaHtml(m: ShareMeta): string {
  const t = escapeHtml(m.title);
  const d = escapeHtml(m.description);
  const url = `${SITE_URL}${m.path}`;
  const img = escapeHtml(m.image);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Mythique">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
<meta http-equiv="refresh" content="0;url=${url}">
</head><body><a href="${url}">${t}</a></body></html>`;
}

export type HeroLite = { id: string; name: string; publisher: string | null };

export function characterMeta(hero: HeroLite): ShareMeta {
  const uni = hero.publisher ? `${hero.publisher} · ` : '';
  return {
    title: `${hero.name} — Mythique`,
    description: `${uni}Powers, stats, allies, enemies and every appearance of ${hero.name} on Mythique.`,
    path: `/character/${hero.id}`,
    image: `${SITE_URL}/api/og?hero=${encodeURIComponent(hero.id)}`,
  };
}

export function vsMeta(a: HeroLite, b: HeroLite, votesA: number, votesB: number): ShareMeta {
  return {
    title: `${a.name} vs ${b.name} — Mythique`,
    description: vsShareLine(a.name, b.name, votesA, votesB),
    path: `/compare/${a.id}/${b.id}`,
    image: `${SITE_URL}/api/og?a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(b.id)}`,
  };
}

/** Site-wide fallback (also used when a hero lookup fails — never a broken unfurl). */
export function siteMeta(): ShareMeta {
  return {
    title: 'Mythique — Every universe. Every icon.',
    description:
      'Explore characters, teams, films and universes from across all fiction — Marvel, DC, Disney, anime, games and beyond — and pit any two against each other.',
    path: '/',
    image: `${SITE_URL}/og.png`,
  };
}
