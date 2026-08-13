// Portrait generator — drives a working set of heroes through Gemini portrait
// generation, one at a time, live. A spotlight shows the hero being painted now:
// its source art sits in the frame, then the generated portrait fades in over it
// the instant it lands. A progress grid below ticks each hero to a check.
// Foreground only (stops if closed). Spend is gated before this opens.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, ScrollView, Animated, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { getPortraitHeroes, stepPortrait, type PortraitHero } from '../../../lib/db/portraits';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Spot = { hero: PortraitHero };

function PortraitSpotlight({ spot }: { spot: Spot }) {
  const generating = !spot.hero.portrait;
  const [fade] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (spot.hero.portrait) {
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    } else {
      fade.setValue(0);
    }
  }, [spot.hero.portrait, spot.hero.id, fade]);

  return (
    <View style={styles.spot}>
      <View style={styles.frame}>
        <Image source={spot.hero.source ?? undefined} style={styles.frameImg} contentFit="cover" />
        {spot.hero.portrait ? (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
            <Image source={spot.hero.portrait} style={styles.frameImg} contentFit="cover" />
          </Animated.View>
        ) : (
          <View style={styles.frameOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.spotBody}>
        <Text style={styles.spotKicker}>{generating ? 'PAINTING NOW' : 'PORTRAIT READY'}</Text>
        <Text style={styles.spotName} numberOfLines={2}>
          {spot.hero.name}
        </Text>
        <Text style={styles.spotSub}>
          {generating ? 'Gemini is redrawing the source art…' : 'Styled portrait generated.'}
        </Text>
      </View>
    </View>
  );
}

export function PortraitBoard({
  heroIds,
  onClose,
  flash,
}: {
  heroIds: string[];
  onClose: () => void;
  flash: (m: string, t?: 'info' | 'success' | 'error' | 'pending') => void;
}) {
  const [heroes, setHeroes] = useState<PortraitHero[]>([]);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const ctrl = useRef({ stopped: false, paused: false });
  const running = useRef(false);
  const attempts = useRef<Map<string, number>>(new Map());

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setDone(false);
    try {
      while (!ctrl.current.stopped) {
        if (ctrl.current.paused) {
          await sleep(400);
          continue;
        }
        const rows = await getPortraitHeroes(heroIds);
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
        setSpot({ hero: next }); // painting — source only
        let revealed = false;
        try {
          await stepPortrait(next.id);
          const fresh = (await getPortraitHeroes([next.id]))[0];
          if (fresh?.status === 'done') {
            setSpot({ hero: fresh });
            revealed = true;
          }
        } catch {
          /* counted below, skipped after 3 */
        }
        attempts.current.set(next.id, (attempts.current.get(next.id) ?? 0) + 1);
        if (!revealed && (attempts.current.get(next.id) ?? 0) >= 3) {
          setFailed((prev) => new Set(prev).add(next.id));
        }
        await sleep(revealed ? 1400 : 500);
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
    if (made > 0) flash(`Generated ${made} portrait${made === 1 ? '' : 's'}.`, 'success');
    onClose();
  };

  const total = heroes.length;
  const made = heroes.filter((h) => h.status === 'done').length;

  return (
    <View style={styles.overlay as object}>
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              Portraits · {total} hero{total === 1 ? '' : 'es'}
            </Text>
            <Text style={styles.sub}>
              {done
                ? 'Finished.'
                : paused
                  ? 'Paused.'
                  : 'Painting with Gemini — keep this tab open.'}
              {failed.size > 0 ? `  ·  ${failed.size} failed` : ''}
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

        {spot ? <PortraitSpotlight spot={spot} /> : null}

        <ScrollView
          style={styles.grid}
          nestedScrollEnabled
          contentContainerStyle={styles.gridInner}
        >
          {heroes.map((h) => {
            const isNow = spot?.hero.id === h.id && h.status !== 'done';
            const isFailed = failed.has(h.id) && h.status !== 'done';
            return (
              <View
                key={h.id}
                style={[
                  styles.chip,
                  h.status === 'done' && styles.chipDone,
                  isFailed && styles.chipFailed,
                  isNow && styles.chipNow,
                ]}
              >
                {h.status === 'done' ? (
                  <Ionicons name="checkmark-circle" size={13} color={COLORS.green} />
                ) : isFailed ? (
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
    gap: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
  },
  frame: {
    width: 96,
    height: 124,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ece2cf',
  },
  frameImg: { width: '100%', height: '100%' },
  frameOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,18,24,0.35)',
  },
  spotBody: { flex: 1, minWidth: 0, gap: 4, justifyContent: 'center' },
  spotKicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    color: COLORS.orange,
  },
  spotName: { fontFamily: 'Flame-Regular', fontSize: 19, color: COLORS.black },
  spotSub: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: COLORS.grey },

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
  chipFailed: { backgroundColor: COLORS.red + '12' },
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
