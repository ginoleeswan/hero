import { resolveKinship, type KinNode } from '../../../src/lib/family/resolveKinship';

const n = (p: Partial<KinNode> & { id: string; relation: KinNode['relation'] }): KinNode => ({
  role: '',
  modifiers: [],
  ...p,
});

describe('resolveKinship', () => {
  it('attaches a paternal grandparent to the single father', () => {
    const nodes = [
      n({ id: 'f', relation: 'parent', role: 'father' }),
      n({ id: 'm', relation: 'parent', role: 'mother' }),
      n({ id: 'gf', relation: 'grandparent', role: 'paternal grandfather' }),
    ];
    expect(resolveKinship(nodes).get('gf')).toEqual({ treeParentId: 'f', branchSide: 'paternal' });
  });

  it('attaches a maternal grandparent to the single mother', () => {
    const nodes = [
      n({ id: 'm', relation: 'parent', role: 'mother' }),
      n({ id: 'gm', relation: 'grandparent', role: 'maternal grandmother' }),
    ];
    expect(resolveKinship(nodes).get('gm')).toEqual({ treeParentId: 'm', branchSide: 'maternal' });
  });

  it('leaves a side-less grandparent unattached', () => {
    const nodes = [
      n({ id: 'f', relation: 'parent', role: 'father' }),
      n({ id: 'm', relation: 'parent', role: 'mother' }),
      n({ id: 'g', relation: 'grandparent', role: 'grandfather' }),
    ];
    expect(resolveKinship(nodes).get('g')).toEqual({ treeParentId: null, branchSide: null });
  });

  it('does not attach a paternal grandparent when there are two fathers', () => {
    const nodes = [
      n({ id: 'f1', relation: 'parent', role: 'father' }),
      n({ id: 'f2', relation: 'parent', role: 'adoptive father', modifiers: ['adoptive'] }),
      n({ id: 'gf', relation: 'grandparent', role: 'paternal grandfather' }),
    ];
    expect(resolveKinship(nodes).get('gf')).toEqual({ treeParentId: null, branchSide: 'paternal' });
  });

  it('attaches a cousin to the single aunt/uncle', () => {
    const nodes = [
      n({ id: 'u', relation: 'aunt_uncle', role: 'uncle' }),
      n({ id: 'c', relation: 'cousin', role: 'cousin' }),
    ];
    expect(resolveKinship(nodes).get('c')).toEqual({ treeParentId: 'u', branchSide: null });
  });

  it('attaches an in-law to the single spouse', () => {
    const nodes = [
      n({ id: 's', relation: 'spouse', role: 'wife' }),
      n({ id: 'il', relation: 'in_law', role: 'father-in-law' }),
    ];
    expect(resolveKinship(nodes).get('il')).toEqual({ treeParentId: 's', branchSide: 'spouse' });
  });

  it('attaches a grandchild to the single child', () => {
    const nodes = [
      n({ id: 'ch', relation: 'child', role: 'son' }),
      n({ id: 'gc', relation: 'grandchild', role: 'grandson' }),
    ];
    expect(resolveKinship(nodes).get('gc')).toEqual({ treeParentId: 'ch', branchSide: null });
  });

  it('tags parents with a branch side but no parent link', () => {
    const nodes = [n({ id: 'f', relation: 'parent', role: 'father' })];
    expect(resolveKinship(nodes).get('f')).toEqual({ treeParentId: null, branchSide: 'paternal' });
  });

  it('leaves plain same-generation members unattached', () => {
    const nodes = [n({ id: 'b', relation: 'sibling', role: 'brother' })];
    expect(resolveKinship(nodes).get('b')).toEqual({ treeParentId: null, branchSide: null });
  });
});
