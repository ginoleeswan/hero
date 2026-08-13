// Always-on ops vitals strip — the live signals you must see on every tab:
// pending backlog + ETA, ComicVine health/usage, the active run (+ stop),
// auto-drain state, and month-to-date spend. Compact, data-dense, wraps on
// narrow. The masthead owns the static catalogue snapshot; this owns the
// dynamic operational state.
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { CV_HOURLY_CAP, relTime } from './format';
import type {
  EnrichmentRun,
  CronJob,
  GeminiSpend,
  ComicvineStatus,
} from '../../../lib/db/catalogHealth';

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
  buildActive?: boolean;
  onStopBuild?: () => void;
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
  buildActive,
  onStopBuild,
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

  const lbl = [s.label, narrow && s.labelNarrow];
  const val = [s.value, narrow && s.valueNarrow];

  return (
    <View style={[s.bar, narrow && s.barNarrow]}>
      {/* Backlog */}
      <View style={[s.cell, narrow && s.cellNarrow]}>
        <Text style={lbl} numberOfLines={1}>
          BACKLOG
        </Text>
        <Text style={val} numberOfLines={1}>
          {pending.toLocaleString()}
        </Text>
        {!narrow && <Text style={s.sub}>{etaLabel ?? 'to enrich'}</Text>}
      </View>
      {!narrow && <Divider />}

      {/* ComicVine health + usage. On mobile: drop the track/caption, show the
          dot + usage as the value so it fits the single-row layout. */}
      <View style={[s.cell, !narrow && s.cellWide, narrow && s.cellNarrow]}>
        {narrow ? (
          <>
            <Text style={lbl} numberOfLines={1}>
              COMICVINE
            </Text>
            <View style={s.row}>
              <View style={[s.dot, { backgroundColor: cvDot }]} />
              <Text style={[...val, { color: cvColor }]} numberOfLines={1}>
                {cvUsage}/{CV_HOURLY_CAP}
              </Text>
            </View>
          </>
        ) : (
          <>
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
          </>
        )}
      </View>
      {!narrow && <Divider />}

      {/* Active run */}
      <View style={[s.cell, narrow && s.cellNarrow]}>
        <Text style={lbl} numberOfLines={1}>
          RUN
        </Text>
        {activeRun ? (
          <>
            <View style={s.row}>
              <View style={[s.dot, { backgroundColor: COLORS.orange }]} />
              <Text style={[...val, { color: COLORS.orange }]} numberOfLines={1}>
                {runProgress}/{activeRun.processed}
              </Text>
            </View>
            <Pressable
              onPress={() => onStop(activeRun.id)}
              disabled={stopping || activeRun.cancel_requested}
              style={[s.stopBtn, narrow && s.stopBtnNarrow]}
            >
              {stopping ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="stop" size={11} color="#fff" />
              )}
              <Text style={s.stopText}>{activeRun.cancel_requested ? 'Stopping…' : 'Stop'}</Text>
            </Pressable>
          </>
        ) : buildActive ? (
          <>
            <View style={s.row}>
              <View style={[s.dot, { backgroundColor: COLORS.orange }]} />
              <Text style={[...val, { color: COLORS.orange }]} numberOfLines={1}>
                build
              </Text>
            </View>
            <Pressable onPress={onStopBuild} style={[s.stopBtn, narrow && s.stopBtnNarrow]}>
              <Ionicons name="stop" size={11} color="#fff" />
              <Text style={s.stopText}>Stop</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[...val, { color: COLORS.grey }]} numberOfLines={1}>
              idle
            </Text>
            {!narrow && <Text style={s.sub}>no run</Text>}
          </>
        )}
      </View>
      {!narrow && <Divider />}

      {/* Auto-drain */}
      <View style={[s.cell, narrow && s.cellNarrow]}>
        <Text style={lbl} numberOfLines={1}>
          {narrow ? 'DRAIN' : 'AUTO-DRAIN'}
        </Text>
        <Text style={[...val, { color: cronOn ? COLORS.green : COLORS.grey }]} numberOfLines={1}>
          {cronOn ? 'ON' : 'OFF'}
        </Text>
        {!narrow && (
          <Text style={s.sub}>
            {drainJob?.last_run ? `ran ${relTime(drainJob.last_run)}` : 'manual'}
          </Text>
        )}
      </View>
      {!narrow && <Divider />}

      {/* Spend */}
      <View style={[s.cell, narrow && s.cellNarrow]}>
        <Text style={lbl} numberOfLines={1}>
          {narrow ? 'SPEND' : 'SPEND · MTD'}
        </Text>
        <Text style={[...val, { color: '#fff' }]} numberOfLines={1}>
          {spend?.available ? `$${(spend.monthToDate ?? 0).toFixed(0)}` : '—'}
        </Text>
        {!narrow && <Text style={s.sub}>{spend?.available ? 'this month' : 'no data'}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 14,
  },
  // Mobile: KPI cells wrap (3-then-2) once they'd be crammed below ~90px, so the
  // dense strip never squeezes the numbers past legibility on the narrowest phones.
  barNarrow: {
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 10,
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  cell: { gap: 2, minWidth: 80, justifyContent: 'center' },
  cellWide: { flex: 1, minWidth: 150 },
  cellNarrow: { flex: 1, minWidth: 90, gap: 1 },
  // 10px is the legibility floor for tracked uppercase labels (see EYEBROW note in colors.ts).
  labelNarrow: { fontSize: 10, letterSpacing: 0.4 },
  // lineHeight ≥ 1.22× fontSize so clamped Flame values keep their descenders.
  valueNarrow: { fontSize: 15, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    // 0.6α is the documented text-on-ink contrast floor (colors.ts INK_TEXT).
    color: 'rgba(255,255,255,0.6)',
  },
  value: { fontFamily: 'Flame-Regular', fontSize: 21, color: '#fff', lineHeight: 26 },
  usage: { fontFamily: 'Flame-Regular', fontSize: 14, marginLeft: 'auto' },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  dot: { width: 8, height: 8, borderRadius: 8 },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginVertical: 2,
  },
  fill: { height: 5, borderRadius: 3 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.1)' },
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
  // Mobile: 44pt touch floor for a destructive action (kill a live run).
  stopBtnNarrow: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' },
  stopText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff' },
});
