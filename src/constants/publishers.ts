// src/constants/publishers.ts
// The featured publisher tiles on the Explore page + their listing route.
// `query` is the ILIKE term passed to getHeroesByPublisher (publisher strings in
// the DB are messy — e.g. "Marvel" vs "Marvel Comics").
import type { ImageSourcePropType } from 'react-native';

export interface PublisherConfig {
  slug: string;
  name: string;
  query: string;
  /** Brand accent (wordmark fallback + tile gradient top). */
  color: string;
  /** Darker shade of the brand colour (tile gradient bottom). */
  colorDark: string;
  /** Logo asset; the tile falls back to the name wordmark when absent. */
  logo?: ImageSourcePropType;
}

export const PUBLISHERS: PublisherConfig[] = [
  {
    slug: 'marvel',
    name: 'Marvel',
    query: 'marvel',
    color: '#C8102E',
    colorDark: '#7E0A1D',
    logo: require('../../assets/images/Marvel_Logo.png'),
  },
  {
    slug: 'dc',
    name: 'DC',
    query: 'dc comics',
    color: '#0476F2',
    colorDark: '#03489A',
    logo: require('../../assets/images/DC-Logo.png'),
  },
  { slug: 'image', name: 'Image', query: 'image', color: '#16A085', colorDark: '#0C5F4E' },
  {
    slug: 'dark-horse',
    name: 'Dark Horse',
    query: 'dark horse',
    color: '#3A2E2A',
    colorDark: '#1E1715',
    logo: require('../../assets/images/Dark_Horse_Comics_logo.png'),
  },
];

export function publisherBySlug(slug: string | undefined): PublisherConfig | undefined {
  return PUBLISHERS.find((p) => p.slug === slug);
}
