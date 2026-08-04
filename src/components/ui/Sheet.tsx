// src/components/ui/Sheet.tsx — the one bottom sheet.
//
// Eight screens hand-rolled this: ReportSheet, ContributeSheet, StatsSheet,
// EditDisplayNameModal, ChangePasswordModal, BadgeDetailModal, HousePicker and
// DonateNudge. Between them they had three backdrop alphas, two grabber
// colours, two different animations, and only one remembered to lift above the
// keyboard.
//
// THE ANIMATION IS THE POINT. `Modal animationType="slide"` translates the
// ENTIRE modal — backdrop included — up from the bottom edge. The scrim rides
// up with the sheet, and the strip beneath it shows the live app until the
// animation lands, so the sheet appears to drag the page up behind it. The
// other five used `fade`, which doesn't slide at all and reads as a pop.
//
// Both are wrong for the same reason: a sheet and its scrim are two different
// objects. The scrim belongs to the screen and should dim in place; only the
// sheet travels. So the Modal animates nothing (`animationType="none"`) and
// this drives the two independently — backdrop opacity, panel translateY.
//
// `tone` picks the canvas — 'paper' for beige form sheets, 'ink' for the dark
// stat/contents sheets — and carries the grabber and backdrop with it, since a
// paper grabber on an ink sheet is invisible and vice versa.
import { useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { DUR, EASE_OUT } from '../../lib/nativeMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Fallback travel before the panel has measured itself. */
const ASSUMED_H = 700;

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Canvas. 'paper' = beige (forms), 'ink' = deep navy (data, contents). */
  tone?: 'paper' | 'ink';
  /**
   * Lift the sheet above the keyboard. Only for sheets with a text input —
   * it wraps the panel in a KeyboardAvoidingView, which changes layout even
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
  const reduceMotion = useReducedMotion();
  const ink = tone === 'ink';
  // Web renders this as a centred dialog, so there is no upward travel to do.
  const slides = Platform.OS !== 'web' && !reduceMotion;

  // Kept mounted through the exit so the close animates instead of vanishing.
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);
  const panelH = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Mount first, then animate in from progress 0. Driving the Reanimated
      // timeline IS the external system this effect synchronises with, and the
      // unmount has to wait for it to finish, so the state lives here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      progress.value = withTiming(1, { duration: DUR.enter, easing: EASE_OUT });
    } else {
      progress.value = withTiming(0, { duration: DUR.exit, easing: EASE_OUT }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // Shared values are stable refs; re-running on them would restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // The scrim dims IN PLACE. It never translates — that is the whole fix.
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const panelStyle = useAnimatedStyle(() => {
    if (!slides) return { opacity: progress.value, transform: [{ translateY: 0 }] };
    const travel = panelH.value || ASSUMED_H;
    return { opacity: 1, transform: [{ translateY: (1 - progress.value) * travel }] };
  });

  const onPanelLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) panelH.value = h;
  };

  const panel = (
    <Animated.View
      onLayout={onPanelLayout}
      accessibilityViewIsModal
      accessibilityLabel={label}
      style={[
        s.sheet,
        ink ? s.sheetInk : s.sheetPaper,
        // Padding, not a gap: the sheet's own surface runs to the physical
        // bottom edge and the home indicator sits ON it. A margin here would
        // leave a strip of scrim under the sheet.
        { paddingBottom: Math.max(insets.bottom, 8) + footPad },
        panelStyle,
        style,
      ]}
    >
      <View style={[s.grabber, ink ? s.grabberInk : s.grabberPaper]} />
      {children}
    </Animated.View>
  );

  return (
    <Modal
      visible={mounted}
      transparent
      // We own both animations; letting the Modal also animate is what dragged
      // the backdrop up with the sheet.
      animationType="none"
      onRequestClose={onClose}
      // Android: without these the modal stops at the system bars, so the scrim
      // leaves an undimmed band top and bottom and the sheet cannot reach the
      // real bottom edge. No-ops on iOS.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <AnimatedPressable
        style={[s.backdrop, backdropStyle]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={s.dock} pointerEvents="box-none">
        {avoidKeyboard ? (
          // iOS needs the lift; Android resizes the window itself.
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
          >
            {panel}
          </KeyboardAvoidingView>
        ) : (
          panel
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // One scrim value for every sheet — deep-navy tinted, never neutral black,
  // so the dimmed page keeps the warm ink-on-paper material.
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,24,32,0.55)',
  },
  // Separate layer from the scrim so the panel can travel while the scrim
  // holds still. box-none lets taps fall through to the backdrop beside the
  // sheet, which is how tap-outside-to-dismiss keeps working.
  dock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderCurve: 'continuous',
    paddingTop: 10,
    ...Platform.select({
      // Centred dialog on web — round all four corners and inset it.
      web: { borderRadius: 22, marginHorizontal: 16 },
      default: {},
    }),
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
