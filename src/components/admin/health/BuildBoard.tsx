// Build orchestrator — drives a working set of heroes through ComicVine ->
// Resolve -> Appearances, one hero at a time, live, while you watch. Foreground
// only (stops if closed); pauses at the ComicVine hourly cap and auto-resumes.
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { HeroThumb } from './atoms';
import {
  getBuildHeroes, comicvineUsageLastHour, stepComicvine, stepResolve, stepEnrich,
  ACTIONABLE, type BuildHero, type BuildStage,
} from '../../../lib/db/build';

const CV_CAP = 190; // ComicVine ~200/hr; leave headroom
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STAGE_LABEL: Record<BuildStage, string> = {
  comicvine: 'ComicVine', resolve: 'Resolving', appearances: 'Appearances',
  review: 'needs review', unresolved: 'no Wikidata match', failed: 'ComicVine failed', done: 'done',
};

// Three-dot progress for a hero: ComicVine · Resolve · Appearances.
function passedCv(s: BuildStage) { return s !== 'comicvine' && s !== 'failed'; }
function passedResolve(s: BuildStage) { return s === 'appearances' || s === 'review' || s === 'unresolved' || s === 'done'; }

function Dots({ stage, active }: { stage: BuildStage; active: boolean }) {
  const cv = stage === 'failed' ? COLORS.red : passedCv(stage) ? COLORS.green : (active && stage === 'comicvine') ? COLORS.orange : '#d8cdbb';
  const rs = stage === 'review' ? COLORS.yellow : passedResolve(stage) ? COLORS.green : (active && stage === 'resolve') ? COLORS.orange : '#d8cdbb';
  const ap = stage === 'done' ? COLORS.green : (active && stage === 'appearances') ? COLORS.orange : '#d8cdbb';
  return (
    <View style={styles.dots}>
      <View style={[styles.dot, { backgroundColor: cv }]} />
      <View style={[styles.dot, { backgroundColor: rs }]} />
      <View style={[styles.dot, { backgroundColor: ap }]} />
    </View>
  );
}

export function BuildBoard({
  heroIds, onClose, flash,
}: { heroIds: string[]; onClose: () => void; flash: (m: string, t?: 'info' | 'success' | 'error' | 'pending') => void }) {
  const [heroes, setHeroes] = useState<BuildHero[]>([]);
  const [paused, setPaused] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const ctrl = useRef({ stopped: false, paused: false });
  const attempts = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    ctrl.current = { stopped: false, paused: false };
    let alive = true;
    (async () => {
      setHeroes(await getBuildHeroes(heroIds));
      while (!ctrl.current.stopped) {
        if (ctrl.current.paused) { await sleep(400); continue; }
        const rows = await getBuildHeroes(heroIds);
        if (!alive) return;
        setHeroes(rows);
        const key = (h: BuildHero) => `${h.id}:${h.stage}`;
        const next = rows.find((h) => ACTIONABLE.includes(h.stage) && (attempts.current.get(key(h)) ?? 0) < 3);
        if (!next) { if (alive) { setDone(true); setCurrentId(null); } break; }
        if (alive) setCurrentId(next.id);
        try {
          if (next.stage === 'comicvine') {
            if ((await comicvineUsageLastHour()) >= CV_CAP) { if (alive) setRateLimited(true); await sleep(20_000); continue; }
            if (alive) setRateLimited(false);
            await stepComicvine(next.id, next.name);
          } else if (next.stage === 'resolve') {
            await stepResolve(next.id);
          } else {
            await stepEnrich(next.id);
          }
        } catch { /* counted below, skipped after 3 */ }
        attempts.current.set(key(next), (attempts.current.get(key(next)) ?? 0) + 1);
        await sleep(400);
      }
    })();
    return () => { alive = false; ctrl.current.stopped = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = () => { const v = !paused; setPaused(v); ctrl.current.paused = v; };
  const close = () => { ctrl.current.stopped = true; onClose(); };

  const total = heroes.length;
  const cvDone = heroes.filter((h) => passedCv(h.stage)).length;
  const resolved = heroes.filter((h) => passedResolve(h.stage)).length;
  const enriched = heroes.filter((h) => h.stage === 'done').length;
  const review = heroes.filter((h) => h.stage === 'review').length;
  const failed = heroes.filter((h) => h.stage === 'failed').length;

  return (
    <View style={styles.overlay as object}>
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Build · {total} hero{total === 1 ? '' : 'es'}</Text>
            <Text style={styles.sub}>
              {done ? 'Finished.' : paused ? 'Paused.' : 'Running — keep this tab open.'}
              {review > 0 ? `  ·  ${review} need review` : ''}{failed > 0 ? `  ·  ${failed} failed` : ''}
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

        <View style={styles.progressRow}>
          <Bar label="ComicVine" have={cvDone} total={total} />
          <Bar label="Resolve" have={resolved} total={total} />
          <Bar label="Appearances" have={enriched} total={total} />
        </View>

        {rateLimited ? (
          <View style={styles.rateBar}>
            <Ionicons name="hourglass-outline" size={14} color={COLORS.orange} />
            <Text style={styles.rateText}>ComicVine hourly limit reached — waiting for the window to open, then auto-resuming.</Text>
          </View>
        ) : null}

        <ScrollView style={styles.list} nestedScrollEnabled>
          {heroes.map((h) => (
            <View key={h.id} style={[styles.row, currentId === h.id && styles.rowActive]}>
              <HeroThumb uri={h.image} width={30} height={40} radius={6} />
              <Text style={styles.name} numberOfLines={1}>{h.name}</Text>
              <Text style={[styles.stageText, h.stage === 'done' && { color: COLORS.green }, (h.stage === 'failed') && { color: COLORS.red }, h.stage === 'review' && { color: COLORS.yellow }]} numberOfLines={1}>
                {currentId === h.id && ACTIONABLE.includes(h.stage) ? <ActivityIndicator size="small" color={COLORS.orange} /> : STAGE_LABEL[h.stage]}
              </Text>
              <Dots stage={h.stage} active={currentId === h.id} />
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function Bar({ label, have, total }: { label: string; have: number; total: number }) {
  const pct = total > 0 ? Math.round((have / total) * 100) : 0;
  return (
    <View style={styles.bar}>
      <View style={styles.barHead}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barNum}>{have}/{total}</Text>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
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

  progressRow: { flexDirection: 'row', gap: 12 },
  bar: { flex: 1, gap: 4 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey, textTransform: 'uppercase', letterSpacing: 0.5 },
  barNum: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  track: { height: 6, borderRadius: 3, backgroundColor: COLORS.navy + '12', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: COLORS.orange },

  rateBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.orange + '14', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  rateText: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },

  list: { maxHeight: 360 } as object,
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.05)' },
  rowActive: { backgroundColor: COLORS.orange + '10' },
  name: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black, minWidth: 0 },
  stageText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.grey, width: 110, textAlign: 'right' },
  dots: { flexDirection: 'row', gap: 4, width: 40, justifyContent: 'flex-end' },
  dot: { width: 8, height: 8, borderRadius: 8 },
});
