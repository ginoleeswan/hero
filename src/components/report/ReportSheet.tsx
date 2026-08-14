// Cross-platform report sheet - a bottom sheet that asks "what's wrong?" with a
// tap-to-pick reason list and an optional detail note, then files it via
// submit_report. Signed-in only (a queued moderation signal, never a direct
// edit). Opened from the character page's contribute menu (context='page') and
// the image lightbox (context='image').
//
// `mode="block"` skips straight to the block confirm — no reason list, no
// submit button in between — so a "Block" entry point (e.g. the take card's
// overflow menu) lands the user on the confirm in one tap instead of making
// them scroll past a report form they didn't ask for. It reuses this sheet's
// existing block state rather than building a second flow.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, PAPER_TEXT, ORANGE_INK } from '../../constants/colors';
import { Sheet } from '../ui/Sheet';
import {
  REPORT_REASONS,
  resolveReportTarget,
  submitReport,
  type ReportContext,
} from '../../lib/db/reports';
import { blockUser } from '../../lib/db/blocks';

export interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  heroId: string;
  heroName: string;
  context: ReportContext;
  /** The gallery image being reported (image context). */
  imageUrl?: string | null;
  /** The AI portrait url, attached when the page "ai_inaccurate" reason is picked. */
  portraitUrl?: string | null;
  /** The take being reported (take context only). */
  takeId?: string | null;
  /** The take's author (take context only) — enables the block action below. */
  authorId?: string | null;
  authorName?: string | null;
  user: { id: string } | null | undefined;
  onRequestSignIn: () => void;
  /** Called after a successful block, so the caller can refresh its list. */
  onBlocked?: () => void;
  /**
   * "report" (default) opens on the reason list. "block" opens straight on
   * the block confirm, skipping the report form entirely — for a dedicated
   * "Block" entry point. Requires `context === 'take'` and an `authorId`.
   */
  mode?: 'report' | 'block';
}

export function ReportSheet({
  visible,
  onClose,
  heroId,
  heroName,
  context,
  imageUrl,
  portraitUrl,
  takeId,
  authorId,
  authorName,
  user,
  onRequestSignIn,
  onBlocked,
  mode = 'report',
}: ReportSheetProps) {
  const blockOnly = mode === 'block' && context === 'take' && !!authorId;
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [blockConfirming, setBlockConfirming] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  // Reset the form to a clean slate each time the sheet opens. Fires only on the
  // visible transition; keeping it in an effect avoids remounting mid-animation.
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReason(null);
      setDetail('');
      setError(null);
      setDone(false);
      setSubmitting(false);
      setBlockConfirming(blockOnly);
      setBlocking(false);
      setBlockError(null);
    }
  }, [visible, blockOnly]);

  const showBlock = context === 'take' && !!authorId;

  const handleBlock = async () => {
    if (!authorId) return;
    setBlocking(true);
    setBlockError(null);
    const ok = await blockUser(authorId);
    setBlocking(false);
    if (!ok) {
      setBlockError('Could not block — please try again.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onBlocked?.();
    onClose();
  };

  const reasons = REPORT_REASONS[context];
  // ai_inaccurate (page) attaches the portrait; image context shows the image.
  const thumb = context === 'image' ? imageUrl : reason === 'ai_inaccurate' ? portraitUrl : null;

  const submit = async () => {
    if (!reason) {
      setError('Pick a reason first.');
      return;
    }
    if (reason === 'other' && !detail.trim()) {
      setError('Tell us a bit more.');
      return;
    }
    const target = resolveReportTarget(context, reason, { imageUrl, portraitUrl });
    setSubmitting(true);
    setError(null);
    const res = await submitReport({
      heroId,
      targetType: target.targetType,
      imageUrl: target.imageUrl,
      reason,
      detail: detail.trim() || null,
      takeId: target.targetType === 'take' ? takeId : null,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(
        res.error === 'already reported'
          ? "You've already reported this."
          : (res.error ?? 'Could not submit - please try again.'),
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setDone(true);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      avoidKeyboard
      label={blockOnly ? 'Block this person' : 'Report a problem'}
    >
      {blockOnly ? (
        !user ? (
          <View style={s.body}>
            <Text style={s.kicker}>{heroName}</Text>
            <Text style={s.prompt}>Block</Text>
            <Text style={s.guideline}>Sign in to block — it only changes what you see.</Text>
            <Pressable onPress={onRequestSignIn} style={[s.btn, s.btnPrimary]}>
              <Text style={s.btnPrimaryText}>Sign in to block</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.body}>
            <Text style={s.kicker}>{heroName}</Text>
            <Text style={s.prompt}>Block {authorName ?? 'this person'}?</Text>
            <Text style={s.guideline}>
              You won’t see their takes any more. They won’t be told. You can undo this later in
              Settings.
            </Text>
            {!!blockError && <Text style={s.error}>{blockError}</Text>}
            <View style={[s.blockConfirmRow, s.blockOnlyRow]}>
              <Pressable
                onPress={onClose}
                disabled={blocking}
                style={[s.btn, s.btnSecondary, s.btnHalf]}
              >
                <Text style={s.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleBlock}
                disabled={blocking}
                style={[s.btn, s.btnDanger, s.btnHalf, blocking && s.btnDisabled]}
              >
                <Text style={s.btnPrimaryText}>{blocking ? 'Blocking...' : 'Block'}</Text>
              </Pressable>
            </View>
          </View>
        )
      ) : !user ? (
        <View style={s.body}>
          <Text style={s.kicker}>{heroName}</Text>
          <Text style={s.prompt}>Report a problem</Text>
          <Text style={s.guideline}>Sign in to report - it helps us keep pages accurate.</Text>
          <Pressable onPress={onRequestSignIn} style={[s.btn, s.btnPrimary]}>
            <Text style={s.btnPrimaryText}>Sign in to report</Text>
          </Pressable>
        </View>
      ) : done ? (
        <View style={s.body}>
          <View style={s.doneIcon}>
            <Ionicons name="checkmark" size={28} color="#fff" />
          </View>
          <Text style={s.doneTitle}>Reported</Text>
          <Text style={s.doneSub}>Thanks for flagging this.</Text>
          <Text style={s.doneMeta}>We’ll take a look shortly.</Text>
          <Pressable onPress={onClose} style={[s.btn, s.btnPrimary]}>
            <Text style={s.btnPrimaryText}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.body}>
          <Text style={s.kicker}>{heroName}</Text>
          <Text style={s.prompt}>Report a problem</Text>
          <Text style={s.guideline}>What’s wrong here?</Text>

          {thumb ? <Image source={{ uri: thumb }} style={s.thumb} contentFit="cover" /> : null}

          <View style={s.reasons}>
            {reasons.map((r) => {
              const on = reason === r.code;
              return (
                <Pressable
                  key={r.code}
                  onPress={() => setReason(r.code)}
                  style={[s.reasonRow, on && s.reasonRowOn]}
                >
                  <Ionicons
                    name={on ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={on ? COLORS.orange : COLORS.grey}
                  />
                  <Text style={[s.reasonText, on && s.reasonTextOn]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder={reason === 'other' ? "Tell us what's wrong" : 'Add details (optional)'}
            placeholderTextColor={COLORS.grey}
            multiline
            maxLength={1000}
            style={[s.input, s.inputMultiline]}
          />
          {!!error && <Text style={s.error}>{error}</Text>}
          <Pressable
            onPress={submit}
            disabled={submitting}
            style={[s.btn, s.btnPrimary, submitting && s.btnDisabled]}
          >
            <Text style={s.btnPrimaryText}>{submitting ? 'Sending...' : 'Submit report'}</Text>
          </Pressable>
          <Text style={s.reviewNote}>Reports are reviewed by a moderator.</Text>

          {showBlock &&
            (blockConfirming ? (
              <View style={s.blockConfirm}>
                <Text style={s.blockConfirmText}>
                  Block {authorName ?? 'this person'}? You won’t see their takes any more. They
                  won’t be told. You can undo this later in Settings.
                </Text>
                {!!blockError && <Text style={s.error}>{blockError}</Text>}
                <View style={s.blockConfirmRow}>
                  <Pressable
                    onPress={() => setBlockConfirming(false)}
                    disabled={blocking}
                    style={[s.btn, s.btnSecondary, s.btnHalf]}
                  >
                    <Text style={s.btnSecondaryText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleBlock}
                    disabled={blocking}
                    style={[s.btn, s.btnDanger, s.btnHalf, blocking && s.btnDisabled]}
                  >
                    <Text style={s.btnPrimaryText}>{blocking ? 'Blocking...' : 'Block'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setBlockConfirming(true)}
                style={({ pressed }) => [s.blockRow, pressed && s.blockRowPressed]}
              >
                <Ionicons name="ban-outline" size={16} color={COLORS.red} />
                <View style={s.blockText}>
                  <Text style={s.blockTitle}>Block this person</Text>
                  <Text style={s.blockSub}>
                    You won’t see their takes any more. They won’t be told.
                  </Text>
                </View>
              </Pressable>
            ))}
        </View>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 22, paddingTop: 10 },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: ORANGE_INK,
    marginBottom: 4,
  },
  prompt: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.navy, lineHeight: 30 },
  guideline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: PAPER_TEXT.faint,
    lineHeight: 20,
    marginTop: 6,
  },
  thumb: {
    width: 72,
    height: 96,
    borderRadius: 10,
    marginTop: 14,
    backgroundColor: COLORS.navy + '18',
  },
  reasons: { marginTop: 14, gap: 6 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
    backgroundColor: '#fff',
  },
  reasonRowOn: { borderColor: COLORS.orange, backgroundColor: '#fff7ef' },
  reasonText: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },
  reasonTextOn: { fontFamily: 'Nunito_700Bold' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.black,
    marginTop: 12,
  },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
  error: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.red, marginTop: 10 },
  btn: { paddingVertical: 14, borderRadius: 26, alignItems: 'center', marginTop: 16 },
  btnPrimary: { backgroundColor: COLORS.orange },
  btnPrimaryText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.6 },
  reviewNote: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: PAPER_TEXT.faint,
    textAlign: 'center',
    marginTop: 12,
  },
  doneIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  doneTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 24,
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  doneSub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: COLORS.navy,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 6,
  },
  doneMeta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: PAPER_TEXT.faint,
    textAlign: 'center',
    lineHeight: 19,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(41,60,67,0.1)',
  },
  blockRowPressed: { opacity: 0.6 },
  blockText: { flex: 1, gap: 2 },
  blockTitle: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.red },
  blockSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: PAPER_TEXT.faint,
    lineHeight: 17,
  },
  blockConfirm: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(41,60,67,0.1)',
  },
  blockConfirmText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.navy,
    lineHeight: 19,
  },
  blockConfirmRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  blockOnlyRow: { marginTop: 16 },
  btnHalf: { flex: 1 },
  btnSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(41,60,67,0.16)' },
  btnSecondaryText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.navy },
  btnDanger: { backgroundColor: COLORS.red },
});
