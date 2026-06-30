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
    franchise: 'League of Legends',
    publisher: 'Riot Games',
    marqueeTiers: {
      Jinx: 4, Ahri: 3, Yasuo: 3, Lux: 3, Teemo: 3, Ezreal: 2, Garen: 2, Vi: 3, Jhin: 2,
    },
  },
  {
    franchise: 'Valorant',
    publisher: 'Riot Games',
    marqueeTiers: { Jett: 3, Sage: 2, Phoenix: 2, Reyna: 2 },
  },
  {
    franchise: 'Overwatch',
    publisher: 'Blizzard Entertainment',
    marqueeTiers: {
      Tracer: 4, Genji: 3, Reaper: 3, Mercy: 3, 'D.Va': 3, Widowmaker: 3, Reinhardt: 2,
    },
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
    publisher: 'CD Projekt',
    marqueeTiers: { 'Geralt of Rivia': 4, Yennefer: 3, Ciri: 3, 'Triss Merigold': 3 },
  },
  {
    franchise: 'Cyberpunk',
    publisher: 'CD Projekt',
    marqueeTiers: { 'Johnny Silverhand': 3, V: 3, 'Panam Palmer': 2 },
  },
  {
    franchise: 'Genshin Impact',
    publisher: 'HoYoverse',
    marqueeTiers: {
      'Raiden Shogun': 3, Zhongli: 3, 'Hu Tao': 3, Venti: 3, Ganyu: 3, Paimon: 3,
      Klee: 2, Aether: 2, Lumine: 2,
    },
  },
  {
    franchise: 'Persona',
    publisher: 'Atlus',
    marqueeTiers: { Joker: 3, 'Yu Narukami': 2, 'Makoto Yuki': 2, Morgana: 2 },
  },
  {
    franchise: 'Tekken',
    publisher: 'Bandai Namco',
    marqueeTiers: { 'Kazuya Mishima': 3, 'Jin Kazama': 3, 'Heihachi Mishima': 3, 'Nina Williams': 2 },
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
  {
    franchise: 'Apex Legends',
    publisher: 'Electronic Arts',
    marqueeTiers: { Wraith: 3, Octane: 2, Bloodhound: 2, Lifeline: 2, Bangalore: 2, Pathfinder: 2 },
  },
];

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
