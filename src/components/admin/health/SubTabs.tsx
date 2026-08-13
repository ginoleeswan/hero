// Sub-tab pill strip for splitting a dense domain into focused, no-scroll bento
// views. Sits on the dark content background, above the active sub-view.
import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '../../ui/Text';
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
  // Mobile: a horizontally SCROLLABLE strip with FULL labels (icons dropped —
  // they cost the most width). The old shrink-to-fit approach ellipsized six
  // Publish tabs into "So… / Prom… / Insig…" — unreadable beats unscrollable in
  // no world. Pills keep their intrinsic width; the strip carries any overflow.
  const { width } = useWindowDimensions();
  const narrow = width < 760;

  const pills = tabs.map((t) => {
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
  });

  if (narrow) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {pills}
      </ScrollView>
    );
  }
  return <View style={styles.row}>{pills}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  // Mobile strip: the ScrollView owns the width; pills never squeeze. Bleeds
  // through the shell's 12px body gutter to the screen edges — a scroller that
  // clips at the gutter reads as a broken layout, not a scrollable one. The
  // gutter moves into the content padding so the first pill still aligns.
  scroll: { marginBottom: 12, marginHorizontal: -12, flexGrow: 0 },
  scrollContent: { flexDirection: 'row', gap: 6, paddingHorizontal: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  // Mobile: slightly slimmer pills at full label width, tall enough for the
  // 44pt touch floor. flexShrink deliberately ABSENT — labels never truncate.
  pillNarrow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: COLORS.orange },
  pillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },
  pillTextNarrow: { fontSize: 12.5 },
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
