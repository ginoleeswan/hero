// app/compare/pick.tsx — the native Battle Builder, structured as a DRAFT
// BOARD: a pinned tray (what you have) over a dominant catalogue (what you can
// pick). The design rules, learned from the version this replaced:
//
//   1. The CATALOGUE is the star. You spend the whole session browsing heroes,
//      so the grid starts above the fold. The old screen spent ~60% of the
//      viewport on empty question-mark placeholders (a focal card, a giant
//      anchor, five dashed slots — seven "?" boxes before one real character).
//   2. The TRAY never scrolls away. Adding a fighter must visibly change the
//      roster; the old header scrolled off with it, so taps appeared to do
//      nothing. Here both sides stay pinned while the grid scrolls beneath.
//   3. Picked heroes STAY in the grid, marked `added` (gold ring + check, tap
//      again to remove) — the old filter-them-out approach reflowed the whole
//      grid under your finger on every add.
//   4. The CTA guides instead of scolding. No dead grey button reading "Add at
//      least one fighter to each side" before you've done anything — a quiet
//      contextual hint that names the NEXT step, replaced by the Fight button
//      the moment the battle is valid.
//
// "Armed" side = where taps land. Tap a tray row to arm it; the armed row gets
// its faction tint, a "+" in its next open slot, and the dice (random fill).
import { useMemo, useState } from 'react';
import { View, FlatList, Pressable, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Text, TextInput } from '../../src/components/ui/Text';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useStableTopInset } from '../../src/hooks/useStableTopInset';
import { useHeroSearchInfinite } from '../../src/lib/query/heroQueries';
import { OpponentCard } from '../../src/components/compare/OpponentCard';
import { CardSkeleton } from '../../src/components/compare/CardSkeleton';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';
import { VsBadge } from '../../src/components/compare/VsBadge';
import { PressScale } from '../../src/components/ui/PressScale';
import { useBattleBuilder } from '../../src/hooks/useBattleBuilder';
import { usePresetTeams } from '../../src/hooks/usePresetTeams';
import { FACTION_A, FACTION_B } from '../../src/components/versus/factionColors';
import { COLORS, PAPER_TEXT, STAGE_INK } from '../../src/constants/colors';
import { EYEBROW_TYPE, SEAM } from '../../src/design';
import { getTeamRoster } from '../../src/lib/db/teams';
import { MAX_SIDE, type PickedHero, type Side } from '../../src/lib/battleBuilderState';
import type { PublisherFilter, AlignmentFilter } from '../../src/lib/db/heroes/types';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 16;
const GAP = 10;
const CARD_W = (SCREEN_W - H_PAD * 2 - GAP * 2) / 3;
const CARD_H = Math.round(CARD_W * 1.4);
// The opponent grid renders at most this many cards — past it, you refine the
// search rather than scroll. Pagination is capped to match: fetching a page
// whose rows the slice below would discard is pure waste on the user's data.
const GRID_CAP = 120;
const SLOT = 40;

const PUBLISHERS: PublisherFilter[] = ['All', 'Marvel', 'DC'];
const ALIGNMENTS: AlignmentFilter[] = ['All', 'Heroes', 'Villains'];

const tintBg = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

function pickRandom<T extends { id: string }>(pool: T[], n: number): T[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default function BattleBuilderScreen() {
  const router = useRouter();
  // `mode=team` only changes what the screen SAYS. The mechanics are already
  // identical — both sides hold up to MAX_SIDE, and resolveBattleRoute sends a
  // one-a-side result to the pair arena and anything larger to the team draft.
  // Arriving from "Team battle" with copy about picking two fighters would be
  // the screen contradicting the button that opened it.
  const team = useLocalSearchParams<{ mode?: string }>().mode === 'team';
  const insets = useSafeAreaInsets();
  const topInset = useStableTopInset();
  const b = useBattleBuilder();
  const { teams } = usePresetTeams();

  const [query, setQuery] = useState('');
  const [publisher, setPublisher] = useState<PublisherFilter>('All');
  const [alignment, setAlignment] = useState<AlignmentFilter>('All');
  const [peek, setPeek] = useState<PeekHero | null>(null);
  const debounced = useDebouncedValue(query, 200);

  const searchQ = useHeroSearchInfinite(debounced, publisher, alignment);
  // Placed heroes stay in the grid (marked `added`) — no filter, no reflow.
  const heroes = useMemo(
    () => (searchQ.data?.pages ?? []).flat().slice(0, GRID_CAP) as PickedHero[],
    [searchQ.data],
  );

  const activeTint = b.active === 'A' ? FACTION_A : FACTION_B;
  const activeRoster = b.active === 'A' ? b.aHeroes : b.bHeroes;
  const anyPicked = b.aHeroes.length > 0 || b.bHeroes.length > 0;

  const add = (hero: PickedHero) => {
    if (activeRoster.length >= MAX_SIDE) {
      // Side is full — a silent no-op reads as a broken tap.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.selectionAsync();
    b.addToActive(hero);
  };
  const remove = (id: string) => {
    Haptics.selectionAsync();
    b.removeHero(id);
  };
  const arm = (side: Side) => {
    if (side !== b.active) Haptics.selectionAsync();
    b.setActive(side);
  };
  const pickPreset = async (teamId: string) => {
    const roster = (await getTeamRoster(teamId, MAX_SIDE)) as PickedHero[];
    b.fillActive(roster);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const randomFill = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    b.fillActive(
      pickRandom(
        heroes.filter((h) => !b.isPlaced(h.id)),
        3,
      ),
    );
  };

  // The hint names the NEXT step rather than restating the rule.
  const hint = !anyPicked
    ? team
      ? `Tap fighters below to build Side A — up to ${MAX_SIDE}`
      : 'Tap a fighter below to start Side A'
    : b.aHeroes.length === 0
      ? 'Side A needs a fighter — tap its row, then pick'
      : 'Side B needs a fighter — tap its row, then pick';

  const gridHeader = (
    <View style={s.sheetHead}>
      <View style={s.searchRow}>
        <Ionicons name="search" size={17} color="rgba(41,60,67,0.4)" />
        <TextInput
          style={s.input}
          placeholder="Search any hero or villain…"
          placeholderTextColor={PAPER_TEXT.placeholder}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={17} color="rgba(41,60,67,0.35)" />
          </Pressable>
        ) : null}
      </View>

      {/* One row: publisher · alignment. The old two labelled groups wrapped
          into a tall block that pushed the grid below the fold. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.railBleed}
        contentContainerStyle={s.chips}
      >
        {PUBLISHERS.map((p) => (
          <Chip key={p} label={p} selected={publisher === p} onPress={() => setPublisher(p)} />
        ))}
        <View style={s.chipDivider} />
        {ALIGNMENTS.map((a) => (
          <Chip key={a} label={a} selected={alignment === a} onPress={() => setAlignment(a)} />
        ))}
      </ScrollView>

      {teams.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.railBleed}
          contentContainerStyle={s.presets}
        >
          {teams.slice(0, 10).map((t) => (
            <Pressable key={t.id} onPress={() => pickPreset(t.id)} style={s.presetPill}>
              {t.logo_url ? (
                <Image source={{ uri: t.logo_url }} style={s.presetLogo} contentFit="contain" />
              ) : null}
              <Text style={s.presetName} numberOfLines={1}>
                {t.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* Education + destination in one quiet line: the gesture hint, and a
          solid tint pill (ink text on the faction colour — raw orange/blue TEXT
          on paper fails contrast, the solid pill doesn't) naming where taps go. */}
      <View style={s.captionRow}>
        <Text style={s.caption}>Tap to add · hold to preview</Text>
        <View style={[s.destPill, { backgroundColor: activeTint }]}>
          <Text style={s.destText}>→ Side {b.active}</Text>
        </View>
      </View>

      {heroes.length === 0 && !searchQ.isPending ? (
        <Text style={s.empty}>No fighters match these filters.</Text>
      ) : null}
    </View>
  );

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      {/* ── Pinned: top bar + tray, on the arena-lobby gradient ── */}
      <LinearGradient colors={[...STAGE_INK]} style={[s.stage, { paddingTop: topInset + 4 }]}>
        <View style={s.topBar}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/versus'))}
            style={s.backBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={19} color="rgba(245,235,220,0.85)" />
          </Pressable>
          <Text style={s.title}>{team ? 'Build a Team Battle' : 'Build a Battle'}</Text>
          {anyPicked ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                b.clearAll();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Reset both sides"
            >
              <Text style={s.reset}>Reset</Text>
            </Pressable>
          ) : (
            <View style={s.resetGhost} />
          )}
        </View>

        <SideRow
          side="A"
          tint={FACTION_A}
          roster={b.aHeroes}
          synergy={b.synergyA}
          armed={b.active === 'A'}
          onArm={() => arm('A')}
          onRemove={remove}
          onDice={randomFill}
        />
        <View style={s.vsRow}>
          <View style={s.vsLine} />
          <VsBadge size={24} variant="solid" />
          <View style={s.vsLine} />
        </View>
        <SideRow
          side="B"
          tint={FACTION_B}
          roster={b.bHeroes}
          synergy={b.synergyB}
          armed={b.active === 'B'}
          onArm={() => arm('B')}
          onRemove={remove}
          onDice={randomFill}
        />
      </LinearGradient>

      {/* ── Scrolls: the catalogue ── */}
      <View style={s.sheet}>
        <FlatList
          data={heroes}
          extraData={b}
          keyExtractor={(it) => it.id}
          numColumns={3}
          columnWrapperStyle={s.gridRow}
          contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={gridHeader}
          ListEmptyComponent={
            searchQ.isPending ? (
              <View style={s.skeletonGrid}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <CardSkeleton key={i} width={CARD_W} height={CARD_H} />
                ))}
              </View>
            ) : null
          }
          onEndReached={() => {
            if (heroes.length >= GRID_CAP) return;
            if (searchQ.hasNextPage && !searchQ.isFetchingNextPage) searchQ.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => {
            const placed = b.isPlaced(item.id);
            return (
              <OpponentCard
                item={item}
                added={placed}
                onPress={() => (placed ? remove(item.id) : add(item))}
                onLongPress={() => setPeek(item)}
                width={CARD_W}
                height={CARD_H}
              />
            );
          }}
        />
      </View>

      {/* ── CTA: a guide until valid, the Fight button after ── */}
      <View style={[s.ctaBar, { paddingBottom: insets.bottom + 10 }]} pointerEvents="box-none">
        {b.canBattle && b.battleHref ? (
          <Animated.View entering={FadeInDown.duration(220)} style={s.ctaStrip}>
            {/* Flat, thick, rounded, elevated. No gradient and no bevel: the
                depth comes from the drop shadow alone, so the fill stays one
                honest gold. A full-width horizontal gradient read as a battery
                meter; a metallic ramp read as fussy. A slab reads as a button. */}
            <PressScale
              scale={0.97}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push(b.battleHref as Parameters<typeof router.push>[0]);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Fight, ${b.aHeroes.length} versus ${b.bHeroes.length}`}
              style={s.cta}
            >
              <View style={[s.ctaCount, { borderColor: FACTION_A }]}>
                <Text style={s.ctaCountTxt}>{b.aHeroes.length}</Text>
              </View>
              <View style={s.ctaCenter}>
                <MaterialCommunityIcons name="sword-cross" size={17} color={COLORS.deepNavy} />
                <Text style={s.ctaTxt}>Fight</Text>
              </View>
              <View style={[s.ctaCount, { borderColor: FACTION_B }]}>
                <Text style={s.ctaCountTxt}>{b.bHeroes.length}</Text>
              </View>
            </PressScale>
          </Animated.View>
        ) : (
          <View style={s.hintPill} pointerEvents="none">
            <Text style={s.hintTxt}>{hint}</Text>
          </View>
        )}
      </View>

      {peek ? (
        <HeroPeek
          hero={peek}
          onClose={() => setPeek(null)}
          onFight={() => {
            add(peek);
            setPeek(null);
          }}
          onViewProfile={() => {
            setPeek(null);
            router.push(`/character/${peek.id}`);
          }}
        />
      ) : null}
    </View>
  );
}

/** One pinned tray row: label column, five slots, dice when armed. Tapping the
 *  row arms it; tapping a filled slot removes (armed row) or arms (idle row —
 *  first tap selects, second acts, so idle rows can't lose a fighter by
 *  accident). The armed row's next open slot shows a tinted "+": taps land here. */
function SideRow({
  side,
  tint,
  roster,
  synergy,
  armed,
  onArm,
  onRemove,
  onDice,
}: {
  side: Side;
  tint: string;
  roster: PickedHero[];
  synergy: number;
  armed: boolean;
  onArm: () => void;
  onRemove: (id: string) => void;
  onDice: () => void;
}) {
  return (
    <Pressable
      onPress={onArm}
      accessibilityRole="button"
      accessibilityLabel={`Side ${side}, ${roster.length} of ${MAX_SIDE} fighters${armed ? ', selected' : ''}`}
      style={[s.row, armed ? { borderColor: tint, backgroundColor: tintBg(tint, 0.1) } : s.rowIdle]}
    >
      <View style={s.rowLabelCol}>
        <Text style={[s.rowLabel, { color: armed ? tint : 'rgba(245,235,220,0.55)' }]}>
          Side {side}
        </Text>
        <Text style={s.rowMeta}>
          {roster.length >= 2 && synergy > 0 ? `+${synergy}%` : `${roster.length}/${MAX_SIDE}`}
        </Text>
      </View>

      <View style={[s.slots, armed ? null : s.slotsIdle]}>
        {Array.from({ length: MAX_SIDE }).map((_, i) => {
          const hero = roster[i];
          if (!hero) {
            const isNext = armed && i === roster.length;
            return (
              <View key={`e${i}`} style={[s.slotEmpty, isNext ? { borderColor: tint } : null]}>
                {isNext ? <Text style={[s.slotPlus, { color: tint }]}>+</Text> : null}
              </View>
            );
          }
          const uri = hero.portrait_url ?? hero.image_url ?? undefined;
          return (
            <Pressable
              key={hero.id}
              onPress={() => (armed ? onRemove(hero.id) : onArm())}
              accessibilityLabel={armed ? `Remove ${hero.name}` : `Select side ${side}`}
              style={s.slot}
            >
              <Animated.View entering={ZoomIn.duration(160)} style={StyleSheet.absoluteFill}>
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    recyclingKey={hero.id}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
                )}
              </Animated.View>
              {armed ? (
                <View style={s.rmBadge}>
                  <Ionicons name="close" size={9} color="#fff" />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {armed ? (
        <Pressable
          onPress={onDice}
          hitSlop={6}
          style={s.diceBtn}
          accessibilityRole="button"
          accessibilityLabel={`Random fill side ${side}`}
        >
          <Ionicons name="dice-outline" size={16} color="rgba(245,235,220,0.85)" />
        </Pressable>
      ) : (
        <View style={s.diceGhost} />
      )}
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.chip, selected ? s.chipOn : null]}>
      <Text style={[s.chipText, selected ? s.chipTextOn : null]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  stage: { paddingHorizontal: H_PAD, paddingBottom: 26, gap: 8 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,235,220,0.08)',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 18, lineHeight: 24, color: COLORS.beige },
  reset: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.7)',
    width: 36,
    textAlign: 'right',
  },
  resetGhost: { width: 36 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  rowIdle: { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
  rowLabelCol: { width: 52, gap: 1 },
  rowLabel: { ...EYEBROW_TYPE },
  rowMeta: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: 'rgba(245,235,220,0.55)' },
  slots: { flexDirection: 'row', gap: 5, flex: 1 },
  slotsIdle: { opacity: 0.7 },
  slot: {
    width: SLOT,
    height: SLOT,
    borderRadius: 8,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: '#1b2a30',
  },
  slotEmpty: {
    width: SLOT,
    height: SLOT,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(245,235,220,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotPlus: { fontFamily: 'Nunito_700Bold', fontSize: 15, lineHeight: 18 },
  rmBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(11,24,32,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,235,220,0.1)',
  },
  diceGhost: { width: 30 },

  vsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: -2 },
  vsLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(245,235,220,0.14)' },

  sheet: {
    flex: 1,
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: SEAM.radius,
    borderTopRightRadius: SEAM.radius,
    borderCurve: 'continuous',
    marginTop: -SEAM.overlap,
    overflow: 'hidden',
  },
  sheetHead: { paddingTop: 16, paddingHorizontal: H_PAD, gap: 10, paddingBottom: 10 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(41,60,67,0.06)',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(41,60,67,0.12)',
    paddingHorizontal: 14,
    height: 44,
    gap: 9,
  },
  input: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },

  // Horizontal rails escape the header's padding (negative margin) and carry
  // their own edge insets — otherwise the padded parent CLIPS the rail at both
  // edges instead of letting it scroll to the screen edge. Repo-wide rule; see
  // "Horizontal rails bleed to the screen edge" in CLAUDE.md.
  railBleed: { marginHorizontal: -H_PAD },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: H_PAD },
  chip: {
    paddingHorizontal: 13,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.22)',
  },
  chipOn: { backgroundColor: COLORS.goldAccent, borderColor: COLORS.goldAccent },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: PAPER_TEXT.muted },
  chipTextOn: { color: '#1a130a' },
  chipDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(41,60,67,0.15)',
    marginHorizontal: 2,
  },

  presets: { flexDirection: 'row', gap: 8, paddingHorizontal: H_PAD },
  presetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.18)',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  presetLogo: { width: 16, height: 16 },
  presetName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: PAPER_TEXT.muted,
    maxWidth: 130,
  },

  captionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caption: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: PAPER_TEXT.faint },
  destPill: {
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.deepNavy },

  empty: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: PAPER_TEXT.faint, paddingTop: 6 },
  gridRow: { gap: GAP, marginBottom: GAP, paddingHorizontal: H_PAD },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: H_PAD,
    paddingTop: GAP,
  },

  ctaBar: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  ctaStrip: { alignSelf: 'stretch', paddingHorizontal: H_PAD, paddingTop: 10 },
  cta: {
    height: 64,
    borderRadius: 24,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: COLORS.goldAccent,
    // The only depth cue, so it carries the whole load: a long, deep, soft
    // shadow that lifts the slab well off the beige sheet. Deliberately beyond
    // the ELEVATION ramp — those steps (alpha 0.12-0.18) are tuned for cards
    // RESTING on paper, and this is a floating primary action that has to read
    // as hovering above the content it scrolls over.
    boxShadow: '0 18px 44px rgba(11,24,32,0.55)',
    elevation: 24,
  },
  ctaCenter: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  ctaTxt: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    lineHeight: 24,
    color: COLORS.deepNavy,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  // Ink discs ringed in each side's colour — 15.27:1 for the numeral, and the
  // factions stay legible as identity without painting the whole button.
  ctaCount: {
    minWidth: 32,
    height: 32,
    borderRadius: 999,
    paddingHorizontal: 8,
    backgroundColor: COLORS.deepNavy,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaCountTxt: { fontFamily: 'Flame-Regular', fontSize: 15, lineHeight: 20, color: COLORS.beige },
  hintPill: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,24,32,0.8)',
  },
  hintTxt: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(245,235,220,0.85)' },
});
