// src/hooks/useLayout.ts — the live window, and everything derived from it.
//
// The one place a screen should learn how wide it is. `useWindowDimensions`
// re-renders on rotation and on every Split View drag, which is exactly the
// behaviour the module-scope `Dimensions.get('window')` reads it replaces did
// not have.
//
// Pure maths stays in constants/layout.ts so a skeleton, a screen and a test
// can all reach the same numbers; this hook only supplies the live width.
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  breakpointFor,
  contentWidth,
  gridColumns,
  isTabletWidth,
  pagePadding,
  railCardWidth,
  type Breakpoint,
} from '../constants/layout';

export interface Layout {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  /** True from the tablet threshold up. False in a narrow Split View column. */
  isTablet: boolean;
  landscape: boolean;
  /** The page gutter for this width. */
  hPad: number;
  /** The centred content column's width, capped for readability. */
  content: number;
  /** Left inset that centres a capped column in the window. */
  gutter: number;
  columns: (target?: number, min?: number, max?: number) => number;
  railCard: (phoneRatio?: number, tabletWidth?: number) => number;
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const hPad = pagePadding(width);
    const content = contentWidth(width);
    return {
      width,
      height,
      breakpoint: breakpointFor(width),
      isTablet: isTabletWidth(width),
      landscape: width > height,
      hPad,
      content,
      // Whatever the cap left over, split evenly. Zero on a phone, where the
      // content column already fills the window.
      gutter: Math.max(hPad, Math.round((width - content) / 2)),
      columns: (target, min, max) => gridColumns(width, target, min, max),
      railCard: (phoneRatio, tabletWidth) => railCardWidth(width, phoneRatio, tabletWidth),
    };
  }, [width, height]);
}
