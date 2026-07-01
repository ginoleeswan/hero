// Curated game-franchise allowlist for IGDB ingestion. Single source of truth;
// adding a franchise is one entry here. `marqueeTiers` are hand-rated fame_tier
// values (0-4) for headliners that must surface immediately; everyone else
// defaults to 0 and earns fame via the Wikidata drain. No https/Deno imports —
// this file is imported by both the Deno edge function and Jest.

export interface FranchiseEntry {
  franchise: string;
  publisher: string;
  /** Optional explicit IGDB franchise id, used when the name is ambiguous. */
  igdbFranchiseId?: number;
  /** characterName -> fame_tier (0-4). Keys are matched normalized. */
  marqueeTiers: Record<string, number>;
}

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const IGDB_ALLOWLIST: FranchiseEntry[] = [
  {
    franchise: 'Final Fantasy',
    publisher: 'Square Enix',
    marqueeTiers: {
      'Cloud Strife': 4, Sephiroth: 4, 'Tifa Lockhart': 3, 'Aerith Gainsborough': 3,
      'Squall Leonhart': 3, Lightning: 3, 'Noctis Lucis Caelum': 3,
    },
  },
  {
    franchise: 'Kingdom Hearts',
    publisher: 'Square Enix',
    marqueeTiers: { Sora: 3, Riku: 3, Kairi: 2, Aqua: 2 },
  },
  {
    franchise: 'NieR',
    publisher: 'Square Enix',
    marqueeTiers: { '2B': 4, '9S': 3, A2: 2 },
  },
  {
    franchise: 'Tomb Raider',
    publisher: 'Square Enix',
    marqueeTiers: { 'Lara Croft': 4 },
  },
  {
    franchise: 'Warcraft',
    publisher: 'Blizzard Entertainment',
    marqueeTiers: {
      'Sylvanas Windrunner': 4, 'Arthas Menethil': 4, Thrall: 3, 'Jaina Proudmoore': 3,
      'Illidan Stormrage': 3,
    },
  },
  {
    franchise: 'Diablo',
    publisher: 'Blizzard Entertainment',
    marqueeTiers: { Diablo: 3, Lilith: 3, 'Deckard Cain': 2 },
  },
  {
    franchise: 'The Witcher',
    publisher: 'CD Projekt Red',
    marqueeTiers: { 'Geralt of Rivia': 4, Yennefer: 3, Ciri: 3, 'Triss Merigold': 3 },
  },
  {
    franchise: 'Persona',
    publisher: 'Atlus',
    marqueeTiers: { Joker: 3, 'Yu Narukami': 2, 'Makoto Yuki': 2, Morgana: 2 },
  },
  {
    franchise: 'Halo',
    publisher: 'Xbox Game Studios',
    marqueeTiers: { 'Master Chief': 4, Cortana: 3, Arbiter: 2 },
  },
  {
    franchise: 'God of War',
    publisher: 'PlayStation Studios',
    marqueeTiers: { Kratos: 4, Atreus: 3 },
  },
  {
    franchise: 'Metal Gear',
    publisher: 'Konami',
    marqueeTiers: { 'Solid Snake': 4, 'Big Boss': 3, Raiden: 2, 'Revolver Ocelot': 2 },
  },
  {
    franchise: 'The Elder Scrolls',
    publisher: 'Bethesda',
    marqueeTiers: { Dragonborn: 3, 'Alduin': 2 },
  },
  {
    franchise: 'Fallout',
    publisher: 'Bethesda',
    marqueeTiers: { 'Vault Boy': 2 },
  },
  {
    franchise: 'Mass Effect',
    publisher: 'Electronic Arts',
    marqueeTiers: { 'Commander Shepard': 3, 'Garrus Vakarian': 3, 'Liara T\'Soni': 2, 'Tali\'Zorah': 2 },
  },
];

// NOT INGESTABLE FROM IGDB — verified 2026-07-01 that IGDB has no character
// records for these (their characters either don't exist there or aren't linked
// to games): League of Legends, Valorant, Overwatch, Apex Legends, Genshin
// Impact (hero-shooters/gacha), plus Cyberpunk and Tekken. They were dropped
// from the allowlist above; sourcing them needs a different pipeline
// (Wikipedia/Wikidata or a game-specific API), not IGDB.

const tierIndex = new Map<FranchiseEntry, Map<string, number>>();

export function marqueeTier(entry: FranchiseEntry, characterName: string): number {
  let idx = tierIndex.get(entry);
  if (!idx) {
    idx = new Map(
      Object.entries(entry.marqueeTiers).map(([k, v]) => [normalizeName(k), v]),
    );
    tierIndex.set(entry, idx);
  }
  return idx.get(normalizeName(characterName)) ?? 0;
}
