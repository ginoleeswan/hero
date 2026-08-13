// "Recently built" — the exact heroes each run just touched, newest first.
// A card grid; tap a card to open the character.
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../../../ui/Text';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { InfoTip } from '../InfoTip';
import { HeroThumb, EmptyState } from '../ui';
import { relTime, runTypeLabel } from '../format';
import type { RecentlyEnriched } from '../../../../lib/db/catalogHealth';

export function RecentlyBuilt({
  recentlyEnriched,
  fill,
}: {
  recentlyEnriched: RecentlyEnriched[];
  fill: boolean;
}) {
  const router = useRouter();
  const grid = (
    <View style={styles.grid}>
      {recentlyEnriched.map((r, i) => (
        <Pressable
          key={`${r.heroId}-${i}`}
          onPress={() => router.push(`/character/${r.heroId}`)}
          style={styles.card}
        >
          <HeroThumb uri={r.imageUrl} width={30} height={40} radius={6} />
          <View style={styles.meta}>
            <Text style={styles.name} numberOfLines={1}>
              {r.name}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {runTypeLabel(r.runType)}
              {r.at ? ` · ${relTime(r.at)}` : ''}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Panel
      fill={fill}
      scroll={fill}
      title="Recently built"
      hint="The exact heroes each run just touched — click one to open it."
      action={
        <InfoTip text="Every hero a run processed is logged here, newest first; the chip shows which stage did it and when. Use it to confirm a build actually did what you expected." />
      }
    >
      {recentlyEnriched.length === 0 ? (
        <EmptyState text="Nothing yet — build some heroes and they appear here." />
      ) : fill ? (
        grid
      ) : (
        <ScrollView style={styles.boundedScroll} nestedScrollEnabled>
          {grid}
        </ScrollView>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  boundedScroll: { maxHeight: 340 } as object,
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 190,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
    paddingVertical: 7,
    paddingHorizontal: 9,
  } as object,
  meta: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.orange },
});
