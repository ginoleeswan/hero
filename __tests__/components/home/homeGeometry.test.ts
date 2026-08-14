// Two invariants a device pass on an iPad Pro 13" found broken:
//
//  1. Phone widths must not move by one point — publisherGrid/matchupCard/
//     dailyBanner all shipped and tuned at these exact numbers.
//  2. At tablet widths the deck gutter, publisherGrid, matchupCard and
//     dailyBanner must all land on the SAME left edge — that unification is
//     the entire point of the fix, so it has to be a test, not a comment.
import { pageGutter } from '../../../src/constants/colors';
import { spotlightLayout } from '../../../src/constants/spotlightLayout';
import { spotlightHeight } from '../../../src/components/home/SpotlightCarousel';
import { TABLET_TAB_CLEARANCE } from '../../../src/components/home/SpotlightDeck';
import {
  dailyBanner,
  DAILY_BANNER,
  FEED_H_PAD,
  matchupCard,
  MATCHUP_CARD,
  publisherGrid,
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
    'at %dpt, spotlightHeight adds insetTop + TABLET_TAB_CLEARANCE on top of the stage',
    (width) => {
      const insetTop = 59;
      const stage = spotlightLayout(width).stageHeight;
      expect(spotlightHeight(width, 1366, insetTop)).toBe(stage + insetTop + TABLET_TAB_CLEARANCE);
    },
  );
});
