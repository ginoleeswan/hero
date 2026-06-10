// __tests__/constants/powerIcons.test.ts
import { getPowerIcon, POWER_ICON_FALLBACK } from '../../src/constants/powerIcons';

describe('getPowerIcon', () => {
  it('matches exact lowercase power name', () => {
    expect(getPowerIcon('flight').icon).toBe('feather');
  });

  it('matches case-insensitively', () => {
    expect(getPowerIcon('FLIGHT').icon).toBe('feather');
    expect(getPowerIcon('Flight').icon).toBe('feather');
  });

  it('matches substring — "Enhanced Strength" hits the strength entry', () => {
    expect(getPowerIcon('Enhanced Strength').icon).toBe('arm-flex');
  });

  it('matches substring — "Super Speed" hits the speed entry', () => {
    expect(getPowerIcon('Super Speed').icon).toBe('run-fast');
  });

  it('returns fallback for an unknown power', () => {
    expect(getPowerIcon('Cheese Manipulation')).toEqual(POWER_ICON_FALLBACK);
  });

  it('fallback icon is "star-four-points"', () => {
    expect(POWER_ICON_FALLBACK.icon).toBe('star-four-points');
  });
});
