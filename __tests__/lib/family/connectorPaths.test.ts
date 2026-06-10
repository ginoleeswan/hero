import { connectorPaths, type NodeBox } from '../../../src/lib/family/connectorPaths';

const box = (cx: number, top: number, bottom: number): NodeBox => ({ cx, top, bottom });

describe('connectorPaths', () => {
  const hero = box(100, 200, 240);

  it('connects an above-hero node to the hero with a 4-point elbow', () => {
    const paths = connectorPaths({
      hero,
      boxes: { p: box(60, 120, 160) },
      links: [{ id: 'p', target: { kind: 'hero' } }],
    });
    expect(paths).toEqual([{ points: [[60, 160], [60, 180], [100, 180], [100, 200]] }]);
  });

  it('connects a below-hero node upward to the hero', () => {
    const paths = connectorPaths({
      hero,
      boxes: { c: box(140, 300, 340) },
      links: [{ id: 'c', target: { kind: 'hero' } }],
    });
    expect(paths).toEqual([{ points: [[140, 300], [140, 270], [100, 270], [100, 240]] }]);
  });

  it('connects a node to a specific parent box (fork)', () => {
    const paths = connectorPaths({
      hero,
      boxes: { f: box(60, 120, 160), gf: box(40, 40, 80) },
      links: [{ id: 'gf', target: { kind: 'parent', id: 'f' } }],
    });
    expect(paths).toEqual([{ points: [[40, 80], [40, 100], [60, 100], [60, 120]] }]);
  });

  it('skips a link whose box has not been measured yet', () => {
    expect(connectorPaths({ hero, boxes: {}, links: [{ id: 'x', target: { kind: 'hero' } }] })).toEqual([]);
  });
});
