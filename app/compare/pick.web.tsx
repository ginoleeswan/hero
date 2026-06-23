import { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useHeroSearchInfinite } from '../../src/lib/query/heroQueries';
import { OpponentCard } from '../../src/components/compare/OpponentCard';
import { FilterChips } from '../../src/components/versus/FilterChips';
import { PresetRail } from '../../src/components/versus/PresetRail';
import { useBattleBuilder } from '../../src/hooks/useBattleBuilder';
import { usePresetTeams } from '../../src/hooks/usePresetTeams';
import { FACTION_A, FACTION_B } from '../../src/components/versus/factionColors';
import { COLORS, SURFACE, SURFACE_GRADIENT } from '../../src/constants/colors';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { withViewTransition } from '../../src/lib/viewTransition';
import { getTeamRoster } from '../../src/lib/db/teams';
import { MAX_SIDE, type PickedHero } from '../../src/lib/battleBuilderState';
import type { PublisherFilter, AlignmentFilter } from '../../src/lib/db/heroes/types';

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

function pickRandom<T extends { id: string }>(pool: T[], n: number): T[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default function BattleBuilderWeb() {
  // Full navy "select characters" stage, top to bottom (à la a fighter CSS).
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const contentPad = width < 640 ? 14 : 26;

  const b = useBattleBuilder();
  const { teams } = usePresetTeams();
  const [query, setQuery] = useState('');
  const [publisher, setPublisher] = useState<PublisherFilter>('All');
  const [alignment, setAlignment] = useState<AlignmentFilter>('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounced = useDebounce(query, 200);
  const activeFilters = (publisher !== 'All' ? 1 : 0) + (alignment !== 'All' ? 1 : 0);

  const searchQ = useHeroSearchInfinite(debounced, publisher, alignment);
  const heroes = useMemo(
    () =>
      (searchQ.data?.pages ?? [])
        .flat()
        .filter((h) => !b.isPlaced(h.id))
        .slice(0, 120),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- granular inputs, not the unstable `b`
    [searchQ.data, b.aHeroes, b.bHeroes, b.isPlaced],
  );

  const add = (hero: PickedHero) => b.addToActive(hero);
  const pickPreset = async (teamId: string) => {
    const roster = (await getTeamRoster(teamId, 5)) as PickedHero[];
    b.fillActive(roster);
  };
  const randomFill = (side: 'A' | 'B') => {
    b.setActive(side);
    b.fillActive(pickRandom(heroes, 3));
  };

  const activeTint = b.active === 'A' ? FACTION_A : FACTION_B;
  const cardW = isWide ? 104 : (width - contentPad * 2 - 2 * 10) / 3;

  // ── Desktop flanks ──
  const flankA = (
    <Flank
      label="Side A"
      tint={FACTION_A}
      roster={b.aHeroes}
      synergy={b.synergyA}
      publisher={b.publisherA}
      active={b.active === 'A'}
      onActivate={() => b.setActive('A')}
      onRemove={b.removeHero}
      onRandom={() => randomFill('A')}
      onClear={() => b.clearSide('A')}
    />
  );
  const flankB = (
    <Flank
      label="Side B"
      tint={FACTION_B}
      roster={b.bHeroes}
      synergy={b.synergyB}
      publisher={b.publisherB}
      active={b.active === 'B'}
      flip
      onActivate={() => b.setActive('B')}
      onRemove={b.removeHero}
      onRandom={() => randomFill('B')}
      onClear={() => b.clearSide('B')}
    />
  );

  // Shared search + Filters toggle (mobile sticky head and desktop top bar).
  const toolBar = (
    <View style={mh.tools}>
      <View style={[s.searchWrap, mh.searchFlex]}>
        <Ionicons name="search" size={18} color="rgba(245,235,220,0.4)" />
        <TextInput
          style={s.input}
          placeholder="Search any hero or villain…"
          placeholderTextColor="rgba(245,235,220,0.4)"
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.4)" />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={() => setFiltersOpen((o) => !o)}
        style={[mh.filterBtn, filtersOpen ? mh.filterBtnOn : null]}
        hitSlop={6}
      >
        <Ionicons
          name="options-outline"
          size={19}
          color={filtersOpen ? '#1a130a' : 'rgba(245,235,220,0.8)'}
        />
        <Text style={[mh.filterLabel, filtersOpen ? mh.filterLabelOn : null]}>Filters</Text>
        {activeFilters > 0 ? (
          <View style={mh.badge}>
            <Text style={mh.badgeText}>{activeFilters}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );

  const grid =
    heroes.length === 0 && !searchQ.isPending ? (
      <Text style={s.empty}>No fighters match these filters.</Text>
    ) : (
      <View style={s.grid}>
        {heroes.map((item) => (
          <OpponentCard
            key={item.id}
            item={item}
            onPress={() => add(item)}
            width={cardW}
            height={Math.round(cardW * 1.32)}
          />
        ))}
      </View>
    );

  // ── Mobile sticky dual-team tray ──
  const traySide = (side: 'A' | 'B', tint: string, roster: PickedHero[], synergy: number) => {
    const isActive = b.active === side;
    // Fewer fighters ⇒ larger slots; they compress as the side fills toward 5.
    const n = roster.length;
    const slotMax = n <= 1 ? 54 : n === 2 ? 48 : n === 3 ? 42 : n === 4 ? 37 : 33;
    return (
      <View style={[ts.half, isActive ? ({ backgroundColor: `${tint}26` } as object) : null]}>
        <View style={ts.head}>
          <Pressable onPress={() => b.setActive(side)} style={ts.labelBtn} hitSlop={4}>
            <Text
              style={[ts.sideLabel, { color: isActive ? tint : 'rgba(245,235,220,0.5)' }]}
              numberOfLines={1}
            >
              {isActive ? '▶ ' : ''}Side {side}
              {roster.length >= 2 ? `  +${synergy}%` : ''}
            </Text>
          </Pressable>
          <View style={ts.acts}>
            <Pressable onPress={() => randomFill(side)} style={ts.actBtn} hitSlop={8}>
              <Text style={ts.actText}>🎲</Text>
            </Pressable>
            {roster.length > 0 ? (
              <Pressable onPress={() => b.clearSide(side)} style={ts.actBtn} hitSlop={8}>
                <Ionicons name="close" size={13} color="rgba(245,235,220,0.7)" />
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={[ts.slots, side === 'B' ? ts.slotsR : null]}>
          {roster.map((hero) => {
            const uri = hero.portrait_url ?? hero.image_url ?? undefined;
            return (
              <Pressable
                key={hero.id}
                onPress={() => b.removeHero(hero.id)}
                style={[ts.slot, { maxWidth: slotMax, borderColor: tint }]}
                hitSlop={3}
              >
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={[StyleSheet.absoluteFill, side === 'B' ? ts.mirror : null]}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
                )}
              </Pressable>
            );
          })}
          {roster.length < MAX_SIDE ? (
            <View style={[ts.slot, ts.slotEmpty, { maxWidth: slotMax }]}>
              <Text style={ts.addPlus}>+</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const teamStrip = (
    <View style={ts.tray}>
      {traySide('A', FACTION_A, b.aHeroes, b.synergyA)}
      <View style={ts.vs}>
        <Text style={ts.vsText}>VS</Text>
      </View>
      {traySide('B', FACTION_B, b.bHeroes, b.synergyB)}
    </View>
  );

  // Sticky mobile head: team strip + a single search row with a Filters toggle.
  const mobileHead = (
    <View
      style={[
        mh.head,
        { top: `calc(${TOPBAR_HEIGHT + 8}px + env(safe-area-inset-top))` as unknown as number },
      ]}
    >
      {teamStrip}
      {toolBar}
    </View>
  );

  // Progressive disclosure: filters + quick-teams revealed only on demand.
  const filterPanel = filtersOpen ? (
    <View style={mh.panel}>
      <FilterChips
        publisher={publisher}
        alignment={alignment}
        onPublisher={setPublisher}
        onAlignment={setAlignment}
        tone="dark"
      />
      <PresetRail
        teams={teams}
        label={`→ ${b.active === 'A' ? 'Side A' : 'Side B'}`}
        tint={activeTint}
        onPick={pickPreset}
        tone="dark"
      />
    </View>
  ) : null;

  const renderFight = (full: boolean) =>
    b.canBattle && b.battleHref ? (
      <Pressable
        onPress={() =>
          withViewTransition(() => router.push(b.battleHref as Parameters<typeof router.push>[0]))
        }
        style={[s.fight, full ? s.fightFull : null]}
      >
        <Text style={s.fightText}>
          ⚔ FIGHT · {b.aHeroes.length} vs {b.bHeroes.length}
        </Text>
        <Ionicons name="arrow-forward" size={16} color="#1a130a" />
      </Pressable>
    ) : (
      <Text style={[s.hint, full ? s.hintFull : null]}>Add a fighter to each side to battle</Text>
    );

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.content,
          {
            paddingHorizontal: contentPad,
            paddingBottom: isWide
              ? 40
              : ('calc(env(safe-area-inset-bottom) + 96px)' as unknown as number),
          },
        ]}
      >
        <View style={[s.header, isWide ? null : s.headerSm]}>
          <Text style={s.eyebrow}>★ Build a Battle ★</Text>
          <Text style={[s.title, isWide ? null : s.titleSm]}>Select Your Fighters</Text>
        </View>

        {isWide ? (
          <>
            <View style={s.toolWrap}>{toolBar}</View>
            {filterPanel}
            <View style={s.arena}>
              <View style={s.flankCol}>{flankA}</View>
              <View style={s.poolCol}>{grid}</View>
              <View style={s.flankCol}>{flankB}</View>
            </View>
            <View style={s.ctaWrap}>
              {renderFight(false)}
              {b.aHeroes.length > 0 || b.bHeroes.length > 0 ? (
                <Pressable onPress={b.clearAll} style={s.clearAll} hitSlop={6}>
                  <Ionicons name="trash-outline" size={14} color="rgba(245,235,220,0.6)" />
                  <Text style={s.clearAllText}>Clear all</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <>
            {mobileHead}
            {filterPanel}
            {grid}
          </>
        )}
      </ScrollView>

      {!isWide ? (
        <View style={[s.mobileBar, { paddingHorizontal: contentPad }]}>{renderFight(true)}</View>
      ) : null}
    </View>
  );
}

/** Desktop edge: the side's latest pick as a big render facing centre, the squad
 *  as removable chips, synergy + dice/clear. Active = faction glow + Now Picking;
 *  inactive recedes. */
function Flank({
  label,
  tint,
  roster,
  synergy,
  publisher,
  active,
  flip = false,
  onActivate,
  onRemove,
  onRandom,
  onClear,
}: {
  label: string;
  tint: string;
  roster: PickedHero[];
  synergy: number;
  publisher: 'marvel' | 'dc' | null;
  active: boolean;
  flip?: boolean;
  onActivate: () => void;
  onRemove: (id: string) => void;
  onRandom: () => void;
  onClear: () => void;
}) {
  // Dynamic: the featured (latest) pick is large and shrinks as the squad grows;
  // earlier picks become chips. Fewer fighters ⇒ more presence.
  const count = roster.length;
  const featured = count ? roster[count - 1] : null;
  const featuredUri = featured?.portrait_url ?? featured?.image_url ?? undefined;
  const others = roster.slice(0, Math.max(0, count - 1));
  const renderW = [206, 242, 220, 202, 188, 176][Math.min(count, MAX_SIDE)];
  const renderH = Math.round(renderW * 1.32);
  const chipSize = count <= 2 ? 48 : count === 3 ? 42 : count === 4 ? 37 : 33;

  return (
    <View style={[fs.flank, active ? null : fs.dim]}>
      <View style={fs.tagSlot}>
        {active ? (
          <View style={[fs.pickingTag, { backgroundColor: tint }]}>
            <Text style={fs.pickingText}>▶ Now Picking</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={onActivate}
        style={[
          fs.render,
          { width: renderW, height: renderH, borderColor: tint },
          active ? ({ boxShadow: `0 0 36px 2px ${tint}80` } as object) : null,
        ]}
      >
        {featuredUri ? (
          <Image
            source={{ uri: featuredUri }}
            style={[StyleSheet.absoluteFill, flip ? fs.mirror : null]}
            contentFit="cover"
          />
        ) : (
          <View style={fs.empty}>
            <Text style={fs.emptyQ}>?</Text>
            <Text style={fs.emptyHint}>Tap heroes →</Text>
          </View>
        )}
        <View style={[fs.nameTag, { backgroundColor: tint }]}>
          <Text style={fs.name} numberOfLines={1}>
            {featured?.name ?? label}
          </Text>
        </View>
      </Pressable>

      {others.length > 0 || (count > 0 && count < MAX_SIDE) ? (
        <View style={fs.chips}>
          {others.map((hero) => {
            const uri = hero.portrait_url ?? hero.image_url ?? undefined;
            return (
              <Pressable
                key={hero.id}
                onPress={() => onRemove(hero.id)}
                style={[fs.chip, { width: chipSize, height: chipSize, borderColor: tint }]}
              >
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={[StyleSheet.absoluteFill, flip ? fs.mirror : null]}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
                )}
                <View style={fs.rm}>
                  <Text style={fs.rmx}>×</Text>
                </View>
              </Pressable>
            );
          })}
          {count > 0 && count < MAX_SIDE ? (
            <View style={[fs.chip, fs.chipEmpty, { width: chipSize, height: chipSize }]}>
              <Text style={fs.addPlus}>+</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={fs.meta}>
        {publisher ? (
          <Text style={fs.pub}>{publisher === 'dc' ? 'all-DC' : 'all-Marvel'}</Text>
        ) : null}
        {roster.length >= 2 ? (
          <Text style={[fs.syn, { color: tint }]}>SYNERGY +{synergy}%</Text>
        ) : null}
      </View>

      <View style={fs.actions}>
        <Pressable onPress={onRandom} style={fs.dice} hitSlop={6}>
          <Text style={fs.diceText}>🎲 Random</Text>
        </Pressable>
        {roster.length > 0 ? (
          <Pressable onPress={onClear} style={fs.dice} hitSlop={6}>
            <Text style={fs.diceText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    ...Platform.select({
      web: { backgroundImage: SURFACE_GRADIENT.stageImmersive } as object,
      default: {},
    }),
    paddingTop: TOPBAR_HEIGHT + 22,
  } as object,

  header: { alignItems: 'center', marginBottom: 16 },
  headerSm: { marginBottom: 12 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 6,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 28, color: COLORS.beige, textAlign: 'center' },
  titleSm: { fontSize: 21 },

  toolWrap: { maxWidth: 880, width: '100%', alignSelf: 'center', marginBottom: 18 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    height: 48,
    gap: 9,
  },
  input: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.beige,
    outlineStyle: 'none' as unknown as undefined,
  },

  arena: {
    flexDirection: 'row',
    gap: 24,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'flex-start',
  },
  flankCol: {
    width: 224,
    alignItems: 'center',
    position: 'sticky',
    top: `calc(${TOPBAR_HEIGHT + 16}px + env(safe-area-inset-top))` as unknown as number,
    alignSelf: 'flex-start',
  } as object,
  poolCol: { flex: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  empty: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.5)',
    paddingVertical: 36,
    textAlign: 'center',
    width: '100%',
  },

  ctaWrap: { alignItems: 'center', paddingTop: 30, gap: 14 },
  clearAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  clearAllText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.6)',
    letterSpacing: 0.3,
  },

  fight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.goldAccent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 34,
  },
  fightFull: { alignSelf: 'stretch' },
  fightText: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#1a130a', letterSpacing: 0.5 },
  hint: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(245,235,220,0.5)',
    textTransform: 'uppercase',
  },
  hintFull: { textAlign: 'center', paddingVertical: 16 },

  mobileBar: {
    // Pinned to the visual viewport; clears the iOS Safari toolbar + home indicator.
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    paddingTop: 10,
    paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' as unknown as number,
    backgroundColor: 'rgba(11,24,32,0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  } as object,
});

const ts = StyleSheet.create({
  tray: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#0f1c23',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  half: { flex: 1, gap: 7, padding: 7, borderRadius: 11 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  labelBtn: { flex: 1, paddingVertical: 2 },
  sideLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  slots: { flexDirection: 'row', gap: 5, justifyContent: 'flex-start', alignItems: 'flex-start' },
  slotsR: { justifyContent: 'flex-end' },
  slot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#1b2a30',
  },
  slotEmpty: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: 'rgba(255,255,255,0.4)' },
  mirror: { transform: [{ scaleX: -1 }] },
  acts: { flexDirection: 'row', gap: 6 },
  actBtn: {
    minWidth: 30,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  actText: { fontSize: 12 },
  vs: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  vsText: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.goldAccent },
});

const fs = StyleSheet.create({
  flank: { alignItems: 'center', gap: 12, padding: 10, width: '100%' },
  dim: { opacity: 0.46, transform: [{ scale: 0.96 }] },
  tagSlot: { height: 22, justifyContent: 'center' },
  pickingTag: { paddingHorizontal: 11, paddingVertical: 3, borderRadius: 11 },
  pickingText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#fff',
    textTransform: 'uppercase',
  },
  render: {
    width: 200,
    height: 264,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: '#16242b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mirror: { transform: [{ scaleX: -1 }] },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  emptyQ: { fontFamily: 'Flame-Regular', fontSize: 48, color: 'rgba(255,255,255,0.22)' },
  emptyHint: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
  },
  nameTag: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  name: { fontFamily: 'Flame-Regular', fontSize: 15, color: '#fff', textAlign: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5 },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#1b2a30',
  },
  chipEmpty: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  rm: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(11,24,32,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rmx: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: '#fff', lineHeight: 11 },

  meta: { alignItems: 'center', gap: 3, minHeight: 14 },
  pub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.goldAccent,
    borderWidth: 1,
    borderColor: 'rgba(206,155,51,0.5)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  syn: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 0.3 },

  actions: { flexDirection: 'row', gap: 8 },
  dice: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  diceText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(245,235,220,0.85)' },
});

const mh = StyleSheet.create({
  head: {
    position: 'sticky',
    zIndex: 20,
    backgroundColor: COLORS.deepNavy,
    paddingBottom: 12,
    gap: 10,
  } as object,
  tools: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchFlex: { flex: 1 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  filterBtnOn: { backgroundColor: COLORS.goldAccent, borderColor: COLORS.goldAccent },
  filterLabel: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: 'rgba(245,235,220,0.85)' },
  filterLabelOn: { color: '#1a130a' },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: COLORS.goldAccent,
    borderWidth: 1.5,
    borderColor: COLORS.deepNavy,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: '#1a130a' },
  panel: {
    gap: 12,
    marginTop: -2,
    marginBottom: 16,
    maxWidth: 880,
    width: '100%',
    alignSelf: 'center',
  },
});
