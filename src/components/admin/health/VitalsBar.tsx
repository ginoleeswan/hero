// Always-on ops vitals strip — the live signals you must see on every tab:
// pending backlog + ETA, ComicVine health/usage, the active run (+ stop),
// auto-drain state, and month-to-date spend. Compact, data-dense, wraps on
// narrow. The masthead owns the static catalogue snapshot; this owns the
// dynamic operational state.
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { CV_HOURLY_CAP, relTime } from './format';
import type { EnrichmentRun, CronJob, GeminiSpend, ComicvineStatus } from '../../../lib/db/catalogHealth';

interface Props {
  narrow: boolean;
  pending: number;
  etaLabel: string | null;
  cvPing?: ComicvineStatus;
  cvUsage: number;
  cvColor: string;
  cvPctUsed: number;
  activeRun?: EnrichmentRun;
  stopping: boolean;
  onStop: (id: number) => void;
  cronOn: boolean;
  drainJob?: CronJob;
  spend?: GeminiSpend;
}

const Divider = () => <View style={s.divider} />;

export function VitalsBar({
  narrow,
  pending,
  etaLabel,
  cvPing,
  cvUsage,
  cvColor,
  cvPctUsed,
  activeRun,
  stopping,
  onStop,
  cronOn,
  drainJob,
  spend,
}: Props) {
  const cvLabel =
    cvPing === 'ok'
      ? 'healthy'
      : cvPing === 'limited'
        ? 'rate-limited'
        : cvPing === 'error'
          ? 'error'
          : 'checking…';
  const cvDot = cvPing === 'ok' ? COLORS.green : cvPing === 'limited' ? COLORS.red : COLORS.grey;
  const runProgress = activeRun ? activeRun.done + activeRun.failed + activeRun.retry : 0;

  return (
    <View style={[s.bar, narrow && s.barNarrow]}>
      {/* Backlog */}
      <View style={s.cell}>
        <Text style={s.label}>BACKLOG</Text>
        <Text style={s.value}>{pending.toLocaleString()}</Text>
        <Text style={s.sub}>{etaLabel ?? 'pending'}</Text>
      </View>
      <Divider />

      {/* ComicVine health + usage */}
      <View style={[s.cell, s.cellWide]}>
        <View style={s.row}>
          <View style={[s.dot, { backgroundColor: cvDot }]} />
          <Text style={s.label}>COMICVINE</Text>
          <Text style={[s.usage, { color: cvColor }]}>
            {cvUsage}/{CV_HOURLY_CAP}
          </Text>
        </View>
        <View style={s.track}>
          <View style={[s.fill, { width: `${cvPctUsed}%`, backgroundColor: cvColor }]} />
        </View>
        <Text style={s.sub}>{cvLabel}</Text>
      </View>
      <Divider />

      {/* Active run */}
      <View style={s.cell}>
        <Text style={s.label}>RUN</Text>
        {activeRun ? (
          <>
            <View style={s.row}>
              <View style={[s.dot, { backgroundColor: COLORS.orange }]} />
              <Text style={[s.value, { color: COLORS.orange }]}>
                {runProgress}/{activeRun.processed}
              </Text>
            </View>
            <Pressable
              onPress={() => onStop(activeRun.id)}
              disabled={stopping || activeRun.cancel_requested}
              style={s.stopBtn}
            >
              {stopping ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="stop" size={11} color="#fff" />
              )}
              <Text style={s.stopText}>{activeRun.cancel_requested ? 'Stopping…' : 'Stop'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[s.value, { color: COLORS.grey }]}>idle</Text>
            <Text style={s.sub}>no run</Text>
          </>
        )}
      </View>
      <Divider />

      {/* Auto-drain */}
      <View style={s.cell}>
        <Text style={s.label}>AUTO-DRAIN</Text>
        <Text style={[s.value, { color: cronOn ? COLORS.green : COLORS.grey }]}>
          {cronOn ? 'ON' : 'OFF'}
        </Text>
        <Text style={s.sub}>{drainJob?.last_run ? `ran ${relTime(drainJob.last_run)}` : 'manual'}</Text>
      </View>
      <Divider />

      {/* Spend */}
      <View style={s.cell}>
        <Text style={s.label}>SPEND · MTD</Text>
        <Text style={[s.value, { color: COLORS.navy }]}>
          {spend?.available ? `$${(spend.monthToDate ?? 0).toFixed(0)}` : '—'}
        </Text>
        <Text style={s.sub}>{spend?.available ? 'this month' : 'no data'}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#fffdf8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 16,
    shadowColor: '#3a2a14',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  barNarrow: { flexWrap: 'wrap', gap: 14, rowGap: 14 },
  cell: { gap: 2, minWidth: 84, justifyContent: 'center' },
  cellWide: { flex: 1, minWidth: 150 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    color: COLORS.grey,
  },
  value: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.black, lineHeight: 24 },
  usage: { fontFamily: 'Flame-Regular', fontSize: 14, marginLeft: 'auto' },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  dot: { width: 8, height: 8, borderRadius: 8 },
  track: { height: 5, borderRadius: 3, backgroundColor: '#efe6d6', overflow: 'hidden', marginVertical: 2 },
  fill: { height: 5, borderRadius: 3 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: '#efe6d6' },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.red,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  stopText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff' },
});
