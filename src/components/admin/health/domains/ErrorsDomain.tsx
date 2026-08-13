// Errors domain — self-hosted client error feed (client_errors) for the command
// center. Read-only view of the admin_recent_client_errors() RPC: headline
// totals + kind split, then the top recurring signatures (collapsed on message)
// with the latest raw rows for drill-down. Mirrors the Traffic domain.
import { View, StyleSheet } from 'react-native';
import { Text } from '../../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { StatTile, EmptyState } from '../ui';
import { ErrorsSkeleton } from '../skeletons';
import type {
  ClientErrorOverview,
  ClientErrorSignature,
  ClientErrorRow,
} from '../../../../lib/db/clientErrors';

const KIND_LABEL: Record<string, string> = {
  boundary: 'Render crash',
  error: 'Uncaught',
  unhandledrejection: 'Promise',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function SignatureRow({ sig }: { sig: ClientErrorSignature }) {
  return (
    <View style={s.sigRow}>
      <View style={s.sigHead}>
        <View style={s.kindTag}>
          <Text style={s.kindTagText}>{KIND_LABEL[sig.kind] ?? sig.kind}</Text>
        </View>
        <Text style={s.sigCount}>{sig.count.toLocaleString()}×</Text>
        <Text style={s.sigWhen}>{relativeTime(sig.last_seen)}</Text>
      </View>
      <Text style={s.sigMsg} numberOfLines={2}>
        {sig.message}
      </Text>
      {sig.source ? (
        <Text style={s.sigSource} numberOfLines={1}>
          {sig.source}
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorsDomain({
  data,
  loading,
  narrow,
}: {
  data: ClientErrorOverview | null;
  loading: boolean;
  narrow: boolean;
}) {
  if (loading && !data) {
    return <ErrorsSkeleton narrow={narrow} />;
  }
  if (!data) {
    return (
      <Panel title="Errors">
        <View style={s.locked}>
          <Ionicons name="lock-closed-outline" size={26} color={COLORS.grey} />
          <Text style={s.lockedText}>
            The error feed is admin-only, or no client errors have been recorded yet.
          </Text>
        </View>
      </Panel>
    );
  }

  const k = data.byKind;
  return (
    <Bento>
      <Bento.Row narrow={narrow}>
        <Panel title="Errors" hint={`Last ${data.rangeDays} days`} style={s.flex1}>
          <View style={s.tiles}>
            <StatTile label="Total" value={data.total.toLocaleString()} tint={COLORS.navy} />
            <StatTile
              label="Render crashes"
              value={(k.boundary ?? 0).toLocaleString()}
              tint={COLORS.orange}
            />
            <StatTile label="Uncaught" value={(k.error ?? 0).toLocaleString()} tint={COLORS.blue} />
            <StatTile
              label="Promise"
              value={(k.unhandledrejection ?? 0).toLocaleString()}
              tint={COLORS.green}
            />
          </View>
        </Panel>
      </Bento.Row>

      <Panel title="Top signatures" hint="Recurring errors, grouped by message">
        {data.top.length === 0 ? (
          <EmptyState text="No errors recorded yet — this is the good kind of empty." />
        ) : (
          <View style={s.sigList}>
            {data.top.map((sig, i) => (
              <SignatureRow key={i} sig={sig} />
            ))}
          </View>
        )}
      </Panel>

      <Panel title="Recent" hint="Latest individual errors">
        {data.recent.length === 0 ? (
          <EmptyState text="Nothing recent." />
        ) : (
          <View style={s.recentList}>
            {data.recent.map((r: ClientErrorRow) => (
              <View key={r.id} style={s.recentRow}>
                <Text style={s.recentWhen}>{relativeTime(r.created_at)}</Text>
                <Text style={s.recentMsg} numberOfLines={1}>
                  {r.message}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Panel>
    </Bento>
  );
}

const s = StyleSheet.create({
  flex1: { flex: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Signature cards
  sigList: { gap: 10 },
  sigRow: { gap: 4, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#efe6d6' },
  sigHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kindTag: {
    backgroundColor: '#f3ead9',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  kindTagText: { fontFamily: 'Nunito_700Bold', fontSize: 10.5, color: COLORS.navy },
  sigCount: { fontFamily: 'Flame-Regular', fontSize: 13, color: COLORS.orange },
  sigWhen: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11.5,
    color: COLORS.grey,
    marginLeft: 'auto',
  },
  sigMsg: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black, lineHeight: 18 },
  sigSource: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  // Recent compact rows
  recentList: { gap: 6 },
  recentRow: { flexDirection: 'row', gap: 10, alignItems: 'baseline' },
  recentWhen: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey, width: 64 },
  recentMsg: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: COLORS.black },
  locked: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  lockedText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textAlign: 'center',
    maxWidth: 360,
  },
});
