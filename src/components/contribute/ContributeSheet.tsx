// Cross-platform contribution sheet — a bottom sheet that asks one
// question-framed thing (a field edit or a "Did You Know" fact) and submits it
// for review. Everything is admin-vetted, so copy makes clear it's a suggestion;
// the reward is immediate (a warm, status-building confirmation) since the live
// change is deferred. Opened by the in-place dossier editor on the character
// screen (native + web via RNW).
import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';
import {
  submitContribution,
  adminEditHero,
  type EditableFieldDef,
} from '../../lib/db/contributions';
import { rewardLine } from '../../lib/contribute/reward';

export interface ContributeSheetProps {
  visible: boolean;
  onClose: () => void;
  heroId: string;
  heroName: string;
  /** Field edit when set; a "Did You Know" fact when null. */
  field: EditableFieldDef | null;
  user: { id: string } | null | undefined;
  /** The user's contribution count BEFORE this one (for the reward number). */
  priorCount: number;
  /** Admin = direct apply (no queue): "Save" instead of "Submit for review". */
  isAdmin?: boolean;
  /** Current value when editing a field that already has one. */
  currentValue?: string | null;
  onRequestSignIn: () => void;
  /** Called after a successful submit (so the card can mark the field pending/saved). */
  onSubmitted?: (field: EditableFieldDef | null) => void;
}

export function ContributeSheet({
  visible,
  onClose,
  heroId,
  heroName,
  field,
  user,
  priorCount,
  isAdmin = false,
  currentValue,
  onRequestSignIn,
  onSubmitted,
}: ContributeSheetProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue('');
      setError(null);
      setDone(false);
      setSubmitting(false);
    }
  }, [visible, field]);

  const isFact = !field;
  const prompt = isFact ? 'Know a fun fact about this hero?' : field!.question;
  const guideline = isFact
    ? 'Share a "Did You Know" — one or two sentences.'
    : (field!.guideline ?? '');
  const multiline = isFact || !!field?.multiline;

  const submit = async () => {
    if (!value.trim()) {
      setError('Add something first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      heroId,
      kind: (isFact ? 'fact' : 'field') as 'fact' | 'field',
      targetField: field?.field ?? null,
      newValue: value.trim(),
    };
    const res = isAdmin ? await adminEditHero(payload) : await submitContribution(payload);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not submit — please try again.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setDone(true);
    onSubmitted?.(field);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation?.()}>
          <View style={s.grabber} />

          {!user ? (
            <View style={s.body}>
              <Text style={s.kicker}>{heroName}</Text>
              <Text style={s.prompt}>Help complete this page</Text>
              <Text style={s.guideline}>
                Sign in to add what you know — it helps everyone who looks this hero up.
              </Text>
              <Pressable onPress={onRequestSignIn} style={[s.btn, s.btnPrimary]}>
                <Text style={s.btnPrimaryText}>Sign in to contribute</Text>
              </Pressable>
            </View>
          ) : done ? (
            <View style={s.body}>
              <View style={s.doneIcon}>
                <Ionicons name="checkmark" size={28} color="#fff" />
              </View>
              <Text style={s.doneTitle}>{isAdmin ? 'Saved' : 'Sent for review'}</Text>
              <Text style={s.doneSub}>
                {isAdmin ? "It's live now." : rewardLine(priorCount + 1)}
              </Text>
              {!isAdmin && (
                <Text style={s.doneMeta}>A moderator will take a look before it goes live.</Text>
              )}
              <Pressable onPress={onClose} style={[s.btn, s.btnPrimary]}>
                <Text style={s.btnPrimaryText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.body}>
              <Text style={s.kicker}>{heroName}</Text>
              <Text style={s.prompt}>{prompt}</Text>
              {!!guideline && <Text style={s.guideline}>{guideline}</Text>}
              {isAdmin && !!currentValue && (
                <View style={s.current}>
                  <Text style={s.currentLabel}>Current</Text>
                  <Text style={s.currentValue}>{currentValue}</Text>
                </View>
              )}
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder={isFact ? 'Did you know…' : 'Type your answer'}
                placeholderTextColor={COLORS.grey}
                multiline={multiline}
                style={[s.input, multiline && s.inputMultiline]}
                autoFocus
                onSubmitEditing={multiline ? undefined : submit}
                returnKeyType="done"
              />
              {!!error && <Text style={s.error}>{error}</Text>}
              <Pressable
                onPress={submit}
                disabled={submitting}
                style={[s.btn, s.btnPrimary, submitting && s.btnDisabled]}
              >
                <Text style={s.btnPrimaryText}>
                  {submitting ? 'Saving…' : isAdmin ? 'Save' : 'Submit for review'}
                </Text>
              </Pressable>
              {!isAdmin && (
                <Text style={s.reviewNote}>Suggestions are reviewed before they appear.</Text>
              )}
            </View>
          )}
        </Pressable>
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
    paddingBottom: 28,
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
    color: 'rgba(41,60,67,0.7)',
    lineHeight: 20,
    marginTop: 6,
  },
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
    marginTop: 16,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  current: { backgroundColor: '#e8ddd0', borderRadius: 10, padding: 12, marginTop: 14 },
  currentLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginBottom: 3,
  },
  currentValue: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.navy,
    lineHeight: 18,
  },
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
    color: 'rgba(41,60,67,0.7)',
    textAlign: 'center',
    lineHeight: 19,
  },
});
