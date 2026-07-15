// Pure, asset-free projection of PUBLISHER_BRANDS (src/constants/publishers.ts)
// — slug / name / query / match only. The RN-free crawler bundle
// (api/_lib/botPage.ts) and the standalone sitemap script (scripts/…) resolve a
// raw `publisher` string to its canonical universe slug through this module,
// without importing the SVG/PNG logos that make publishers.ts un-importable
// outside React Native (and outside the Vercel functions in api/).
//
// This is a MIRROR, not the source of truth: PUBLISHER_BRANDS stays canonical.
// __tests__/constants/universeBrands.test.ts asserts the two never drift —
// slug/name/query/match must equal PUBLISHER_BRANDS exactly, in registry order —
// so a brand added or renamed there fails CI until mirrored here.

export type UniverseBrand = { slug: string; name: string; query: string; match: string[] };

/** Mirror of PUBLISHER_BRANDS (slug/name/query/match), in registry (detection)
 *  order — `match` is checked in order, so ordering is load-bearing. */
export const UNIVERSE_BRANDS: UniverseBrand[] = [
  { slug: 'marvel', name: 'Marvel', query: 'marvel', match: ['marvel'] },
  { slug: 'dc', name: 'DC', query: 'dc comics', match: ['dc comics', 'dc'] },
  { slug: 'dark-horse', name: 'Dark Horse', query: 'dark horse', match: ['dark horse'] },
  {
    slug: 'star-wars',
    name: 'Star Wars',
    query: 'star wars',
    match: ['star wars', 'george lucas'],
  },
  { slug: 'image', name: 'Image', query: 'image', match: ['image'] },
  {
    slug: 'netherrealm',
    name: 'NetherRealm Studios',
    query: 'netherrealm',
    match: ['netherrealm'],
  },
  { slug: 'babylon-5', name: 'Babylon 5', query: 'babylon 5', match: ['babylon 5'] },
  {
    slug: 'avatar-last-airbender',
    name: 'Avatar: The Last Airbender',
    query: 'last airbender',
    match: ['last airbender'],
  },
  { slug: 'snk', name: 'SNK', query: 'snk', match: ['snk'] },
  { slug: 'the-boys', name: 'The Boys', query: 'The Boys', match: ['the boys'] },
  { slug: 'sin-city', name: 'Sin City', query: 'Sin City', match: ['sin city'] },
  { slug: 'pokemon', name: 'Pokémon', query: 'Pokémon', match: ['pokémon', 'pokemon'] },
  { slug: 'gatchaman', name: 'Gatchaman', query: 'gatchaman', match: ['gatchaman'] },
  {
    slug: 'hanna-barbera',
    name: 'Hanna-Barbera',
    query: 'hanna-barbera',
    match: ['hanna-barbera', 'hanna barbera'],
  },
  { slug: 'looney-tunes', name: 'Looney Tunes', query: 'looney tunes', match: ['looney tunes'] },
  { slug: 'cd-projekt-red', name: 'CD Projekt Red', query: 'cd projekt', match: ['cd projekt'] },
  {
    slug: 'rocky-bullwinkle',
    name: 'Rocky & Bullwinkle',
    query: 'bullwinkle',
    match: ['bullwinkle', 'rocky & bullwinkle'],
  },
  { slug: 'insomniac', name: 'Insomniac Games', query: 'insomniac', match: ['insomniac'] },
  { slug: 'star-trek', name: 'Star Trek', query: 'star trek', match: ['star trek'] },
  {
    slug: 'green-hornet',
    name: 'The Green Hornet',
    query: 'green hornet',
    match: ['green hornet'],
  },
  {
    slug: 'tmnt',
    name: 'Teenage Mutant Ninja Turtles',
    query: 'ninja turtles',
    match: ['teenage mutant', 'ninja turtles'],
  },
  { slug: 'conan', name: 'Conan', query: 'conan', match: ['conan'] },
  { slug: 'ben-10', name: 'Ben 10', query: 'ben 10', match: ['ben 10'] },
  { slug: 'buffy', name: 'Buffy the Vampire Slayer', query: 'buffy', match: ['buffy'] },
  { slug: 'harvey', name: 'Harvey Comics', query: 'harvey', match: ['harvey'] },
  { slug: 'terminator', name: 'The Terminator', query: 'terminator', match: ['terminator'] },
  { slug: 'bungie', name: 'Bungie', query: 'bungie', match: ['bungie'] },
  {
    slug: 'crystal-dynamics',
    name: 'Crystal Dynamics',
    query: 'crystal dynamics',
    match: ['crystal dynamics'],
  },
  {
    slug: 'playstation-studios',
    name: 'PlayStation Studios',
    query: 'playstation studios',
    match: ['playstation studios', 'playstation'],
  },
  {
    slug: 'xbox-game-studios',
    name: 'Xbox Game Studios',
    query: 'xbox game studios',
    match: ['xbox game studios', 'xbox game'],
  },
  { slug: 'god-of-war', name: 'God of War', query: 'god of war', match: ['god of war'] },
  { slug: 'halo', name: 'Halo', query: 'halo', match: ['halo'] },
  {
    slug: 'santa-monica-studio',
    name: 'Santa Monica Studio',
    query: 'santa monica',
    match: ['santa monica'],
  },
  { slug: 'namco', name: 'Namco', query: 'namco', match: ['namco'] },
  {
    slug: 'radical-entertainment',
    name: 'Radical Entertainment',
    query: 'radical entertainment',
    match: ['radical entertainment'],
  },
  { slug: 'alien', name: 'Alien', query: 'alien', match: ['alien'] },
  { slug: 'predator', name: 'Predator', query: 'predator', match: ['predator'] },
  {
    slug: 'indiana-jones',
    name: 'Indiana Jones',
    query: 'indiana jones',
    match: ['indiana jones'],
  },
  { slug: 'jurassic-park', name: 'Jurassic Park', query: 'jurassic', match: ['jurassic'] },
  { slug: 'nintendo', name: 'Nintendo', query: 'nintendo', match: ['nintendo'] },
  { slug: 'shueisha', name: 'Shueisha', query: 'shueisha', match: ['shueisha'] },
  {
    slug: 'warp-graphics',
    name: 'Warp Graphics',
    query: 'warp graphics',
    match: ['warp graphics'],
  },
  { slug: 'archie', name: 'Archie Comics', query: 'archie', match: ['archie'] },
  { slug: 'disney', name: 'Disney', query: 'disney', match: ['disney'] },
  { slug: 'valiant', name: 'Valiant', query: 'valiant', match: ['valiant'] },
  { slug: 'top-cow', name: 'Top Cow', query: 'top cow', match: ['top cow'] },
  { slug: 'malibu', name: 'Malibu Comics', query: 'malibu', match: ['malibu'] },
  { slug: 'rebellion', name: '2000 AD', query: 'rebellion', match: ['rebellion'] },
  { slug: 'capcom', name: 'Capcom', query: 'capcom', match: ['capcom'] },
  { slug: 'sega', name: 'Sega', query: 'sega', match: ['sega'] },
  { slug: 'mattel', name: 'Mattel', query: 'mattel', match: ['mattel'] },
  { slug: 'hasbro', name: 'Hasbro', query: 'hasbro', match: ['hasbro'] },
  { slug: 'kodansha', name: 'Kodansha', query: 'kodansha', match: ['kodansha'] },
  {
    slug: 'warner-bros',
    name: 'Warner Bros',
    query: 'warner bros',
    match: ['warner bros', 'warner brothers'],
  },
];

/** Raw `publisher` values that are SuperheroAPI category buckets, not universes —
 *  never linked as a browsable universe. Mirrors NON_UNIVERSE_PUBLISHERS in
 *  publishers.ts. */
export const NON_UNIVERSE_PUBLISHERS = new Set<string>([
  'Non-Fictional',
  'Creator-Owned',
  'Company-Licensed',
  'In the Public Domain',
]);

/** Resolve a raw DB `publisher` to its brand by substring match, in registry
 *  order. Mirrors brandForPublisher() in publishers.ts. */
export function universeBrandForPublisher(
  publisher: string | null | undefined,
): UniverseBrand | undefined {
  if (!publisher) return undefined;
  const p = publisher.toLowerCase();
  return UNIVERSE_BRANDS.find((brand) => brand.match.some((m) => p.includes(m)));
}

/** Resolve a URL slug to its registered brand, or undefined. */
export function universeBrandBySlug(slug: string | null | undefined): UniverseBrand | undefined {
  if (!slug) return undefined;
  return UNIVERSE_BRANDS.find((brand) => brand.slug === slug);
}

/** The canonical `/universe/*` href for a publisher, or null when it isn't a
 *  browsable universe (absent, or a category bucket). Registered brands route by
 *  their stable slug; every other universe by its URL-encoded raw name. Mirrors
 *  publisherHref() in publishers.ts — the single canonical universe URL that the
 *  sitemap, character bot pages, and universe bot page all agree on. */
export function universeHref(publisher: string | null | undefined): string | null {
  if (!publisher || NON_UNIVERSE_PUBLISHERS.has(publisher)) return null;
  const slug = universeBrandForPublisher(publisher)?.slug ?? encodeURIComponent(publisher);
  return `/universe/${slug}`;
}
