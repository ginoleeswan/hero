// Enrichment domain — the operator hub for every data pipeline that fills the
// catalog, plus anything that needs a human decision (ambiguous identity review).
// One card per drain (coverage + status + run), then a "Needs attention" panel.
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Bento } from '../Bento';
import { Panel } from '../Panel';
import { HeroThumb } from '../atoms';
import type { AmbiguousHero, EnrichmentProgress } from '../../../../lib/db/catalogHealth';

const pct = (have: number, total: number) => (total > 0 ? Math.round((have / total) * 100) : 0);

interface Pipeline {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
  blurb: string;
  have: number;
  total: number;
  /** Status when there's no run button (e.g. cron-driven). */
  note?: string;
  run?: { label: string; busyKey: string; onPress: () => void };
}

function PipelineCard({ p, busy }: { p: Pipeline; busy: string | null }) {
  const percent = pct(p.have, p.total);
  const running = p.run && busy === p.run.busyKey;
  return (
    <View style={styles.card}>
      <View style={styles.cardIcon}>
        <Ionicons name={p.icon} size={18} color={COLORS.orange} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName} numberOfLines={1}>{p.name}</Text>
          <Text style={styles.cardCount}>
            {p.have.toLocaleString()}{p.total > 0 ? ` / ${p.total.toLocaleString()}` : ''}
          </Text>
        </View>
        <Text style={styles.cardBlurb} numberOfLines={1}>{p.blurb}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
      </View>
      <View style={styles.cardAction}>
        {p.run ? (
          <Pressable
            onPress={p.run.onPress}
            disabled={!!busy}
            style={[styles.runBtn, !!busy && styles.dim]}
          >
            {running ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="play" size={12} color="#fff" />
            )}
            <Text style={styles.runText}>{p.run.label}</Text>
          </Pressable>
        ) : (
          <Text style={styles.note}>{p.note ?? 'auto'}</Text>
        )}
      </View>
    </View>
  );
}

export function EnrichmentDomain({
  progress,
  ambiguous,
  busy,
  onRunDrain,
  onRunResolve,
  onRunEnrich,
  onResolveQid,
  narrow,
}: {
  progress: EnrichmentProgress | undefined;
  ambiguous: AmbiguousHero[];
  busy: string | null;
  onRunDrain: () => void;
  onRunResolve: () => void;
  onRunEnrich: () => void;
  onResolveQid: (id: string, qid: string, name: string) => void;
  narrow: boolean;
}) {
  const p = progress ?? {
    heroesTotal: 0, comicvineDone: 0, resolved: 0, ambiguous: 0, unresolved: 0,
    enriched: 0, filmTitles: 0, tvTitles: 0, gameTitles: 0,
  };

  const pipelines: Pipeline[] = [
    {
      key: 'comicvine', icon: 'documents-outline', name: 'ComicVine',
      blurb: 'Core hero data — powers, bio, movies',
      have: p.comicvineDone, total: p.heroesTotal,
      run: { label: 'Run', busyKey: 'drain', onPress: onRunDrain },
    },
    {
      key: 'tmdb', icon: 'film-outline', name: 'TMDB · film',
      blurb: `Film media — posters, trailers, cast (${p.filmTitles.toLocaleString()} titles)`,
      have: p.filmTitles, total: p.filmTitles,
      note: 'cron',
    },
    {
      key: 'wd-resolve', icon: 'globe-outline', name: 'Wikidata · resolve',
      blurb: 'Match each hero to its Wikidata identity (QID)',
      have: p.resolved, total: p.heroesTotal,
      run: { label: 'Resolve', busyKey: 'resolve', onPress: onRunResolve },
    },
    {
      key: 'wd-enrich', icon: 'sparkles-outline', name: 'Wikidata · appearances',
      blurb: `Cross-media edges — film/TV/game + cast (${p.tvTitles}+${p.gameTitles} tv/game titles)`,
      have: p.enriched, total: p.resolved,
      run: { label: 'Enrich', busyKey: 'enrich', onPress: onRunEnrich },
    },
  ];

  return (
    <Bento>
      <Panel
        title="Pipelines"
        hint="Every drain that fills the catalogue. Run one on demand or let its cron tick."
      >
        <View style={styles.cardList}>
          {pipelines.map((pl) => (
            <PipelineCard key={pl.key} p={pl} busy={busy} />
          ))}
        </View>
      </Panel>

      <Panel
        title="Needs attention"
        hint={
          ambiguous.length > 0
            ? `${ambiguous.length} hero${ambiguous.length === 1 ? '' : 'es'} need a Wikidata identity picked`
            : 'Items here need a human decision'
        }
      >
        {ambiguous.length === 0 ? (
          <Text style={styles.empty}>All clear — nothing waiting on you.</Text>
        ) : (
          ambiguous.map((hero) => {
            const busyThis = busy === `resolveqid-${hero.id}`;
            return (
              <View key={hero.id} style={[styles.reviewRow, narrow && styles.reviewRowNarrow]}>
                <View style={styles.reviewWho}>
                  <HeroThumb uri={hero.imageUrl} width={34} height={44} radius={7} />
                  <View style={styles.reviewMeta}>
                    <Text style={styles.reviewName} numberOfLines={1}>{hero.name}</Text>
                    <Text style={styles.reviewPub} numberOfLines={1}>{hero.publisher ?? '—'}</Text>
                  </View>
                </View>
                <View style={styles.candidates}>
                  {hero.candidates.map((c) => (
                    <Pressable
                      key={c.qid}
                      onPress={() => onResolveQid(hero.id, c.qid, hero.name)}
                      disabled={!!busy}
                      style={[styles.chip, !!busy && styles.dim]}
                    >
                      <Text style={styles.chipText}>
                        {busyThis ? '…' : `${c.qid} · ${c.score.toFixed(2)}`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </Panel>
    </Bento>
  );
}

const styles = StyleSheet.create({
  cardList: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
  },
  cardIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: COLORS.orange + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 4, minWidth: 0 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  cardName: { fontFamily: 'Flame-Regular', fontSize: 14, color: COLORS.black, flexShrink: 1 },
  cardCount: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey },
  cardBlurb: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  track: { height: 5, borderRadius: 3, backgroundColor: COLORS.navy + '12', overflow: 'hidden', marginTop: 2 },
  fill: { height: 5, borderRadius: 3, backgroundColor: COLORS.orange },
  cardAction: { minWidth: 76, alignItems: 'flex-end' },
  runBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.orange, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  runText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
  note: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey, textTransform: 'uppercase', letterSpacing: 0.6 },
  dim: { opacity: 0.4 },

  empty: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.grey },
  reviewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.06)',
  },
  reviewRowNarrow: { flexDirection: 'column', alignItems: 'stretch' },
  reviewWho: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  reviewMeta: { flex: 1, minWidth: 0 },
  reviewName: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  reviewPub: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
  candidates: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  chip: { backgroundColor: COLORS.navy + '12', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.navy },
});
