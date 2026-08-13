// Powerstats generator — drives a working set of heroes through Gemini stats
// generation, one at a time, live. A spotlight card shows the hero generating
// right now with its six dials counting up the instant the result lands; a
// progress grid below ticks each hero to a check as it finishes. Foreground only
// (stops if closed). Spend is gated before this opens, so here we just run.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, ScrollView, Animated, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { HeroThumb } from './atoms';
import {
  getStatsHeroes,
  stepStats,
  STAT_KEYS,
  type StatsHero,
  type HeroStatValues,
} from '../../../lib/db/stats';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Spot = { hero: StatsHero; stats: HeroStatValues | null };

// One animated dial: bar fills and the number counts up to the value on reveal.
function Dial({ label, value }: { label: string; value: number | null }) {
  const [a] = useState(() => new Animated.Value(0));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (value == null) {
      a.stopAnimation();
      a.setValue(0);
      // Reset the displayed count alongside the animation value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(0);
      return;
    }
    const id = a.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(a, { toValue: value, duration: 750, useNativeDriver: false }).start();
    return () => a.removeListener(id);
  }, [value, a]);
  const width = a.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });
  return (
    <View style={styles.dialRow}>
      <Text style={styles.dialLabel}>{label}</Text>
      <View style={styles.dialTrack}>
        <Animated.View style={[styles.dialFill, { width }]} />
      </View>
      <Text style={styles.dialVal}>{value == null ? '··' : shown}</Text>
    </View>
  );
}

function Spotlight({ spot }: { spot: Spot }) {
  const generating = spot.stats == null;
  return (
    <View style={styles.spot}>
      <View style={styles.spotThumbWrap}>
        <HeroThumb uri={spot.hero.image} width={68} height={90} radius={10} />
        {generating ? (
          <View style={styles.spotBadge}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        ) : (
          <View style={[styles.spotBadge, styles.spotBadgeDone]}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.spotBody}>
        <Text style={styles.spotKicker}>{generating ? 'GENERATING NOW' : 'STATS READY'}</Text>
        <Text style={styles.spotName} numberOfLines={1}>
          {spot.hero.name}
        </Text>
        <View style={styles.dials}>
          {STAT_KEYS.map((s) => (
            <Dial key={s.key} label={s.label} value={spot.stats ? spot.stats[s.key] : null} />
          ))}
        </View>
      </View>
    </View>
  );
}

export function StatsBoard({
  heroIds,
  onClose,
  flash,
}: {
  heroIds: string[];
  onClose: () => void;
  flash: (m: string, t?: 'info' | 'success' | 'error' | 'pending') => void;
}) {
  const [heroes, setHeroes] = useState<StatsHero[]>([]);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const ctrl = useRef({ stopped: false, paused: false });
  const running = useRef(false);
  const attempts = useRef<Map<string, number>>(new Map());

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (!ctrl.current.stopped) {
        if (ctrl.current.paused) {
          await sleep(400);
          continue;
        }
        const rows = await getStatsHeroes(heroIds);
        if (ctrl.current.stopped) break;
        setHeroes(rows);
        const next = rows.find(
          (h) => h.status === 'pending' && (attempts.current.get(h.id) ?? 0) < 3,
        );
        if (!next) {
          setDone(true);
          setSpot(null);
          break;
        }
        setDone(false);
        setSpot({ hero: next, stats: null }); // generating — empty dials
        let revealed = false;
        try {
          await stepStats(next.id);
          const fresh = (await getStatsHeroes([next.id]))[0];
          if (fresh?.status === 'done' && fresh.stats) {
            setSpot({ hero: fresh, stats: fresh.stats }); // reveal — dials animate up
            revealed = true;
          }
        } catch {
          /* counted below, skipped after 3 */
        }
        attempts.current.set(next.id, (attempts.current.get(next.id) ?? 0) + 1);
        await sleep(revealed ? 1200 : 400); // linger on a successful reveal
      }
    } finally {
      running.current = false;
    }
  }, [heroIds]);

  useEffect(() => {
    ctrl.current = { stopped: false, paused: false };
    pump();
    return () => {
      ctrl.current.stopped = true;
    };
  }, [pump]);

  const togglePause = () => {
    const v = !paused;
    setPaused(v);
    ctrl.current.paused = v;
  };
  const close = () => {
    ctrl.current.stopped = true;
    const made = heroes.filter((h) => h.status === 'done').length;
    if (made > 0)
      flash(`Generated powerstats for ${made} hero${made === 1 ? '' : 'es'}.`, 'success');
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
            <Text style={styles.title}>
              Powerstats · {total} hero{total === 1 ? '' : 'es'}
            </Text>
            <Text style={styles.sub}>
              {done
                ? 'Finished.'
                : paused
                  ? 'Paused.'
                  : 'Generating with Gemini — keep this tab open.'}
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
            <Text style={[styles.headBtnText, done && { color: '#fff' }]}>
              {done ? 'Done' : 'Stop'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.bar}>
          <View style={styles.barHead}>
            <Text style={styles.barLabel}>Generated</Text>
            <Text style={styles.barNum}>
              {made}/{total}
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${total > 0 ? Math.round((made / total) * 100) : 0}%` },
              ]}
            />
          </View>
        </View>

        {spot ? <Spotlight spot={spot} /> : null}

        {done ? (
          <View style={styles.doneNote}>
            <Ionicons name="checkmark-done" size={16} color={COLORS.green} />
            <Text style={styles.doneText}>
              All {made} done{failed > 0 ? ` · ${failed} failed` : ''}.
            </Text>
          </View>
        ) : null}

        {/* Progress grid — every hero, ticking to a check as it lands. */}
        <ScrollView
          style={styles.grid}
          nestedScrollEnabled
          contentContainerStyle={styles.gridInner}
        >
          {heroes.map((h) => {
            const isNow = spot?.hero.id === h.id && h.status !== 'done';
            return (
              <View
                key={h.id}
                style={[
                  styles.chip,
                  h.status === 'done' && styles.chipDone,
                  isNow && styles.chipNow,
                ]}
              >
                {h.status === 'done' ? (
                  <Ionicons name="checkmark-circle" size={13} color={COLORS.green} />
                ) : h.status === 'failed' ? (
                  <Ionicons name="close-circle" size={13} color={COLORS.red} />
                ) : isNow ? (
                  <ActivityIndicator size="small" color={COLORS.orange} />
                ) : (
                  <View style={styles.chipDot} />
                )}
                <Text style={styles.chipName} numberOfLines={1}>
                  {h.name}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9000,
    backgroundColor: 'rgba(11,18,24,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '86%',
    backgroundColor: '#fffdf8',
    borderRadius: 16,
    padding: 20,
    gap: 14,
    boxShadow: '0 24px 60px rgba(11,18,24,0.4)',
  } as object,
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.black },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: COLORS.grey, marginTop: 2 },
  headBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#efe6d6',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  headBtnPrimary: { backgroundColor: COLORS.orange },
  headBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },

  bar: { gap: 4 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  barNum: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  track: { height: 6, borderRadius: 3, backgroundColor: COLORS.navy + '12', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: COLORS.orange },

  // Spotlight
  spot: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
  },
  spotThumbWrap: { position: 'relative' },
  spotBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  spotBadgeDone: { backgroundColor: COLORS.green },
  spotBody: { flex: 1, minWidth: 0, gap: 3, justifyContent: 'center' },
  spotKicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    color: COLORS.orange,
  },
  spotName: { fontFamily: 'Flame-Regular', fontSize: 17, color: COLORS.black, marginBottom: 4 },
  dials: { gap: 5 },
  dialRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dialLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    color: COLORS.grey,
    width: 28,
  },
  dialTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#efe6d6',
    overflow: 'hidden',
  },
  dialFill: { height: 7, borderRadius: 4, backgroundColor: COLORS.orange },
  dialVal: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
    width: 22,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  doneNote: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  doneText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },

  grid: { maxHeight: 200 } as object,
  gridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: '#f3ecdd',
    maxWidth: 200,
  },
  chipDone: { backgroundColor: COLORS.green + '14' },
  chipNow: { backgroundColor: COLORS.orange + '18' },
  chipDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: '#d8cdbb' },
  chipName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.black,
    flexShrink: 1,
    minWidth: 0,
  },
});
