// __tests__/constants/powerIcons.test.ts
import { getPowerIcon, POWER_ICON_FALLBACK } from '../../src/constants/powerIcons';

describe('getPowerIcon', () => {
  it('matches exact lowercase power name', () => {
    expect(getPowerIcon('flight').icon).toBe('airplane');
  });

  it('matches case-insensitively', () => {
    expect(getPowerIcon('FLIGHT').icon).toBe('airplane');
    expect(getPowerIcon('Flight').icon).toBe('airplane');
  });

  it('matches substring — "Enhanced Strength" hits the strength entry', () => {
    expect(getPowerIcon('Enhanced Strength').icon).toBe('barbell');
  });

  it('matches substring — "Super Speed" hits the speed entry', () => {
    expect(getPowerIcon('Super Speed').icon).toBe('flash');
  });

  it('returns fallback for an unknown power', () => {
    expect(getPowerIcon('Cheese Manipulation')).toEqual(POWER_ICON_FALLBACK);
  });

  it('fallback icon is "star"', () => {
    expect(POWER_ICON_FALLBACK.icon).toBe('star');
  });
});
