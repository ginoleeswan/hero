// src/components/ui/Sheet.tsx — the one bottom sheet.
//
// ReportSheet, ContributeSheet and StatsSheet each hand-rolled the same
// Modal + backdrop + grabber + safe-area foot, and each one drifted: three
// different backdrop alphas, two grabber colours, and only one of them
// remembered to lift above the keyboard. This is that shell, extracted, so a
// new sheet inherits the behaviour instead of re-deriving it.
//
// `tone` picks the canvas — 'paper' for beige form sheets, 'ink' for the dark
// stat/contents sheets — and carries the grabber and backdrop with it, since a
// paper grabber on an ink sheet is invisible and vice versa.
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Canvas. 'paper' = beige (forms), 'ink' = deep navy (data, contents). */
  tone?: 'paper' | 'ink';
  /**
   * Lift the sheet above the keyboard. Only for sheets with a text input —
   * it wraps the sheet in a KeyboardAvoidingView, which changes layout even
   * when no keyboard is up, so sheets without inputs opt out.
   */
  avoidKeyboard?: boolean;
  /** Extra bottom padding beyond the home-indicator clearance. */
  footPad?: number;
  /** Accessible name for the sheet, e.g. "Report a problem". */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function Sheet({
  visible,
  onClose,
  children,
  tone = 'paper',
  avoidKeyboard = false,
  footPad = 20,
  label,
  style,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const ink = tone === 'ink';

  const panel = (
    <Pressable
      // Swallow the tap so it never reaches the dismissing backdrop beneath.
      onPress={(e) => e.stopPropagation?.()}
      accessibilityViewIsModal
      accessibilityLabel={label}
      style={[
        s.sheet,
        ink ? s.sheetInk : s.sheetPaper,
        { paddingBottom: Math.max(insets.bottom, 8) + footPad },
        style,
      ]}
    >
      <View style={[s.grabber, ink ? s.grabberInk : s.grabberPaper]} />
      {children}
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close">
        {avoidKeyboard ? (
          // iOS needs the lift; Android resizes the window itself.
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {panel}
          </KeyboardAvoidingView>
        ) : (
          panel
        )}
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  // One scrim value for every sheet — deep-navy tinted, never neutral black,
  // so the dimmed page keeps the warm ink-on-paper material.
  backdrop: { flex: 1, backgroundColor: 'rgba(11,24,32,0.55)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderCurve: 'continuous',
    paddingTop: 10,
  },
  sheetPaper: { backgroundColor: COLORS.beige },
  sheetInk: {
    backgroundColor: '#0e2029',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.1)',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  grabberPaper: { backgroundColor: 'rgba(41,60,67,0.25)' },
  grabberInk: { backgroundColor: 'rgba(245,235,220,0.25)' },
});
