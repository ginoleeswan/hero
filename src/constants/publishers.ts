// src/constants/publishers.ts
// Single source of truth for publisher branding.
//
// Publisher strings in the DB are messy and inconsistent — "Marvel" vs
// "Marvel Comics", "George Lucas" for Star Wars, etc. Every surface that needs
// a logo, brand colour, or browse route resolves it through this registry so
// the same hero brands the same way everywhere (search cards, web cards,
// Explore tiles, publisher route).
import type { ImageSourcePropType } from 'react-native';

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
  /** Logo asset; surfaces fall back to the name wordmark/text when absent. */
  logo?: ImageSourcePropType;
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
    logo: require('../../assets/images/image-comics-logo.svg'),
    badgeSize: { width: 50, height: 20 },
    featured: true,
  },
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
export function brandForPublisher(publisher: string | null | undefined): PublisherBrand | undefined {
  if (!publisher) return undefined;
  const p = publisher.toLowerCase();
  return PUBLISHER_BRANDS.find((brand) => brand.match.some((m) => p.includes(m)));
}
