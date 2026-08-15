// Two invariants a device pass on an iPad Pro 13" found broken:
//
//  1. Phone widths must not move by one point — publisherGrid/matchupCard/
//     dailyBanner all shipped and tuned at these exact numbers.
//  2. At tablet widths the deck gutter, publisherGrid, matchupCard and
//     dailyBanner must all land on the SAME left edge — that unification is
//     the entire point of the fix, so it has to be a test, not a comment.
//
// The DailyChallengeBanner describe block below is the reason (2) is a
// component-render test rather than a pure-function one for that one row:
// DAILY_BANNER/dailyBanner() had exactly one consumer — HomeSkeleton's
// placeholder — and the REAL banner (src/components/game/
// DailyChallengeBanner.tsx) hardcoded its own `marginHorizontal: 15` and
// never read the shared value at all. A function-level assertion on
// dailyBanner(width) alone cannot catch that: the function was already
// correct, the component just wasn't reading it.
import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { pageGutter } from '../../../src/constants/colors';
import { spotlightLayout } from '../../../src/constants/spotlightLayout';
import { spotlightHeight } from '../../../src/components/home/SpotlightCarousel';
import {
  TABLET_TAB_CLEARANCE,
  SPOTLIGHT_DECK_BOTTOM_GAP,
} from '../../../src/components/home/SpotlightDeck';
import { DailyChallengeBanner } from '../../../src/components/game/DailyChallengeBanner';
import {
  dailyBanner,
  DAILY_BANNER,
  FEED_H_PAD,
  matchupCard,
  MATCHUP_CARD,
  publisherGrid,
  sectionGap,
  SECTION_GAP,
} from '../../../src/components/home/homeGeometry';

// SpotlightCarousel pulls in react-native-reanimated-carousel purely for its
// <Carousel> JSX — this suite only needs the pure spotlightHeight() function
// it also exports, so the native carousel (which crashes under jest, being
// untransformed and reaching for Reanimated's real Easing.bezier) is stubbed
// out rather than rendered. jest.mock calls are hoisted above these imports
// by babel-jest regardless of source position.
jest.mock('react-native-reanimated-carousel', () => ({
  __esModule: true,
  default: () => null,
}));

// The banner's streak number comes from a hook that hits AsyncStorage +
// Supabase — irrelevant to a gutter test, so it's stubbed to a fixed value.
jest.mock('../../../src/hooks/useDailyStreak', () => ({ useDailyStreak: () => 0 }));

// react-native's own useWindowDimensions returns whatever the test host's
// fixed default is, which is fine for the pure-function tests above but not
// for the render test below, which needs to assert what the banner does at
// SPECIFIC widths. Mocking the whole 'react-native' package (or spying on
// its namespace import) reconstructs the module and breaks jest-expo's own
// setup (native module registration errors) — so only the leaf module that
// react-native/index.js's useWindowDimensions getter re-requires internally
// is swapped instead.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 1024, scale: 2, fontScale: 1 })),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- needs the mocked jest.fn instance, not the typed hook
const mockUseWindowDimensions = require('react-native/Libraries/Utilities/useWindowDimensions')
  .default as jest.Mock;
const atWidth = (width: number) =>
  mockUseWindowDimensions.mockReturnValue({ width, height: 1024, scale: 2, fontScale: 1 });

describe('phone widths — untouched', () => {
  it('publisherGrid(390).hPad stays 16, not feedHPad(390)', () => {
    expect(publisherGrid(390).hPad).toBe(16);
  });

  it('matchupCard(390).hMargin stays FEED_H_PAD (15)', () => {
    expect(matchupCard(390).hMargin).toBe(FEED_H_PAD);
    expect(matchupCard(390).hMargin).toBe(15);
  });

  it('dailyBanner(390).hMargin stays FEED_H_PAD (15)', () => {
    expect(dailyBanner(390).hMargin).toBe(FEED_H_PAD);
    expect(dailyBanner(390).hMargin).toBe(15);
  });

  it('matchupCard/dailyBanner keep every other field identical to the old constants', () => {
    const { hMargin: _a, ...restMatchup } = matchupCard(390);
    const { hMargin: _b, ...restConst } = MATCHUP_CARD;
    expect(restMatchup).toEqual(restConst);

    const { hMargin: _c, ...restDaily } = dailyBanner(390);
    const { hMargin: _d, ...restDailyConst } = DAILY_BANNER;
    expect(restDaily).toEqual(restDailyConst);
  });

  it('spotlightHeight(390, 844, 59) is unchanged — width < 720 skips the deck branch', () => {
    expect(spotlightHeight(390, 844, 59)).toBe(Math.round(844 * 0.5 + 59));
  });
});

describe('tablet widths — one shared left edge', () => {
  it.each([1032, 1376])(
    'at %dpt, deck gutter, publisherGrid, matchupCard and dailyBanner agree',
    (width) => {
      const deckGutter = spotlightLayout(width).gutter;
      const publisherHPad = publisherGrid(width).hPad;
      const matchupHMargin = matchupCard(width).hMargin;
      const dailyHMargin = dailyBanner(width).hMargin;

      expect(deckGutter).toBe(pageGutter(width));
      expect(publisherHPad).toBe(deckGutter);
      expect(matchupHMargin).toBe(deckGutter);
      expect(dailyHMargin).toBe(deckGutter);
    },
  );
});

describe('spotlightHeight — deck branch grows to clear the floating tab bar', () => {
  it.each([1032, 1376])(
    'at %dpt, spotlightHeight adds insetTop + TABLET_TAB_CLEARANCE + SPOTLIGHT_DECK_BOTTOM_GAP on top of the stage',
    (width) => {
      const insetTop = 59;
      const stage = spotlightLayout(width).stageHeight;
      expect(spotlightHeight(width, 1366, insetTop)).toBe(
        stage + insetTop + TABLET_TAB_CLEARANCE + SPOTLIGHT_DECK_BOTTOM_GAP,
      );
    },
  );
});

// The real regression: dailyBanner() being correct doesn't help if nothing
// reads it. This renders the actual banner component and reads its resolved
// `marginHorizontal`, so a hardcoded literal that silently stops tracking
// the shared function fails here even if every pure-function test above is
// green.
describe('DailyChallengeBanner — reads the shared gutter, not a hardcoded one', () => {
  function cardMargin() {
    const { getByLabelText } = render(<DailyChallengeBanner onPress={() => {}} />);
    const card = getByLabelText('Play the daily Guess the Hero challenge');
    return StyleSheet.flatten(card.props.style).marginHorizontal;
  }

  it('stays at FEED_H_PAD (15) on phone — unchanged', () => {
    atWidth(390);
    expect(cardMargin()).toBe(FEED_H_PAD);
    expect(cardMargin()).toBe(15);
  });

  it.each([1032, 1376])(
    'at %dpt, matches dailyBanner(width).hMargin — the same edge as the deck/publisherGrid/matchupCard',
    (width) => {
      atWidth(width);
      expect(cardMargin()).toBe(dailyBanner(width).hMargin);
      expect(cardMargin()).toBe(spotlightLayout(width).gutter);
    },
  );
});

// The vertical counterpart of the gutter unification above. Measured down an
// iPad in portrait, the four dark-stage boundaries were 23.5 / 18.5 / 12.5 /
// 28pt — additive sums of a bottom padding and a top padding, so no component
// owned the number it was half of. sectionGap makes the tablet boundary one
// number owned by the section below; the phone keeps every tuned value.
describe('sectionGap', () => {
  const PHONE = { top: 8, bottom: 12 };

  it.each([320, 390, 430, 699])('returns the phone pair untouched at %dpt', (width) => {
    expect(sectionGap(width, PHONE)).toEqual(PHONE);
  });

  it.each([700, 1032, 1194, 1376])('is SECTION_GAP on top and nothing below at %dpt', (width) => {
    expect(sectionGap(width, PHONE)).toEqual({ top: SECTION_GAP, bottom: 0 });
  });

  // The boundary is the section below's top plus the section above's bottom.
  // Zeroing the bottom is what makes that sum a single number — without it the
  // tablet boundary would be 24 + whatever the section above happened to use.
  it('sums to exactly SECTION_GAP between two adjacent sections', () => {
    const above = sectionGap(1032, { top: 8, bottom: 12 });
    const below = sectionGap(1032, { top: 20, bottom: 18 });
    expect(above.bottom + below.top).toBe(SECTION_GAP);
  });

  it('leaves publisherGrid a bottom pad on a phone and none on a tablet', () => {
    expect(publisherGrid(390).paddingBottom).toBe(6);
    expect(publisherGrid(1032).paddingBottom).toBe(0);
    // Its TOP is the billboard seam, not a boundary, so it does not move.
    expect(publisherGrid(390).paddingTop).toBe(publisherGrid(1032).paddingTop);
  });
});
