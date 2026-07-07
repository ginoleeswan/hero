// Pure builders for the search-crawler character pages. Search engines hitting
// /character/:id (matched by user-agent rewrites in vercel.json) get this fully
// rendered HTML instead of the empty SPA shell, so the ~22k catalogue pages are
// actually indexable. Social link-preview bots keep the lighter share-meta
// route; humans never land here.
//
// Kept free of runtime deps (like shareMeta.ts) so it's unit-testable under
// jest and safe to bundle into the RN-free Vercel functions in api/.
import { SITE_URL } from '../../src/constants/site';
import { escapeHtml } from './shareMeta';

/** The hero columns the bot page renders. Subset of the heroes Row. */
export type BotHero = {
  id: string;
  name: string;
  full_name: string | null;
  aliases: string[] | null;
  alignment: string | null;
  publisher: string | null;
  franchise: string | null;
  description: string | null;
  summary: string | null;
  first_appearance: string | null;
  occupation: string | null;
  place_of_birth: string | null;
  race: string | null;
  gender: string | null;
  height_metric: string | null;
  weight_metric: string | null;
  base: string | null;
  creators: string[] | null;
  teams: string[] | null;
  powers: string[] | null;
  intelligence: number | null;
  strength: number | null;
  speed: number | null;
  durability: number | null;
  power: number | null;
  combat: number | null;
  portrait_url: string | null;
  image_url: string | null;
};

export type RelatedLite = { id: string; name: string };

export type BotHeroRelations = {
  allies: RelatedLite[];
  enemies: RelatedLite[];
  teammates: RelatedLite[];
};

/** ComicVine descriptions arrive as HTML — reduce to plain text for meta/body. */
export function stripHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** SuperheroAPI category buckets that must never link as a browsable universe
 *  (mirrors NON_UNIVERSE_PUBLISHERS in src/constants/publishers.ts, which the
 *  RN-free api/ bundle can't import). */
const NON_UNIVERSE_PUBLISHERS = new Set([
  'Non-Fictional',
  'Creator-Owned',
  'Company-Licensed',
  'In the Public Domain',
]);

/** /universe browse link for a publisher, or null when it isn't browsable.
 *  Routes by raw name — /universe/[slug] ilike-matches unregistered slugs. */
export function universePath(publisher: string | null | undefined): string | null {
  if (!publisher || NON_UNIVERSE_PUBLISHERS.has(publisher)) return null;
  return `/universe/${encodeURIComponent(publisher)}`;
}

function heroLink(h: RelatedLite): string {
  return `<a href="/character/${encodeURIComponent(h.id)}">${escapeHtml(h.name)}</a>`;
}

function factRow(label: string, value: string | null | undefined): string {
  const v = value?.trim();
  if (!v) return '';
  return `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(v)}</td></tr>`;
}

function section(title: string, inner: string): string {
  if (!inner) return '';
  return `<section><h2>${escapeHtml(title)}</h2>${inner}</section>`;
}

/** First ~2 sentences of the description, for the meta description tag. */
export function metaDescription(hero: BotHero): string {
  const text = stripHtml(hero.description) || stripHtml(hero.summary);
  if (text) return text.length > 300 ? `${text.slice(0, 297)}…` : text;
  const uni = hero.publisher ? `${hero.publisher} · ` : '';
  return `${uni}Powers, stats, allies, enemies and every appearance of ${hero.name} on Mythique.`;
}

/** JSON-LD: ProfilePage + Person main entity + breadcrumbs. Serialized with
 *  `<` escaped so hero-controlled text can never close the script tag. */
function jsonLd(hero: BotHero, description: string): string {
  const image = hero.portrait_url ?? hero.image_url ?? undefined;
  const person: Record<string, unknown> = {
    '@type': 'Person',
    name: hero.name,
    url: `${SITE_URL}/character/${encodeURIComponent(hero.id)}`,
  };
  if (description) person.description = description;
  if (image) person.image = image;
  const alts = [hero.full_name, ...(hero.aliases ?? [])].filter(
    (a): a is string => !!a && a.trim() !== '' && a !== hero.name,
  );
  if (alts.length > 0) person.alternateName = alts.slice(0, 10);
  const crumbs = [
    { '@type': 'ListItem', position: 1, name: 'Mythique', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Characters', item: `${SITE_URL}/search` },
    { '@type': 'ListItem', position: 3, name: hero.name },
  ];
  const doc = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: person,
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: crumbs },
  };
  return JSON.stringify(doc).replace(/</g, '\\u003c');
}

const STATS: Array<[keyof BotHero, string]> = [
  ['intelligence', 'Intelligence'],
  ['strength', 'Strength'],
  ['speed', 'Speed'],
  ['durability', 'Durability'],
  ['power', 'Power'],
  ['combat', 'Combat'],
];

function statsTable(hero: BotHero): string {
  const rows = STATS.map(([key, label]) => {
    const v = hero[key];
    return typeof v === 'number' ? `<tr><th scope="row">${label}</th><td>${v}/100</td></tr>` : '';
  }).join('');
  return rows ? `<table>${rows}</table>` : '';
}

function relationList(heroes: RelatedLite[]): string {
  if (heroes.length === 0) return '';
  return `<ul>${heroes.map((h) => `<li>${heroLink(h)}</li>`).join('')}</ul>`;
}

/** "Batman vs Joker — who wins?" links into /compare for the top enemies. */
function versusLinks(hero: BotHero, enemies: RelatedLite[]): string {
  if (enemies.length === 0) return '';
  const items = enemies
    .slice(0, 3)
    .map(
      (e) =>
        `<li><a href="/compare/${encodeURIComponent(hero.id)}/${encodeURIComponent(e.id)}">` +
        `${escapeHtml(hero.name)} vs ${escapeHtml(e.name)} — who wins?</a></li>`,
    )
    .join('');
  return `<ul>${items}</ul>`;
}

// Just enough style that a stray human (or a rendered-page inspection tool)
// sees a readable document. Bots read the markup either way.
const PAGE_CSS =
  'body{font-family:system-ui,sans-serif;max-width:44rem;margin:0 auto;padding:1.5rem;' +
  'background:#f5ebdc;color:#221c14;line-height:1.55}img{max-width:16rem;height:auto}' +
  'table{border-collapse:collapse}th{text-align:left;padding-right:1rem}a{color:#8a5a00}';

/**
 * The full crawlable character page: complete head (canonical + OG, matching
 * the share-meta card), JSON-LD, and a semantic body with dense internal links
 * (allies, enemies, versus matchups, universe) so crawlers can walk the graph.
 * No meta-refresh — search engines must index this URL, not follow a redirect.
 */
export function buildCharacterBotPage(hero: BotHero, rel: BotHeroRelations): string {
  const name = escapeHtml(hero.name);
  const title = escapeHtml(`${hero.name} — Powers, Stats, Allies & Enemies | Mythique`);
  const desc = metaDescription(hero);
  const descAttr = escapeHtml(desc);
  const url = `${SITE_URL}/character/${encodeURIComponent(hero.id)}`;
  const ogImage = `${SITE_URL}/api/og?hero=${encodeURIComponent(hero.id)}`;
  const img = hero.portrait_url ?? hero.image_url;
  // ComicVine descriptions can be whole wiki articles — keep the prose real
  // (crawlers value it) but bounded, so no page balloons to tens of KB.
  const aboutFull = stripHtml(hero.description) || stripHtml(hero.summary);
  const about = aboutFull.length > 4000 ? `${aboutFull.slice(0, 3997)}…` : aboutFull;
  const uniPath = universePath(hero.publisher);
  const universe = hero.publisher
    ? uniPath
      ? `<a href="${escapeHtml(uniPath)}">${escapeHtml(hero.publisher)}</a>`
      : escapeHtml(hero.publisher)
    : '';

  const facts = [
    factRow('Full name', hero.full_name),
    factRow('Alignment', hero.alignment),
    factRow('First appearance', hero.first_appearance),
    factRow('Occupation', hero.occupation),
    factRow('Place of birth', hero.place_of_birth),
    factRow('Species', hero.race),
    factRow('Gender', hero.gender),
    factRow('Height', hero.height_metric),
    factRow('Weight', hero.weight_metric),
    factRow('Base', hero.base),
    factRow('Creators', hero.creators?.join(', ')),
    factRow('Teams', hero.teams?.join(', ')),
    factRow('Aliases', hero.aliases?.join(', ')),
  ].join('');

  const powers =
    hero.powers && hero.powers.length > 0
      ? `<ul>${hero.powers.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
      : '';

  const body = [
    `<header><h1>${name}</h1>`,
    universe || hero.franchise
      ? `<p>${[universe, hero.franchise ? escapeHtml(hero.franchise) : '']
          .filter(Boolean)
          .join(' · ')}</p>`
      : '',
    `</header>`,
    img ? `<img src="${escapeHtml(img)}" alt="${name} portrait">` : '',
    about ? section('About', `<p>${escapeHtml(about)}</p>`) : '',
    facts ? section('Profile', `<table>${facts}</table>`) : '',
    section('Power stats', statsTable(hero)),
    powers ? section('Powers', powers) : '',
    section('Allies', relationList(rel.allies)),
    section('Enemies', relationList(rel.enemies)),
    section('Teammates', relationList(rel.teammates)),
    section('Matchups', versusLinks(hero, rel.enemies)),
    `<footer><p><a href="/explore">Explore more characters on Mythique</a> · ` +
      `<a href="/">Mythique — every universe, every icon</a></p></footer>`,
  ].join('\n');

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${descAttr}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Mythique">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${descAttr}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd(hero, desc)}</script>
<style>${PAGE_CSS}</style>
</head><body>
${body}
</body></html>`;
}

/** Unknown-id response — noindex so crawlers drop dead URLs instead of
 *  indexing an empty shell. Served with a 404 status by the handler. */
export function buildNotFoundPage(): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>Character not found — Mythique</title>
<meta name="robots" content="noindex">
</head><body><p>Character not found. <a href="${SITE_URL}/explore">Explore Mythique</a></p></body></html>`;
}
