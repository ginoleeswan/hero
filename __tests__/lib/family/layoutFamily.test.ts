import { layoutFamily, HERO_ID } from '../../../src/lib/family/layoutFamily';
import { buildFamilyGraph } from '../../../src/lib/family/buildFamilyGraph';
import type { FamilyMember } from '../../../src/lib/family/types';

function m(p: Partial<FamilyMember> & { id: string }): FamilyMember {
  return {
    name: p.id,
    alias: null,
    role: 'role',
    relation: 'other',
    tier: 0,
    modifiers: [],
    status: null,
    position: 0,
    heroId: null,
    heroImage: null,
    heroPower: null,
    heroAlignment: null,
    treeParentId: null,
    branchSide: null,
    ...p,
  };
}
const layout = (members: FamilyMember[]) => layoutFamily(buildFamilyGraph(members));

describe('layoutFamily', () => {
  it('includes the hero node and one node per member', () => {
    const out = layout([
      m({ id: 'f', relation: 'parent', tier: 1 }),
      m({ id: 'c', relation: 'child', tier: -1 }),
    ]);
    expect(out.nodes.map((n) => n.id).sort()).toEqual([HERO_ID, 'c', 'f'].sort());
    expect(out.nodes.find((n) => n.isHero)?.id).toBe(HERO_ID);
  });

  it('places ancestors above the hero and descendants below', () => {
    const out = layout([
      m({ id: 'gp', relation: 'grandparent', tier: 2 }),
      m({ id: 'f', relation: 'parent', tier: 1 }),
      m({ id: 'c', relation: 'child', tier: -1 }),
      m({ id: 'gc', relation: 'grandchild', tier: -2 }),
    ]);
    const y = (id: string) => out.nodes.find((n) => n.id === id)!.y;
    expect(y('gp')).toBeLessThan(y('f'));
    expect(y('f')).toBeLessThan(y(HERO_ID));
    expect(y(HERO_ID)).toBeLessThan(y('c'));
    expect(y('c')).toBeLessThan(y('gc'));
  });

  it('puts siblings on one side of the hero and the spouse on the other', () => {
    const out = layout([
      m({ id: 'b', relation: 'sibling', tier: 0 }),
      m({ id: 'w', relation: 'spouse', tier: 0 }),
    ]);
    const x = (id: string) => out.nodes.find((n) => n.id === id)!.x;
    expect(x('b')).toBeLessThan(x(HERO_ID));
    expect(x('w')).toBeGreaterThan(x(HERO_ID));
  });

  it('emits marriage, sibling, and bloodline edges with correct kinds', () => {
    const out = layout([
      m({ id: 'w', relation: 'spouse', tier: 0 }),
      m({ id: 'b', relation: 'sibling', tier: 0 }),
      m({ id: 'f', relation: 'parent', tier: 1 }),
    ]);
    const kind = (to: string) => out.edges.find((e) => e.toId === to || e.fromId === to)!.kind;
    expect(kind('w')).toBe('marriage');
    expect(kind('b')).toBe('sibling');
    expect(kind('f')).toBe('bloodline');
  });

  it('positions a resolved grandparent over its parent column', () => {
    const out = layout([
      m({ id: 'f', relation: 'parent', tier: 1 }),
      m({ id: 'gp', relation: 'grandparent', tier: 2, treeParentId: 'f' }),
    ]);
    const x = (id: string) => out.nodes.find((n) => n.id === id)!.x;
    expect(Math.abs(x('gp') - x('f'))).toBeLessThan(1);
  });

  it('produces positive coords, a bounds box, and generation rows', () => {
    const out = layout([m({ id: 'f', relation: 'parent', tier: 1 })]);
    expect(out.nodes.every((n) => n.x >= 0 && n.y >= 0)).toBe(true);
    expect(out.bounds.width).toBeGreaterThan(0);
    expect(out.bounds.height).toBeGreaterThan(0);
    expect(out.rows.map((r) => r.tier)).toEqual(expect.arrayContaining([0, 1]));
  });
});
