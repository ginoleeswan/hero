// src/components/ui/PageColumn.tsx — a centred column with a maximum measure.
//
// The single most recognisable "iPhone app running on an iPad" tell is a form
// field, or a settings row, or a paragraph, stretched the full 1194pt of a
// landscape tablet. Nothing about it is broken — it is just obviously a layout
// that was never asked about anything wider than a phone.
//
// On a phone this is a no-op: the cap is larger than the window, so the column
// fills it exactly as before. It only does anything once there is more width
// than the content should use, which means it can be dropped into a screen
// without re-tuning that screen's phone layout.
//
// Deliberately NOT a scroll view, a safe-area view or a background. It caps a
// width and centres, and screens compose it with whatever else they need —
// a wrapper that quietly owns four other concerns is one nobody can reuse.
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { CONTENT_MAX_WIDTH } from '../../constants/layout';

export function PageColumn({
  children,
  maxWidth = CONTENT_MAX_WIDTH,
  style,
}: {
  children: React.ReactNode;
  /** Override for a surface with its own measure — a form wants less. */
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ width: '100%', maxWidth, alignSelf: 'center' }, style]}>{children}</View>;
}

/**
 * A form's measure, which is much narrower than a page's.
 *
 * A 900pt-wide email field is not easier to fill in than a 460pt one; it is
 * just a longer distance for the eye to travel between the label and the end of
 * the box. Every native settings and sign-in form on iPad sits around here.
 */
export const FORM_MAX_WIDTH = 460;

/**
 * A list's or a document's measure.
 *
 * 720, because LegalScreen already picked it and a second number for the same
 * job is how a design system starts disagreeing with itself. A settings list at
 * full landscape-iPad width puts a row's label against one edge of the glass
 * and its switch against the other, which is a long way to look to find out
 * what you just toggled.
 */
export const READING_MAX_WIDTH = 720;
