// Live activity feed for the Traffic tab — the most recent page views, newest
// first, with character routes shown by hero name and everything else as a
// friendly section label + relative time. A pulsing "active now" header answers
// "what's happening this minute". Tapping a hero row opens that character.
import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../../../constants/colors';
import { relTime } from '../../format';
import { EmptyState } from '../../ui';
import type { LiveHit } from '../../../../../lib/db/traffic';

// Friendly label + icon for a route pattern (non-character views).
const ROUTE_META: {
  test: (r: string) => boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { test: (r) => r === '/' || r === '/index', label: 'Home', icon: 'home' },
  { test: (r) => r.startsWith('/explore'), label: 'Explore', icon: 'compass' },
  { test: (r) => r.startsWith('/search'), label: 'Search', icon: 'search' },
  { test: (r) => r.startsWith('/versus') || r.includes('arena'), label: 'Arena', icon: 'flash' },
  { test: (r) => r.startsWith('/profile'), label: 'Profile', icon: 'person-circle' },
  { test: (r) => r.startsWith('/admin'), label: 'Command center', icon: 'construct' },
  { test: (r) => r.startsWith('/settings'), label: 'Settings', icon: 'settings-outline' },
  { test: (r) => r.startsWith('/universe'), label: 'Universe', icon: 'planet' },
  { test: (r) => r.startsWith('/category'), label: 'Category', icon: 'albums' },
  { test: (r) => r.startsWith('/title') || r.startsWith('/film'), label: 'Title', icon: 'film' },
  { test: (r) => r.startsWith('/issue'), label: 'Issue', icon: 'book-outline' },
  { test: (r) => r.startsWith('/biography'), label: 'Biography', icon: 'document-text-outline' },
  { test: (r) => r.startsWith('/team'), label: 'Team', icon: 'people' },
  { test: (r) => r.startsWith('/compare'), label: 'Compare', icon: 'git-compare' },
  {
    test: (r) => r.startsWith('/login') || r.startsWith('/signup'),
    label: 'Sign in',
    icon: 'log-in-outline',
  },
];

function routeMeta(route: string) {
  const m = ROUTE_META.find((x) => x.test(route));
  if (m) return m;
  return { label: route, icon: 'globe-outline' as keyof typeof Ionicons.glyphMap };
}

function PulseDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[styles.pulse, { opacity: pulse }]} />;
}

/** A character path → the hero id, so a hero row can deep-link. */
const heroIdFromPath = (path: string) =>
  path.startsWith('/character/') ? path.split('/')[2] : null;

export function LiveFeed({ hits, activeNow }: { hits: LiveHit[]; activeNow: number }) {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <PulseDot />
        <Text style={styles.headerText}>
          {activeNow > 0 ? `${activeNow.toLocaleString()} active now` : 'No one active this minute'}
        </Text>
      </View>
      {hits.length === 0 ? (
        <EmptyState text="No recent activity." />
      ) : (
        <View style={styles.list}>
          {hits.map((hit, i) => {
            const heroId = hit.name ? heroIdFromPath(hit.path) : null;
            const meta = routeMeta(hit.route);
            const label = hit.name ?? meta.label;
            const icon = hit.name ? ('person' as const) : meta.icon;
            const tint = hit.name ? COLORS.orange : COLORS.grey;
            const Row = (
              <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: tint + '1a' }]}>
                  <Ionicons name={icon} size={13} color={tint} />
                </View>
                <Text style={styles.label} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={styles.time}>{relTime(hit.at)}</Text>
              </View>
            );
            return heroId ? (
              <Pressable key={i} onPress={() => router.push(`/character/${heroId}`)}>
                {Row}
              </Pressable>
            ) : (
              <View key={i}>{Row}</View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pulse: { width: 8, height: 8, borderRadius: 999, backgroundColor: COLORS.green },
  headerText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 0.2,
    color: COLORS.green,
  },
  list: { gap: 1 },
  // paddingVertical 5 + 26 icon = 36pt row (dense feed).
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  time: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
});
