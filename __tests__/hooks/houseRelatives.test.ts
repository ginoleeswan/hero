// The re-projection that turns the flat house graph into one person's tree.
//
// The bug this pins: `tree_parent_id` points at a hero_relatives ROW, and the
// projected members carry edge-scoped ids instead — so the chain has to be
// remapped or every deep forebear falls out of the chart into the "generation
// unrecorded" list. That failed silently for a whole house.
import { relativesOf } from '../../src/hooks/useHouse';

// Hoisted above the import by babel-plugin-jest-hoist — useHouse pulls the
// client in at module scope and this module only needs the pure projection.
jest.mock('../../src/lib/supabase', () => ({ supabase: {} }));

type Payload = Parameters<typeof relativesOf>[0];

const member = (id: string, name: string) => ({
  id,
  name,
  portrait_url: null,
  avatar_url: null,
  image_url: null,
  image_md_url: null,
  alignment: null,
  gender: null,
  fame_score: null,
  summary: null,
  via: 'surname',
});

const edge = (
  heroId: string,
  relatedId: string,
  relation: string,
  tier: number,
  treeParentHeroId: string | null = null,
) => ({
  hero_id: heroId,
  related_hero_id: relatedId,
  relation,
  role: null,
  tier,
  branch_side: null,
  tree_parent_hero_id: treeParentHeroId,
  position: 0,
  modifiers: null,
  status: null,
});

const payload = (edges: ReturnType<typeof edge>[]): Payload =>
  ({
    house: {
      slug: 'targaryen',
      name: 'House Targaryen',
      universe: 'Game of Thrones',
      words: null,
      seat: null,
      sigil_tint: null,
      blurb: null,
    },
    members: [member('jon', 'Jon'), member('dad', 'Rhaegar'), member('gran', 'Aerys')],
    edges,
  }) as unknown as Payload;

describe('relativesOf', () => {
  it('hangs a forebear off the ancestor it descends through', () => {
    const out = relativesOf(
      payload([edge('jon', 'dad', 'parent', 1), edge('jon', 'gran', 'grandparent', 2, 'dad')]),
      'jon',
    );
    const gran = out.find((m) => m.name === 'Aerys');
    expect(gran?.treeParentId).toBe('jon:dad');
  });

  it('drops a chain link the focused person cannot see', () => {
    // Aerys hangs off someone who is not one of Jon's own relatives — keeping
    // the pointer would chain to an id that never appears in this list.
    const out = relativesOf(payload([edge('jon', 'gran', 'ancestor', 4, 'stranger')]), 'jon');
    expect(out[0].treeParentId).toBeNull();
  });

  it('only projects the focused person’s own edges', () => {
    const out = relativesOf(
      payload([edge('jon', 'dad', 'parent', 1), edge('dad', 'gran', 'parent', 1)]),
      'jon',
    );
    expect(out.map((m) => m.name)).toEqual(['Rhaegar']);
  });
});
