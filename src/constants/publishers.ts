// src/constants/publishers.ts
// The featured publisher tiles on the Explore page + their listing route.
// `query` is the ILIKE term passed to getHeroesByPublisher (publisher strings in
// the DB are messy — e.g. "Marvel" vs "Marvel Comics").
import type { ImageSourcePropType } from 'react-native';

export interface PublisherConfig {
  slug: string;
  name: string;
  query: string;
  /** Brand-ish accent used for the wordmark fallback. */
  color: string;
  /** Logo asset; the tile falls back to the name wordmark when absent. */
  logo?: ImageSourcePropType;
}

export const PUBLISHERS: PublisherConfig[] = [
  {
    slug: 'marvel',
    name: 'Marvel',
    query: 'marvel',
    color: '#C8102E',
    logo: require('../../assets/images/Marvel_Logo.png'),
  },
  {
    slug: 'dc',
    name: 'DC',
    query: 'dc comics',
    color: '#0476F2',
    logo: require('../../assets/images/DC-Logo.png'),
  },
  { slug: 'image', name: 'Image', query: 'image', color: '#16A085' },
  {
    slug: 'dark-horse',
    name: 'Dark Horse',
    query: 'dark horse',
    color: '#3A2E2A',
    logo: require('../../assets/images/Dark_Horse_Comics_logo.png'),
  },
];

export function publisherBySlug(slug: string | undefined): PublisherConfig | undefined {
  return PUBLISHERS.find((p) => p.slug === slug);
}
