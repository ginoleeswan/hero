// "Recently added" — the newest catalogue entries with their live build stage.
// Fills the Add tab below the search panel (which is empty until you type, and
// left ~55% of the mobile screen as dead ink) with useful context at zero
// ComicVine cost: what just came in, and how far the pipeline took it.
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { HeroThumb, EmptyState } from '../ui';
import { relTime, withAlpha } from '../format';
import { getRecentlyAddedHeroes } from '../../../../lib/db/build';
import { STAGE_BADGE } from '../AddHeroesPanel.constants';

export function RecentlyAddedPanel() {
  const router = useRouter();
  const recentQ = useQuery({
    queryKey: ['admin', 'recently-added'],
    queryFn: () => getRecentlyAddedHeroes(8),
    staleTime: 60_000,
  });
  const heroes = recentQ.data ?? [];

  return (
    <Panel title="Recently added" hint="Newest catalogue entries and how far the build took them">
      {recentQ.isSuccess && heroes.length === 0 ? (
        <EmptyState text="Nothing yet — search above to add your first." />
      ) : (
        <View style={s.rows}>
          {heroes.map((h) => {
            const badge = STAGE_BADGE[h.stage];
            return (
              <Pressable key={h.id} style={s.row} onPress={() => router.push(`/character/${h.id}`)}>
                <HeroThumb uri={h.image} size={34} radius={8} />
                <View style={s.main}>
                  <Text style={s.name} numberOfLines={1}>
                    {h.name}
                  </Text>
                  <Text style={s.sub} numberOfLines={1}>
                    {h.publisher ?? 'Unknown publisher'} · {relTime(h.createdAt)}
                  </Text>
                </View>
                <View style={[s.badge, { backgroundColor: withAlpha(badge.color, 0.14) }]}>
                  <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Panel>
  );
}

const s = StyleSheet.create({
  rows: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  main: { flex: 1, minWidth: 0 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: { fontFamily: 'Nunito_700Bold', fontSize: 10.5 },
});
