// src/components/ui/SectionHeader.tsx — the one section header.
//
// The home rails already agreed on this pattern (orange eyebrow at 9/ls-2 over
// a Flame 24 title) across nine components — it's the app's strongest existing
// convention. Everything outside home/ invented its own: eleven different
// eyebrow sizes and letter-spacings between 0.3 and 4. This is that convention,
// extracted, so new sections inherit it instead of guessing.
//
// `tone` picks the canvas: 'dark' for the deep-navy stage, 'light' for beige
// paper. Flame titles carry lineHeight ≥ 1.22× fontSize (see CLAUDE.md) so
// clamped descenders never clip.
import { View, Text, StyleSheet, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, PAPER_TEXT } from '../../constants/colors';
import { TRACKING } from '../../constants/tokens';

// The rail gutter, NOT SCREEN_PAD. A section header lines up with the cards in
// its own rail (16), which is a different measure from the screen-level gutter
// (20) — snapping this to SCREEN_PAD would push every header 4px out of line
// with the row beneath it.
const RAIL_PAD = 16;

export function SectionHeader({
  eyebrow,
  title,
  sub,
  action,
  tone = 'dark',
  style,
}: {
  /** Small orange kicker above the title. Omit for a bare title. */
  eyebrow?: string;
  title: string;
  /** One quiet line under the title, for sections that need framing. */
  sub?: string;
  /** Trailing affordance, e.g. { label: 'See all', onPress }. */
  action?: { label: string; onPress: () => void };
  tone?: 'dark' | 'light';
  style?: StyleProp<ViewStyle>;
}) {
  const light = tone === 'light';
  return (
    <View style={[styles.row, style]}>
      <View style={styles.textCol}>
        {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={[styles.title, light && styles.titleLight]} numberOfLines={1}>
          {title}
        </Text>
        {!!sub && <Text style={[styles.sub, light && styles.subLight]}>{sub}</Text>}
      </View>
      {action && (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            action.onPress();
          }}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={[styles.actionText, light && styles.actionTextLight]}>{action.label}</Text>
          <Ionicons
            name="chevron-forward"
            size={13}
            color={light ? COLORS.navy : 'rgba(245,235,220,0.7)'}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: RAIL_PAD,
    marginBottom: 12,
  },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: TRACKING.widest,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, lineHeight: 30, color: COLORS.beige },
  titleLight: { color: COLORS.navy },
  sub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(245,235,220,0.6)',
    marginTop: 2,
  },
  subLight: { color: PAPER_TEXT.faint },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 4 },
  actionPressed: { opacity: 0.6 },
  actionText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(245,235,220,0.7)' },
  actionTextLight: { color: COLORS.navy },
});
