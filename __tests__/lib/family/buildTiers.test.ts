// __tests__/lib/family/buildTiers.test.ts
import { buildTiers } from '../../../src/lib/family/buildTiers';
import type { FamilyMember } from '../../../src/lib/family/types';

function member(p: Partial<FamilyMember>): FamilyMember {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'X', alias: null, role: 'role', relation: 'other', tier: 0,
    modifiers: [], status: null, position: 0,
    heroId: null, heroImage: null, heroPower: null, heroAlignment: null,
    ...p,
  };
}

describe('buildTiers', () => {
  it('orders tiers from +2 down to -2 and omits empty tiers', () => {
    const model = buildTiers([
      member({ relation: 'child', tier: -1 }),
      member({ relation: 'grandparent', tier: 2 }),
      member({ relation: 'parent', tier: 1 }),
    ]);
    expect(model.tiers.map((t) => t.tier)).toEqual([2, 1, -1]);
  });

  it('moves clones into asides, not tiers', () => {
    const model = buildTiers([member({ relation: 'clone', tier: 9 })]);
    expect(model.tiers).toHaveLength(0);
    expect(model.asides).toHaveLength(1);
  });

  it('moves non-family others into footnotes', () => {
    const model = buildTiers([member({ relation: 'other', role: 'fiancée', tier: 0 })]);
    expect(model.footnotes).toHaveLength(1);
    expect(model.tiers).toHaveLength(0);
  });

  it('keeps generic others in their tier', () => {
    const model = buildTiers([member({ relation: 'other', role: 'legal ward', tier: 0 })]);
    expect(model.tiers).toHaveLength(1);
    expect(model.footnotes).toHaveLength(0);
  });

  it('sorts members within a tier by position', () => {
    const model = buildTiers([
      member({ relation: 'parent', tier: 1, position: 2, name: 'B' }),
      member({ relation: 'parent', tier: 1, position: 0, name: 'A' }),
    ]);
    expect(model.tiers[0].members.map((m) => m.name)).toEqual(['A', 'B']);
  });
});
