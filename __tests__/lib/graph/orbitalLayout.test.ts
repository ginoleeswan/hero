import { layoutOrbital, type OrbitKind } from '../../../src/lib/graph/orbitalLayout';

type N = { id: string; isSubject: boolean; kind: OrbitKind | null; fame: number };

const subject: N = { id: 's', isSubject: true, kind: null, fame: 100 };
const n = (id: string, kind: OrbitKind, fame = 50): N => ({ id, isSubject: false, kind, fame });

const radius = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);

describe('layoutOrbital', () => {
  it('pins the subject at the origin', () => {
    const { positions } = layoutOrbital([subject, n('a', 'ally')], 's');
    expect(positions.get('s')).toEqual({ x: 0, y: 0 });
  });

  it('orders the bands teammate → ally → enemy, closest bond innermost', () => {
    const { positions } = layoutOrbital(
      [subject, n('t', 'teammate'), n('a', 'ally'), n('e', 'enemy')],
      's',
    );
    const t = radius(positions.get('t')!);
    const a = radius(positions.get('a')!);
    const e = radius(positions.get('e')!);
    expect(t).toBeLessThan(a);
    expect(a).toBeLessThan(e);
  });

  it('puts every member of a band on the same ring', () => {
    const members = ['a', 'b', 'c', 'd'].map((id) => n(id, 'ally'));
    const { positions } = layoutOrbital([subject, ...members], 's');
    const radii = members.map((m) => radius(positions.get(m.id)!));
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 5);
  });

  // The whole point of compressing radii: a hero with only enemies should fill
  // the canvas, not sit on one lonely outer ring with a hole in the middle.
  it('compresses to a single mid ring when only one band is populated', () => {
    const { positions, bands } = layoutOrbital(
      [subject, n('e1', 'enemy'), n('e2', 'enemy')],
      's',
    );
    expect(bands).toHaveLength(1);
    expect(radius(positions.get('e1')!)).toBeCloseTo(0.72, 5);
  });

  it('spreads a band evenly around the full circle', () => {
    const members = ['a', 'b', 'c', 'd'].map((id) => n(id, 'ally'));
    const { positions } = layoutOrbital([subject, ...members], 's');
    const angles = members
      .map((m) => positions.get(m.id)!)
      .map((p) => Math.atan2(p.y, p.x))
      .sort((x, y) => x - y);
    const gaps = angles.slice(1).map((a, i) => a - angles[i]);
    for (const g of gaps) expect(g).toBeCloseTo((Math.PI * 2) / 4, 4);
  });

  // A crowded ring splits into two lanes so neighbouring heads can't collide.
  it('staggers a crowded ring into two lanes', () => {
    const members = Array.from({ length: 10 }, (_, i) => n(`m${i}`, 'ally'));
    const { positions } = layoutOrbital([subject, ...members], 's');
    const radii = new Set(members.map((m) => radius(positions.get(m.id)!).toFixed(4)));
    expect(radii.size).toBe(2);
  });

  it('is deterministic — the same system every visit', () => {
    const build = () => layoutOrbital([subject, n('a', 'ally'), n('b', 'enemy')], 's').positions;
    expect([...build().entries()]).toEqual([...build().entries()]);
  });

  it('gives different subjects different rotations', () => {
    const nodes = [n('a', 'ally')];
    const one = layoutOrbital([{ ...subject, id: 's1' }, ...nodes], 's1').positions.get('a')!;
    const two = layoutOrbital([{ ...subject, id: 's2' }, ...nodes], 's2').positions.get('a')!;
    expect(one).not.toEqual(two);
  });

  it('parks a node with no direct tie on the outermost ring', () => {
    const { positions } = layoutOrbital(
      [subject, n('t', 'teammate'), { id: 'x', isSubject: false, kind: null, fame: 10 }],
      's',
    );
    expect(radius(positions.get('x')!)).toBeGreaterThan(radius(positions.get('t')!));
  });

  it('keeps everything inside the normalized unit box', () => {
    const members = Array.from({ length: 12 }, (_, i) =>
      n(`m${i}`, (['ally', 'enemy', 'teammate'] as OrbitKind[])[i % 3]),
    );
    const { positions } = layoutOrbital([subject, ...members], 's');
    for (const p of positions.values()) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1.06);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1.06);
    }
  });
});
