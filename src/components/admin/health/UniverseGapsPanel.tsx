// Universe gaps: characters still parked in the 'Company-Licensed' catch-all with
// no real franchise. ComicVine gives the comic house, not the franchise, so there
// is no reliable auto-signal — assignment is a curated comicvine_id → franchise
// pass. This panel just surfaces the backlog (with a copy button) so newly-ingested
// licensed characters aren't silently forgotten. Renders nothing when clean.
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { Panel } from './Panel';
import { InfoTip } from './InfoTip';
import { HeroThumb } from './atoms';
import type { UnbrandedHero } from '../../../lib/db/catalogHealth';

type Flash = (msg: string, tone?: 'info' | 'success' | 'error' | 'pending') => void;

export function UniverseGapsPanel({
  heroes,
  loading,
  flash,
}: {
  heroes: UnbrandedHero[];
  loading: boolean;
  flash: Flash;
}) {
  if (!loading && heroes.length === 0) return null;

  const copyList = async () => {
    const text = heroes
      .map((h) => `${h.name}\t${h.id}\tcv-${h.comicvineId ?? '?'}\t${(h.teams ?? []).join('/')}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      flash(`Copied ${heroes.length} unbranded characters.`, 'success');
    } catch {
      flash('Could not copy to clipboard.', 'error');
    }
  };

  return (
    <Panel
      title="Needs a universe"
      hint={`${heroes.length} character${heroes.length === 1 ? '' : 's'} still in the Company-Licensed catch-all`}
      action={
        <InfoTip text="ComicVine gives the comic publisher, not the franchise, so these can't be auto-placed — they need a curated comicvine_id → franchise pass. Copy the list and hand it over to get them placed (and made fame-eligible). Newly-ingested licensed characters land here." />
      }
    >
      {loading ? (
        <ActivityIndicator color={COLORS.orange} style={styles.loader} />
      ) : (
        <>
          <Pressable style={styles.copyBtn} onPress={copyList} accessibilityRole="button">
            <Ionicons name="copy-outline" size={14} color={COLORS.navy} />
            <Text style={styles.copyText}>Copy list</Text>
          </Pressable>
          <View style={styles.list}>
            {heroes.map((h) => (
              <View key={h.id} style={styles.row}>
                <HeroThumb uri={h.image} size={34} />
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {h.name}
                    <Text style={styles.cv}>{`  cv-${h.comicvineId ?? '?'}`}</Text>
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {(h.teams ?? []).length > 0 ? (h.teams ?? []).join(' · ') : (h.hint ?? '—')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  loader: { paddingVertical: 24 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 7,
    backgroundColor: 'rgba(41,60,67,0.06)',
    marginBottom: 10,
  },
  copyText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  info: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black },
  cv: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey, fontVariant: ['tabular-nums'] },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
});
