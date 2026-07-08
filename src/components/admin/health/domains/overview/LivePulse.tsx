// The command center's heartbeat — a live status band across the top of the
// Overview. Shows who's on the app right now (pulsing), today's audience with a
// day-over-day delta, and a synthesized system-status line. This is the single
// element that makes Overview read as a live bridge, not a static report.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../../constants/colors';
import { CC } from '../../format';

// Inject the pulse keyframes once (RNW's animationKeyframes doesn't compile
// reliably here — the house pattern is a real <style> tag, see web/PulseTicker).
const PULSE_ID = 'cc-live-pulse-kf';
function ensurePulseKeyframes() {
  if (typeof document === 'undefined' || document.getElementById(PULSE_ID)) return;
  const el = document.createElement('style');
  el.id = PULSE_ID;
  el.textContent =
    '@keyframes ccLivePulse { 0% { transform: scale(1); opacity: 0.55; } 70% { transform: scale(2.6); opacity: 0; } 100% { opacity: 0; } }';
  document.head.appendChild(el);
}

export function LivePulse({
  activeNow,
  onlineMembers,
  todayVisitors,
  todayViews,
  yesterdayViews,
  attention,
  onSnapshot,
  snapshotting,
  narrow,
}: {
  activeNow: number;
  onlineMembers: number;
  todayVisitors: number;
  todayViews: number;
  yesterdayViews: number;
  /** Count of things needing a human (inbox + failed + review). 0 = nominal. */
  attention: number;
  onSnapshot: () => void;
  snapshotting: boolean;
  narrow: boolean;
}) {
  ensurePulseKeyframes();
  const delta =
    yesterdayViews > 0 ? Math.round(((todayViews - yesterdayViews) / yesterdayViews) * 100) : null;
  const up = (delta ?? 0) >= 0;
  const nominal = attention === 0;

  return (
    <View style={[styles.band, narrow && styles.bandNarrow]}>
      {/* Left: the live presence readout. */}
      <View style={styles.live}>
        <View style={styles.dotWrap}>
          <View style={[styles.dot, activeNow === 0 && styles.dotIdle]} />
          {activeNow > 0 ? <View style={styles.pulse} /> : null}
        </View>
        <Text style={styles.liveNum}>{activeNow}</Text>
        <Text style={styles.liveLabel}>
          on the app now
          {onlineMembers > 0 ? ` · ${onlineMembers} member${onlineMembers === 1 ? '' : 's'}` : ''}
        </Text>
      </View>

      {/* Middle: today's audience + delta. */}
      <View style={styles.todayCol}>
        <View style={styles.todayRow}>
          <Text style={styles.todayNum}>{todayVisitors.toLocaleString()}</Text>
          <Text style={styles.todayLabel}>visitors today</Text>
          {delta != null ? (
            <View style={[styles.delta, up ? styles.deltaUp : styles.deltaDown]}>
              <Ionicons
                name={up ? 'trending-up' : 'trending-down'}
                size={11}
                color={up ? COLORS.green : COLORS.red}
              />
              <Text style={[styles.deltaText, { color: up ? COLORS.green : COLORS.red }]}>
                {Math.abs(delta)}%
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Right: system status + snapshot. */}
      <View style={styles.statusCol}>
        <View style={[styles.statusChip, nominal ? styles.statusOk : styles.statusWarn]}>
          <Ionicons
            name={nominal ? 'shield-checkmark' : 'alert-circle'}
            size={13}
            color={nominal ? COLORS.green : COLORS.orange}
          />
          <Text style={[styles.statusText, { color: nominal ? COLORS.green : COLORS.orange }]}>
            {nominal ? 'Systems nominal' : `${attention} need${attention === 1 ? 's' : ''} you`}
          </Text>
        </View>
        {!narrow ? (
          <Pressable onPress={onSnapshot} disabled={snapshotting} style={styles.snap} hitSlop={6}>
            <Ionicons
              name={snapshotting ? 'hourglass-outline' : 'camera-outline'}
              size={13}
              color="rgba(255,255,255,0.75)"
            />
            <Text style={styles.snapText}>Snapshot</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The band sits on the ink stage (not a paper card) — it's chrome, the pulse
  // of the room. A warm hairline top edge ties it to the seam language.
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.16)',
    boxShadow: CC.wellShadow,
  } as object,
  bandNarrow: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },

  live: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 999, backgroundColor: COLORS.green, zIndex: 1 },
  dotIdle: { backgroundColor: 'rgba(255,255,255,0.35)' },
  // Expanding ring — the heartbeat (keyframes injected above).
  pulse: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: COLORS.green,
    animation: 'ccLivePulse 1.8s ease-out infinite',
  } as object,
  liveNum: { fontFamily: 'Flame-Regular', fontSize: 22, color: '#fff', lineHeight: 24 },
  liveLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.72)' },

  todayCol: { flex: 1 },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  todayNum: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: '#fff',
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  todayLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.3,
  },
  delta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deltaUp: { backgroundColor: 'rgba(63,157,106,0.16)' },
  deltaDown: { backgroundColor: 'rgba(209,80,63,0.16)' },
  deltaText: { fontFamily: 'Nunito_700Bold', fontSize: 11 },

  statusCol: { alignItems: 'flex-end', gap: 6 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusOk: { backgroundColor: 'rgba(63,157,106,0.14)' },
  statusWarn: { backgroundColor: 'rgba(231,115,51,0.16)' },
  statusText: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
  snap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  snapText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.75)' },
});
