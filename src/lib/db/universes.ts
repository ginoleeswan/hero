import { PUBLISHER_BRANDS, type PublisherBrand, type BrandLogo } from '../../constants/publishers';

export interface UniverseResult {
  slug: string;
  name: string;
  color: string;
  logo?: BrandLogo;
  badgeSize?: { width: number; height: number };
  logoOnLight?: boolean;
  /** Single-colour silhouette logos paint this ink (SVG only); see BrandLogoView. */
  logoTint?: string;
  /** Exact name/alias hit — ranks first and can drive a "jump straight there" affordance. */
  exact: boolean;
}

// Mirrors the normaliser used by hero rankResults: lowercase, strip separators.
const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, '');

/**
 * Fuzzy-search the brand registry for universes matching `query`. Pure and
 * synchronous (the registry is a small in-memory constant) so callers can paint
 * universe hits instantly, before the debounced hero search returns.
 * Ranking: exact (0) > prefix (1) > contains (2); ties keep registry order
 * (which is already brand-priority ordered).
 */
export function searchUniverses(query: string, limit = 6): UniverseResult[] {
  const qn = norm(query);
  if (!qn) return [];

  const scored: { brand: PublisherBrand; index: number; rank: number }[] = [];
  PUBLISHER_BRANDS.forEach((brand, index) => {
    const candidates = [brand.name, ...brand.match].map(norm);
    let rank = Infinity;
    for (const c of candidates) {
      if (c === qn) rank = Math.min(rank, 0);
      else if (c.startsWith(qn)) rank = Math.min(rank, 1);
      else if (c.includes(qn)) rank = Math.min(rank, 2);
    }
    if (rank !== Infinity) scored.push({ brand, index, rank });
  });

  scored.sort((a, b) => a.rank - b.rank || a.index - b.index);

  return scored.slice(0, limit).map(({ brand, rank }) => ({
    slug: brand.slug,
    name: brand.name,
    color: brand.color,
    logo: brand.logo,
    badgeSize: brand.badgeSize,
    logoOnLight: brand.logoOnLight,
    logoTint: brand.logoTint,
    exact: rank === 0,
  }));
}
