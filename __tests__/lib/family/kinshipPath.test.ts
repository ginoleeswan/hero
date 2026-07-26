import {
  buildKinshipGraph,
  findKinshipPath,
  describeKinship,
  type KinshipEdge,
} from '../../../src/lib/family/kinshipPath';

// A slice of the real dynasty, which is what the feature has to answer for:
// Jon Snow to Daenerys is the question people actually ask.
const WESTEROS: KinshipEdge[] = [
  { from: 'jon', to: 'rhaegar', relation: 'parent' },
  { from: 'jon', to: 'lyanna', relation: 'parent' },
  { from: 'rhaegar', to: 'aerys', relation: 'parent' },
  { from: 'daenerys', to: 'aerys', relation: 'parent' },
  { from: 'viserys', to: 'aerys', relation: 'parent' },
  { from: 'aerys', to: 'jaehaerys2', relation: 'parent' },
  { from: 'lyanna', to: 'rickard', relation: 'parent' },
  { from: 'ned', to: 'rickard', relation: 'parent' },
  { from: 'arya', to: 'ned', relation: 'parent' },
  { from: 'ned', to: 'catelyn', relation: 'spouse' },
];

const NAMES: Record<string, string> = {
  jon: 'Jon Snow',
  rhaegar: 'Rhaegar Targaryen',
  lyanna: 'Lyanna Stark',
  aerys: 'Aerys II Targaryen',
  daenerys: 'Daenerys Targaryen',
  viserys: 'Viserys Targaryen',
  jaehaerys2: 'Jaehaerys II Targaryen',
  rickard: 'Rickard Stark',
  ned: 'Eddard Stark',
  arya: 'Arya Stark',
  catelyn: 'Catelyn Stark',
};
const GENDERS: Record<string, 'Male' | 'Female'> = {
  jon: 'Male',
  rhaegar: 'Male',
  lyanna: 'Female',
  aerys: 'Male',
  daenerys: 'Female',
  viserys: 'Male',
  jaehaerys2: 'Male',
  rickard: 'Male',
  ned: 'Male',
  arya: 'Female',
  catelyn: 'Female',
};

const graph = buildKinshipGraph(WESTEROS);
const describe_ = (from: string, to: string) => {
  const path = findKinshipPath(graph, from, to)!;
  return describeKinship(
    path,
    from,
    (id) => NAMES[id] ?? id,
    (id) => GENDERS[id],
  );
};

describe('findKinshipPath', () => {
  it('walks a recorded edge in the direction it was recorded', () => {
    expect(findKinshipPath(graph, 'jon', 'rhaegar')).toEqual([
      { fromId: 'jon', toId: 'rhaegar', relation: 'parent' },
    ]);
  });

  it('walks the same edge backwards, inverting the relation', () => {
    expect(findKinshipPath(graph, 'rhaegar', 'jon')).toEqual([
      { fromId: 'rhaegar', toId: 'jon', relation: 'child' },
    ]);
  });

  it('finds a multi-hop route across the dynasty', () => {
    const path = findKinshipPath(graph, 'jon', 'daenerys');
    expect(path?.map((s) => s.toId)).toEqual(['rhaegar', 'aerys', 'daenerys']);
  });

  it('returns the shortest route when several exist', () => {
    // arya reaches jon via ned → rickard → lyanna → jon (4), never a longer way.
    expect(findKinshipPath(graph, 'arya', 'jon')).toHaveLength(4);
  });

  it('returns an empty path for a person and themselves', () => {
    expect(findKinshipPath(graph, 'jon', 'jon')).toEqual([]);
  });

  it('returns null when the graph records no connection', () => {
    const g = buildKinshipGraph([{ from: 'a', to: 'b', relation: 'parent' }]);
    expect(findKinshipPath(g, 'a', 'stranger')).toBeNull();
  });

  it('returns null for someone not in the graph at all', () => {
    expect(findKinshipPath(graph, 'nobody', 'jon')).toBeNull();
  });

  it('keeps one step per pair, preferring the one that carries a label', () => {
    // A derived dynasty stores both directions as separate rows, so the same
    // pair arrives several times and whichever was reached first used to decide
    // the wording.
    const g = buildKinshipGraph([
      { from: 'dany', to: 'rhaenyra', relation: 'ancestor', role: '6× great-grandmother' },
      { from: 'rhaenyra', to: 'dany', relation: 'descendant', role: '6× great-granddaughter' },
    ]);
    expect(g.adjacency.get('dany')).toHaveLength(1);
    expect(g.adjacency.get('dany')![0].role).toBe('6× great-grandmother');
  });

  it('ignores self-edges and half-empty edges', () => {
    const g = buildKinshipGraph([
      { from: 'x', to: 'x', relation: 'parent' },
      { from: '', to: 'y', relation: 'parent' },
    ]);
    expect(findKinshipPath(g, 'x', 'y')).toBeNull();
  });
});

describe('describeKinship', () => {
  it('names the relation people actually ask about', () => {
    // The whole feature in one assertion.
    expect(describe_('jon', 'daenerys').headline).toBe("Daenerys Targaryen is Jon Snow's aunt");
  });

  it('always renders the chain, whatever the headline says', () => {
    expect(describe_('jon', 'daenerys').chain).toBe(
      'Jon Snow → father Rhaegar Targaryen → father Aerys II Targaryen → daughter Daenerys Targaryen',
    );
  });

  it('genders a direct relation', () => {
    expect(describe_('jon', 'rhaegar').headline).toBe("Rhaegar Targaryen is Jon Snow's father");
    expect(describe_('jon', 'lyanna').headline).toBe("Lyanna Stark is Jon Snow's mother");
  });

  it('composes two hops into one word', () => {
    expect(describe_('jon', 'aerys').headline).toBe("Aerys II Targaryen is Jon Snow's grandfather");
  });

  it('counts the greats on an unbroken line', () => {
    expect(describe_('jon', 'jaehaerys2').headline).toBe(
      "Jaehaerys II Targaryen is Jon Snow's great-grandfather",
    );
  });

  it('names a cousin reached through a shared grandparent', () => {
    // arya → ned → rickard → lyanna → jon is parent>parent>child>child.
    expect(describe_('arya', 'jon').steps).toBe(4);
    expect(describe_('arya', 'jon').headline).toBe("Jon Snow is Arya Stark's cousin");
  });

  it('degrades honestly rather than inventing a word', () => {
    // arya → ned → rickard → lyanna → jon → rhaegar → aerys → daenerys.
    const d = describe_('arya', 'daenerys');
    expect(d.headline).toBe('Daenerys Targaryen is distant kin to Arya Stark — 7 steps');
    expect(d.chain).toContain('Rickard Stark');
  });

  it('uses the recorded label for a deep ancestor, which the relation cannot carry', () => {
    // `ancestor` is one hop however many generations it spans; the count lives
    // in the role the dynasty migration wrote.
    const g = buildKinshipGraph([
      { from: 'jon', to: 'aegon1', relation: 'ancestor', role: '11× great-grandfather' },
    ]);
    const d = describeKinship(
      findKinshipPath(g, 'jon', 'aegon1')!,
      'jon',
      (id) => (id === 'jon' ? 'Jon Snow' : 'Aegon I Targaryen'),
      () => 'Male',
    );
    expect(d.headline).toBe("Aegon I Targaryen is Jon Snow's 11× great-grandfather");
  });

  it('says "1 step", not "1 steps"', () => {
    const g = buildKinshipGraph([{ from: 'a', to: 'b', relation: 'in_law' }]);
    const d = describeKinship(
      findKinshipPath(g, 'a', 'b')!,
      'a',
      (id) => id,
      () => null,
    );
    expect(d.headline).toContain('1 step');
    expect(d.headline).not.toContain('1 steps');
  });

  it('handles a person and themselves', () => {
    const d = describeKinship(
      [],
      'jon',
      (id) => NAMES[id],
      (id) => GENDERS[id],
    );
    expect(d.steps).toBe(0);
    expect(d.chain).toBe('Jon Snow is the same person.');
  });
});
