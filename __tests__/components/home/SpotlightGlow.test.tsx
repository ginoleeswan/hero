// __tests__/components/home/SpotlightGlow.test.tsx
//
// A deliberate, narrow exception to "don't test rendering" (CLAUDE.md):
// SpotlightGlow crashed on mount in production (`Animated.createAnimatedComponent`
// wrapped an SVG `<Stop>`, an element with no host view for Reanimated to attach
// to) and every other gate — tsc, lint, format, check:ui, the rest of the suite —
// passed anyway, because nothing in this repo actually mounts the component. A
// bug class that is invisible to every other check gets its own narrow mount
// smoke-test rather than a broader rendering-test policy change.
import React from 'react';
import { render } from '@testing-library/react-native';
import { SpotlightGlow } from '../../../src/components/home/SpotlightGlow';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factory must use require (it's hoisted above imports)
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

describe('SpotlightGlow', () => {
  it('mounts without throwing', () => {
    expect(() => render(<SpotlightGlow color="rgba(200,16,46,0.16)" size={280} />)).not.toThrow();
  });

  it('re-renders without throwing when the colour changes', () => {
    const { rerender } = render(<SpotlightGlow color="rgba(200,16,46,0.16)" size={280} />);
    expect(() => rerender(<SpotlightGlow color="rgba(4,118,242,0.16)" size={280} />)).not.toThrow();
  });
});
