// Sub-tab pill strip for splitting a dense domain into focused, no-scroll bento
// views. Sits on the dark content background, above the active sub-view.
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';

export interface SubTab<T extends string> {
  key: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  badge?: number;
}

export function SubTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: SubTab<T>[];
  active: T;
  onChange: (k: T) => void;
}) {
  // Mobile: keep every sub-tab on one no-wrap line — tighter pills, icons dropped
  // (they cost the most width).
  const { width } = useWindowDimensions();
  const narrow = width < 760;
  return (
    <View style={[styles.row, narrow && styles.rowNarrow]}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[styles.pill, narrow && styles.pillNarrow, on && styles.pillOn]}
          >
            {t.icon && !narrow ? (
              <Ionicons name={t.icon} size={14} color={on ? '#fff' : 'rgba(255,255,255,0.65)'} />
            ) : null}
            <Text
              numberOfLines={1}
              style={[styles.pillText, narrow && styles.pillTextNarrow, on && styles.pillTextOn]}
            >
              {t.label}
            </Text>
            {t.badge != null && t.badge > 0 ? (
              <View style={[styles.badge, on && styles.badgeOn]}>
                <Text style={[styles.badgeText, on && styles.badgeTextOn]}>
                  {t.badge > 99 ? '99+' : t.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  // Mobile: one no-wrap line, tighter gaps so every sub-tab fits without scroll.
  rowNarrow: { flexWrap: 'nowrap', gap: 5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  // Mobile: slimmer pills (less padding, icons dropped in the view), allowed to
  // shrink so all tabs fit one line, and tall enough to meet the 44pt touch floor.
  pillNarrow: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 4,
    flexShrink: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: COLORS.orange },
  // flexShrink lets the label give up width (with numberOfLines) so a long tab
  // like "Distributions" truncates instead of pushing the no-wrap row off-screen.
  pillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    flexShrink: 1,
  },
  pillTextNarrow: { fontSize: 12 },
  pillTextOn: { color: '#fff' },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    paddingHorizontal: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOn: { backgroundColor: 'rgba(0,0,0,0.22)' },
  badgeText: { fontFamily: 'Nunito_700Bold', fontSize: 10.5, color: 'rgba(255,255,255,0.8)' },
  badgeTextOn: { color: '#fff' },
});
