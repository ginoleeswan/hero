// Pure builders for the search-crawler character pages. Search engines hitting
// /character/:id (matched by user-agent rewrites in vercel.json) get this fully
// rendered HTML instead of the empty SPA shell, so the ~22k catalogue pages are
// actually indexable. Social link-preview bots keep the lighter share-meta
// route; humans never land here.
//
// Kept free of runtime deps (like shareMeta.ts) so it's unit-testable under
// jest and safe to bundle into the RN-free Vercel functions in api/.
import { SITE_URL } from '../../src/constants/site';
import { universeHref } from '../../src/constants/universeBrands';
import { escapeHtml, vsShareLine } from './shareMeta';

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
  // Entity anchors for JSON-LD `sameAs` — ties the page to its Knowledge-Graph
  // node so Google/answer-engines recognise the character as a known entity.
  wikidata_qid: string | null;
  enwiki_title: string | null;
};

/** Build the schema.org `sameAs` list — the external authorities that identify
 *  this character. Wikidata is the Knowledge-Graph hub; the English-Wikipedia
 *  article is the human-readable anchor. Empty when the hero has neither. */
export function entitySameAs(hero: Pick<BotHero, 'wikidata_qid' | 'enwiki_title'>): string[] {
  const out: string[] = [];
  const qid = hero.wikidata_qid?.trim();
  if (qid && /^Q\d+$/.test(qid)) out.push(`https://www.wikidata.org/wiki/${qid}`);
  const title = hero.enwiki_title?.trim();
  if (title) {
    // MediaWiki canonical form: spaces → underscores, then percent-encode.
    out.push(`https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`);
  }
  return out;
}

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

/** /universe browse link for a publisher, or null when it isn't browsable.
 *  Delegates to the shared canonicaliser so character bot pages link universes
 *  by the SAME URL the app and sitemap use (registered brands by stable slug,
 *  others by encoded raw name) — no duplicate /universe/<raw> vs /universe/<slug>
 *  competing for the same content. */
export function universePath(publisher: string | null | undefined): string | null {
  return universeHref(publisher);
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
  const sameAs = entitySameAs(hero);
  if (sameAs.length > 0) person.sameAs = sameAs;
  const crumbs = [
    { '@type': 'ListItem', position: 1, name: 'Mythique', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Characters', item: `${SITE_URL}/search` },
    { '@type': 'ListItem', position: 3, name: hero.name },
  ];
  return serializeLd({
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: person,
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: crumbs },
  });
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

const FOOTER =
  `<footer><p><a href="/explore">Explore more characters on Mythique</a> · ` +
  `<a href="/">Mythique — every universe, every icon</a></p></footer>`;

type DocSpec = {
  title: string;
  description: string;
  /** Site-absolute canonical path, e.g. "/character/h_abc". */
  path: string;
  ogImage: string;
  ogType: string;
  /** Pre-serialized JSON-LD (already `<`-escaped). */
  jsonLd: string;
  body: string;
};

/** Shared document shell: full head (canonical + OG), JSON-LD, styled body.
 *  No meta-refresh — search engines must index these URLs, not follow a redirect. */
function buildDoc(spec: DocSpec): string {
  const t = escapeHtml(spec.title);
  const d = escapeHtml(spec.description);
  const url = `${SITE_URL}${spec.path}`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${escapeHtml(spec.ogType)}">
<meta property="og:site_name" content="Mythique">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${escapeHtml(spec.ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${spec.jsonLd}</script>
<style>${PAGE_CSS}</style>
</head><body>
${spec.body}
</body></html>`;
}

/** Serialize JSON-LD with `<` escaped so page-data text can never close the script tag. */
function serializeLd(doc: Record<string, unknown>): string {
  return JSON.stringify(doc).replace(/</g, '\\u003c');
}

/**
 * The full crawlable character page: complete head (canonical + OG, matching
 * the share-meta card), JSON-LD, and a semantic body with dense internal links
 * (allies, enemies, versus matchups, universe) so crawlers can walk the graph.
 * No meta-refresh — search engines must index this URL, not follow a redirect.
 */
export function buildCharacterBotPage(hero: BotHero, rel: BotHeroRelations): string {
  const name = escapeHtml(hero.name);
  const desc = metaDescription(hero);
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
    FOOTER,
  ].join('\n');

  return buildDoc({
    title: `${hero.name} — Powers, Stats, Allies & Enemies | Mythique`,
    description: desc,
    path: `/character/${encodeURIComponent(hero.id)}`,
    ogImage: `${SITE_URL}/api/og?hero=${encodeURIComponent(hero.id)}`,
    ogType: 'profile',
    jsonLd: jsonLd(hero, desc),
    body,
  });
}

/** The title columns the bot page renders. Subset of the titles Row. */
export type BotTitle = {
  id: string;
  title: string;
  media_type: string;
  year: number | null;
  release_date: string | null;
  runtime: number | null;
  vote_average: number | null;
  overview: string | null;
  poster_url: string | null;
};

/**
 * Crawlable title (film/TV) page: overview, key facts, and — the graph value —
 * links to every catalogue character appearing in it.
 */
export function buildTitleBotPage(t: BotTitle, characters: RelatedLite[]): string {
  const isTv = t.media_type === 'tv';
  const label = isTv ? 'TV series' : 'Film';
  const yearSuffix = t.year ? ` (${t.year})` : '';
  const desc =
    stripHtml(t.overview) ||
    `${label} — every character from ${t.title} on Mythique, with powers, stats and matchups.`;
  const facts = [
    factRow('Type', label),
    factRow('Release date', t.release_date),
    factRow('Runtime', t.runtime ? `${t.runtime} min` : null),
    factRow('Rating', typeof t.vote_average === 'number' ? `${t.vote_average}/10` : null),
  ].join('');
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': isTv ? 'TVSeries' : 'Movie',
    name: t.title,
    url: `${SITE_URL}/title/${encodeURIComponent(t.id)}`,
  };
  if (desc) ld.description = desc;
  if (t.poster_url) ld.image = t.poster_url;
  if (t.release_date) ld.datePublished = t.release_date;
  const body = [
    `<header><h1>${escapeHtml(t.title)}${escapeHtml(yearSuffix)}</h1><p>${label}</p></header>`,
    t.poster_url
      ? `<img src="${escapeHtml(t.poster_url)}" alt="${escapeHtml(t.title)} poster">`
      : '',
    desc ? section('About', `<p>${escapeHtml(desc)}</p>`) : '',
    facts ? section('Details', `<table>${facts}</table>`) : '',
    section('Characters', relationList(characters)),
    FOOTER,
  ].join('\n');
  return buildDoc({
    title: `${t.title}${yearSuffix} — Characters & Details | Mythique`,
    description: desc.length > 300 ? `${desc.slice(0, 297)}…` : desc,
    path: `/title/${encodeURIComponent(t.id)}`,
    ogImage: t.poster_url ?? `${SITE_URL}/og.png`,
    ogType: isTv ? 'video.tv_show' : 'video.movie',
    jsonLd: serializeLd(ld),
    body,
  });
}

/** The team columns the bot page renders. Subset of the teams Row. */
export type BotTeam = {
  id: string;
  name: string;
  publisher: string | null;
  member_count: number;
};

/** Crawlable team page: roster links into the character graph. */
export function buildTeamBotPage(team: BotTeam, members: RelatedLite[]): string {
  const uniPath = universePath(team.publisher);
  const universe = team.publisher
    ? uniPath
      ? `<a href="${escapeHtml(uniPath)}">${escapeHtml(team.publisher)}</a>`
      : escapeHtml(team.publisher)
    : '';
  const desc =
    `${team.name} — team roster, members and universe on Mythique.` +
    (team.member_count > 0 ? ` ${team.member_count} known members.` : '');
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${team.name} — Mythique`,
    url: `${SITE_URL}/team/${encodeURIComponent(team.id)}`,
    description: desc,
  };
  if (members.length > 0) {
    ld.mainEntity = {
      '@type': 'ItemList',
      name: `${team.name} members`,
      itemListElement: members.map((m, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: m.name,
        url: `${SITE_URL}/character/${encodeURIComponent(m.id)}`,
      })),
    };
  }
  const body = [
    `<header><h1>${escapeHtml(team.name)}</h1>${universe ? `<p>${universe}</p>` : ''}</header>`,
    section(
      'Profile',
      `<table>${factRow(
        'Known members',
        team.member_count > 0 ? String(team.member_count) : null,
      )}${factRow('Universe', team.publisher)}</table>`,
    ),
    section('Members', relationList(members)),
    FOOTER,
  ].join('\n');
  return buildDoc({
    title: `${team.name} — Members & Roster | Mythique`,
    description: desc,
    path: `/team/${encodeURIComponent(team.id)}`,
    ogImage: `${SITE_URL}/og.png`,
    ogType: 'website',
    jsonLd: serializeLd(ld),
    body,
  });
}

/**
 * Crawlable versus page — targets the "X vs Y who would win" query space.
 * Stat-by-stat table, community tally, and onward matchup links. /compare/a/b
 * and /compare/b/a render the same comparison, so the canonical uses the
 * sorted-id order — both URLs declare one indexable page.
 */
export function buildVsBotPage(
  a: BotHero,
  b: BotHero,
  tally: { votesA: number; votesB: number },
  moreOpponents: { forA: RelatedLite[]; forB: RelatedLite[] },
): string {
  const [cA, cB] = [a, b].sort((x, y) => (x.id < y.id ? -1 : 1));
  const titleText = `${a.name} vs ${b.name} — Who Would Win? | Mythique`;
  const desc = vsShareLine(a.name, b.name, tally.votesA, tally.votesB);
  const statRows = STATS.map(([key, label]) => {
    const va = a[key];
    const vb = b[key];
    if (typeof va !== 'number' && typeof vb !== 'number') return '';
    const cell = (v: unknown) => (typeof v === 'number' ? `${v}/100` : '—');
    return `<tr><th scope="row">${label}</th><td>${cell(va)}</td><td>${cell(vb)}</td></tr>`;
  }).join('');
  const statsTableHtml = statRows
    ? `<table><tr><th></th><th>${escapeHtml(a.name)}</th><th>${escapeHtml(
        b.name,
      )}</th></tr>${statRows}</table>`
    : '';
  const total = tally.votesA + tally.votesB;
  const tallyLine =
    total > 0
      ? `<p>Community votes: ${escapeHtml(a.name)} ${tally.votesA} — ${
          tally.votesB
        } ${escapeHtml(b.name)}.</p>`
      : `<p>No votes yet — <a href="/compare/${encodeURIComponent(a.id)}/${encodeURIComponent(
          b.id,
        )}">cast the first vote on Mythique</a>.</p>`;
  const more = [
    ...moreOpponents.forA
      .filter((o) => o.id !== b.id)
      .slice(0, 3)
      .map((o) => ({ hero: a, opp: o })),
    ...moreOpponents.forB
      .filter((o) => o.id !== a.id)
      .slice(0, 3)
      .map((o) => ({ hero: b, opp: o })),
  ]
    .map(
      ({ hero, opp }) =>
        `<li><a href="/compare/${encodeURIComponent(hero.id)}/${encodeURIComponent(opp.id)}">` +
        `${escapeHtml(hero.name)} vs ${escapeHtml(opp.name)} — who wins?</a></li>`,
    )
    .join('');
  const body = [
    `<header><h1>${escapeHtml(a.name)} vs ${escapeHtml(b.name)}</h1>${tallyLine}</header>`,
    section('Stat by stat', statsTableHtml),
    section(
      'The fighters',
      `<ul><li>${heroLink(a)} — full profile, powers and enemies</li>` +
        `<li>${heroLink(b)} — full profile, powers and enemies</li></ul>`,
    ),
    section('More matchups', more ? `<ul>${more}</ul>` : ''),
    FOOTER,
  ].join('\n');
  const canonicalUrl = `${SITE_URL}/compare/${encodeURIComponent(cA.id)}/${encodeURIComponent(
    cB.id,
  )}`;
  return buildDoc({
    title: titleText,
    description: desc,
    path: `/compare/${encodeURIComponent(cA.id)}/${encodeURIComponent(cB.id)}`,
    ogImage: `${SITE_URL}/api/og?a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(b.id)}`,
    ogType: 'website',
    // WebPage + FAQPage: the FAQ targets the "who would win, X vs Y?" query
    // directly (People-Also-Ask / featured-snippet real estate) with a factual,
    // data-backed answer — this matchup content is unique to Mythique.
    jsonLd: serializeLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: titleText,
          description: desc,
          url: canonicalUrl,
          // Community votes are real user engagement — surfacing the count as an
          // InteractionCounter signals this is an active, participatory page.
          ...(tally.votesA + tally.votesB > 0
            ? {
                interactionStatistic: {
                  '@type': 'InteractionCounter',
                  interactionType: 'https://schema.org/VoteAction',
                  userInteractionCount: tally.votesA + tally.votesB,
                },
              }
            : {}),
        },
        {
          '@type': 'FAQPage',
          url: canonicalUrl,
          mainEntity: [
            {
              '@type': 'Question',
              name: `Who would win in a fight, ${a.name} or ${b.name}?`,
              acceptedAnswer: { '@type': 'Answer', text: vsAnswer(a.name, b.name, tally) },
            },
          ],
        },
      ],
    }),
    body,
  });
}

/** Plain-text answer for the versus FAQ — the community lean when votes exist,
 *  otherwise an open-debate invite. Kept factual so the rich result never
 *  overstates a verdict. */
function vsAnswer(aName: string, bName: string, tally: { votesA: number; votesB: number }): string {
  const total = tally.votesA + tally.votesB;
  if (total > 0) {
    const aLeads = tally.votesA >= tally.votesB;
    const leader = aLeads ? aName : bName;
    const [hi, lo] = aLeads ? [tally.votesA, tally.votesB] : [tally.votesB, tally.votesA];
    const pct = Math.round((hi / total) * 100);
    return (
      `The Mythique community currently favours ${leader}, with ${pct}% of ${total} ` +
      `votes (${hi}–${lo}). Compare their full power stats and cast your own vote.`
    );
  }
  return (
    `It's an open debate — no community votes yet. Compare ${aName} and ${bName} ` +
    `stat by stat and cast the first vote on Mythique.`
  );
}

// --- Browsable hub pages (categories + universes) -------------------------
// These target head/mid-tail queries ("strongest characters", "marvel
// villains", "dc characters") that a single character page can't rank for, and
// they funnel crawl equity down into the character graph via dense links.

/** SEO copy for each browsable category hub. Mirrors CATEGORY_LABELS /
 *  CATEGORY_DESCRIPTIONS in src/lib/db/heroes/categories.ts — the RN-free api/
 *  bundle can't import that RN module, so keep the slug set in sync when
 *  categories change. Labels are written as the search phrases we want to win,
 *  not the app's short UI labels. */
export const CATEGORY_SEO: Record<string, { label: string; blurb: string }> = {
  popular: {
    label: 'Most Popular Superheroes & Villains',
    blurb:
      'The most beloved and recognizable characters across all of fiction — Marvel, DC, anime, games and beyond — ranked by fame on Mythique.',
  },
  villain: {
    label: 'Greatest Supervillains of All Time',
    blurb:
      'The forces of darkness across Marvel, DC, anime and beyond — the most iconic supervillains, ranked by fame, with powers and stats.',
  },
  xmen: {
    label: 'X-Men Characters',
    blurb:
      "Every member of Charles Xavier's world — X-Men mutants, allies and villains — with powers, stats and who-would-win matchups.",
  },
  'anti-heroes': {
    label: 'Greatest Anti-Heroes',
    blurb:
      'Characters who walk the line between hero and villain — the most iconic anti-heroes across all fiction, with powers and stats.',
  },
  marvel: {
    label: 'Marvel Characters',
    blurb:
      'Heroes and villains from the Marvel Universe — powers, stats, teams and who-would-win matchups, ranked by fame.',
  },
  dc: {
    label: 'DC Characters',
    blurb:
      'Heroes and villains of the DC Universe — powers, stats, teams and who-would-win matchups, ranked by fame.',
  },
  image: {
    label: 'Image Comics Characters',
    blurb:
      'Creator-owned heroes and villains from Image Comics — Spawn, Invincible and more — with powers, stats and matchups.',
  },
  'dark-horse': {
    label: 'Dark Horse Characters',
    blurb:
      'Heroes and villains from Dark Horse Comics — Hellboy, Sin City and beyond — with powers, stats and matchups.',
  },
  strongest: {
    label: 'Strongest Characters',
    blurb:
      'The most physically powerful characters in fiction, ranked by raw strength — with full power stats and matchups.',
  },
  'most-intelligent': {
    label: 'Most Intelligent Characters',
    blurb:
      'The greatest minds across comics, film and games, ranked by intelligence — with full power stats and matchups.',
  },
  'most-iconic': {
    label: 'Most Iconic Characters',
    blurb:
      'The most recognizable characters across comics and screen, ranked by fame — with powers, stats and matchups.',
  },
  'franchise-icons': {
    label: 'Icons Beyond the Comics',
    blurb:
      'Legendary characters from film, TV, games and anime — icons that transcend the page, with powers, stats and matchups.',
  },
  anime: {
    label: 'Anime & Manga Characters',
    blurb:
      'Heroes and villains from the biggest anime and manga — powers, stats and who-would-win matchups, ranked.',
  },
  'video-games': {
    label: 'Video Game Characters',
    blurb:
      'Legends straight out of video-game history — powers, stats and who-would-win matchups, ranked by fame.',
  },
  horror: {
    label: 'Horror Icons',
    blurb:
      'The slashers and monsters of horror cinema — the most iconic villains of horror, with powers, stats and matchups.',
  },
  magic: {
    label: 'Magic Users & Sorcerers',
    blurb:
      'Sorcerers, mystics and wielders of the arcane across comics, film and games — with powers, stats and who-would-win matchups.',
  },
  aliens: {
    label: 'Alien Characters',
    blurb:
      'Heroes and villains born beyond Earth — Kryptonians, Saiyans, symbiotes and more, with powers, stats and matchups.',
  },
  mythology: {
    label: 'Gods & Mythological Characters',
    blurb:
      'Gods, monsters and legends pulled from myth into comics and film — with powers, stats and who-would-win matchups.',
  },
};

/** Cross-links to the other hub pages so crawlers walk between them and equity
 *  spreads across the hub graph. Optionally excludes the current category. */
function hubNav(excludeSlug?: string): string {
  const items = Object.entries(CATEGORY_SEO)
    .filter(([slug]) => slug !== excludeSlug)
    .map(([slug, m]) => `<li><a href="/category/${slug}">${escapeHtml(m.label)}</a></li>`)
    .join('');
  return items ? `<nav><h2>Browse more</h2><ul>${items}</ul></nav>` : '';
}

/** Ordered, linked character list — the internal-link payload of a hub page. */
function characterOrderedList(heroes: RelatedLite[]): string {
  if (heroes.length === 0) return '';
  return `<ol>${heroes.map((h) => `<li>${heroLink(h)}</li>`).join('')}</ol>`;
}

/** JSON-LD for a hub page: CollectionPage wrapping an ItemList of the linked
 *  characters, plus breadcrumbs. `<` escaped so data text can't close the tag. */
function hubJsonLd(name: string, path: string, description: string, heroes: RelatedLite[]): string {
  const itemListElement = heroes.map((h, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: h.name,
    url: `${SITE_URL}/character/${encodeURIComponent(h.id)}`,
  }));
  return serializeLd({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: `${SITE_URL}${path}`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: heroes.length,
      itemListElement,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Mythique', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Browse', item: `${SITE_URL}/explore` },
        { '@type': 'ListItem', position: 3, name },
      ],
    },
  });
}

/**
 * Crawlable category hub (e.g. /category/strongest): a keyword-targeted H1 +
 * intro, an ordered list of the top characters (each linked into the graph),
 * cross-links to sibling hubs, and CollectionPage JSON-LD. `slug` must be a key
 * of CATEGORY_SEO — the handler validates before calling.
 */
export function buildCategoryBotPage(slug: string, heroes: RelatedLite[]): string {
  const meta = CATEGORY_SEO[slug];
  const path = `/category/${slug}`;
  const body = [
    `<header><h1>${escapeHtml(meta.label)}</h1><p>${escapeHtml(meta.blurb)}</p></header>`,
    section('Characters', characterOrderedList(heroes)),
    hubNav(slug),
    FOOTER,
  ].join('\n');
  return buildDoc({
    title: `${meta.label} — Powers, Stats & Rankings | Mythique`,
    description: meta.blurb,
    path,
    ogImage: `${SITE_URL}/og.png`,
    ogType: 'website',
    jsonLd: hubJsonLd(meta.label, path, meta.blurb, heroes),
    body,
  });
}

/**
 * Crawlable universe hub (e.g. /universe/marvel): every catalogue character from
 * one publisher/studio, linked into the graph. `name` is the display name (brand
 * name for a registered universe, else the raw publisher); `slug` is the canonical
 * path segment (stable brand slug, else the raw name) — the handler resolves both
 * so /universe/<slug> and /universe/<raw> collapse to one canonical URL.
 */
export function buildUniverseBotPage(name: string, slug: string, heroes: RelatedLite[]): string {
  const label = `${name} Characters`;
  const blurb =
    `Every character from ${name} on Mythique — heroes, villains, powers, stats and ` +
    `who-would-win matchups, ranked by fame.`;
  const path = `/universe/${encodeURIComponent(slug)}`;
  const body = [
    `<header><h1>${escapeHtml(label)}</h1><p>${escapeHtml(blurb)}</p></header>`,
    section('Characters', characterOrderedList(heroes)),
    hubNav(),
    FOOTER,
  ].join('\n');
  return buildDoc({
    title: `${name} Characters — Heroes, Villains & Power Stats | Mythique`,
    description: blurb,
    path,
    ogImage: `${SITE_URL}/og.png`,
    ogType: 'website',
    jsonLd: hubJsonLd(label, path, blurb, heroes),
    body,
  });
}

/**
 * Crawlable franchise hub (e.g. /franchise/Star Wars): every catalogue character
 * whose `franchise` exactly equals `name`, linked into the graph. Franchises have
 * no brand registry, so the canonical is always the URL-encoded raw name — which
 * is exactly how the app's /franchise/[slug] route resolves it.
 */
export function buildFranchiseBotPage(name: string, heroes: RelatedLite[]): string {
  const label = `${name} Characters`;
  const blurb =
    `Every character from the ${name} franchise on Mythique — heroes, villains, ` +
    `powers, stats and who-would-win matchups, ranked by fame.`;
  const path = `/franchise/${encodeURIComponent(name)}`;
  const body = [
    `<header><h1>${escapeHtml(label)}</h1><p>${escapeHtml(blurb)}</p></header>`,
    section('Characters', characterOrderedList(heroes)),
    hubNav(),
    FOOTER,
  ].join('\n');
  return buildDoc({
    title: `${name} Characters — Full List, Powers & Stats | Mythique`,
    description: blurb,
    path,
    ogImage: `${SITE_URL}/og.png`,
    ogType: 'website',
    jsonLd: hubJsonLd(label, path, blurb, heroes),
    body,
  });
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
