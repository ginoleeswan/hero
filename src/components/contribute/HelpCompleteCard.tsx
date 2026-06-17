// "Help complete this page" — the contributor entry point on the character
// screen.
//
//  • Community users see the hero's *missing* editable fields as question chips
//    (+ "Add a fact"); each opens the ContributeSheet, and after submitting that
//    gap flips to an author-only "in review" chip right here.
//  • Admins see *every* editable field (add the empty ones, fix the filled
//    ones) and their edits apply immediately (the sheet handles direct-apply);
//    a saved field shows a ✓ until the page reloads with the new value.
//
// Shown to logged-out visitors too (a sign-in hook). Cross-platform (RNW).
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { isBlankValue, missingFields } from '../../lib/contribute/missingFields';
import {
  EDITABLE_FIELDS,
  getMyContributions,
  type EditableFieldDef,
} from '../../lib/db/contributions';
import { getProfile } from '../../lib/db/profiles';
import { ContributeSheet } from './ContributeSheet';

export interface HelpCompleteCardProps {
  heroId: string;
  heroName: string;
  values: Record<string, string | null | undefined>;
  user: { id: string } | null | undefined;
  onRequestSignIn: () => void;
  /** Called after an admin direct-edit so the screen can refresh the hero. */
  onEdited?: () => void;
  style?: StyleProp<ViewStyle>;
}

const FACT_KEY = '__fact__';
type SheetTarget = { field: EditableFieldDef | null; current?: string | null } | undefined;

export function HelpCompleteCard({
  heroId,
  heroName,
  values,
  user,
  onRequestSignIn,
  onEdited,
  style,
}: HelpCompleteCardProps) {
  const [target, setTarget] = useState<SheetTarget>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingFields, setPendingFields] = useState<Set<string>>(new Set());
  const [pendingFact, setPendingFact] = useState(false);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set()); // admin just-saved
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let active = true;
    getProfile(user.id)
      .then((p) => active && setIsAdmin(!!p?.is_admin))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  // Community pending marks + reward count. (Admins apply directly, so they don't
  // accrue pending rows; this just seeds the count harmlessly.)
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
    if (isAdmin) {
      setSavedKeys((prev) => new Set(prev).add(field ? field.field : FACT_KEY));
      onEdited?.(); // let the screen refetch so the live value updates too
      return;
    }
    setTotal((t) => t + 1);
    if (field) setPendingFields((prev) => new Set(prev).add(field.field));
    else setPendingFact(true);
    load();
  };

  // Header copy differs by role.
  const headTitle = isAdmin
    ? 'Edit this page'
    : openMissing.length > 0
      ? 'Help complete this page'
      : missing.length > 0
        ? 'Thanks for helping'
        : "Know something we don't?";
  const headSub = isAdmin
    ? 'Add or fix any field — changes go live instantly.'
    : openMissing.length > 0
      ? `${openMissing.length} ${openMissing.length === 1 ? 'detail is' : 'details are'} missing — add what you know.`
      : missing.length > 0
        ? 'Your suggestions are under review.'
        : 'Suggest a fact to make this page even better.';

  return (
    <View style={[s.card, style]}>
      <View style={s.head}>
        <View style={s.iconWrap}>
          <Ionicons
            name={isAdmin ? 'shield-checkmark' : openMissing.length > 0 ? 'construct' : 'sparkles'}
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
        {isAdmin
          ? EDITABLE_FIELDS.map((f) => {
              const cur = values[f.field];
              const filled = !isBlankValue(cur);
              const saved = savedKeys.has(f.field);
              return (
                <Pressable
                  key={f.field}
                  style={[s.chip, saved && s.chipSaved]}
                  onPress={() => setTarget({ field: f, current: filled ? cur : null })}
                >
                  <Ionicons
                    name={saved ? 'checkmark' : filled ? 'pencil' : 'add'}
                    size={14}
                    color={saved ? COLORS.green : COLORS.navy}
                  />
                  <Text style={s.chipText}>{f.label}</Text>
                </Pressable>
              );
            })
          : missing.map((f) =>
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

        {!isAdmin && pendingFact ? (
          <View style={[s.chip, s.chipPending]}>
            <Ionicons name="time-outline" size={14} color={COLORS.grey} />
            <Text style={[s.chipText, s.chipTextPending]}>Fact · in review</Text>
          </View>
        ) : (
          <Pressable
            style={[s.chip, s.chipAccent, savedKeys.has(FACT_KEY) && s.chipSaved]}
            onPress={() => setTarget({ field: null })}
          >
            <Ionicons
              name={savedKeys.has(FACT_KEY) ? 'checkmark' : 'bulb-outline'}
              size={14}
              color="#fff"
            />
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
        currentValue={target?.current ?? null}
        user={user}
        isAdmin={isAdmin}
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
  chipPending: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(41,60,67,0.18)',
    borderStyle: 'dashed',
  },
  chipSaved: { borderColor: COLORS.green },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  chipTextAccent: { color: '#fff' },
  chipTextPending: { color: COLORS.grey },
});
