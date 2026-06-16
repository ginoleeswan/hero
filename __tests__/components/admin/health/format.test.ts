import {
  DOMAINS,
  primaryDomainKeys,
  DENSITY,
} from '../../../../src/components/admin/health/format';

describe('DOMAINS', () => {
  it('lists the primary domains in rail order, then placeholders', () => {
    expect(DOMAINS.map((d) => d.key)).toEqual([
      'command',
      'catalog',
      'sources',
      'pipelines',
      'campaigns',
      'spend',
      'users',
      'traffic',
    ]);
  });

  it('flags exactly the two future domains as placeholders', () => {
    const placeholders = DOMAINS.filter((d) => d.placeholder).map((d) => d.key);
    expect(placeholders).toEqual(['users', 'traffic']);
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
