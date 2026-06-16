import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Defs,
  Pattern,
  ClipPath,
  RadialGradient,
  Stop,
  Circle,
  Rect,
  G,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants/colors';

// Off-white "paper" the poster is printed on — the halftone fades into this at
// its edges so the dot disc dissolves into the card instead of hard-clipping.
const PAPER = '#fffdf8';

export interface NotFoundAction {
  label: string;
  onPress: () => void;
  primary?: boolean;
}

type IoniconName = keyof typeof Ionicons.glyphMap;

// ── Halftone disc ────────────────────────────────────────────────────────────
// A field of navy dots clipped to a circle, with a radial fade (transparent
// centre → paper edge) overlaid so the disc dissolves into the poster. Built
// from primitives that render identically on iOS / Android / web (the same
// react-native-svg the power-stat dials use). A silhouette sits on top.
function Halftone({ icon }: { icon: IoniconName }) {
  const SIZE = 96;
  return (
    <View style={styles.halftone}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="hf-dots" width={8} height={8} patternUnits="userSpaceOnUse">
            <Circle cx={4} cy={4} r={1.5} fill={COLORS.navy} />
          </Pattern>
          <ClipPath id="hf-disc">
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2} />
          </ClipPath>
          <RadialGradient id="hf-fade" cx="50%" cy="46%" r="56%">
            <Stop offset="0.4" stopColor={PAPER} stopOpacity={0} />
            <Stop offset="1" stopColor={PAPER} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <G clipPath="url(#hf-disc)">
          <Rect width={SIZE} height={SIZE} fill="url(#hf-dots)" />
          <Rect width={SIZE} height={SIZE} fill="url(#hf-fade)" />
        </G>
      </Svg>
      <Ionicons name={icon} size={46} color={COLORS.navy} style={styles.halftoneIcon} />
    </View>
  );
}

// ── Wanted poster ────────────────────────────────────────────────────────────
// A tilted "MISSING / 404" poster with a hard comic drop-shadow. The shadow is a
// solid navy plate stacked behind the card (not a blurred box-shadow) so it
// reads crisp and identical on every platform.
function WantedPoster({
  stamp,
  stampColor,
  icon,
  headline,
  subline,
}: {
  stamp: string;
  stampColor: string;
  icon: IoniconName;
  headline: string;
  subline: string;
}) {
  return (
    <View style={styles.posterWrap}>
      <View style={styles.shadowPlate} />
      <View style={styles.poster}>
        <View style={[styles.stamp, { borderColor: stampColor }]}>
          <Text style={[styles.stampText, { color: stampColor }]}>{stamp}</Text>
        </View>
        <Halftone icon={icon} />
        <Text style={styles.posterHeadline}>{headline}</Text>
        <Text style={styles.posterSubline}>{subline}</Text>
      </View>
    </View>
  );
}

function PosterButton({ label, onPress, primary }: NotFoundAction) {
  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    onPress();
  };
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        primary ? styles.btnPrimary : styles.btnGhost,
        pressed && styles.btnPressed,
      ]}
    >
      <Text style={primary ? styles.btnPrimaryText : styles.btnGhostText}>{label}</Text>
    </Pressable>
  );
}

// ── Screens ──────────────────────────────────────────────────────────────────

export interface NotFoundViewProps {
  stamp: string;
  stampColor?: string;
  icon?: IoniconName;
  headline: string;
  subline: string;
  actions: NotFoundAction[];
}

// The poster-led "this doesn't exist" screen, shared by the hero-not-found state
// and the generic 404 route. Permanent states only — a transient load failure
// uses <LoadErrorView> instead (the thing it's looking for does exist).
export function NotFoundView({
  stamp,
  stampColor = COLORS.red,
  icon = 'person',
  headline,
  subline,
  actions,
}: NotFoundViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.center}>
        <WantedPoster
          stamp={stamp}
          stampColor={stampColor}
          icon={icon}
          headline={headline}
          subline={subline}
        />
        <View style={styles.actions}>
          {actions.map((a) => (
            <PosterButton key={a.label} {...a} />
          ))}
        </View>
      </View>
    </View>
  );
}

// Quiet, retryable failure — the hero exists, it just didn't load. Deliberately
// not a poster (which would imply the hero is gone for good).
export function LoadErrorView({
  headline = "Couldn't load this hero",
  subline = 'Check your connection and try again.',
  actions,
}: {
  headline?: string;
  subline?: string;
  actions: NotFoundAction[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.center}>
        <View style={styles.loadIcon}>
          <Ionicons name="cloud-offline-outline" size={34} color={COLORS.navy} />
        </View>
        <Text style={styles.loadHeadline}>{headline}</Text>
        <Text style={styles.loadSubline}>{subline}</Text>
        <View style={styles.actions}>
          {actions.map((a) => (
            <PosterButton key={a.label} {...a} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.beige,
    paddingHorizontal: 28,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Poster ──
  posterWrap: { alignSelf: 'center' },
  shadowPlate: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    transform: [{ translateX: 7 }, { translateY: 9 }, { rotate: '-2.5deg' }],
  },
  poster: {
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: COLORS.navy,
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 28,
    alignItems: 'center',
    transform: [{ rotate: '-2.5deg' }],
  },
  stamp: {
    borderWidth: 3,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 4,
    transform: [{ rotate: '-3deg' }],
    marginBottom: 6,
  },
  stampText: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    letterSpacing: 4,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  posterHeadline: {
    fontFamily: 'Flame-Regular',
    fontSize: 19,
    color: COLORS.navy,
    marginTop: 10,
    textAlign: 'center',
  },
  posterSubline: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12.5,
    color: 'rgba(41,60,67,0.6)',
    marginTop: 4,
    textAlign: 'center',
  },

  // ── Load error ──
  loadIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(41,60,67,0.07)',
    marginBottom: 16,
  },
  loadHeadline: {
    fontFamily: 'Flame-Regular',
    fontSize: 21,
    color: COLORS.navy,
    textAlign: 'center',
  },
  loadSubline: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: 'rgba(41,60,67,0.6)',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 260,
  },

  // ── Actions ──
  actions: {
    marginTop: 36,
    alignItems: 'center',
    gap: 14,
  },
  // Burnt orange (≈4.6:1 with white) — passes WCAG AA, matching the Compare pill.
  btnPrimary: {
    backgroundColor: '#C2551B',
    borderRadius: 28,
    borderCurve: 'continuous',
    paddingVertical: 14,
    paddingHorizontal: 30,
    minWidth: 210,
    alignItems: 'center',
    boxShadow: '0px 8px 20px rgba(41,60,67,0.22)',
  },
  btnPrimaryText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.3,
  },
  btnGhost: {
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  btnGhostText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.navy,
  },
  btnPressed: { opacity: 0.7 },

  halftone: { width: 96, height: 96 },
  halftoneIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    lineHeight: 96,
    zIndex: 1,
  },
});
