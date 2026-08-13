// src/constants/typeScale.ts — Dynamic Type, as a number the layout can use.
//
// Two halves make Dynamic Type work in this app and they have to agree:
//
//   1. Type is CAPPED, so it cannot grow without bound (src/components/ui/Text).
//   2. The fixed line boxes GROW by the same factor, so the type it is allowed
//      to grow by has somewhere to go.
//
// Without (2), a cap is just a smaller version of the same bug: the boxes in
// src/constants/*Geometry.ts are fixed `lineHeight`s, and a `lineHeight` in a
// StyleSheet is a plain number that does not scale with the OS font scale. So a
// reader at 130% gets 130% glyphs in a 100% line box, and the descenders go.
//
// Read once at module scope, deliberately. Every consumer is a layout constant
// that a screen AND its skeleton both import — the two must compute the same
// number or the swap moves the page, and a hook would let them disagree by a
// render. iOS restarts the app on a Dynamic Type change anyway.
import { PixelRatio } from 'react-native';

/** How far type may grow. Mirrored by MAX_TYPE_SCALE in components/ui/Text. */
export const MAX_TYPE_SCALE = 1.3;

/**
 * The multiplier actually in effect: the device's font scale, capped.
 *
 * 1 for everyone at the default size, so nothing about the shipped layout
 * changes for the large majority — this only opens up when someone has asked
 * for bigger text.
 */
export const TYPE_SCALE = Math.min(Math.max(PixelRatio.getFontScale(), 1), MAX_TYPE_SCALE);

/**
 * Grow a fixed line box by the scale in effect.
 *
 * Rounded, because a fractional line box lands the following content on a
 * half-pixel and the skeleton and the page round it independently.
 */
export const line = (h: number): number => Math.round(h * TYPE_SCALE);
