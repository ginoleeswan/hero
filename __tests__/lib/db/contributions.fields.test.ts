import {
  EDITABLE_FIELDS,
  SUMMARY_FIELD,
  POWERS_FIELD,
  STAT_FIELDS,
  DOSSIER_GROUPS,
} from '../../../src/lib/db/contributions';

// Mirror of the server-side allow-list in _contrib_field_type (migration
// 20260618130000). This test fails if the TS field registry and the SQL
// classifier drift apart — they MUST stay in lockstep or edits will be rejected.
const SERVER = {
  list: ['aliases', 'powers'],
  stat: ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat'],
  text: [
    'origin',
    'full_name',
    'occupation',
    'base',
    'place_of_birth',
    'first_appearance',
    'alter_egos',
    'gender',
    'race',
    'height_imperial',
    'weight_imperial',
    'eye_color',
    'hair_color',
    'group_affiliation',
    'summary',
    'description',
  ],
};

function serverType(field: string): 'text' | 'list' | 'stat' | null {
  if (SERVER.list.includes(field)) return 'list';
  if (SERVER.stat.includes(field)) return 'stat';
  if (SERVER.text.includes(field)) return 'text';
  return null;
}

describe('contribution field registry ↔ server allow-list', () => {
  const all = [...EDITABLE_FIELDS, SUMMARY_FIELD, POWERS_FIELD, ...STAT_FIELDS];

  it('every editable field is allow-listed server-side with a matching type', () => {
    for (const f of all) {
      const expected = serverType(f.field);
      expect(expected).not.toBeNull();
      // A field with no explicit type defaults to 'text'.
      expect(f.type ?? 'text').toBe(expected);
    }
  });

  it('no community Dossier field is a stat (stats are admin-only)', () => {
    for (const f of EDITABLE_FIELDS) {
      expect(f.type).not.toBe('stat');
      expect(SERVER.stat).not.toContain(f.field);
    }
  });

  it('all six power stats are present and typed as stat', () => {
    expect(STAT_FIELDS.map((f) => f.field).sort()).toEqual([...SERVER.stat].sort());
    expect(STAT_FIELDS.every((f) => f.type === 'stat')).toBe(true);
  });

  it('summary and powers carry the right shape', () => {
    expect(SUMMARY_FIELD.field).toBe('summary');
    expect(POWERS_FIELD.field).toBe('powers');
    expect(POWERS_FIELD.type).toBe('list');
  });

  it('Dossier groups cover exactly the editable Dossier fields', () => {
    const grouped = DOSSIER_GROUPS.flatMap((g) => g.fields.map((f) => f.field)).sort();
    expect(grouped).toEqual(EDITABLE_FIELDS.map((f) => f.field).sort());
  });
});
