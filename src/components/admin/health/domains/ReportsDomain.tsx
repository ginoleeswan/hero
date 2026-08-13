// Command-center domain: the user-report moderation queue. Admins resolve or
// dismiss reports of a page, its AI portrait, or a gallery image. Image/portrait
// reports show the reported art (portrait reports show it beside the current
// portrait). Web-only, like the rest of the command center.
import { useState } from 'react';
import { View, Pressable, StyleSheet, Linking } from 'react-native';
import { Text } from '../../../ui/Text';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Panel } from '../Panel';
import { SkRows } from '../skeletons';
import { COLORS } from '../../../../constants/colors';
import {
  fetchReportsQueue,
  resolveReport,
  setTakeStatus,
  REPORT_REASONS,
  type ReportRow,
  type ReportStatus,
  type ReportTargetType,
  type TakeStatus,
} from '../../../../lib/db/reports';

const TARGET_LABEL: Record<ReportTargetType, string> = {
  page: 'Page',
  image: 'Image',
  ai_portrait: 'AI portrait',
  take: 'Take',
};
const TARGET_COLOR: Record<ReportTargetType, string> = {
  page: COLORS.blue,
  image: COLORS.orange,
  ai_portrait: COLORS.red,
  take: COLORS.purple,
};
const STATUSES: ReportStatus[] = ['open', 'resolved', 'dismissed'];
// Reason code → label across all contexts (for display).
const REASON_LABEL: Record<string, string> = Object.fromEntries(
  [...REPORT_REASONS.page, ...REPORT_REASONS.image, ...REPORT_REASONS.take].map((r) => [
    r.code,
    r.label,
  ]),
);

export function ReportsDomain() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ReportStatus>('open');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['reportsQueue', status],
    queryFn: () => fetchReportsQueue(status),
  });
  const rows = q.data ?? [];

  const decide = async (id: number, decision: 'resolve' | 'dismiss') => {
    setErr(null);
    setBusyId(id);
    const res = await resolveReport(id, decision);
    setBusyId(null);
    if (!res.ok) {
      setErr(res.error ?? 'Action failed');
      return;
    }
    qc.invalidateQueries({ queryKey: ['reportsQueue'] });
  };

  const takedown = async (reportId: number, takeId: string, status: TakeStatus) => {
    setErr(null);
    setBusyId(reportId);
    const res = await setTakeStatus(takeId, status);
    setBusyId(null);
    if (!res.ok) {
      setErr(res.error ?? 'Action failed');
      return;
    }
    qc.invalidateQueries({ queryKey: ['reportsQueue'] });
  };

  return (
    <View style={s.wrap}>
      <Panel title="Reports" hint={q.isLoading ? 'Loading…' : `${rows.length} ${status}`}>
        <View style={s.filters}>
          {STATUSES.map((st) => (
            <Pressable
              key={st}
              onPress={() => setStatus(st)}
              style={[s.chip, status === st && s.chipOn]}
            >
              <Text style={[s.chipText, status === st && s.chipTextOn]}>{st}</Text>
            </Pressable>
          ))}
        </View>
        {!!err && <Text style={s.err}>{err}</Text>}
        {q.isLoading ? (
          <SkRows n={5} thumb={false} />
        ) : rows.length === 0 ? (
          <Text style={s.muted}>No {status} reports.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((r) => (
              <ReportRowView
                key={r.id}
                r={r}
                busy={busyId === r.id}
                onDecide={decide}
                onTakedown={takedown}
              />
            ))}
          </View>
        )}
      </Panel>
    </View>
  );
}

function ReportRowView({
  r,
  busy,
  onDecide,
  onTakedown,
}: {
  r: ReportRow;
  busy: boolean;
  onDecide: (id: number, d: 'resolve' | 'dismiss') => void;
  onTakedown: (reportId: number, takeId: string, status: TakeStatus) => void;
}) {
  const showReported = r.target_type !== 'page' && !!r.image_url;
  const showCompare = r.target_type === 'ai_portrait' && !!r.hero_portrait_url;
  const isTake = r.target_type === 'take' && !!r.take_id;
  const takeLive = r.take_status === 'visible';
  return (
    <View style={s.row}>
      <View style={s.rowHead}>
        <Pressable onPress={() => Linking.openURL(`/character/${r.hero_id}`)}>
          <Text style={s.hero}>{r.hero_name}</Text>
        </Pressable>
        <View style={[s.badge, { backgroundColor: TARGET_COLOR[r.target_type] + '22' }]}>
          <Text style={[s.badgeText, { color: TARGET_COLOR[r.target_type] }]}>
            {TARGET_LABEL[r.target_type]}
          </Text>
        </View>
      </View>
      <Text style={s.reason}>{REASON_LABEL[r.reason] ?? r.reason}</Text>
      {!!r.detail && <Text style={s.detail}>{r.detail}</Text>}
      {isTake && (
        <View style={s.takeQuote}>
          <Text style={s.takeBody} numberOfLines={4}>
            {r.take_body ?? '(take deleted by its author)'}
          </Text>
          {!takeLive && !!r.take_body && <Text style={s.takeState}>take is {r.take_status}</Text>}
        </View>
      )}
      {(showReported || showCompare) && (
        <View style={s.thumbs}>
          {showReported && (
            <View style={s.thumbWrap}>
              <Image source={{ uri: r.image_url! }} style={s.thumb} contentFit="cover" />
              <Text style={s.thumbLabel}>Reported</Text>
            </View>
          )}
          {showCompare && (
            <View style={s.thumbWrap}>
              <Image source={{ uri: r.hero_portrait_url! }} style={s.thumb} contentFit="cover" />
              <Text style={s.thumbLabel}>Current</Text>
            </View>
          )}
        </View>
      )}
      <Text style={s.meta}>
        {r.submitter ?? 'someone'} · {new Date(r.created_at).toLocaleString()}
      </Text>
      {r.status === 'open' ? (
        <View style={s.actions}>
          <Pressable
            disabled={busy}
            onPress={() => onDecide(r.id, 'resolve')}
            style={[s.action, s.resolve]}
          >
            <Text style={s.resolveText}>Resolve</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => onDecide(r.id, 'dismiss')}
            style={[s.action, s.dismiss]}
          >
            <Text style={s.dismissText}>Dismiss</Text>
          </Pressable>
          {isTake && !!r.take_body && (
            <Pressable
              disabled={busy}
              onPress={() => onTakedown(r.id, r.take_id!, takeLive ? 'removed' : 'visible')}
              style={[s.action, takeLive ? s.takedown : s.dismiss]}
            >
              <Text style={takeLive ? s.takedownText : s.dismissText}>
                {takeLive ? 'Remove take' : 'Restore take'}
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Text style={s.resolved}>
          {r.status}
          {r.resolution_note ? ` — ${r.resolution_note}` : ''}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: '#efe6d6' },
  chipOn: { backgroundColor: COLORS.orange },
  chipText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
    textTransform: 'capitalize',
  },
  chipTextOn: { color: '#fff' },
  err: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.red, marginBottom: 8 },
  muted: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey },
  row: { backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 6 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.navy },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  reason: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.navy },
  detail: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(41,60,67,0.8)',
    lineHeight: 20,
  },
  thumbs: { flexDirection: 'row', gap: 10, marginTop: 4 },
  thumbWrap: { alignItems: 'center', gap: 3 },
  thumb: { width: 60, height: 80, borderRadius: 8, backgroundColor: COLORS.navy + '18' },
  thumbLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.grey,
    textTransform: 'uppercase',
  },
  meta: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  action: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  resolve: { backgroundColor: COLORS.green },
  resolveText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
  dismiss: { backgroundColor: '#efe6d6' },
  dismissText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  takedown: { backgroundColor: COLORS.red },
  takedownText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
  takeQuote: {
    backgroundColor: '#f7f1e5',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.purple,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  takeBody: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(41,60,67,0.85)',
    lineHeight: 18,
  },
  takeState: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resolved: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textTransform: 'capitalize',
  },
});
