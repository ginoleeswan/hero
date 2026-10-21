import {
  decodeDots,
  heatOf,
  toVec3,
} from '../../../../src/components/admin/health/domains/audience/globeScene';
import {
  COUNTRY_ANCHORS,
  LAND_DOTS,
} from '../../../../src/components/admin/health/domains/audience/globeDots';
import { codeOf } from '../../../../src/components/admin/health/domains/audience/AudienceGlobe';

describe('globe land dots', () => {
  it('decodes to valid lat/lon pairs', () => {
    const dots = decodeDots(LAND_DOTS.ZA);
    expect(dots.length).toBeGreaterThan(10);
    for (const [lat, lon] of dots) {
      // South Africa's bounding box, loosely.
      expect(lat).toBeGreaterThan(-36);
      expect(lat).toBeLessThan(-21);
      expect(lon).toBeGreaterThan(15);
      expect(lon).toBeLessThan(34);
    }
  });

  it('gives every country with dots an anchor, and tiny states at least one dot', () => {
    for (const code of Object.keys(LAND_DOTS)) {
      expect(COUNTRY_ANCHORS[code]).toHaveLength(2);
      expect(decodeDots(LAND_DOTS[code]).length).toBeGreaterThan(0);
    }
    expect(LAND_DOTS.SG).toBeDefined();
  });

  it('anchors France in Europe, not French Guiana', () => {
    const [lat, lon] = COUNTRY_ANCHORS.FR;
    expect(lat).toBeGreaterThan(42);
    expect(lon).toBeGreaterThan(-5);
  });
});

describe('globe math', () => {
  it('puts lon 0 facing +z and east on +x', () => {
    const front = toVec3(0, 0);
    expect(front.z).toBeCloseTo(1);
    expect(toVec3(0, 90).x).toBeCloseTo(1);
    expect(toVec3(90, 0).y).toBeCloseTo(1);
  });

  it('heat is log-scaled 0..1', () => {
    expect(heatOf(0, 100)).toBe(0);
    expect(heatOf(100, 100)).toBeCloseTo(1);
    // One visitor in a 200-visitor field still shows clearly.
    expect(heatOf(1, 200)).toBeGreaterThan(0.1);
  });
});

describe('codeOf', () => {
  it('upper-cases ISO codes and masks unknown', () => {
    expect(codeOf('za')).toBe('ZA');
    expect(codeOf('unknown')).toBe('··');
  });
});
