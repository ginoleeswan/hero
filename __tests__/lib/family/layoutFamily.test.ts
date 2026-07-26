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
    heroAvatar: null,
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

  // A dynasty is recorded far deeper than a nuclear family — Daenerys
  // Targaryen's line runs twelve generations back to Aegon the Conqueror. Both
  // buildFamilyGraph and layoutFamily used to hard-code a +2..-2 window, which
  // dropped every one of those generations before it could be drawn.
  describe('deep lineage', () => {
    // g1 is the parent, g2 the grandparent, then a chain up to tier 6.
    const lineage = [
      m({ id: 'g1', relation: 'parent', tier: 1 }),
      m({ id: 'g2', relation: 'grandparent', tier: 2, treeParentId: 'g1' }),
      m({ id: 'g3', relation: 'ancestor', tier: 3, treeParentId: 'g2' }),
      m({ id: 'g4', relation: 'ancestor', tier: 4, treeParentId: 'g3' }),
      m({ id: 'g5', relation: 'ancestor', tier: 5, treeParentId: 'g4' }),
      m({ id: 'g6', relation: 'ancestor', tier: 6, treeParentId: 'g5' }),
    ];

    it('keeps every generation instead of truncating above grandparents', () => {
      const out = layout(lineage);
      expect(out.nodes.map((n) => n.id).sort()).toEqual(
        [HERO_ID, 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'].sort(),
      );
    });

    it('stacks each generation strictly higher than the one below it', () => {
      const out = layout(lineage);
      const y = (id: string) => out.nodes.find((n) => n.id === id)!.y;
      for (const [lower, higher] of [
        ['g1', 'g2'],
        ['g2', 'g3'],
        ['g3', 'g4'],
        ['g4', 'g5'],
        ['g5', 'g6'],
      ]) {
        expect(y(higher)).toBeLessThan(y(lower));
      }
    });

    it('chains each ancestor to the forebear it descends through', () => {
      const out = layout(lineage);
      const parentOf = (id: string) => out.edges.find((e) => e.toId === id)?.fromId;
      expect(parentOf('g2')).toBe('g1');
      expect(parentOf('g4')).toBe('g3');
      expect(parentOf('g6')).toBe('g5');
    });

    it('labels deep rows rather than leaving them blank', () => {
      const out = layout(lineage);
      const label = (tier: number) => out.rows.find((r) => r.tier === tier)?.label;
      // Uniform from depth 4 down, so consecutive rows keep the same shape and
      // width in a gutter that has to stay on one line.
      expect(label(3)).toBe('Great-grandparents');
      expect(label(4)).toBe('2× great-grandparents');
      expect(label(6)).toBe('4× great-grandparents');
    });

    it('attaches an ancestor whose forebear is missing to the hero, not nowhere', () => {
      // g3's treeParentId points at a tier-2 node that is not in the set.
      const out = layout([
        m({ id: 'g1', relation: 'parent', tier: 1 }),
        m({ id: 'g3', relation: 'ancestor', tier: 3, treeParentId: 'absent' }),
      ]);
      expect(out.nodes.map((n) => n.id)).toContain('g3');
      expect(out.edges.find((e) => e.toId === 'g3')?.fromId).toBe(HERO_ID);
    });
  });

  // The descendant half was capped at grandchildren while ancestors ran deep,
  // so Aegon the Conqueror's line stopped at his grandsons even though Daenerys
  // could see all the way back up to him.
  describe('deep descent', () => {
    const line = [
      m({ id: 'd1', relation: 'child', tier: -1 }),
      m({ id: 'd2', relation: 'grandchild', tier: -2, treeParentId: 'd1' }),
      m({ id: 'd3', relation: 'descendant', tier: -3, treeParentId: 'd2' }),
      m({ id: 'd4', relation: 'descendant', tier: -4, treeParentId: 'd3' }),
      m({ id: 'd5', relation: 'descendant', tier: -5, treeParentId: 'd4' }),
    ];

    it('keeps every generation instead of truncating below grandchildren', () => {
      const out = layout(line);
      expect(out.nodes.map((n) => n.id).sort()).toEqual(
        [HERO_ID, 'd1', 'd2', 'd3', 'd4', 'd5'].sort(),
      );
    });

    it('stacks each generation strictly lower than the one above it', () => {
      const out = layout(line);
      const y = (id: string) => out.nodes.find((n) => n.id === id)!.y;
      for (const [upper, lower] of [
        ['d1', 'd2'],
        ['d2', 'd3'],
        ['d3', 'd4'],
        ['d4', 'd5'],
      ]) {
        expect(y(lower)).toBeGreaterThan(y(upper));
      }
    });

    it('chains each descendant to the forebear it descends from', () => {
      const out = layout(line);
      const parentOf = (id: string) => out.edges.find((e) => e.toId === id)?.fromId;
      expect(parentOf('d2')).toBe('d1');
      expect(parentOf('d5')).toBe('d4');
    });

    it('labels deep descendant rows', () => {
      const out = layout(line);
      const label = (tier: number) => out.rows.find((r) => r.tier === tier)?.label;
      expect(label(-3)).toBe('Great-grandchildren');
      expect(label(-4)).toBe('2× great-grandchildren');
      expect(label(-5)).toBe('3× great-grandchildren');
    });

    it('renders a line that runs deep in both directions at once', () => {
      const out = layout([
        m({ id: 'up3', relation: 'ancestor', tier: 3, treeParentId: 'up2' }),
        m({ id: 'up2', relation: 'grandparent', tier: 2, treeParentId: 'up1' }),
        m({ id: 'up1', relation: 'parent', tier: 1 }),
        m({ id: 'dn1', relation: 'child', tier: -1 }),
        m({ id: 'dn2', relation: 'grandchild', tier: -2, treeParentId: 'dn1' }),
        m({ id: 'dn3', relation: 'descendant', tier: -3, treeParentId: 'dn2' }),
      ]);
      const y = (id: string) => out.nodes.find((n) => n.id === id)!.y;
      expect(y('up3')).toBeLessThan(y('up1'));
      expect(y('dn3')).toBeGreaterThan(y('dn1'));
      expect(out.rows.map((r) => r.tier)).toEqual([3, 2, 1, 0, -1, -2, -3]);
    });
  });
});
