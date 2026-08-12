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
  // Escaped, not raw. `path` carries slugs now, not just opaque generated ids —
  // a house or event slug is human-readable text from the catalogue, and one
  // containing a quote would close the `href="` attribute and inject markup
  // into the page we hand every link-preview crawler. The builders below also
  // percent-encode their segments; this is the backstop that does not depend
  // on each new builder remembering to.
  const url = escapeHtml(`${SITE_URL}${m.path}`);
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
    path: `/character/${encodeURIComponent(hero.id)}`,
    image: `${SITE_URL}/api/og?hero=${encodeURIComponent(hero.id)}`,
  };
}

export function universeMeta(hero: HeroLite, connections: number): ShareMeta {
  const uni = hero.publisher ? `${hero.publisher} · ` : '';
  const count = connections > 0 ? `${connections} connections — ` : '';
  return {
    title: `${hero.name}'s universe — Mythique`,
    description: `${uni}${count}the nemeses, allies, teammates and bloodline that make up ${hero.name}'s world.`,
    path: `/social-web/${encodeURIComponent(hero.id)}`,
    image: `${SITE_URL}/api/og?type=universe&hero=${encodeURIComponent(hero.id)}`,
  };
}

export function vsMeta(a: HeroLite, b: HeroLite, votesA: number, votesB: number): ShareMeta {
  return {
    title: `${a.name} vs ${b.name} — Mythique`,
    description: vsShareLine(a.name, b.name, votesA, votesB),
    path: `/compare/${encodeURIComponent(a.id)}/${encodeURIComponent(b.id)}`,
    image: `${SITE_URL}/api/og?a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(b.id)}`,
  };
}

/**
 * Today's curated debate. Same page as `vsMeta`, but the OG card is the richer
 * `type=debate` one — portraits, the live split bar and the crowned take.
 *
 * That card was written, shipped and then reachable from nowhere: no route, no
 * rewrite and no share in the product ever produced a `type=debate` URL, so the
 * only thing that ever rendered it was the admin health preview. The daily
 * matchup's share button emits `?debate=1` and the rewrite ahead of the plain
 * vs rule sends it here.
 */
export function debateMeta(a: HeroLite, b: HeroLite, votesA: number, votesB: number): ShareMeta {
  return {
    title: `Today's battle: ${a.name} vs ${b.name} — Mythique`,
    description: vsShareLine(a.name, b.name, votesA, votesB),
    path: `/compare/${encodeURIComponent(a.id)}/${encodeURIComponent(b.id)}`,
    image: `${SITE_URL}/api/og?type=debate&a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(
      b.id,
    )}`,
  };
}

export type HouseLite = {
  slug: string;
  name: string;
  universe: string | null;
  memberCount: number;
};

export function houseMeta(house: HouseLite): ShareMeta {
  const where = house.universe ? `${house.universe} · ` : '';
  const n = house.memberCount;
  const who = n > 0 ? `${n} charted ${n === 1 ? 'member' : 'members'}` : 'The charted line';
  return {
    title: `House ${house.name} — Mythique`,
    description: `${where}${who} — the bloodline, the marriages and the feuds of House ${house.name}.`,
    path: `/house/${encodeURIComponent(house.slug)}`,
    image: `${SITE_URL}/api/og?type=house&slug=${encodeURIComponent(house.slug)}`,
  };
}

export type EventLite = { slug: string; headline: string; blurb: string | null; ongoing: boolean };

export function eventMeta(event: EventLite): ShareMeta {
  return {
    title: `${event.headline} — Mythique`,
    description:
      event.blurb ??
      `${event.ongoing ? 'Happening now. ' : ''}No calendar told us this was on — the readership did. The window, the spike and everything that dropped inside it.`,
    path: `/event/${encodeURIComponent(event.slug)}`,
    image: `${SITE_URL}/api/og?type=event&slug=${encodeURIComponent(event.slug)}`,
  };
}

export type TitleLite = {
  id: string;
  title: string;
  year: number | null;
  mediaType: string | null;
};

export function titleMeta(t: TitleLite): ShareMeta {
  const kind = t.mediaType === 'tv' ? 'series' : t.mediaType === 'game' ? 'game' : 'film';
  const year = t.year ? ` (${t.year})` : '';
  return {
    title: `${t.title}${year} — Mythique`,
    description: `Every character in the ${kind}, who plays them, where to watch it, and how it connects to the rest of the catalogue.`,
    path: `/title/${encodeURIComponent(t.id)}`,
    image: `${SITE_URL}/api/og?type=title&title=${encodeURIComponent(t.id)}`,
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
