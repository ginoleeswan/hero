// src/constants/publishers.ts
// The featured publisher tiles on the Explore page + their listing route.
// `query` is the ILIKE term passed to getHeroesByPublisher (publisher strings in
// the DB are messy — e.g. "Marvel" vs "Marvel Comics").

export interface PublisherConfig {
  slug: string;
  name: string;
  query: string;
  /** Brand-ish accent used as the tile's scrim tint. */
  color: string;
}

export const PUBLISHERS: PublisherConfig[] = [
  { slug: 'marvel', name: 'Marvel', query: 'marvel', color: '#C8102E' },
  { slug: 'dc', name: 'DC', query: 'dc comics', color: '#0476F2' },
  { slug: 'image', name: 'Image', query: 'image', color: '#16A085' },
  { slug: 'dark-horse', name: 'Dark Horse', query: 'dark horse', color: '#3A2E2A' },
];

export function publisherBySlug(slug: string | undefined): PublisherConfig | undefined {
  return PUBLISHERS.find((p) => p.slug === slug);
}
