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
import ImageComicsLogo from '../../assets/brands/image.svg';
import NintendoLogo from '../../assets/brands/nintendo.svg';
import ShueishaLogo from '../../assets/brands/shueisha.svg';
import DisneyLogo from '../../assets/brands/disney.svg';
import ArchieLogo from '../../assets/brands/archie.svg';
import ValiantLogo from '../../assets/brands/valiant.svg';
import CapcomLogo from '../../assets/brands/capcom.svg';
import SegaLogo from '../../assets/brands/sega.svg';
import WarpGraphicsLogo from '../../assets/brands/warp-graphics.svg';
import CdProjektRedLogo from '../../assets/brands/cd-projekt-red.svg';
import InsomniacLogo from '../../assets/brands/insomniac.svg';
import NamcoLogo from '../../assets/brands/namco.svg';
import BungieLogo from '../../assets/brands/bungie.svg';
import CrystalDynamicsLogo from '../../assets/brands/crystal-dynamics.svg';
import HannaBarberaLogo from '../../assets/brands/hanna-barbera.svg';
import HasbroLogo from '../../assets/brands/hasbro.svg';
import MattelLogo from '../../assets/brands/mattel.svg';
import SantaMonicaLogo from '../../assets/brands/santa-monica-studio.svg';
import WarnerBrosLogo from '../../assets/brands/warner-bros.svg';
import NetherRealmLogo from '../../assets/brands/netherrealm.svg';
import LooneyTunesLogo from '../../assets/brands/looney-tunes.svg';
import TmntLogo from '../../assets/brands/tmnt.svg';
import StarTrekLogo from '../../assets/brands/star-trek.svg';
import AvatarLogo from '../../assets/brands/avatar-last-airbender.svg';
import SnkLogo from '../../assets/brands/snk.svg';
import TheBoysLogo from '../../assets/brands/the-boys.svg';
import SinCityLogo from '../../assets/brands/sin-city.svg';
import PokemonLogo from '../../assets/brands/pokemon.svg';

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
  /**
   * When set, the logo is a single-colour silhouette painted this ink — so one
   * file reads on any surface (e.g. Nintendo's bare wordmark painted red). Logos
   * with their own colours (Sega, Capcom…) leave this unset and render as-is.
   */
  logoTint?: string;
  /**
   * The logo reads best on a LIGHT chip (e.g. a red/dark mark) rather than the
   * default dark chip. Drives the backing colour on the CHIP surfaces (card
   * badge, web card, clue sticker). The character-page eyebrow is chipless.
   */
  logoOnLight?: boolean;
  /**
   * Multiplier on the eyebrow logo height — for marks that read small at the
   * default size (e.g. the Star Wars wordmark wants to be much bigger).
   */
  eyebrowScale?: number;
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
    logo: require('../../assets/brands/marvel.png'),
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
    logo: require('../../assets/brands/dc.png'),
    badgeSize: { width: 20, height: 20 },
    logoOnLight: true,
    featured: true,
  },
  {
    slug: 'dark-horse',
    name: 'Dark Horse',
    query: 'dark horse',
    match: ['dark horse'],
    color: '#3A2E2A',
    colorDark: '#1E1715',
    logo: require('../../assets/brands/dark-horse.png'),
    badgeSize: { width: 16, height: 24 },
    featured: true,
  },
  {
    slug: 'star-wars',
    name: 'Star Wars',
    query: 'star wars',
    match: ['star wars', 'george lucas'],
    color: '#1A1A1A',
    colorDark: '#000000',
    logo: require('../../assets/brands/star-wars.png'),
    badgeSize: { width: 32, height: 32 },
    // Black wordmark PNG painted white via tintColor so it reads on dark; shown
    // big on the (chipless) eyebrow.
    logoTint: '#FFFFFF',
    eyebrowScale: 2.2,
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
    logoTint: '#FFFFFF',
    featured: true,
  },

  // ── Universes from the Company-Licensed re-brand ──────────────────────────
  // Registered so they badge, route, and carry a brand colour. No `logo` yet —
  // surfaces fall back to the name wordmark until transparent PNGs are added
  // (then set `logo` + `badgeSize`). Match substrings are distinct from the
  // brands above; order doesn't collide.
  {
    slug: 'netherrealm',
    name: 'NetherRealm Studios',
    query: 'netherrealm',
    match: ['netherrealm'],
    color: '#C9A227',
    colorDark: '#7A6115',
    logo: NetherRealmLogo,
    badgeSize: { width: 18, height: 20 },
  },
  {
    slug: 'babylon-5',
    name: 'Babylon 5',
    query: 'babylon 5',
    match: ['babylon 5'],
    color: '#3B4C7A',
    colorDark: '#222E4D',
  },
  {
    slug: 'avatar-last-airbender',
    name: 'Avatar: The Last Airbender',
    query: 'last airbender',
    match: ['last airbender'],
    color: '#E8A33D',
    colorDark: '#9C6418',
    logo: AvatarLogo,
    // Brushstroke wordmark — Nickelodeon splat stripped, tinted cream so it
    // reads on the orange banner and the dark chip alike.
    badgeSize: { width: 57, height: 20 },
    logoTint: '#F5EBDC',
  },
  {
    slug: 'snk',
    name: 'SNK',
    query: 'snk',
    match: ['snk'],
    color: '#D32F2F',
    colorDark: '#7F1B1B',
    logo: SnkLogo,
    // Source logo is blue; recoloured to a white silhouette so it reads on the
    // red brand banner + dark chip.
    badgeSize: { width: 80, height: 17 },
    logoTint: '#FFFFFF',
  },
  {
    slug: 'the-boys',
    name: 'The Boys',
    query: 'The Boys',
    match: ['the boys'],
    color: '#C8102E',
    colorDark: '#6E0309',
    logo: TheBoysLogo,
    // Grungy black wordmark → white silhouette on the Vought-red banner.
    badgeSize: { width: 51, height: 20 },
    logoTint: '#FFFFFF',
  },
  {
    slug: 'sin-city',
    name: 'Sin City',
    query: 'Sin City',
    match: ['sin city'],
    // Noir stage — the logo keeps its own white + signature red.
    color: '#2A2530',
    colorDark: '#121016',
    logo: SinCityLogo,
    badgeSize: { width: 30, height: 20 },
  },
  {
    slug: 'pokemon',
    name: 'Pokémon',
    query: 'Pokémon',
    match: ['pokémon', 'pokemon'],
    color: '#3B4CCA',
    colorDark: '#1E2A7A',
    logo: PokemonLogo,
    // Full-colour gradient wordmark (yellow on blue) — keeps its own ink.
    badgeSize: { width: 54, height: 20 },
  },
  {
    slug: 'gatchaman',
    name: 'Gatchaman',
    query: 'gatchaman',
    match: ['gatchaman'],
    color: '#1E66A8',
    colorDark: '#103A60',
  },
  {
    slug: 'hanna-barbera',
    name: 'Hanna-Barbera',
    query: 'hanna-barbera',
    match: ['hanna-barbera', 'hanna barbera'],
    color: '#1FA8A0',
    colorDark: '#0E5E59',
    logo: HannaBarberaLogo,
    badgeSize: { width: 59, height: 10 },
    logoOnLight: true,
  },
  {
    slug: 'looney-tunes',
    name: 'Looney Tunes',
    query: 'looney tunes',
    match: ['looney tunes'],
    color: '#E03A30',
    colorDark: '#8A201B',
    logo: LooneyTunesLogo,
    badgeSize: { width: 100, height: 48 }, // viewBox 90390×43330 ≈ 2.09:1
  },
  {
    slug: 'cd-projekt-red',
    name: 'CD Projekt Red',
    query: 'cd projekt',
    match: ['cd projekt'],
    color: '#B11A1A',
    colorDark: '#6A0F0F',
    logo: CdProjektRedLogo,
    badgeSize: { width: 37, height: 16 },
  },
  {
    slug: 'rocky-bullwinkle',
    name: 'Rocky & Bullwinkle',
    query: 'bullwinkle',
    match: ['bullwinkle', 'rocky & bullwinkle'],
    color: '#2E6FB0',
    colorDark: '#1A4068',
  },
  {
    slug: 'insomniac',
    name: 'Insomniac Games',
    query: 'insomniac',
    match: ['insomniac'],
    color: '#E87722',
    colorDark: '#8C4512',
    logo: InsomniacLogo,
    badgeSize: { width: 56, height: 11 },
  },
  {
    slug: 'star-trek',
    name: 'Star Trek',
    query: 'star trek',
    match: ['star trek'],
    color: '#2A6FB5',
    colorDark: '#16406B',
    logo: StarTrekLogo,
    // Single-colour gold wordmark — reads on the blue banner and dark chip, so
    // keep the gold (no tint).
    badgeSize: { width: 60, height: 18 },
  },
  {
    slug: 'green-hornet',
    name: 'The Green Hornet',
    query: 'green hornet',
    match: ['green hornet'],
    color: '#1E8449',
    colorDark: '#0F4D2A',
  },
  {
    slug: 'tmnt',
    name: 'Teenage Mutant Ninja Turtles',
    query: 'ninja turtles',
    match: ['teenage mutant', 'ninja turtles'],
    color: '#3FA535',
    colorDark: '#21601C',
    logo: TmntLogo,
    // Full-colour classic logo (red banner + green letters) — keep its own ink.
    badgeSize: { width: 52, height: 20 },
  },
  {
    slug: 'conan',
    name: 'Conan',
    query: 'conan',
    match: ['conan'],
    color: '#A6562B',
    colorDark: '#5E2F17',
  },
  {
    slug: 'ben-10',
    name: 'Ben 10',
    query: 'ben 10',
    match: ['ben 10'],
    color: '#5DBB46',
    colorDark: '#2F6B23',
  },
  {
    slug: 'buffy',
    name: 'Buffy the Vampire Slayer',
    query: 'buffy',
    match: ['buffy'],
    color: '#9C2B3B',
    colorDark: '#5A1822',
  },
  {
    slug: 'harvey',
    name: 'Harvey Comics',
    query: 'harvey',
    match: ['harvey'],
    color: '#2E78C7',
    colorDark: '#18467A',
  },
  {
    slug: 'terminator',
    name: 'The Terminator',
    query: 'terminator',
    match: ['terminator'],
    color: '#C0392B',
    colorDark: '#6E2017',
  },
  {
    slug: 'bungie',
    name: 'Bungie',
    query: 'bungie',
    match: ['bungie'],
    color: '#00A3E3',
    colorDark: '#0A5E86',
    logo: BungieLogo,
    badgeSize: { width: 41, height: 12 },
  },
  {
    slug: 'crystal-dynamics',
    name: 'Crystal Dynamics',
    query: 'crystal dynamics',
    match: ['crystal dynamics'],
    color: '#1F8A8A',
    colorDark: '#0F5050',
    logo: CrystalDynamicsLogo,
    badgeSize: { width: 41, height: 13 },
    logoTint: '#FFFFFF',
  },
  {
    slug: 'santa-monica-studio',
    name: 'Santa Monica Studio',
    query: 'santa monica',
    match: ['santa monica'],
    color: '#B22029',
    colorDark: '#5E1216',
    logo: SantaMonicaLogo,
    badgeSize: { width: 18, height: 20 },
  },
  {
    slug: 'namco',
    name: 'Namco',
    query: 'namco',
    match: ['namco'],
    color: '#E9001A',
    colorDark: '#8E0010',
    logo: NamcoLogo,
    badgeSize: { width: 27, height: 16 },
  },
  {
    slug: 'radical-entertainment',
    name: 'Radical Entertainment',
    query: 'radical entertainment',
    match: ['radical entertainment'],
    color: '#A11D1D',
    colorDark: '#5C1010',
  },
  {
    slug: 'alien',
    name: 'Alien',
    query: 'alien',
    match: ['alien'],
    color: '#3C6B2F',
    colorDark: '#1F3A19',
  },
  {
    slug: 'predator',
    name: 'Predator',
    query: 'predator',
    match: ['predator'],
    color: '#B5471E',
    colorDark: '#63270F',
  },
  {
    slug: 'indiana-jones',
    name: 'Indiana Jones',
    query: 'indiana jones',
    match: ['indiana jones'],
    color: '#9C6B2E',
    colorDark: '#5A3D18',
  },
  {
    slug: 'jurassic-park',
    name: 'Jurassic Park',
    query: 'jurassic',
    match: ['jurassic'],
    color: '#B5402E',
    colorDark: '#62211A',
  },

  // ── Legacy publishers from the original SuperheroAPI import ───────────────
  // Big rosters that were never registered (so they showed as plain text with
  // no route). Same treatment: slug + colour + match now, `logo` to follow.
  {
    slug: 'nintendo',
    name: 'Nintendo',
    query: 'nintendo',
    match: ['nintendo'],
    color: '#E60012',
    colorDark: '#8E0009',
    logo: NintendoLogo,
    badgeSize: { width: 56, height: 14 },
    logoTint: '#E60012',
    logoOnLight: true,
  },
  {
    slug: 'shueisha',
    name: 'Shueisha',
    query: 'shueisha',
    match: ['shueisha'],
    color: '#E12120',
    colorDark: '#861313',
    logo: ShueishaLogo,
    badgeSize: { width: 32, height: 18 },
    logoTint: '#FFFFFF',
  },
  {
    slug: 'warp-graphics',
    name: 'Warp Graphics',
    query: 'warp graphics',
    match: ['warp graphics'],
    color: '#3E8E5A',
    colorDark: '#205230',
    logo: WarpGraphicsLogo,
    badgeSize: { width: 22, height: 22 },
  },
  {
    slug: 'archie',
    name: 'Archie Comics',
    query: 'archie',
    match: ['archie'],
    color: '#ED1C24',
    colorDark: '#8E1115',
    logo: ArchieLogo,
    badgeSize: { width: 35, height: 20 },
  },
  {
    slug: 'disney',
    name: 'Disney',
    query: 'disney',
    match: ['disney'],
    color: '#113CCF',
    colorDark: '#0A2480',
    logo: DisneyLogo,
    badgeSize: { width: 38, height: 16 },
    logoTint: '#FFFFFF',
  },
  {
    slug: 'valiant',
    name: 'Valiant',
    query: 'valiant',
    match: ['valiant'],
    color: '#1B3A6B',
    colorDark: '#0E2444',
    logo: ValiantLogo,
    badgeSize: { width: 50, height: 13 },
  },
  {
    slug: 'top-cow',
    name: 'Top Cow',
    query: 'top cow',
    match: ['top cow'],
    color: '#B5202A',
    colorDark: '#6E1318',
  },
  {
    slug: 'malibu',
    name: 'Malibu Comics',
    query: 'malibu',
    match: ['malibu'],
    color: '#1E73BE',
    colorDark: '#114571',
  },
  {
    slug: 'rebellion',
    name: '2000 AD',
    query: 'rebellion',
    match: ['rebellion'],
    color: '#F0152B',
    colorDark: '#8A0C19',
    logo: require('../../assets/brands/rebellion.png'),
    badgeSize: { width: 20, height: 20 },
  },
  {
    slug: 'capcom',
    name: 'Capcom',
    query: 'capcom',
    match: ['capcom'],
    color: '#0A4DA0',
    colorDark: '#06305F',
    logo: CapcomLogo,
    badgeSize: { width: 60, height: 11 },
  },
  {
    slug: 'sega',
    name: 'Sega',
    query: 'sega',
    match: ['sega'],
    color: '#0089CF',
    colorDark: '#00558A',
    logo: SegaLogo,
    badgeSize: { width: 42, height: 14 },
  },
  {
    slug: 'mattel',
    name: 'Mattel',
    query: 'mattel',
    match: ['mattel'],
    color: '#E3000B',
    colorDark: '#8A000B',
    logo: MattelLogo,
    badgeSize: { width: 18, height: 18 },
  },
  {
    slug: 'hasbro',
    name: 'Hasbro',
    query: 'hasbro',
    match: ['hasbro'],
    color: '#0046AD',
    colorDark: '#002C6E',
    logo: HasbroLogo,
    // Wide wordmark (~1.85:1) — silhouette tinted white on the brand chip.
    badgeSize: { width: 37, height: 20 },
    logoTint: '#FFFFFF',
  },
  {
    slug: 'kodansha',
    name: 'Kodansha',
    query: 'kodansha',
    match: ['kodansha'],
    color: '#1C8A4C',
    colorDark: '#0E4D2A',
  },
  // Inert until a hero carries a "Warner Bros" publisher (0 today); logo is a
  // colorless shield silhouette → white tint.
  {
    slug: 'warner-bros',
    name: 'Warner Bros',
    query: 'warner bros',
    match: ['warner bros', 'warner brothers'],
    color: '#004B8D',
    colorDark: '#012A50',
    logo: WarnerBrosLogo,
    badgeSize: { width: 20, height: 20 },
    logoTint: '#FFFFFF',
  },
];

/** Explore tiles, in display order. */
export const FEATURED_PUBLISHERS: PublisherBrand[] = ['marvel', 'dc', 'image', 'dark-horse']
  .map((slug) => PUBLISHER_BRANDS.find((b) => b.slug === slug))
  .filter((b): b is PublisherBrand => b != null);

/**
 * Every universe, for the search landing's horizontal "Universes" rail. It's all
 * of PUBLISHER_BRANDS — the most recognizable ones are pulled to the front so the
 * rail opens strong (registry order otherwise buries Disney/Nintendo), then the
 * rest follow. Chips show the universe name, so logo-less ones still read fine.
 */
const UNIVERSE_RAIL_FRONT = [
  'marvel',
  'dc',
  'star-wars',
  'disney',
  'image',
  'dark-horse',
  'nintendo',
  'sega',
  'capcom',
  'looney-tunes',
  'shueisha',
  'valiant',
];
export const SEARCH_UNIVERSES: PublisherBrand[] = [
  ...UNIVERSE_RAIL_FRONT.map((slug) => PUBLISHER_BRANDS.find((b) => b.slug === slug)).filter(
    (b): b is PublisherBrand => b != null,
  ),
  ...PUBLISHER_BRANDS.filter((b) => !UNIVERSE_RAIL_FRONT.includes(b.slug)),
];

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
 * every other universe routes by its raw name, which `/universe/[slug]`
 * ilike-matches against the column. Used to make the character-page eyebrow a
 * doorway into the universe.
 */
export function publisherHref(publisher: string | null | undefined): string | null {
  if (!publisher || NON_UNIVERSE_PUBLISHERS.has(publisher)) return null;
  const slug = brandForPublisher(publisher)?.slug ?? encodeURIComponent(publisher);
  return `/universe/${slug}`;
}
