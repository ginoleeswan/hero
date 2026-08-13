// src/components/ui/Text.tsx — the app's Text and TextInput, with Dynamic Type
// bounded rather than ignored.
//
// WHY THIS FILE EXISTS AT ALL. iOS Dynamic Type goes to 310%. Nothing in this
// app survives that: the type here is set in fixed line boxes on purpose (see
// src/constants/*Geometry.ts) so a skeleton can match a loaded page to the
// pixel, and a fixed box with 3.1x type in it is a box with one word in it.
// The two ways out are to ignore accessibility scaling entirely
// (`allowFontScaling={false}` — the App Store notices, and so does anyone who
// needs it) or to honour it up to a limit. This is the limit.
//
// WHY IT IS A COMPONENT AND NOT A GLOBAL DEFAULT. React Native's own guidance
// is `Text.defaultProps.maxFontSizeMultiplier = n`. That no longer does
// anything: RN's Text is a plain function component and React 19 removed
// defaultProps for function components, so the assignment is silently ignored —
// verified in this repo, the prop arrives `undefined`. A capped re-export is
// the seam that actually works, and unlike a global it is greppable: you can
// see, at a call site, that the text is capped.
//
// `yarn check:ui` enforces that Text and TextInput are imported from here
// rather than from 'react-native', because a cap that 289 files honour and one
// file forgets is a layout bug that only appears on a stranger's phone.
import { forwardRef } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import type { TextProps, TextInputProps } from 'react-native';
// One source of truth for the number: the same cap bounds the type here and
// grows the fixed line boxes in src/constants/*Geometry.ts. Two copies of it
// would be two copies that can disagree, and the symptom of disagreement is
// clipped descenders at a size nobody here has switched on.
import { MAX_TYPE_SCALE } from '../../constants/typeScale';

export { MAX_TYPE_SCALE };

/**
 * Long-form reading gets more room.
 *
 * A biography or a take is a column of prose in a scroll view — there is no box
 * for it to overflow, so the only reason to cap it would be taste, and taste is
 * not a good enough reason to hold someone's reading size down.
 */
export const MAX_TYPE_SCALE_PROSE = 2;

// forwardRef, and the type aliases beside each component, so these are drop-in:
// a call site can still `useRef<TextInput>(null)` and focus the field. Without
// both, swapping the import would have meant editing every measured Text and
// every focusable field as well, which is how a mechanical change turns into a
// risky one.
export const Text = forwardRef<RNText, TextProps>(function Text(
  { maxFontSizeMultiplier, ...rest },
  ref,
) {
  return (
    <RNText ref={ref} maxFontSizeMultiplier={maxFontSizeMultiplier ?? MAX_TYPE_SCALE} {...rest} />
  );
});
export type Text = RNText;

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { maxFontSizeMultiplier, ...rest },
  ref,
) {
  return (
    <RNTextInput
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MAX_TYPE_SCALE}
      {...rest}
    />
  );
});
export type TextInput = RNTextInput;
