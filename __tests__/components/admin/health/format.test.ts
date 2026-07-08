import { DOMAINS, DENSITY } from '../../../../src/components/admin/health/format';

describe('DOMAINS', () => {
  it('lists every lane in rail order', () => {
    expect(DOMAINS.map((d) => d.key)).toEqual([
      'command',
      'catalog',
      'pipelines',
      'inbox',
      'audience',
      'publish',
    ]);
  });

  it('every domain has a label and an Ionicons name', () => {
    for (const d of DOMAINS) {
      expect(typeof d.label).toBe('string');
      expect(d.label.length).toBeGreaterThan(0);
      expect(typeof d.icon).toBe('string');
    }
  });

  it('badge keys are only pending or inbox', () => {
    for (const d of DOMAINS) {
      if (d.badge != null) {
        expect(['pending', 'inbox']).toContain(d.badge);
      }
    }
  });

  it('fill flags only command, catalog, and pipelines', () => {
    const filled = DOMAINS.filter((d) => d.fill).map((d) => d.key);
    expect(filled).toEqual(['command', 'catalog', 'pipelines']);
  });
});

describe('DENSITY', () => {
  it('exposes a compact scale used across panels (premium pass: 14px pad/radius)', () => {
    expect(DENSITY.panelPad).toBeLessThanOrEqual(16);
    expect(DENSITY.radius).toBeLessThanOrEqual(16);
    expect(DENSITY.rowH).toBeLessThanOrEqual(30);
  });
});
