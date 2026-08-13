// app/notifications.tsx — the inbox: what happened while you were away.
//
// Native and web share this file's shape but expo-router needs both to exist,
// so notifications.web.tsx re-exports this one. There is nothing platform
// specific here — the list is a list.
import { useEffect } from 'react';
import { View, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '../src/components/ui/Text';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PAPER_TEXT } from '../src/constants/colors';
import { DISPLAY, LABEL, RADIUS, SPACE } from '../src/design';
import { EmptyState } from '../src/components/ui/EmptyState';
import { useNotificationInbox } from '../src/hooks/useNotificationInbox';
import type { InboxItem, InboxKind } from '../src/lib/notifications/inbox';

const ICON: Record<InboxKind, keyof typeof Ionicons.glyphMap> = {
  'take-agreed': 'chatbubble-ellipses',
  'take-crowned': 'trophy',
  'debate-resolved': 'stats-chart',
  'streak-broken': 'flame-outline',
};

/** Relative, because "2 hours ago" is what the reader is actually asking. */
function ago(at: number, now: number): string {
  const mins = Math.max(0, Math.round((now - at) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Row({ item, onPress, now }: { item: InboxItem; onPress: () => void; now: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.body}`}
      style={({ pressed }: { pressed: boolean }) => [s.row, pressed && s.rowPressed] as object}
    >
      <View style={s.badge}>
        <Ionicons name={ICON[item.kind]} size={17} color={COLORS.orange} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{item.title}</Text>
        <Text style={s.rowSub}>{item.body}</Text>
      </View>
      <Text style={s.time}>{ago(item.at, now)}</Text>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, loading, builtAt, acknowledge } = useNotificationInbox();

  // Acknowledged on VIEW, not on fetch: a badge that clears because something
  // prefetched in the background is a badge nobody trusts. Once the list has
  // rendered, it has genuinely been seen.
  useEffect(() => {
    if (!loading) void acknowledge();
  }, [loading, acknowledge]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.titleRow}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }: { pressed: boolean }) => [s.back, pressed && s.rowPressed] as object}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.navy} />
        </Pressable>
        <Text style={s.title}>Activity</Text>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>
        {loading ? (
          <ActivityIndicator color={COLORS.orange} style={s.loader} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="Nothing new"
            body="Agreement on your takes, yesterday’s result and streak news show up here."
            tone="light"
          />
        ) : (
          <View style={s.card}>
            {items.map((item, i) => (
              <View key={item.id}>
                {i > 0 ? <View style={s.divider} /> : null}
                <Row
                  item={item}
                  now={builtAt}
                  onPress={() => router.push(item.url as Parameters<typeof router.push>[0])}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACE.md,
    paddingTop: 6,
    paddingBottom: 10,
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { ...DISPLAY.md, color: COLORS.black },
  scroll: { paddingHorizontal: SPACE.md },
  loader: { marginTop: 40 },
  card: {
    backgroundColor: '#fffaf0',
    borderRadius: RADIUS.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#eadfcb',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowPressed: { opacity: 0.7 },
  badge: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,115,51,0.13)',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...LABEL.lg, color: COLORS.navy },
  rowSub: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: PAPER_TEXT.muted },
  time: { ...LABEL.xs, color: PAPER_TEXT.muted },
  divider: { height: 1, backgroundColor: '#eadfcb', marginLeft: 60 },
});
