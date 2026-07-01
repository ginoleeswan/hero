// __tests__/supabase/igdb-transform.test.ts
import {
  mugShotUrl,
  characterToHeroRow,
  dedupDecision,
  type IgdbCharacter,
  type ExistingRow,
} from '../../supabase/functions/_shared/igdb-transform';
import { IGDB_ALLOWLIST } from '../../supabase/functions/_shared/igdb-allowlist';

const ff = IGDB_ALLOWLIST.find((e) => e.franchise === 'Final Fantasy')!;
const witcher = IGDB_ALLOWLIST.find((e) => e.franchise === 'The Witcher')!;
const tr = IGDB_ALLOWLIST.find((e) => e.franchise === 'Tomb Raider')!;
const NOW = '2026-07-01T00:00:00.000Z';

describe('mugShotUrl', () => {
  it('builds a 720p image url from an image id', () => {
    expect(mugShotUrl('abc123')).toBe(
      'https://images.igdb.com/igdb/image/upload/t_720p/abc123.jpg',
    );
  });
  it('returns null when no image id', () => {
    expect(mugShotUrl(null)).toBeNull();
    expect(mugShotUrl(undefined)).toBeNull();
  });
});

describe('characterToHeroRow', () => {
  it('maps an IGDB character to a new hero row with marquee tier + pending wikidata', () => {
    const c: IgdbCharacter = {
      id: 55,
      name: 'Cloud Strife',
      description: 'SOLDIER.',
      mug_shot: { image_id: 'img1' },
    };
    const row = characterToHeroRow(c, ff, NOW);
    expect(row.id).toMatch(/^h_[0-9a-f-]{36}$/);
    expect(row.igdb_id).toBe('55');
    expect(row.name).toBe('Cloud Strife');
    expect(row.publisher).toBe('Square Enix');
    expect(row.franchise).toBe('Final Fantasy');
    expect(row.fame_tier).toBe(4);
    expect(row.wikidata_status).toBe('pending');
    expect(row.igdb_status).toBe('enriched');
    expect(row.ai_stats_status).toBeNull();
    expect(row.image_url).toBe('https://images.igdb.com/igdb/image/upload/t_720p/img1.jpg');
    expect(row.summary).toBe('SOLDIER.');
    expect(row.enriched_at).toBe(NOW);
  });
  it('defaults non-marquee characters to fame_tier 0', () => {
    const row = characterToHeroRow({ id: 9, name: 'Town Guard' }, ff, NOW);
    expect(row.fame_tier).toBe(0);
  });
});

describe('dedupDecision', () => {
  it('skips when the igdb_id already exists', () => {
    const existing: ExistingRow[] = [
      {
        id: 'igdb-55',
        name: 'Cloud Strife',
        publisher: 'Square Enix',
        comicvine_id: null,
        igdb_id: '55',
      },
    ];
    const d = dedupDecision({ id: 55, name: 'Cloud Strife' }, ff, existing, NOW);
    expect(d.kind).toBe('skip');
  });

  it('re-homes an orphaned game character (non-comic publisher)', () => {
    const existing: ExistingRow[] = [
      {
        id: 'cv-900',
        name: 'Lara Croft',
        publisher: 'Crystal Dynamics',
        comicvine_id: '900',
        igdb_id: null,
      },
    ];
    const d = dedupDecision({ id: 7, name: 'Lara Croft' }, tr, existing, NOW);
    expect(d.kind).toBe('rehome');
    if (d.kind === 'rehome') {
      expect(d.targetId).toBe('cv-900');
      expect(d.patch.publisher).toBe('Square Enix');
      expect(d.patch.franchise).toBe('Tomb Raider');
      expect(d.patch.igdb_id).toBe('7');
    }
  });

  it('does NOT re-home a comic character that merely shares a name (collision)', () => {
    const existing: ExistingRow[] = [
      { id: 'h_x', name: 'Ciri', publisher: 'DC Comics', comicvine_id: '111', igdb_id: null },
    ];
    const d = dedupDecision({ id: 22, name: 'Ciri' }, witcher, existing, NOW);
    expect(d.kind).toBe('insert');
    if (d.kind === 'insert') expect(d.row.id).toMatch(/^h_/);
  });

  it('inserts a new row when there is no match', () => {
    const d = dedupDecision({ id: 30, name: 'Geralt of Rivia' }, witcher, [], NOW);
    expect(d.kind).toBe('insert');
  });

  it('skips a same-name character already ingested from IGDB (per-game duplicate)', () => {
    const existing: ExistingRow[] = [
      {
        id: 'h_abc',
        name: 'Lara Croft',
        publisher: 'Square Enix',
        comicvine_id: null,
        igdb_id: '5',
      },
    ];
    // IGDB lists the same character once per game; a second entry (#7) with the
    // same name must NOT create a duplicate row.
    const d = dedupDecision({ id: 7, name: 'Lara Croft' }, tr, existing, NOW);
    expect(d.kind).toBe('skip');
  });

  it('inserts (not re-home) when the name is ambiguous across multiple rows', () => {
    const existing: ExistingRow[] = [
      { id: 'a', name: 'Triss', publisher: 'Crystal Dynamics', comicvine_id: null, igdb_id: null },
      { id: 'b', name: 'Triss', publisher: 'Some Studio', comicvine_id: null, igdb_id: null },
    ];
    const d = dedupDecision({ id: 40, name: 'Triss' }, witcher, existing, NOW);
    expect(d.kind).toBe('insert');
  });
});
