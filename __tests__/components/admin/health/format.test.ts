import {
  DOMAINS,
  primaryDomainKeys,
  DENSITY,
} from '../../../../src/components/admin/health/format';

describe('DOMAINS', () => {
  it('lists every domain in rail order', () => {
    expect(DOMAINS.map((d) => d.key)).toEqual([
      'command',
      'catalog',
      'sources',
      'pipelines',
      'campaigns',
      'spend',
      'community',
      'traffic',
      'errors',
      'reports',
    ]);
  });

  it('has no remaining placeholder domains (all are live)', () => {
    const placeholders = DOMAINS.filter((d) => d.placeholder).map((d) => d.key);
    expect(placeholders).toEqual([]);
  });

  it('every domain has a label and an Ionicons name', () => {
    for (const d of DOMAINS) {
      expect(typeof d.label).toBe('string');
      expect(d.label.length).toBeGreaterThan(0);
      expect(typeof d.icon).toBe('string');
    }
  });

  it('primaryDomainKeys excludes placeholders (mobile bottom bar set)', () => {
    expect(primaryDomainKeys()).toEqual([
      'command',
      'catalog',
      'sources',
      'pipelines',
      'campaigns',
      'spend',
      'community',
      'traffic',
      'errors',
      'reports',
    ]);
  });
});

describe('DENSITY', () => {
  it('exposes a compact scale used across panels', () => {
    expect(DENSITY.panelPad).toBeLessThanOrEqual(12);
    expect(DENSITY.radius).toBeLessThanOrEqual(12);
    expect(DENSITY.rowH).toBeLessThanOrEqual(30);
  });
});
