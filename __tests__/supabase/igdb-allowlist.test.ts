import {
  IGDB_ALLOWLIST,
  marqueeTier,
  normalizeName,
  type FranchiseEntry,
} from '../../supabase/functions/_shared/igdb-allowlist';

describe('igdb allowlist', () => {
  it('has 14 unique IGDB-ingestable franchises across the expected publishers', () => {
    const names = IGDB_ALLOWLIST.map((e) => e.franchise);
    expect(names.length).toBe(14);
    expect(new Set(names).size).toBe(14);
    // IGDB-empty franchises were removed (LoL/Valorant/Overwatch/Apex/Genshin/
    // Cyberpunk/Tekken) — assert a couple stay gone.
    expect(IGDB_ALLOWLIST.find((e) => e.franchise === 'Overwatch')).toBeUndefined();
    expect(IGDB_ALLOWLIST.find((e) => e.franchise === 'Tekken')).toBeUndefined();
    expect(IGDB_ALLOWLIST.find((e) => e.franchise === 'Final Fantasy')?.publisher).toBe(
      'Square Enix',
    );
    expect(IGDB_ALLOWLIST.find((e) => e.franchise === 'Halo')?.publisher).toBe('Xbox Game Studios');
  });

  it('every entry has a publisher and a marqueeTiers map', () => {
    IGDB_ALLOWLIST.forEach((e: FranchiseEntry) => {
      expect(typeof e.publisher).toBe('string');
      expect(e.publisher.length).toBeGreaterThan(0);
      expect(typeof e.marqueeTiers).toBe('object');
    });
  });

  it('marqueeTier resolves headliners case/punctuation-insensitively, else 0', () => {
    const ff = IGDB_ALLOWLIST.find((e) => e.franchise === 'Final Fantasy')!;
    expect(marqueeTier(ff, 'cloud  strife')).toBe(4);
    expect(marqueeTier(ff, 'Sephiroth')).toBe(4);
    expect(marqueeTier(ff, 'Random NPC')).toBe(0);
  });

  it('normalizeName lowercases and strips non-alphanumerics', () => {
    expect(normalizeName('Mr. Mime!')).toBe('mrmime');
    expect(normalizeName('Cloud Strife')).toBe('cloudstrife');
  });
});
