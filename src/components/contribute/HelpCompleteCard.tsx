// "Help complete this page" — the contributor entry point on the character
// screen. Surfaces the hero's missing editable fields as question chips; each
// opens the ContributeSheet. After a user submits, that gap flips to an
// author-only "in review" chip right here — so they see their fingerprint on the
// page instantly, even though the live change is admin-gated. Shown to logged-out
// visitors too (as a sign-in hook). Cross-platform (RNW).
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { missingFields } from '../../lib/contribute/missingFields';
import { getMyContributions, type EditableFieldDef } from '../../lib/db/contributions';
import { ContributeSheet } from './ContributeSheet';

export interface HelpCompleteCardProps {
  heroId: string;
  heroName: string;
  /** Map of editable field → current value (origin, occupation, base, …). */
  values: Record<string, string | null | undefined>;
  user: { id: string } | null | undefined;
  onRequestSignIn: () => void;
  /** Override container style — web columns pass marginHorizontal:0 to sit flush. */
  style?: StyleProp<ViewStyle>;
}

// undefined = closed; { field } = open (field null ⇒ fact mode).
type SheetTarget = { field: EditableFieldDef | null } | undefined;

export function HelpCompleteCard({
  heroId,
  heroName,
  values,
  user,
  onRequestSignIn,
  style,
}: HelpCompleteCardProps) {
  const [target, setTarget] = useState<SheetTarget>(undefined);
  const [pendingFields, setPendingFields] = useState<Set<string>>(new Set());
  const [pendingFact, setPendingFact] = useState(false);
  const [total, setTotal] = useState(0);

  // Pull the user's contributions so already-submitted gaps show as "in review"
  // (and to seed the reward count). Re-runs after each submit.
  const load = useCallback(() => {
    if (!user) {
      setPendingFields(new Set());
      setPendingFact(false);
      setTotal(0);
      return;
    }
    getMyContributions()
      .then((list) => {
        setTotal(list.length);
        const pf = new Set<string>();
        let fact = false;
        for (const c of list) {
          if (c.status !== 'pending' || c.hero_id !== heroId) continue;
          if (c.kind === 'field' && c.target_field) pf.add(c.target_field);
          if (c.kind === 'fact') fact = true;
        }
        setPendingFields(pf);
        setPendingFact(fact);
      })
      .catch(() => {});
  }, [user, heroId]);

  useEffect(load, [load]);

  const missing = missingFields(values);
  const openMissing = missing.filter((f) => !pendingFields.has(f.field));

  const onSubmitted = (field: EditableFieldDef | null) => {
    setTotal((t) => t + 1);
    if (field) setPendingFields((prev) => new Set(prev).add(field.field));
    else setPendingFact(true);
    load(); // re-sync with the server in the background
  };

  const headTitle = openMissing.length > 0
    ? 'Help complete this page'
    : missing.length > 0
      ? 'Thanks for helping'
      : "Know something we don't?";
  const headSub = openMissing.length > 0
    ? `${openMissing.length} ${openMissing.length === 1 ? 'detail is' : 'details are'} missing — add what you know.`
    : missing.length > 0
      ? 'Your suggestions are under review.'
      : 'Suggest a fact to make this page even better.';

  return (
    <View style={[s.card, style]}>
      <View style={s.head}>
        <View style={s.iconWrap}>
          <Ionicons
            name={openMissing.length > 0 ? 'construct' : 'sparkles'}
            size={18}
            color={COLORS.orange}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{headTitle}</Text>
          <Text style={s.sub}>{headSub}</Text>
        </View>
      </View>

      <View style={s.chipRow}>
        {missing.map((f) =>
          pendingFields.has(f.field) ? (
            <View key={f.field} style={[s.chip, s.chipPending]}>
              <Ionicons name="time-outline" size={14} color={COLORS.grey} />
              <Text style={[s.chipText, s.chipTextPending]}>{f.label} · in review</Text>
            </View>
          ) : (
            <Pressable key={f.field} style={s.chip} onPress={() => setTarget({ field: f })}>
              <Ionicons name="add" size={14} color={COLORS.navy} />
              <Text style={s.chipText}>{f.label}</Text>
            </Pressable>
          ),
        )}
        {pendingFact ? (
          <View style={[s.chip, s.chipPending]}>
            <Ionicons name="time-outline" size={14} color={COLORS.grey} />
            <Text style={[s.chipText, s.chipTextPending]}>Fact · in review</Text>
          </View>
        ) : (
          <Pressable style={[s.chip, s.chipAccent]} onPress={() => setTarget({ field: null })}>
            <Ionicons name="bulb-outline" size={14} color="#fff" />
            <Text style={[s.chipText, s.chipTextAccent]}>Add a fact</Text>
          </Pressable>
        )}
      </View>

      <ContributeSheet
        visible={target !== undefined}
        onClose={() => setTarget(undefined)}
        heroId={heroId}
        heroName={heroName}
        field={target?.field ?? null}
        user={user}
        priorCount={total}
        onRequestSignIn={onRequestSignIn}
        onSubmitted={onSubmitted}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 14,
    padding: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: '#fbf4e7',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.25)',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(231,115,51,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.navy, lineHeight: 22 },
  sub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(41,60,67,0.7)',
    lineHeight: 18,
    marginTop: 2,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
  },
  chipAccent: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
  chipPending: { backgroundColor: 'transparent', borderColor: 'rgba(41,60,67,0.18)', borderStyle: 'dashed' },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  chipTextAccent: { color: '#fff' },
  chipTextPending: { color: COLORS.grey },
});
