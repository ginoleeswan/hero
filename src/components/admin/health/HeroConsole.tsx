// Hero console — find any single hero and re-fetch / inspect it. Per-record
// troubleshooting; lives under Catalog (it's about catalogue records).
import { View, Text, Pressable, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { Panel } from './Panel';
import { Chip, HeroThumb } from './atoms';
import type { AdminHeroResult } from '../../../lib/db/catalogHealth';

export function HeroConsole({
  heroQuery,
  setHeroQuery,
  heroResults,
  heroSearchLoading,
  busy,
  onReenrich,
}: {
  heroQuery: string;
  setHeroQuery: (q: string) => void;
  heroResults: AdminHeroResult[];
  heroSearchLoading: boolean;
  busy: string | null;
  onReenrich: (id: string, name: string) => void;
}) {
  const router = useRouter();
  return (
    <Panel title="Hero console" hint="Find any hero and re-fetch its ComicVine data on demand">
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={COLORS.grey} />
        <TextInput
          value={heroQuery}
          onChangeText={setHeroQuery}
          placeholder="Search heroes by name…"
          placeholderTextColor={COLORS.grey}
          style={[styles.searchInput, { outlineStyle: 'none' }] as object}
        />
        {heroQuery.length > 0 && (
          <Pressable onPress={() => setHeroQuery('')}>
            <Ionicons name="close-circle" size={16} color={COLORS.grey} />
          </Pressable>
        )}
      </View>
      {heroQuery.trim().length >= 2 && (
        <View style={{ marginTop: 6 }}>
          {heroSearchLoading ? (
            <ActivityIndicator color={COLORS.orange} style={{ marginTop: 14 }} />
          ) : heroResults.length === 0 ? (
            <Text style={styles.empty}>No heroes match “{heroQuery}”.</Text>
          ) : (
            heroResults.map((hero) => {
              const st = hero.comicvine_status ?? 'none';
              const stc =
                st === 'done'
                  ? COLORS.green
                  : st === 'failed'
                    ? COLORS.red
                    : st === 'pending'
                      ? COLORS.yellow
                      : COLORS.grey;
              const busyThis = busy === `reenrich-${hero.id}`;
              return (
                <View key={hero.id} style={styles.row}>
                  <HeroThumb
                    uri={hero.portrait_url ?? hero.image_url}
                    width={34}
                    height={44}
                    radius={7}
                  />
                  <Pressable
                    style={styles.info}
                    onPress={() => router.push(`/character/${hero.id}`)}
                  >
                    <Text style={styles.name} numberOfLines={1}>
                      {hero.name}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.pub} numberOfLines={1}>
                        {hero.publisher ?? '—'}
                      </Text>
                      <Chip bg={stc + '22'} fg={stc} text={st} capitalize />
                      {!hero.portrait_url && <Text style={styles.flag}>no portrait</Text>}
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => onReenrich(hero.id, hero.name)}
                    disabled={!!busy}
                    style={[styles.btn, !!busy && styles.dim]}
                  >
                    {busyThis ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="refresh" size={14} color="#fff" />
                    )}
                    <Text style={styles.btnText}>Re-fetch</Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f6f0e6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 10,
  },
  searchInput: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.grey, marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f6f0e6',
  },
  info: { flex: 1, gap: 4, minWidth: 0 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pub: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey, maxWidth: 150 },
  flag: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.red },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
  },
  btnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
  dim: { opacity: 0.4 },
});
