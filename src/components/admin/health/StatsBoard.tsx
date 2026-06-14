// Powerstats generator — drives a working set of heroes through Gemini stats
// generation, one at a time, live, while you watch. Foreground only (stops if
// closed). Sibling of BuildBoard; single-step (no funnel). Spend is gated before
// this ever opens, so here we just run.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { HeroThumb } from './atoms';
import { getStatsHeroes, stepStats, type StatsHero } from '../../../lib/db/stats';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STATUS_LABEL: Record<StatsHero['status'], string> = {
  pending: 'queued', done: 'stats ready', failed: 'failed',
};

export function StatsBoard({
  heroIds, onClose, flash,
}: { heroIds: string[]; onClose: () => void; flash: (m: string, t?: 'info' | 'success' | 'error' | 'pending') => void }) {
  const [heroes, setHeroes] = useState<StatsHero[]>([]);
  const [paused, setPaused] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const ctrl = useRef({ stopped: false, paused: false });
  const running = useRef(false);
  const attempts = useRef<Map<string, number>>(new Map());

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (!ctrl.current.stopped) {
        if (ctrl.current.paused) { await sleep(400); continue; }
        const rows = await getStatsHeroes(heroIds);
        if (ctrl.current.stopped) break;
        setHeroes(rows);
        const next = rows.find((h) => h.status === 'pending' && (attempts.current.get(h.id) ?? 0) < 3);
        if (!next) { setDone(true); setCurrentId(null); break; }
        setDone(false);
        setCurrentId(next.id);
        try {
          await stepStats(next.id);
        } catch { /* counted below, skipped after 3 */ }
        attempts.current.set(next.id, (attempts.current.get(next.id) ?? 0) + 1);
        await sleep(400);
      }
    } finally {
      running.current = false;
    }
  }, [heroIds]);

  useEffect(() => {
    ctrl.current = { stopped: false, paused: false };
    pump();
    return () => { ctrl.current.stopped = true; };
  }, [pump]);

  const togglePause = () => { const v = !paused; setPaused(v); ctrl.current.paused = v; };
  const close = () => {
    ctrl.current.stopped = true;
    const made = heroes.filter((h) => h.status === 'done').length;
    if (made > 0) flash(`Generated powerstats for ${made} hero${made === 1 ? '' : 'es'}.`, 'success');
    onClose();
  };

  const total = heroes.length;
  const made = heroes.filter((h) => h.status === 'done').length;
  const failed = heroes.filter((h) => h.status === 'failed').length;

  return (
    <View style={styles.overlay as object}>
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Powerstats · {total} hero{total === 1 ? '' : 'es'}</Text>
            <Text style={styles.sub}>
              {done ? 'Finished.' : paused ? 'Paused.' : 'Generating with Gemini — keep this tab open.'}
              {failed > 0 ? `  ·  ${failed} failed` : ''}
            </Text>
          </View>
          {!done ? (
            <Pressable onPress={togglePause} style={styles.headBtn}>
              <Ionicons name={paused ? 'play' : 'pause'} size={14} color={COLORS.navy} />
              <Text style={styles.headBtnText}>{paused ? 'Resume' : 'Pause'}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={close} style={[styles.headBtn, done && styles.headBtnPrimary]}>
            <Text style={[styles.headBtnText, done && { color: '#fff' }]}>{done ? 'Done' : 'Stop'}</Text>
          </Pressable>
        </View>

        <View style={styles.bar}>
          <View style={styles.barHead}>
            <Text style={styles.barLabel}>Generated</Text>
            <Text style={styles.barNum}>{made}/{total}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${total > 0 ? Math.round((made / total) * 100) : 0}%` }]} />
          </View>
        </View>

        <ScrollView style={styles.list} nestedScrollEnabled>
          {heroes.map((h) => (
            <View key={h.id} style={[styles.row, currentId === h.id && styles.rowActive]}>
              <HeroThumb uri={h.image} width={30} height={40} radius={6} />
              <Text style={styles.name} numberOfLines={1}>{h.name}</Text>
              <Text
                style={[styles.stageText, h.status === 'done' && { color: COLORS.green }, h.status === 'failed' && { color: COLORS.red }]}
                numberOfLines={1}
              >
                {currentId === h.id && h.status === 'pending' ? <ActivityIndicator size="small" color={COLORS.orange} /> : STATUS_LABEL[h.status]}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9000,
    backgroundColor: 'rgba(11,18,24,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 680, maxHeight: '82%', backgroundColor: '#fffdf8',
    borderRadius: 16, padding: 20, gap: 14, boxShadow: '0 24px 60px rgba(11,18,24,0.4)',
  } as object,
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.black },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: COLORS.grey, marginTop: 2 },
  headBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#efe6d6', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 },
  headBtnPrimary: { backgroundColor: COLORS.orange },
  headBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },

  bar: { gap: 4 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey, textTransform: 'uppercase', letterSpacing: 0.5 },
  barNum: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  track: { height: 6, borderRadius: 3, backgroundColor: COLORS.navy + '12', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: COLORS.orange },

  list: { maxHeight: 360 } as object,
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.05)' },
  rowActive: { backgroundColor: COLORS.orange + '10' },
  name: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black, minWidth: 0 },
  stageText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.grey, width: 110, textAlign: 'right' },
});
