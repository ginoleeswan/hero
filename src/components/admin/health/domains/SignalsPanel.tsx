// Signals — the events pipeline's state, in the Build domain.
//
// Not a seventh lane: the command center's IA is deliberately six, and this is a
// pipeline like every other thing under Build. It is a READ first and a control
// second, because the control it offers is a veto and a veto you cannot see is
// not a control at all.
//
// The two questions it exists to answer, both of which were previously
// unanswerable without opening a SQL client:
//
//   "Is anything about to publish itself that shouldn't?"  → the events list,
//     live first, then loudest. Reject is one press.
//   "Has a feed gone quiet?"                               → the channels list,
//     stalest first. A dormant channel and a broken one look identical from the
//     outside; the only way to tell is to look at when it last spoke.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../../ui/Text';
import { COLORS } from '../../../../constants/colors';
import { Button, EmptyState } from '../ui';
import { InfoTip } from '../InfoTip';
import { relTime } from '../format';
import {
  getEventsHealth,
  setEventApproval,
  type WatchedEventHealth,
  type ChannelHealth,
} from '../../../../lib/db/eventsHealth';

/** Past this, a sync that claims to run every 30 minutes has stopped. */
const SYNC_STALE_MS = 3 * 60 * 60 * 1000;
/** Past this a channel is worth a look — not an error, studios go quiet. */
const CHANNEL_QUIET_MS = 14 * 24 * 60 * 60 * 1000;

const ageMs = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Date.now() - t;
};

function EventRow({
  e,
  busy,
  onReject,
  onAllow,
}: {
  e: WatchedEventHealth;
  busy: string | null;
  onReject: (slug: string) => void;
  onAllow: (slug: string) => void;
}) {
  const stale = ageMs(e.checkedAt);
  const isStale = stale !== null && stale > SYNC_STALE_MS;
  const rejected = e.approval === 'rejected';
  const dot = rejected
    ? COLORS.grey
    : e.isLive
      ? COLORS.green
      : e.verdict === 'live' || e.verdict === 'watch'
        ? COLORS.orange
        : COLORS.grey;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {e.headline}
            </Text>
            {e.isLive ? <Text style={styles.liveTag}>ON THE RAIL</Text> : null}
            {rejected ? <Text style={styles.mutedTag}>VETOED</Text> : null}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {[
              e.verdict,
              e.spikeRatio !== null ? `${e.spikeRatio}×` : null,
              e.editsRecent ? `${e.editsRecent} edits` : null,
              e.editions ? `${e.editions} archived` : null,
              // The freshness of the BELIEF, not of the event. A verdict cannot
              // tell you the sync died.
              e.checkedAt ? `checked ${relTime(e.checkedAt)}` : 'never checked',
            ]
              .filter(Boolean)
              .join('  ·  ')}
          </Text>
          {isStale ? (
            <Text style={styles.warn}>Detector hasn’t run in over three hours.</Text>
          ) : null}
        </View>
        {rejected ? (
          <Button
            label="Allow"
            tone="ghost"
            size="sm"
            loading={busy === e.slug}
            disabled={!!busy}
            onPress={() => onAllow(e.slug)}
          />
        ) : (
          <Button
            label="Veto"
            tone="ghost"
            size="sm"
            loading={busy === e.slug}
            disabled={!!busy}
            onPress={() => onReject(e.slug)}
          />
        )}
      </View>
    </View>
  );
}

function ChannelRow({ c }: { c: ChannelHealth }) {
  const quiet = ageMs(c.lastVideoAt);
  const isQuiet = quiet === null || quiet > CHANNEL_QUIET_MS;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: isQuiet ? COLORS.orange : COLORS.green }]} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {c.name}
          </Text>
          {!c.official ? <Text style={styles.mutedTag}>PRESS</Text> : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {[
            c.lastVideoAt ? `newest ${relTime(c.lastVideoAt)}` : 'no uploads seen',
            `${c.matched}/${c.videos} matched`,
          ].join('  ·  ')}
        </Text>
      </View>
    </View>
  );
}

export function SignalsPanel() {
  const [busy, setBusy] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  // React Query rather than useEffect + setState: it is this repo's standard
  // data layer, and the effect form trips react-hooks/set-state-in-effect, which
  // the lint ratchet has no budget left for.
  const { data, error, refetch } = useQuery({
    queryKey: ['admin-events-health'],
    queryFn: getEventsHealth,
    // Detector state moves every 30 minutes; the panel is read while deciding
    // whether to veto something, so it should not serve a stale answer.
    staleTime: 60_000,
  });

  const setApproval = async (slug: string, approval: string) => {
    setBusy(slug);
    try {
      await setEventApproval(slug, approval);
      await refetch();
      setActionErr(null);
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : 'Could not update.');
    } finally {
      setBusy(null);
    }
  };

  const err = actionErr ?? (error instanceof Error ? error.message : null);
  if (err) return <EmptyState text={err} />;
  if (!data) return <EmptyState text="Loading signals…" />;

  const quietChannels = data.channels.filter((c) => {
    const q = ageMs(c.lastVideoAt);
    return q === null || q > CHANNEL_QUIET_MS;
  }).length;

  return (
    <View style={styles.stack}>
      <View style={styles.head}>
        <Text style={styles.title}>Watched events</Text>
        <InfoTip
          text="Detected from Wikipedia readership, not a calendar. A live verdict publishes itself — approval is a veto, not a prerequisite — so this list is where you see what is about to appear."
          size={13}
        />
      </View>
      {data.events.length === 0 ? (
        <EmptyState text="No watched events." />
      ) : (
        data.events.map((e) => (
          <EventRow
            key={e.slug}
            e={e}
            busy={busy}
            onReject={(s) => setApproval(s, 'rejected')}
            onAllow={(s) => setApproval(s, 'approved')}
          />
        ))
      )}

      <View style={styles.head}>
        <Text style={styles.title}>Channels</Text>
        <Text style={styles.count}>
          {quietChannels > 0 ? `${quietChannels} quiet` : 'all active'}
        </Text>
        <InfoTip
          text="Official studio feeds, read hourly over YouTube RSS. Quiet is not the same as broken — but a feed that has said nothing for a fortnight is worth a look."
          size={13}
        />
      </View>
      {data.channels.map((c) => (
        <ChannelRow key={c.id} c={c} />
      ))}

      <View style={styles.head}>
        <Text style={styles.title}>Archived editions</Text>
        <InfoTip
          text="Frozen while an event is live, because watched_events is overwritten every 30 minutes. If this list stops growing during a detected event, the freeze has stopped working — and that data cannot be recovered later."
          size={13}
        />
      </View>
      {data.editions.length === 0 ? (
        <EmptyState text="Nothing archived yet." />
      ) : (
        data.editions.map((e) => (
          <View key={`${e.slug}-${e.editionSlug}`} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: COLORS.green }]} />
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {e.headline} {e.editionSlug}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[
                  e.spikeRatio !== null ? `${e.spikeRatio}×` : null,
                  `${e.movers} moved`,
                  e.frozenAt ? `frozen ${relTime(e.frozenAt)}` : null,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 4 },
  title: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
    color: COLORS.grey,
    textTransform: 'uppercase',
  },
  count: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  wrap: { borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.06)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 8 },
  info: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black, flexShrink: 1 },
  meta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  warn: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.orange },
  liveTag: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
    color: COLORS.green,
  },
  mutedTag: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
    color: COLORS.grey,
  },
});
