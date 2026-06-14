// __tests__/lib/family/rowToMember.test.ts
import { rowToMember, type FamilyRow } from '../../../src/lib/family/rowToMember';

const base: FamilyRow = {
  id: 'r1',
  name: 'Supergirl',
  alias: 'Kara Zor-El',
  role: 'cousin',
  relation: 'cousin',
  tier: 0,
  modifiers: [],
  status: null,
  position: 3,
  tree_parent_id: 'p1',
  branch_side: 'paternal',
  related: {
    id: 'h9',
    portrait_url: null,
    image_md_url: 'md.jpg',
    image_url: 'full.jpg',
    power: 68,
    alignment: 'good',
  },
};

describe('rowToMember', () => {
  it('flattens a linked row, falling back to image_md_url when no portrait', () => {
    expect(rowToMember(base)).toMatchObject({
      id: 'r1',
      name: 'Supergirl',
      heroId: 'h9',
      heroImage: 'md.jpg',
      heroPower: 68,
      heroAlignment: 'good',
    });
  });

  it('prefers the generated portrait_url over comicvine images', () => {
    const m = rowToMember({ ...base, related: { ...base.related!, portrait_url: 'portrait.jpg' } });
    expect(m.heroImage).toBe('portrait.jpg');
  });

  it('falls back to image_url when portrait and md are missing', () => {
    const m = rowToMember({ ...base, related: { ...base.related!, image_md_url: null } });
    expect(m.heroImage).toBe('full.jpg');
  });

  it('nulls all linked fields when there is no related hero', () => {
    const m = rowToMember({ ...base, related: null });
    expect(m).toMatchObject({
      heroId: null,
      heroImage: null,
      heroPower: null,
      heroAlignment: null,
    });
  });

  it('maps the kinship columns', () => {
    expect(rowToMember(base)).toMatchObject({ treeParentId: 'p1', branchSide: 'paternal' });
  });

  it('defaults kinship columns to null', () => {
    const m = rowToMember({ ...base, tree_parent_id: null, branch_side: null });
    expect(m).toMatchObject({ treeParentId: null, branchSide: null });
  });
});
