// src/components/takes/TakesSection.tsx — "The Debate": pick-a-side one-liner
// takes on a matchup, shared verbatim between native and web (both compare
// screens render it below the verdict/vote block). Reads/writes go through
// useMatchupTakes; report/delete lives behind a small per-card overflow menu.
import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PAPER_TEXT, ORANGE_INK } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useMatchupVote } from '../../hooks/useMatchupVote';
import { useMatchupTakes } from '../../hooks/useMatchupTakes';
import { ReportSheet } from '../report/ReportSheet';
import { PaperCard } from '../ui/PaperCard';
import { loginHref } from '../../lib/loginRedirect';
import type { Take } from '../../lib/db/takes';

const MAX_LEN = 280;

export interface MatchupHeroLike {
  id: string;
  name: string;
}

export interface TakesSectionProps {
  heroA: MatchupHeroLike;
  heroB: MatchupHeroLike;
}

function sideOf(take: Take, heroA: MatchupHeroLike, heroB: MatchupHeroLike): 'a' | 'b' | null {
  if (take.pickedId === heroA.id) return 'a';
  if (take.pickedId === heroB.id) return 'b';
  return null;
}

function SideChip({
  label,
  active,
  tint,
  onPress,
}: {
  label: string;
  active: boolean;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Pick ${label}`}
      style={({ pressed }) => [
        s.chip,
        active && { backgroundColor: tint, borderColor: tint },
        pressed && s.pressed,
      ]}
    >
      <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function TakeCard({
  take,
  heroA,
  heroB,
  agreed,
  isOwn,
  onAgree,
  onReport,
  onBlock,
  onDelete,
}: {
  take: Take;
  heroA: MatchupHeroLike;
  heroB: MatchupHeroLike;
  agreed: boolean;
  isOwn: boolean;
  onAgree: () => void;
  onReport: () => void;
  onBlock: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const side = sideOf(take, heroA, heroB);
  const sideName = side === 'a' ? heroA.name : side === 'b' ? heroB.name : null;
  const tint = side === 'a' ? COLORS.orange : side === 'b' ? COLORS.blue : COLORS.grey;

  return (
    <PaperCard style={s.card}>
      <View style={s.cardTop}>
        {sideName ? (
          <View style={[s.sideBadge, { backgroundColor: tint + '1a', borderColor: tint + '55' }]}>
            <Text style={[s.sideBadgeText, { color: tint }]} numberOfLines={1}>
              {sideName}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <Pressable
          onPress={() => setMenuOpen((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="More options"
          style={({ pressed }) => [s.menuBtn, pressed && s.pressed]}
        >
          <Ionicons name="ellipsis-horizontal" size={16} color="rgba(41,60,67,0.4)" />
        </Pressable>
      </View>

      <Text style={s.body}>{take.body}</Text>

      <View style={s.cardBottom}>
        <Text style={s.byline}>{take.displayName ?? 'Anonymous hero'}</Text>
        <Pressable
          onPress={onAgree}
          accessibilityRole="button"
          accessibilityLabel="Agree with this take"
          style={({ pressed }) => [s.agreePill, agreed && s.agreePillActive, pressed && s.pressed]}
        >
          <Ionicons
            name={agreed ? 'thumbs-up' : 'thumbs-up-outline'}
            size={13}
            color={agreed ? '#fff' : COLORS.navy}
          />
          <Text style={[s.agreeCount, agreed && s.agreeCountActive]}>{take.agreeCount}</Text>
        </Pressable>
      </View>

      {menuOpen && (
        <View style={s.menu}>
          {isOwn ? (
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                onDelete();
              }}
              style={({ pressed }) => [s.menuItem, pressed && s.pressed]}
            >
              <Ionicons name="trash-outline" size={14} color={COLORS.red} />
              <Text style={[s.menuItemText, { color: COLORS.red }]}>Delete</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  onBlock();
                }}
                style={({ pressed }) => [s.menuItem, pressed && s.pressed]}
              >
                <Ionicons name="ban-outline" size={14} color={COLORS.red} />
                <Text style={[s.menuItemText, { color: COLORS.red }]}>Block</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  onReport();
                }}
                style={({ pressed }) => [s.menuItem, pressed && s.pressed]}
              >
                <Ionicons name="flag-outline" size={14} color={COLORS.grey} />
                <Text style={s.menuItemText}>Report</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </PaperCard>
  );
}

export function TakesSection({ heroA, heroB }: TakesSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { pickedId: votePickedId } = useMatchupVote(heroA.id, heroB.id);
  const { takes, myTake, submit, remove, agree, agreedIds, error, refetch } = useMatchupTakes(
    heroA.id,
    heroB.id,
  );

  const [pick, setPick] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [reportTakeId, setReportTakeId] = useState<string | null>(null);
  // Which entry point opened the sheet: the "Report" menu item lands on the
  // reason list, "Block" skips straight to the block confirm (Finding 2 —
  // block used to be reachable only by scrolling past the whole report form).
  const [sheetMode, setSheetMode] = useState<'report' | 'block'>('report');

  // Default the composer's side to the viewer's already-cast vote, once — never
  // stomp a side the user picked explicitly inside the composer.
  useEffect(() => {
    if (pick === null && votePickedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPick(votePickedId);
    }
  }, [votePickedId, pick]);

  const goToLogin = () => router.push(loginHref(pathname));

  const handleSubmit = async () => {
    if (!user) {
      goToLogin();
      return;
    }
    const trimmed = body.trim();
    if (!pick || !trimmed) return;
    setPosting(true);
    const ok = await submit(pick, trimmed);
    setPosting(false);
    if (ok) setBody('');
  };

  const reportTarget = takes.find((t) => t.id === reportTakeId) ?? null;

  return (
    <View style={s.section}>
      <View style={s.headingRow}>
        <Text style={s.heading}>The Debate</Text>
        <Text style={s.count}>
          {takes.length} {takes.length === 1 ? 'take' : 'takes'}
        </Text>
      </View>

      {takes.length === 0 ? (
        <Text style={s.emptyText}>No takes yet — have the first word.</Text>
      ) : (
        <View style={s.cards}>
          {takes.map((t) => (
            <TakeCard
              key={t.id}
              take={t}
              heroA={heroA}
              heroB={heroB}
              agreed={agreedIds.has(t.id)}
              isOwn={!!user && t.userId === user.id}
              onAgree={() => agree(t.id)}
              onReport={() => {
                setSheetMode('report');
                setReportTakeId(t.id);
              }}
              onBlock={() => {
                setSheetMode('block');
                setReportTakeId(t.id);
              }}
              onDelete={() => remove(t.id)}
            />
          ))}
        </View>
      )}

      {!!error && <Text style={s.writeError}>{error}</Text>}

      <View style={s.composer}>
        <View style={s.chips}>
          <SideChip
            label={heroA.name}
            active={pick === heroA.id}
            tint={COLORS.orange}
            onPress={() => setPick(heroA.id)}
          />
          <SideChip
            label={heroB.name}
            active={pick === heroB.id}
            tint={COLORS.blue}
            onPress={() => setPick(heroB.id)}
          />
        </View>

        {user ? (
          <>
            <TextInput
              value={body}
              onChangeText={(t) => setBody(t.slice(0, MAX_LEN))}
              placeholder={myTake ? 'Post a new take to replace yours...' : 'Make your case...'}
              placeholderTextColor={COLORS.grey}
              multiline
              maxLength={MAX_LEN}
              style={s.input}
            />
            <View style={s.composerFooter}>
              <Text style={s.counter}>
                {body.length}/{MAX_LEN}
              </Text>
              <Pressable
                onPress={handleSubmit}
                disabled={posting || !pick || !body.trim()}
                accessibilityRole="button"
                accessibilityLabel="Post take"
                style={({ pressed }) => [
                  s.submitBtn,
                  (posting || !pick || !body.trim()) && s.submitBtnDisabled,
                  pressed && s.pressed,
                ]}
              >
                <Text style={s.submitBtnText}>{posting ? 'Posting...' : 'Post'}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable
            onPress={goToLogin}
            accessibilityRole="button"
            accessibilityLabel="Sign in to post a take"
            style={({ pressed }) => [s.signInRow, pressed && s.pressed]}
          >
            <Text style={s.signInText}>Sign in to weigh in</Text>
            <Ionicons name="chevron-forward" size={15} color={COLORS.orange} />
          </Pressable>
        )}
      </View>

      <ReportSheet
        visible={!!reportTarget}
        onClose={() => setReportTakeId(null)}
        heroId={heroA.id}
        heroName={heroA.name}
        context="take"
        mode={sheetMode}
        takeId={reportTarget?.id ?? null}
        authorId={reportTarget?.userId ?? null}
        authorName={reportTarget?.displayName ?? null}
        user={user}
        onRequestSignIn={() => {
          setReportTakeId(null);
          goToLogin();
        }}
        onBlocked={refetch}
      />
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 14 },
  pressed: { opacity: 0.6 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  heading: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    lineHeight: 27,
    color: COLORS.navy,
  },
  count: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: PAPER_TEXT.faint,
  },
  emptyText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: PAPER_TEXT.faint,
  },
  cards: { gap: 10 },
  // Surface, border and radius come from PaperCard; this is only what is
  // specific to a take. The 14pt radius it used to carry was off the scale, so
  // adopting the primitive drained a radius count as well as a card count.
  card: { gap: 8 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '75%',
  },
  sideBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  menuBtn: { padding: 2 },
  body: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.navy,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  byline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: PAPER_TEXT.faint,
  },
  agreePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(41,60,67,0.06)',
  },
  agreePillActive: { backgroundColor: COLORS.navy },
  agreeCount: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  agreeCountActive: { color: '#fff' },
  menu: {
    position: 'absolute',
    top: 30,
    right: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuItemText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },

  composer: {
    backgroundColor: 'rgba(41,60,67,0.04)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.16)',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  chipTextActive: { color: '#fff' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16, // ≥16: iOS zooms on focus below this
    color: COLORS.black,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: PAPER_TEXT.faint },
  writeError: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.red, marginTop: 10 },
  submitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.orange,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },

  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  signInText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: ORANGE_INK },
});
