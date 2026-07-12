// Dark ink→navy stage band for light (paper-bodied) utility screens — Support,
// Settings, the legal documents. These pages used to open with a bare title on
// beige, which left the web TopBar's light glyphs washed out and (on web) let
// iOS Safari tint its status-bar zone beige. The band gives every page the same
// dark top as the rest of the app — the chrome fuses with it — and lands on the
// beige body over the shared seam hairline.
import { type ReactNode } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SURFACE_GRADIENT, SEAM_COLOR } from '../constants/colors';

// The floating web nav is 64px tall; the band clears it (plus the iOS
// status-bar inset, since content bleeds edge-to-edge under viewport-fit=cover).
const WEB_NAV_CLEARANCE = 64;

export function StageHeader({
  title,
  subtitle,
  onBack,
  maxWidth = 720,
  children,
}: {
  title: string;
  /** Small uppercase line under the title (e.g. "Last updated …"). */
  subtitle?: string;
  /** Renders a back chevron before the title when provided. */
  onBack?: () => void;
  /** Match the body column so the title lines up with the content below. */
  maxWidth?: number;
  /** Extra content at the bottom of the band (search bars, meta rows…). */
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const paddingTop = Platform.OS === 'web' ? undefined : insets.top + 12;

  return (
    <View style={[styles.band, paddingTop !== undefined && { paddingTop }]}>
      <View style={[styles.inner, { maxWidth }]}>
        <View style={styles.titleRow}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [styles.backBtn, hovered && (styles.backBtnHover as object)] as object
              }
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={COLORS.beige} />
            </Pressable>
          ) : null}
          <View style={styles.titleCol}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
    ...Platform.select({
      web: {
        backgroundImage: SURFACE_GRADIENT.stage,
        backgroundColor: COLORS.deepNavy,
        paddingTop: `calc(env(safe-area-inset-top) + ${WEB_NAV_CLEARANCE}px + 14px)`,
      } as object,
      default: {},
    }),
    paddingBottom: 22,
  } as object,
  inner: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: -8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } as object,
  backBtnHover: { backgroundColor: 'rgba(245,235,220,0.08)' } as object,
  titleCol: { flexShrink: 1 },
  // Clamp-free Flame display over the dark stage, like the issue/title heads.
  title: { fontFamily: 'Flame-Regular', fontSize: 30, lineHeight: 38, color: COLORS.beige },
  subtitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: 'rgba(245,235,220,0.55)',
    marginTop: 2,
  },
});
