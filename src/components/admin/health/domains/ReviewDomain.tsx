// Command-center domain: the community-contribution review queue. Admins approve
// or reject pending suggestions (field edits, "Did You Know" facts, reports);
// approval applies the change via the is_admin-gated admin_review_contribution
// RPC. Web-only, like the rest of the command center.
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Panel } from '../Panel';
import { COLORS } from '../../../../constants/colors';
import {
  getReviewQueue,
  reviewContribution,
  fieldTypeOf,
  fieldLabelOf,
  diffListValues,
  type ReviewItem,
  type ContributionKind,
} from '../../../../lib/db/contributions';

const KIND_LABEL: Record<ContributionKind, string> = {
  field: 'Field edit',
  fact: 'New fact',
  report: 'Report',
};

const KIND_COLOR: Record<ContributionKind, string> = {
  field: COLORS.blue,
  fact: COLORS.green,
  report: COLORS.red,
};

export function ReviewDomain() {
  const qc = useQueryClient();
  const queueQ = useQuery({ queryKey: ['reviewQueue'], queryFn: () => getReviewQueue() });
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['reviewQueue'] });

  const decide = async (id: number, decision: 'approve' | 'reject', why?: string) => {
    setErr(null);
    setBusyId(id);
    const res = await reviewContribution(id, decision, why);
    setBusyId(null);
    if (!res.ok) {
      setErr(res.error ?? 'Action failed');
      return;
    }
    setRejectingId(null);
    setReason('');
    refresh();
  };

  const queue = queueQ.data ?? [];

  return (
    <View style={s.wrap}>
      <Panel
        title="Review queue"
        hint={
          queueQ.isLoading
            ? 'Loading…'
            : queue.length === 0
              ? 'Nothing awaiting review'
              : `${queue.length} awaiting review`
        }
      >
        {!!err && <Text style={s.err}>{err}</Text>}
        {queueQ.isLoading ? (
          <Text style={s.muted}>Loading…</Text>
        ) : queue.length === 0 ? (
          <Text style={s.muted}>The queue is clear — no pending contributions.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {queue.map((item) => (
              <ReviewRow
                key={item.id}
                item={item}
                busy={busyId === item.id}
                rejecting={rejectingId === item.id}
                reason={reason}
                onReason={setReason}
                onApprove={() => decide(item.id, 'approve')}
                onStartReject={() => {
                  setRejectingId(item.id);
                  setReason('');
                }}
                onCancelReject={() => setRejectingId(null)}
                onConfirmReject={() => decide(item.id, 'reject', reason.trim() || undefined)}
              />
            ))}
          </View>
        )}
      </Panel>
    </View>
  );
}

// Field edits render differently by shape: lists as added/removed chips, stats
// as old → new, plain text as a strike-through current + proposed. A reviewer
// should be able to judge the change at a glance without parsing array literals.
function FieldDiff({ item }: { item: ReviewItem }) {
  const type = fieldTypeOf(item.target_field);

  if (type === 'list') {
    const { added, removed, next } = diffListValues(item.old_value, item.new_value);
    return (
      <View style={s.diff}>
        <View style={s.chips}>
          {next.map((v) => {
            const isNew = added.some((a) => a.toLowerCase() === v.toLowerCase());
            return (
              <View key={`n-${v}`} style={[s.chip, isNew && (s.chipAdded as object)]}>
                <Text style={[s.chipText, isNew && (s.chipAddedText as object)]}>{v}</Text>
              </View>
            );
          })}
          {removed.map((v) => (
            <View key={`r-${v}`} style={[s.chip, s.chipRemoved as object]}>
              <Text style={[s.chipText, s.chipRemovedText as object]}>{v}</Text>
            </View>
          ))}
        </View>
        {added.length + removed.length > 0 ? (
          <Text style={s.diffMeta}>
            {added.length} added · {removed.length} removed
          </Text>
        ) : (
          <Text style={s.diffMeta}>No net change</Text>
        )}
      </View>
    );
  }

  if (type === 'stat') {
    return (
      <View style={s.statDiff}>
        <Text style={s.statOld}>{item.old_value || '—'}</Text>
        <Text style={s.statArrow}>→</Text>
        <Text style={s.statNew}>{item.new_value}</Text>
      </View>
    );
  }

  // Plain text (and any unknown field): current struck through, proposed below.
  return (
    <View style={s.diff}>
      {!!item.old_value && (
        <Text style={s.old} numberOfLines={4}>
          {item.old_value}
        </Text>
      )}
      <Text style={s.new}>{item.new_value}</Text>
    </View>
  );
}

function ReviewRow({
  item,
  busy,
  rejecting,
  reason,
  onReason,
  onApprove,
  onStartReject,
  onCancelReject,
  onConfirmReject,
}: {
  item: ReviewItem;
  busy: boolean;
  rejecting: boolean;
  reason: string;
  onReason: (v: string) => void;
  onApprove: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onConfirmReject: () => void;
}) {
  return (
    <View style={s.row}>
      <View style={s.rowHead}>
        <View style={[s.kindTag, { backgroundColor: KIND_COLOR[item.kind] + '1c' }]}>
          <Text style={[s.kindTagText, { color: KIND_COLOR[item.kind] }]}>
            {KIND_LABEL[item.kind]}
            {item.kind === 'field' && item.target_field
              ? ` · ${fieldLabelOf(item.target_field)}`
              : ''}
          </Text>
        </View>
        <Text style={s.hero} numberOfLines={1}>
          {item.hero_name}
        </Text>
        <Text style={s.meta} numberOfLines={1}>
          {item.submitter ? `by ${item.submitter}` : 'by a member'} · {item.created_at.slice(0, 10)}
        </Text>
      </View>

      {item.kind === 'field' ? (
        <FieldDiff item={item} />
      ) : item.kind === 'fact' ? (
        <Text style={s.new}>{item.new_value}</Text>
      ) : (
        <Text style={s.report}>{item.note || 'Flagged as incorrect.'}</Text>
      )}

      {item.kind !== 'report' && !!item.note && <Text style={s.note}>Note: {item.note}</Text>}

      {rejecting ? (
        <View style={s.rejectBox}>
          <TextInput
            value={reason}
            onChangeText={onReason}
            placeholder="Reason (optional, shown to the contributor)"
            placeholderTextColor={COLORS.grey}
            style={s.input as object}
          />
          <View style={s.actions}>
            <Pressable
              onPress={onConfirmReject}
              disabled={busy}
              style={[s.btn, s.btnDanger] as object}
            >
              <Text style={s.btnDangerText}>{busy ? 'Rejecting…' : 'Confirm reject'}</Text>
            </Pressable>
            <Pressable onPress={onCancelReject} style={s.btn as object}>
              <Text style={s.btnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={s.actions}>
          <Pressable onPress={onApprove} disabled={busy} style={[s.btn, s.btnPrimary] as object}>
            <Text style={s.btnPrimaryText}>{busy ? 'Working…' : 'Approve'}</Text>
          </Pressable>
          <Pressable onPress={onStartReject} disabled={busy} style={s.btn as object}>
            <Text style={s.btnText}>Reject</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 14 },
  muted: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey, paddingVertical: 8 },
  err: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.red, marginBottom: 8 },
  row: {
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f5efe3',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  kindTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  kindTagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  hero: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.black, flex: 1 },
  meta: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  diff: { gap: 4 },
  diffMeta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: COLORS.grey,
  },
  old: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textDecorationLine: 'line-through',
  },
  new: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.black, lineHeight: 20 },
  // List diff — added/removed chips.
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#eadfce',
  },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  chipAdded: { backgroundColor: COLORS.green + '22' } as object,
  chipAddedText: { color: COLORS.green } as object,
  chipRemoved: { backgroundColor: COLORS.red + '18' } as object,
  chipRemovedText: { color: COLORS.red, textDecorationLine: 'line-through' } as object,
  // Stat diff — old → new.
  statDiff: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statOld: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.grey },
  statArrow: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: COLORS.grey },
  statNew: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.green },
  report: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.red, lineHeight: 20 },
  note: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey, fontStyle: 'italic' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.black,
  } as object,
  rejectBox: { gap: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#efe6d6',
    cursor: 'pointer',
  } as object,
  btnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  btnPrimary: { backgroundColor: COLORS.green } as object,
  btnPrimaryText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
  btnDanger: { backgroundColor: COLORS.red } as object,
  btnDangerText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
});
