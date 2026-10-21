// Audience › Visitors hero: the "atlas". A spinning dot-matrix globe where every
// country's land glows by its share of the audience, with a light spike per
// active country and a pulsing beacon for each person on the site right now.
// Beside it, the ranked list the globe is drawing and a live feed of who's
// reading what. Hover a country for its numbers; click it (on the globe or in
// the list) to filter the sessions list below, same as the Countries panel.
//
// The scene itself lives in globeScene.ts; this file only owns layout + data.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../../ui/Text';
import { COLORS } from '../../../../../constants/colors';
import { CC, DENSITY } from '../../format';
import { PillGroup } from '../../ui';
import { countryName, type AudienceSession, type CountryRow } from '../../../../../lib/db/audience';
import { GlobeScene, type GlobeHover } from './globeScene';

type Metric = 'visitors' | 'views';
const METRICS = [
  { label: 'Visitors', value: 'visitors' as const },
  { label: 'Views', value: 'views' as const },
];
const LIST_MAX = 8;
const LIST_MAX_NARROW = 5;
const LABELS_MAX = 5;
const LABELS_MAX_NARROW = 3;
/** Phone header overlays the globe's top; desktop's sits in the corner. */
const INSET_TOP_NARROW = 64;
const LIVE_MAX = 5;

/** ISO alpha-2 → the short tag shown in badges and globe labels. Pure; exported for tests. */
export function codeOf(code: string): string {
  return /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : '··';
}

/** Country-code badge — typography, not flag emoji (house rule: no emoji in product UI). */
function CodeBadge({ code }: { code: string | null }) {
  if (!code) {
    return (
      <View style={s.badge}>
        <Ionicons name="globe-outline" size={11} color={INK_MUTED} />
      </View>
    );
  }
  return (
    <View style={s.badge}>
      <Text style={s.badgeText}>{codeOf(code)}</Text>
    </View>
  );
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 1 ? 'now' : `${m}m ago`;
}

export function AudienceGlobe({
  countries,
  live,
  botSessions,
  rangeDays,
  selected,
  onSelect,
  narrow,
}: {
  countries: CountryRow[];
  /** Sessions active in the last few minutes — drawn as beacons. */
  live: AudienceSession[];
  botSessions: number;
  rangeDays: number;
  selected: string | null;
  onSelect: (code: string | null) => void;
  narrow: boolean;
}) {
  const [metric, setMetric] = useState<Metric>('visitors');
  const [hover, setHover] = useState<GlobeHover | null>(null);
  const hostRef = useRef<View>(null);
  const sceneRef = useRef<GlobeScene | null>(null);
  const focusedOnce = useRef(false);
  const [glFailed] = useState(() => !hasWebGL());

  const known = useMemo(() => countries.filter((c) => c.code !== 'unknown'), [countries]);
  const ranked = useMemo(
    () =>
      [...known]
        .map((c) => ({ code: c.code, value: c[metric] }))
        .filter((c) => c.value > 0)
        .sort((a, b) => b.value - a.value),
    [known, metric],
  );
  const total = useMemo(() => countries.reduce((n, c) => n + c[metric], 0), [countries, metric]);
  const byCode = useMemo(() => new Map(ranked.map((r) => [r.code, r.value])), [ranked]);
  const share = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  // Scene lifecycle — one WebGL context per mount.
  useEffect(() => {
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host || glFailed) return;
    let scene: GlobeScene;
    try {
      scene = new GlobeScene(host);
    } catch (e) {
      console.warn('[AudienceGlobe] scene failed:', e);
      return;
    }
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [glFailed]);

  // Handlers read fresh props through the scene's mutable callbacks.
  const pick = useCallback(
    (code: string) => onSelect(code === selected ? null : code),
    [onSelect, selected],
  );
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.onHover = setHover;
    scene.onPick = pick;
  }, [pick]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setData(ranked, !focusedOnce.current && !selected);
    if (ranked.length) focusedOnce.current = true;
    scene.setLabels(
      ranked
        .slice(0, narrow ? LABELS_MAX_NARROW : LABELS_MAX)
        .map((r) => ({ code: r.code, text: `${codeOf(r.code)}  ${r.value.toLocaleString()}` })),
    );
  }, [ranked, selected, narrow]);

  useEffect(() => {
    sceneRef.current?.setInsetTop(narrow ? INSET_TOP_NARROW : 0);
  }, [narrow]);

  useEffect(() => {
    sceneRef.current?.setBeacons(
      live
        .filter((s) => s.country)
        .map((s) => ({ id: s.sessionId, code: s.country as string, seed: s.city ?? s.sessionId })),
    );
  }, [live]);

  useEffect(() => {
    sceneRef.current?.setSelected(selected);
  }, [selected]);

  const top = ranked[0];
  const hoverValue = hover ? (byCode.get(hover.code) ?? 0) : 0;

  return (
    <View style={[s.card, narrow && s.cardNarrow]}>
      {/* Globe stage */}
      <View style={[s.stage, narrow && s.stageNarrow]}>
        <View ref={hostRef} style={s.host} />
        {glFailed ? (
          <View style={s.fallback}>
            <Ionicons name="globe-outline" size={28} color={COLORS.grey} />
            <Text style={s.fallbackText}>This browser cannot draw the globe (WebGL is off).</Text>
          </View>
        ) : null}
        <View style={s.stageHead} pointerEvents="box-none">
          <View>
            <Text style={s.eyebrow}>AUDIENCE ATLAS</Text>
            <Text style={s.title}>Where your readers are</Text>
          </View>
          <PillGroup options={METRICS} value={metric} onChange={setMetric} />
        </View>
        <View style={s.legend} pointerEvents="none">
          <Text style={s.legendText}>fewer</Text>
          <View style={s.legendRamp} />
          <Text style={s.legendText}>more {metric}</Text>
        </View>
        {!narrow ? (
          <Text style={s.hintText} pointerEvents="none">
            Drag to spin · click a country to filter sessions
          </Text>
        ) : null}
        {hover ? (
          <View
            pointerEvents="none"
            style={[s.tip, { left: hover.x + 14, top: hover.y + 14 } as object]}
          >
            <Text style={s.tipTitle}>{countryName(hover.code)}</Text>
            <Text style={s.tipBody}>
              {hoverValue > 0
                ? `${hoverValue.toLocaleString()} ${metric} · ${share(hoverValue)}%`
                : `No ${metric} in ${rangeDays}d`}
            </Text>
            {hoverValue > 0 ? (
              <Text style={s.tipAction}>
                {hover.code === selected ? 'Click to clear filter' : 'Click to filter sessions'}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Readout */}
      <View style={[s.side, narrow && s.sideNarrow]}>
        {top ? (
          <View style={s.headline}>
            <Text style={s.bigNum}>{share(top.value)}%</Text>
            <Text style={s.bigLabel}>
              of {metric} from {countryName(top.code)}
              {ranked.length > 1 ? ` · ${ranked.length} countries in all` : ''}
            </Text>
          </View>
        ) : (
          <Text style={s.empty}>
            No located {metric} in the last {rangeDays} days yet.
          </Text>
        )}

        <View style={s.list}>
          {ranked.slice(0, narrow ? LIST_MAX_NARROW : LIST_MAX).map((r, i) => {
            const on = r.code === selected;
            return (
              <Pressable
                key={r.code}
                onPress={() => pick(r.code)}
                style={({ hovered }: { hovered?: boolean }) =>
                  [s.row, (hovered || on) && s.rowOn] as object
                }
              >
                <Text style={s.rank}>{i + 1}</Text>
                <CodeBadge code={r.code} />
                <View style={s.rowMain}>
                  <View style={s.rowTop}>
                    <Text style={[s.rowName, on && s.rowNameOn]} numberOfLines={1}>
                      {countryName(r.code)}
                    </Text>
                    <Text style={s.rowVal}>{r.value.toLocaleString()}</Text>
                  </View>
                  <View style={s.bar}>
                    <View
                      style={[
                        s.barFill,
                        { width: `${Math.max(2, (r.value / (top?.value || 1)) * 100)}%` },
                      ]}
                    />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={s.liveBox}>
          <View style={s.liveHead}>
            <View style={[s.liveDot, live.length === 0 && s.liveDotIdle]} />
            <Text style={s.liveTitle}>
              {live.length > 0 ? `${live.length} reading now` : 'Nobody on right now'}
            </Text>
          </View>
          {live.slice(0, LIVE_MAX).map((sess) => {
            const last = sess.trail[sess.trail.length - 1];
            const where = [sess.city, sess.country ? countryName(sess.country) : null]
              .filter(Boolean)
              .join(', ');
            return (
              <View key={sess.sessionId} style={s.liveRow}>
                <CodeBadge code={sess.country} />
                <View style={s.rowMain}>
                  <Text style={s.liveWhere} numberOfLines={1}>
                    {where || 'Somewhere'}
                    {sess.signedIn && sess.displayName ? ` · ${sess.displayName}` : ''}
                  </Text>
                  <Text style={s.livePage} numberOfLines={1}>
                    {last?.name ?? last?.path ?? sess.landing ?? '—'} · {ago(sess.lastAt)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {botSessions > 0 ? (
          <View style={s.botNote}>
            <Ionicons name="shield-checkmark-outline" size={12} color={COLORS.grey} />
            <Text style={s.botText}>
              {botSessions.toLocaleString()} bot sessions filtered out of every figure here
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const INK_TEXT = COLORS.beige;
const INK_MUTED = 'rgba(245,235,220,0.55)';

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: DENSITY.radius,
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
    backgroundImage: 'radial-gradient(90% 120% at 30% 50%, #18303a 0%, #0f1f27 45%, #0b1820 100%)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.22)',
    boxShadow: CC.cardShadow,
    minHeight: 460,
  } as object,
  cardNarrow: { flexDirection: 'column', minHeight: 0 },
  stage: { flex: 1.7, position: 'relative', minHeight: 460 },
  stageNarrow: { flex: 0, height: 420, minHeight: 420 },
  host: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fallbackText: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: INK_MUTED },
  stageHead: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  eyebrow: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10,
    letterSpacing: 1.6,
    color: COLORS.goldAccent,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 18, color: INK_TEXT, marginTop: 2 },
  legend: {
    position: 'absolute',
    left: 16,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendRamp: {
    width: 90,
    height: 6,
    borderRadius: 3,
    backgroundImage: 'linear-gradient(90deg, #7a3317, #E77333 45%, #F9B222 85%, #ffdb8c)',
  } as object,
  legendText: { fontFamily: 'Nunito_700Bold', fontSize: 10.5, color: INK_MUTED },
  hintText: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    fontFamily: 'Nunito_400Regular',
    fontSize: 10.5,
    color: INK_MUTED,
  },
  tip: {
    position: 'absolute',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(11,24,32,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.4)',
    boxShadow: '0 10px 24px -10px rgba(0,0,0,0.7)',
    gap: 1,
  } as object,
  tipTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: INK_TEXT },
  tipBody: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.skin },
  tipAction: { fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: INK_MUTED, marginTop: 2 },
  side: {
    flex: 1,
    minWidth: 280,
    maxWidth: 380,
    padding: 16,
    gap: 14,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(245,235,220,0.07)',
    backgroundColor: 'rgba(11,24,32,0.35)',
  },
  sideNarrow: {
    maxWidth: undefined,
    minWidth: 0,
    borderLeftWidth: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,235,220,0.07)',
    padding: DENSITY.panelPadNarrow,
  },
  headline: { gap: 2 },
  bigNum: { fontFamily: 'Flame-Regular', fontSize: 34, lineHeight: 38, color: COLORS.yellow },
  bigLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: INK_MUTED },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: INK_MUTED },
  list: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 8,
    cursor: 'pointer',
  } as object,
  rowOn: { backgroundColor: 'rgba(231,115,51,0.12)' },
  rank: {
    width: 14,
    textAlign: 'right',
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    color: INK_MUTED,
  },
  badge: {
    width: 24,
    height: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.1)',
  },
  badgeText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 9,
    letterSpacing: 0.6,
    color: INK_TEXT,
  },
  rowMain: { flex: 1, minWidth: 0, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: INK_TEXT },
  rowNameOn: { color: COLORS.orange },
  rowVal: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.skin },
  bar: { height: 3, borderRadius: 2, backgroundColor: 'rgba(245,235,220,0.08)' },
  barFill: {
    height: 3,
    borderRadius: 2,
    backgroundImage: 'linear-gradient(90deg, #E77333, #F9B222)',
  } as object,
  liveBox: {
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245,235,220,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.06)',
  },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.green,
    boxShadow: '0 0 0 3px rgba(99,169,54,0.22)',
  } as object,
  liveDotIdle: { backgroundColor: COLORS.grey, boxShadow: 'none' } as object,
  liveTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: INK_TEXT },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveWhere: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: INK_TEXT },
  livePage: { fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: INK_MUTED },
  botNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 'auto' } as object,
  botText: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: INK_MUTED },
});
