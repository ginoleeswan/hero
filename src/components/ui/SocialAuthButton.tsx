// src/components/ui/SocialAuthButton.tsx — the square mark buttons under
// "CONTINUE WITH".
//
// Two full-width bars reading "Continue with Apple" and "Continue with Google"
// spent the screen's two most valuable inches repeating the same three words,
// and made the fastest path look heavier than the email field it sits above.
// Hoisting "Continue with" into one label leaves the marks to say the rest,
// which is what a logo is for.
//
// Square tiles, centred as a row under one label. One shell, two instances:
// Apple and Google buttons that merely LOOK alike
// drift apart — one gets a shadow, the other a different radius — and the pair
// starts reading as two vendors' widgets. Here they are identical by
// construction and only the mark differs.
//
// Both vendors publish an approved mark-only variant, so this is a supported
// treatment rather than a liberty: Apple's HIG allows the logo alone where the
// UI is constrained (mark unaltered, target ≥44pt), and Google's brand terms
// allow the G alone with its own colours intact.
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';

interface Props {
  logo: React.ReactNode;
  /** Spoken by screen readers — the label the button no longer prints. */
  accessibilityLabel: string;
  onPress: () => void;
  loading?: boolean;
}

export function SocialAuthButton({ logo, accessibilityLabel, onPress, loading }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, (pressed || loading) && styles.pressed]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {/* A lit top edge. The tile is ink, and ink catches light at its
          shoulder — the same trick the app's cards use to stop a dark surface
          reading as a hole punched in the paper. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.9)', 'rgba(245,235,220,0.35)']}
        locations={[0, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {loading ? <ActivityIndicator color={COLORS.navy} /> : <View>{logo}</View>}
    </Pressable>
  );
}

/** Square. The marks are the content, so the button is a tile, not a bar. */
export const SOCIAL_BUTTON_SIZE = 64;

const styles = StyleSheet.create({
  // PAPER tiles, in the app's own card language — a hairline on the navy ink,
  // the same edge every PaperCard in the product carries. Deep-ink tiles were
  // tried first and read as two holes punched in the beige: the orange CTA
  // directly above is the screen's weight, and anything heavier than it below
  // fights it. Fixed square rather
  // than flexed: two tiles centred under a label stay the same size whether
  // one provider is available or two (Android has no Apple button), where a
  // flexed row would stretch a lone Google mark across the whole card.
  //
  // White also keeps the Apple mark inside the HIG, which permits exactly
  // black / white / white-outline for a custom button.
  button: {
    width: SOCIAL_BUTTON_SIZE,
    height: SOCIAL_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.14)',
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  pressed: {
    opacity: 0.84,
  },
});
