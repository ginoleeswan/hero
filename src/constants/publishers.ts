// src/constants/publishers.ts
// Single source of truth for publisher branding.
//
// Publisher strings in the DB are messy and inconsistent — "Marvel" vs
// "Marvel Comics", "George Lucas" for Star Wars, etc. Every surface that needs
// a logo, brand colour, or browse route resolves it through this registry so
// the same hero brands the same way everywhere (search cards, web cards,
// Explore tiles, publisher route).
import type { FC } from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import ImageComicsLogo from '../../assets/images/image-comics-logo.svg';

/** A brand logo, either a raster image (PNG via require) or an SVG component
 *  (via react-native-svg-transformer). Render helpers branch on which it is. */
export type BrandLogo = ImageSourcePropType | FC<SvgProps>;

export interface PublisherBrand {
  slug: string;
  /** Display name. */
  name: string;
  /** ILIKE term passed to getHeroesByPublisher for the browse route. */
  query: string;
  /**
   * Lowercased substrings used to detect this brand from a raw `publisher`
   * field. Checked with `String.includes`, in registry order — list more
   * specific brands first.
   */
  match: string[];
  /** Brand accent (wordmark fallback + tile gradient top). */
  color: string;
  /** Darker shade of the brand colour (tile gradient bottom). */
  colorDark: string;
  /** Logo (PNG image source or SVG component); surfaces fall back to the name
   *  wordmark/text when absent. */
  logo?: BrandLogo;
  /**
   * Rendered logo size (px) inside a compact overlay badge chip. Hand-tuned
   * per brand because some logos are wide wordmarks (Marvel) and others are
   * compact marks (DC) — a single height doesn't read well across both.
   */
  badgeSize?: { width: number; height: number };
  /** Shown as a browsable tile on the Explore screen. */
  featured?: boolean;
}

/**
 * Every brand we can recognise and badge, in detection priority order.
 * Not all are `featured` (e.g. Star Wars badges results but has no tile).
 */
export const PUBLISHER_BRANDS: PublisherBrand[] = [
  {
    slug: 'marvel',
    name: 'Marvel',
    query: 'marvel',
    match: ['marvel'],
    color: '#C8102E',
    colorDark: '#7E0A1D',
    logo: require('../../assets/images/Marvel_Logo.png'),
    badgeSize: { width: 36, height: 14 },
    featured: true,
  },
  {
    slug: 'dc',
    name: 'DC',
    query: 'dc comics',
    match: ['dc comics', 'dc'],
    color: '#0476F2',
    colorDark: '#03489A',
    logo: require('../../assets/images/DC-Logo.png'),
    badgeSize: { width: 20, height: 20 },
    featured: true,
  },
  {
    slug: 'dark-horse',
    name: 'Dark Horse',
    query: 'dark horse',
    match: ['dark horse'],
    color: '#3A2E2A',
    colorDark: '#1E1715',
    logo: require('../../assets/images/Dark_Horse_Comics_logo.png'),
    badgeSize: { width: 16, height: 24 },
    featured: true,
  },
  {
    slug: 'star-wars',
    name: 'Star Wars',
    query: 'george lucas',
    match: ['george lucas', 'star wars'],
    color: '#1A1A1A',
    colorDark: '#000000',
    logo: require('../../assets/images/star-wars-logo.png'),
    badgeSize: { width: 32, height: 32 },
    // Not featured: badged on result cards, but no Explore tile.
  },
  {
    slug: 'image',
    name: 'Image',
    query: 'image',
    match: ['image'],
    color: '#16A085',
    colorDark: '#0C5F4E',
    logo: ImageComicsLogo,
    badgeSize: { width: 50, height: 20 },
    featured: true,
  },

  // ── Universes from the Company-Licensed re-brand ──────────────────────────
  // Registered so they badge, route, and carry a brand colour. No `logo` yet —
  // surfaces fall back to the name wordmark until transparent PNGs are added
  // (then set `logo` + `badgeSize`). Match substrings are distinct from the
  // brands above; order doesn't collide.
  { slug: 'netherrealm', name: 'NetherRealm Studios', query: 'netherrealm', match: ['netherrealm'], color: '#C9A227', colorDark: '#7A6115' },
  { slug: 'babylon-5', name: 'Babylon 5', query: 'babylon 5', match: ['babylon 5'], color: '#3B4C7A', colorDark: '#222E4D' },
  { slug: 'avatar-last-airbender', name: 'Avatar: The Last Airbender', query: 'last airbender', match: ['last airbender'], color: '#E8A33D', colorDark: '#9C6418' },
  { slug: 'snk', name: 'SNK', query: 'snk', match: ['snk'], color: '#D32F2F', colorDark: '#7F1B1B' },
  { slug: 'gatchaman', name: 'Gatchaman', query: 'gatchaman', match: ['gatchaman'], color: '#1E66A8', colorDark: '#103A60' },
  { slug: 'hanna-barbera', name: 'Hanna-Barbera', query: 'hanna-barbera', match: ['hanna-barbera', 'hanna barbera'], color: '#1FA8A0', colorDark: '#0E5E59' },
  { slug: 'looney-tunes', name: 'Looney Tunes', query: 'looney tunes', match: ['looney tunes'], color: '#E03A30', colorDark: '#8A201B' },
  { slug: 'cd-projekt-red', name: 'CD Projekt Red', query: 'cd projekt', match: ['cd projekt'], color: '#B11A1A', colorDark: '#6A0F0F' },
  { slug: 'rocky-bullwinkle', name: 'Rocky & Bullwinkle', query: 'bullwinkle', match: ['bullwinkle', 'rocky & bullwinkle'], color: '#2E6FB0', colorDark: '#1A4068' },
  { slug: 'insomniac', name: 'Insomniac Games', query: 'insomniac', match: ['insomniac'], color: '#E87722', colorDark: '#8C4512' },
  { slug: 'star-trek', name: 'Star Trek', query: 'star trek', match: ['star trek'], color: '#2A6FB5', colorDark: '#16406B' },
  { slug: 'green-hornet', name: 'The Green Hornet', query: 'green hornet', match: ['green hornet'], color: '#1E8449', colorDark: '#0F4D2A' },
  { slug: 'tmnt', name: 'Teenage Mutant Ninja Turtles', query: 'ninja turtles', match: ['teenage mutant', 'ninja turtles'], color: '#3FA535', colorDark: '#21601C' },
  { slug: 'conan', name: 'Conan', query: 'conan', match: ['conan'], color: '#A6562B', colorDark: '#5E2F17' },
  { slug: 'ben-10', name: 'Ben 10', query: 'ben 10', match: ['ben 10'], color: '#5DBB46', colorDark: '#2F6B23' },
  { slug: 'buffy', name: 'Buffy the Vampire Slayer', query: 'buffy', match: ['buffy'], color: '#9C2B3B', colorDark: '#5A1822' },
  { slug: 'harvey', name: 'Harvey Comics', query: 'harvey', match: ['harvey'], color: '#2E78C7', colorDark: '#18467A' },
  { slug: 'terminator', name: 'The Terminator', query: 'terminator', match: ['terminator'], color: '#C0392B', colorDark: '#6E2017' },
  { slug: 'bungie', name: 'Bungie', query: 'bungie', match: ['bungie'], color: '#2E7D5B', colorDark: '#173E2D' },
  { slug: 'crystal-dynamics', name: 'Crystal Dynamics', query: 'crystal dynamics', match: ['crystal dynamics'], color: '#1F8A8A', colorDark: '#0F5050' },
  { slug: 'santa-monica-studio', name: 'Santa Monica Studio', query: 'santa monica', match: ['santa monica'], color: '#B23A2E', colorDark: '#5E1E18' },
  { slug: 'namco', name: 'Namco', query: 'namco', match: ['namco'], color: '#F2C500', colorDark: '#8A7100' },
  { slug: 'radical-entertainment', name: 'Radical Entertainment', query: 'radical entertainment', match: ['radical entertainment'], color: '#A11D1D', colorDark: '#5C1010' },
  { slug: 'alien', name: 'Alien', query: 'alien', match: ['alien'], color: '#3C6B2F', colorDark: '#1F3A19' },
  { slug: 'predator', name: 'Predator', query: 'predator', match: ['predator'], color: '#B5471E', colorDark: '#63270F' },
  { slug: 'indiana-jones', name: 'Indiana Jones', query: 'indiana jones', match: ['indiana jones'], color: '#9C6B2E', colorDark: '#5A3D18' },
  { slug: 'jurassic-park', name: 'Jurassic Park', query: 'jurassic', match: ['jurassic'], color: '#B5402E', colorDark: '#62211A' },

  // ── Legacy publishers from the original SuperheroAPI import ───────────────
  // Big rosters that were never registered (so they showed as plain text with
  // no route). Same treatment: slug + colour + match now, `logo` to follow.
  { slug: 'nintendo', name: 'Nintendo', query: 'nintendo', match: ['nintendo'], color: '#E60012', colorDark: '#8E0009' },
  { slug: 'shueisha', name: 'Shueisha', query: 'shueisha', match: ['shueisha'], color: '#E12120', colorDark: '#861313' },
  { slug: 'warp-graphics', name: 'Warp Graphics', query: 'warp graphics', match: ['warp graphics'], color: '#3E8E5A', colorDark: '#205230' },
  { slug: 'archie', name: 'Archie Comics', query: 'archie', match: ['archie'], color: '#ED1C24', colorDark: '#8E1115' },
  { slug: 'disney', name: 'Disney', query: 'disney', match: ['disney'], color: '#113CCF', colorDark: '#0A2480' },
  { slug: 'valiant', name: 'Valiant', query: 'valiant', match: ['valiant'], color: '#1B3A6B', colorDark: '#0E2444' },
  { slug: 'top-cow', name: 'Top Cow', query: 'top cow', match: ['top cow'], color: '#B5202A', colorDark: '#6E1318' },
  { slug: 'malibu', name: 'Malibu Comics', query: 'malibu', match: ['malibu'], color: '#1E73BE', colorDark: '#114571' },
  { slug: 'rebellion', name: '2000 AD', query: 'rebellion', match: ['rebellion'], color: '#F0152B', colorDark: '#8A0C19' },
  { slug: 'capcom', name: 'Capcom', query: 'capcom', match: ['capcom'], color: '#0A4DA0', colorDark: '#06305F' },
  { slug: 'sega', name: 'Sega', query: 'sega', match: ['sega'], color: '#0089CF', colorDark: '#00558A' },
  { slug: 'mattel', name: 'Mattel', query: 'mattel', match: ['mattel'], color: '#E2231A', colorDark: '#8A130E' },
  { slug: 'hasbro', name: 'Hasbro', query: 'hasbro', match: ['hasbro'], color: '#0046AD', colorDark: '#002C6E' },
  { slug: 'kodansha', name: 'Kodansha', query: 'kodansha', match: ['kodansha'], color: '#1C8A4C', colorDark: '#0E4D2A' },
];

/** Explore tiles, in display order. */
export const FEATURED_PUBLISHERS: PublisherBrand[] = ['marvel', 'dc', 'image', 'dark-horse']
  .map((slug) => PUBLISHER_BRANDS.find((b) => b.slug === slug))
  .filter((b): b is PublisherBrand => b != null);

export function publisherBySlug(slug: string | undefined): PublisherBrand | undefined {
  return PUBLISHER_BRANDS.find((b) => b.slug === slug);
}

/**
 * Resolve a raw `publisher` string from the DB to its brand, or undefined when
 * it isn't one we badge. Matches by substring in registry order.
 */
export function brandForPublisher(
  publisher: string | null | undefined,
): PublisherBrand | undefined {
  if (!publisher) return undefined;
  const p = publisher.toLowerCase();
  return PUBLISHER_BRANDS.find((brand) => brand.match.some((m) => p.includes(m)));
}

/**
 * Raw `publisher` values that are SuperheroAPI category buckets, not universes —
 * never linked as a browsable universe (see project: publisher→universe reframe).
 */
const NON_UNIVERSE_PUBLISHERS = new Set([
  'Non-Fictional',
  'Creator-Owned',
  'Company-Licensed',
  'In the Public Domain',
]);

/**
 * The browse route for a publisher/universe, or null when it isn't browsable
 * (absent, or a category bucket). Registered brands route by their stable slug;
 * every other universe routes by its raw name, which `/publisher/[slug]`
 * ilike-matches against the column. Used to make the character-page eyebrow a
 * doorway into the universe.
 */
export function publisherHref(publisher: string | null | undefined): string | null {
  if (!publisher || NON_UNIVERSE_PUBLISHERS.has(publisher)) return null;
  const slug = brandForPublisher(publisher)?.slug ?? encodeURIComponent(publisher);
  return `/publisher/${slug}`;
}
