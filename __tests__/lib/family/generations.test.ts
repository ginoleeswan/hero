import { assignGenerations, offsetOf, roleDepth } from '../../../src/lib/family/generations';
import type { GenerationEdge } from '../../../src/lib/family/generations';

const M = (id: string) => ({ id });
const edge = (
  hero_id: string,
  related_hero_id: string,
  relation: string,
  role: string | null = null,
): GenerationEdge => ({ hero_id, related_hero_id, relation, role });

describe('roleDepth', () => {
  it('reads the count out of a multiplied great-grandparent', () => {
    expect(roleDepth('10× great-grandfather')).toBe(12);
    expect(roleDepth('2x great-grandmother')).toBe(4);
  });

  it('counts written-out greats', () => {
    expect(roleDepth('great-grandmother')).toBe(3);
    expect(roleDepth('great-great-grandfather')).toBe(4);
  });

  it('falls back to the plain forms', () => {
    expect(roleDepth('grandfather')).toBe(2);
    expect(roleDepth('father')).toBe(1);
    expect(roleDepth(null)).toBe(1);
  });
});

describe('offsetOf', () => {
  it('signs the ladder so younger is positive', () => {
    expect(offsetOf('parent', null)).toBe(-1);
    expect(offsetOf('child', null)).toBe(1);
    expect(offsetOf('grandparent', null)).toBe(-2);
    expect(offsetOf('sibling', null)).toBe(0);
  });

  it('takes the distance off the role for ancestors', () => {
    expect(offsetOf('ancestor', '10× great-grandfather')).toBe(-12);
    expect(offsetOf('descendant', '10× great-grandson')).toBe(12);
  });

  it('refuses relations that say nothing about generation', () => {
    expect(offsetOf('in_law', null)).toBeNull();
    expect(offsetOf('enemy', null)).toBeNull();
  });
});

describe('assignGenerations', () => {
  it('puts a three-generation family on three rungs, oldest first', () => {
    const { bands, unplaced } = assignGenerations(
      [M('jon'), M('rhaegar'), M('aerys')],
      [edge('jon', 'rhaegar', 'parent'), edge('rhaegar', 'aerys', 'parent')],
    );
    expect(unplaced).toEqual([]);
    expect(bands.map((b) => [b.depth, b.members.map((m) => m.id)])).toEqual([
      [0, ['aerys']],
      [1, ['rhaegar']],
      [2, ['jon']],
    ]);
  });

  it('keeps siblings and spouses on the same rung', () => {
    const { bands } = assignGenerations(
      [M('dany'), M('viserys'), M('drogo')],
      [edge('dany', 'viserys', 'sibling'), edge('dany', 'drogo', 'spouse')],
    );
    expect(bands).toHaveLength(1);
    expect(bands[0].members.map((m) => m.id)).toEqual(['dany', 'viserys', 'drogo']);
  });

  it('spans the whole ladder from one deep ancestor edge', () => {
    const { bands } = assignGenerations(
      [M('dany'), M('aegon')],
      [edge('dany', 'aegon', 'ancestor', '10× great-grandfather')],
    );
    expect(bands.map((b) => b.depth)).toEqual([0, 12]);
    expect(bands[0].members[0].id).toBe('aegon');
  });

  it('walks an edge backwards with the sign flipped', () => {
    // Recorded only as "aerys's child is rhaegar" — rhaegar still lands below.
    const { bands } = assignGenerations(
      [M('rhaegar'), M('aerys')],
      [edge('aerys', 'rhaegar', 'child')],
    );
    expect(bands.map((b) => b.members.map((m) => m.id))).toEqual([['aerys'], ['rhaegar']]);
  });

  it('sets aside anyone no generational relation reaches', () => {
    const { bands, unplaced } = assignGenerations(
      [M('dany'), M('rhaegar'), M('stranger'), M('inlaw')],
      [edge('dany', 'rhaegar', 'sibling'), edge('dany', 'inlaw', 'in_law')],
    );
    expect(bands).toHaveLength(1);
    expect(unplaced.map((m) => m.id)).toEqual(['stranger', 'inlaw']);
  });

  it('takes the shortest route when a house married its cousins', () => {
    // Two routes to `child`: one hop down from dany, or three via the cousins.
    const { bands } = assignGenerations(
      [M('dany'), M('cousin'), M('other'), M('child')],
      [
        edge('dany', 'child', 'child'),
        edge('dany', 'cousin', 'cousin'),
        edge('cousin', 'other', 'child'),
        edge('other', 'child', 'sibling'),
      ],
    );
    const depthOf = (id: string) => bands.find((b) => b.members.some((m) => m.id === id))!.depth;
    expect(depthOf('child')).toBe(depthOf('dany') + 1);
  });

  it('is empty for an empty house', () => {
    expect(assignGenerations([], [])).toEqual({ bands: [], unplaced: [] });
  });
});
