// Cross-platform report sheet - a bottom sheet that asks "what's wrong?" with a
// tap-to-pick reason list and an optional detail note, then files it via
// submit_report. Signed-in only (a queued moderation signal, never a direct
// edit). Opened from the character page's contribute menu (context='page') and
// the image lightbox (context='image').
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, PAPER_TEXT } from '../../constants/colors';
import {
  REPORT_REASONS,
  resolveReportTarget,
  submitReport,
  type ReportContext,
} from '../../lib/db/reports';

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
  user: { id: string } | null | undefined;
  onRequestSignIn: () => void;
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
  user,
  onRequestSignIn,
}: ReportSheetProps) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    }
  }, [visible]);

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        {/* Lift the sheet above the keyboard (iOS; Android resizes the window
            itself) and keep the CTA clear of the home indicator. */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 8) + 20 }]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={s.grabber} />

            {!user ? (
              <View style={s.body}>
                <Text style={s.kicker}>{heroName}</Text>
                <Text style={s.prompt}>Report a problem</Text>
                <Text style={s.guideline}>
                  Sign in to report - it helps us keep pages accurate.
                </Text>
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

                {thumb ? (
                  <Image source={{ uri: thumb }} style={s.thumb} contentFit="cover" />
                ) : null}

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
                  placeholder={
                    reason === 'other' ? "Tell us what's wrong" : 'Add details (optional)'
                  }
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
                  <Text style={s.btnPrimaryText}>
                    {submitting ? 'Sending...' : 'Submit report'}
                  </Text>
                </Pressable>
                <Text style={s.reviewNote}>Reports are reviewed by a moderator.</Text>
              </View>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,24,32,0.55)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderCurve: 'continuous',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(41,60,67,0.25)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  body: { paddingHorizontal: 22, paddingTop: 10 },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.orange,
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
    color: COLORS.grey,
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
});
