import { buildFamilyGraph } from '../../../src/lib/family/buildFamilyGraph';
import type { FamilyMember } from '../../../src/lib/family/types';

function m(p: Partial<FamilyMember> & { id: string }): FamilyMember {
  return {
    name: 'X', alias: null, role: 'role', relation: 'other', tier: 0,
    modifiers: [], status: null, position: 0,
    heroId: null, heroImage: null, heroPower: null, heroAlignment: null,
    treeParentId: null, branchSide: null,
    ...p,
  };
}

describe('buildFamilyGraph', () => {
  it('orders tiers +2..-2 and omits empties', () => {
    const g = buildFamilyGraph([
      m({ id: 'c', relation: 'child', tier: -1 }),
      m({ id: 'gp', relation: 'grandparent', tier: 2 }),
      m({ id: 'p', relation: 'parent', tier: 1 }),
    ]);
    expect(g.tiers.map((t) => t.tier)).toEqual([2, 1, -1]);
  });

  it('annotates a resolved node as connecting to its parent, others to hero', () => {
    const g = buildFamilyGraph([
      m({ id: 'f', relation: 'parent', tier: 1 }),
      m({ id: 'gf', relation: 'grandparent', tier: 2, treeParentId: 'f' }),
    ]);
    const gf = g.tiers.find((t) => t.tier === 2)!.nodes[0];
    const f = g.tiers.find((t) => t.tier === 1)!.nodes[0];
    expect(gf.connectTo).toEqual({ kind: 'parent', id: 'f' });
    expect(f.connectTo).toEqual({ kind: 'hero' });
  });

  it('falls back to hero when treeParentId is not present in the set', () => {
    const g = buildFamilyGraph([m({ id: 'gf', relation: 'grandparent', tier: 2, treeParentId: 'missing' })]);
    expect(g.tiers[0].nodes[0].connectTo).toEqual({ kind: 'hero' });
  });

  it('groups resolved children adjacent to their parent column', () => {
    const g = buildFamilyGraph([
      m({ id: 'f', relation: 'parent', tier: 1, position: 0 }),
      m({ id: 'mo', relation: 'parent', tier: 1, position: 1 }),
      m({ id: 'pgf', relation: 'grandparent', tier: 2, treeParentId: 'f', position: 5 }),
      m({ id: 'mgf', relation: 'grandparent', tier: 2, treeParentId: 'mo', position: 6 }),
    ]);
    expect(g.tiers.find((t) => t.tier === 2)!.nodes.map((x) => x.member.id)).toEqual(['pgf', 'mgf']);
  });

  it('extracts the spouse and flags ancestors + big tiers as collapsed', () => {
    const big = Array.from({ length: 7 }, (_, i) =>
      m({ id: `a${i}`, relation: 'ancestor', tier: 2, position: i }),
    );
    const g = buildFamilyGraph([...big, m({ id: 'sp', relation: 'spouse', tier: 0 })]);
    expect(g.spouse?.id).toBe('sp');
    expect(g.tiers.find((t) => t.tier === 2)!.collapsedByDefault).toBe(true);
  });

  it('routes clones to asides and non-family to footnotes', () => {
    const g = buildFamilyGraph([
      m({ id: 'cl', relation: 'clone', tier: 9 }),
      m({ id: 'gf', relation: 'other', role: 'girlfriend', tier: 0 }),
    ]);
    expect(g.asides.map((x) => x.id)).toEqual(['cl']);
    expect(g.footnotes.map((x) => x.id)).toEqual(['gf']);
  });
});
