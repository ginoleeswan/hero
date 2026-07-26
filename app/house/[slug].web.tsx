// app/house/[slug].web.tsx
// A house of Westeros: the family tree as a destination rather than a band on
// somebody's character page.
//
// All state lives in the URL — ?focus re-roots the tree, ?with lights the
// kinship path — so every view a reader reaches is a link they can send.
import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/colors';
import { FamilyCanvas } from '../../src/components/family/FamilyCanvas.web';
import { HeroAvatar } from '../../src/components/HeroAvatar';
import { useHouse, type HouseMember } from '../../src/hooks/useHouse';

export default function HousePage() {
  const router = useRouter();
  const { slug, focus, with: withId } = useLocalSearchParams<{
    slug: string;
    focus?: string;
    with?: string;
  }>();
  const { house, members, relatives, focusId, kinship, isLoading, error } = useHouse(
    slug,
    focus ?? null,
    withId ?? null,
  );

  const setParams = useCallback(
    (next: { focus?: string | null; with?: string | null }) => {
      const params = new URLSearchParams();
      const f = next.focus === undefined ? focusId : next.focus;
      const w = next.with === undefined ? (withId ?? null) : next.with;
      if (f) params.set('focus', f);
      if (w) params.set('with', w);
      const qs = params.toString();
      router.setParams(Object.fromEntries(params) as Record<string, string>);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/house/${slug}${qs ? `?${qs}` : ''}`);
      }
    },
    [router, slug, focusId, withId],
  );

  const focused = members.find((m) => m.id === focusId) ?? null;

  if (isLoading) {
    return (
      <View style={styles.centre}>
        <Text style={styles.muted}>Loading the house…</Text>
      </View>
    );
  }
  if (error || !house) {
    return (
      <View style={styles.centre}>
        <Text style={styles.h1}>No such house</Text>
        <Text style={styles.muted}>
          {error ? error.message : 'Nothing in the catalogue answers to that name.'}
        </Text>
      </View>
    );
  }

  const tint = house.sigil_tint ?? COLORS.orange;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageInner}>
      <Stack.Screen options={{ title: `${house.name} — family tree` }} />

      {/* The banner is the one place the house gets to be itself: its own
          colour, its own words. Everything below is the shared chart. */}
      <View style={[styles.banner, { borderTopColor: tint }]}>
        <Text style={styles.eyebrow}>{house.universe}</Text>
        <Text style={styles.h1}>{house.name}</Text>
        {house.words ? <Text style={[styles.words, { color: tint }]}>“{house.words}”</Text> : null}
        {house.blurb ? <Text style={styles.blurb}>{house.blurb}</Text> : null}
        <Text style={styles.meta}>
          {members.length} recorded {members.length === 1 ? 'member' : 'members'}
          {house.seat ? ` · Seat: ${house.seat}` : ''}
        </Text>
      </View>

      {/* The hook. When two people are named the answer leads the page, because
          it is the thing worth sending to someone. */}
      {kinship ? (
        <View style={[styles.answer, { borderLeftColor: tint }]}>
          <Text style={styles.answerHeadline}>{kinship.headline}</Text>
          <Text style={styles.answerChain}>{kinship.chain}</Text>
          <Pressable onPress={() => setParams({ with: null })} style={styles.clear}>
            <Ionicons name="close" size={13} color={COLORS.navy} />
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.prompt}>
          Pick someone below to see how they and {focused?.name ?? 'the head of the house'} are
          related.
        </Text>
      )}

      {relatives.length > 0 && focused ? (
        <FamilyCanvas
          heroName={focused.name}
          heroImage={focused.portrait_url ?? focused.image_md_url ?? focused.image_url}
          heroAvatar={focused.avatar_url}
          heroId={focused.id}
          members={relatives}
        />
      ) : (
        <Text style={styles.muted}>
          {focused?.name ?? 'This member'} has no recorded kin inside the house.
        </Text>
      )}

      <Text style={styles.sectionLabel}>Everyone in the house</Text>
      <View style={styles.roster}>
        {members.map((m) => (
          <MemberChip
            key={m.id}
            member={m}
            isFocus={m.id === focusId}
            isWith={m.id === withId}
            onFocus={() => setParams({ focus: m.id, with: null })}
            onRelate={() => setParams({ with: m.id })}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function MemberChip({
  member,
  isFocus,
  isWith,
  onFocus,
  onRelate,
}: {
  member: HouseMember;
  isFocus: boolean;
  isWith: boolean;
  onFocus: () => void;
  onRelate: () => void;
}) {
  return (
    <View style={[styles.chip, isFocus && styles.chipFocus, isWith && styles.chipWith]}>
      <Pressable onPress={onFocus} style={styles.chipMain}>
        <HeroAvatar
          id={member.id}
          name={member.name}
          avatarUrl={member.avatar_url}
          fallbackUrl={member.portrait_url ?? member.image_md_url ?? member.image_url}
          size={30}
          radius={15}
          bare
        />
        <Text style={styles.chipName} numberOfLines={1}>
          {member.name}
        </Text>
      </Pressable>
      {isFocus ? (
        <Text style={styles.chipTag}>rooted</Text>
      ) : (
        <Pressable onPress={onRelate} style={styles.relate}>
          <Text style={styles.relateText}>relate</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.beige },
  pageInner: { padding: 20, gap: 18, maxWidth: 1180, width: '100%', alignSelf: 'center' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 },
  banner: {
    backgroundColor: 'white',
    borderRadius: 18,
    borderTopWidth: 4,
    padding: 22,
    gap: 6,
  },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#a99b84',
  },
  h1: { fontFamily: 'Flame-Regular', fontSize: 34, color: COLORS.black },
  words: { fontFamily: 'Flame-Regular', fontSize: 17 },
  blurb: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#4a5560',
    maxWidth: 640,
  },
  meta: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#a99b84', marginTop: 4 },
  answer: {
    backgroundColor: 'white',
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 16,
    gap: 6,
  },
  answerHeadline: { fontFamily: 'Flame-Regular', fontSize: 21, color: COLORS.black },
  answerChain: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: '#4a5560', lineHeight: 20 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  clearText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  prompt: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: '#8d8375' },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#a99b84',
    marginTop: 6,
  },
  roster: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'white',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e7dcc9',
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
  },
  chipFocus: { borderColor: COLORS.black, borderWidth: 2 },
  chipWith: { borderColor: COLORS.orange, borderWidth: 2 },
  chipMain: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  chipName: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: COLORS.black, maxWidth: 150 },
  chipTag: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#a99b84',
  },
  relate: { paddingHorizontal: 6, paddingVertical: 2 },
  relateText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.navy,
  },
  muted: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: '#8d8375' },
});
