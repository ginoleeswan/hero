// The enrichment funnel — one row per stage, all bars on a shared denominator so
// the drop-off between stages is visible, each with an optional "Run all" drain.
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../../constants/colors';
import { InfoTip } from '../InfoTip';
import { Button } from '../ui';
import { pctOf, type Stage } from './pipelineHelpers';

function FunnelStage({
  s,
  n,
  busy,
  bottleneck,
}: {
  s: Stage;
  n: number;
  busy: string | null;
  bottleneck: boolean;
}) {
  const pct = pctOf(s.reached, s.total);
  const running = !!s.run && busy === s.run.busyKey;
  return (
    <View style={styles.row}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{n}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={styles.name} numberOfLines={1}>
            {s.name}
          </Text>
          <InfoTip text={s.tip} size={13} />
          {bottleneck ? <Text style={styles.bottleneck}>bottleneck</Text> : null}
          <Text style={styles.count}>
            {s.reached.toLocaleString()}
            <Text style={styles.countDim}> / {s.total.toLocaleString()}</Text>
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }, bottleneck && styles.fillWarn]} />
        </View>
        <View style={styles.foot}>
          {s.auto ? (
            <Text style={styles.meta}>auto · runs on a schedule</Text>
          ) : (
            <Text style={styles.meta}>
              {s.pending > 0 ? `${s.pending.toLocaleString()} pending` : 'clear'}
              {s.stuck ? (
                <Text
                  style={[styles.stuck, { color: s.stuck.tone }]}
                >{`  ·  ${s.stuck.label}`}</Text>
              ) : null}
            </Text>
          )}
          {s.run ? (
            <Button
              label="Run all"
              icon="play"
              tone="ghost"
              size="sm"
              loading={running}
              disabled={!!busy || s.pending === 0}
              onPress={s.run.onPress}
              accessibilityLabel={`Run ${s.name} over the backlog`}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function PipelineFunnel({
  stages,
  busy,
  bottleneckKey,
}: {
  stages: Stage[];
  busy: string | null;
  bottleneckKey?: string;
}) {
  return (
    <View style={styles.funnel}>
      {stages.map((s, i) => (
        <FunnelStage key={s.key} s={s} n={i + 1} busy={busy} bottleneck={s.key === bottleneckKey} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  funnel: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: 1,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff' },
  body: { flex: 1, minWidth: 0, gap: 5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black, flexShrink: 1 },
  bottleneck: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    color: COLORS.red,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    backgroundColor: COLORS.red + '15',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  count: {
    marginLeft: 'auto',
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.navy,
    fontVariant: ['tabular-nums'],
  },
  countDim: { fontFamily: 'Nunito_400Regular', color: COLORS.grey },
  track: { height: 7, borderRadius: 4, backgroundColor: '#efe6d6', overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4, backgroundColor: COLORS.orange },
  fillWarn: { backgroundColor: COLORS.red },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
  meta: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  stuck: { fontFamily: 'Nunito_700Bold', fontSize: 11.5 },
});
