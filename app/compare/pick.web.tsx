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
import { VsBadge } from '../../src/components/compare/VsBadge';
import { RailSide } from '../../src/components/versus/RailSide';
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
import type { PickedHero } from '../../src/lib/battleBuilderState';
import type { PublisherFilter, AlignmentFilter } from '../../src/lib/db/heroes/types';

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

/** Up to n not-yet-placed heroes, shuffled. */
function pickRandom<T extends { id: string }>(pool: T[], n: number): T[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default function BattleBuilderWeb() {
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const contentPad = width < 640 ? 16 : 28;

  const b = useBattleBuilder();
  const { teams } = usePresetTeams();
  const [query, setQuery] = useState('');
  const [publisher, setPublisher] = useState<PublisherFilter>('All');
  const [alignment, setAlignment] = useState<AlignmentFilter>('All');
  const [focal, setFocal] = useState<PickedHero | null>(null);
  const debounced = useDebounce(query, 200);

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

  const add = (hero: PickedHero) => {
    b.addToActive(hero);
    setFocal(hero);
  };
  const pickPreset = async (teamId: string) => {
    const roster = (await getTeamRoster(teamId, 5)) as PickedHero[];
    b.fillActive(roster);
    if (roster[0]) setFocal(roster[0]);
  };
  const randomFill = (side: 'A' | 'B') => {
    b.setActive(side);
    const picks = pickRandom(heroes, 3);
    b.fillActive(picks);
    if (picks[0]) setFocal(picks[0]);
  };

  const activeTint = b.active === 'A' ? FACTION_A : FACTION_B;
  const focalHero = focal ?? (b.active === 'A' ? b.aHeroes : b.bHeroes)[0] ?? null;
  const focalUri = focalHero?.portrait_url ?? focalHero?.image_url ?? undefined;

  const railA = (
    <RailSide
      label="Side A"
      tint={FACTION_A}
      roster={b.aHeroes}
      synergy={b.synergyA}
      publisher={b.publisherA}
      active={b.active === 'A'}
      captainW={104}
      captainH={130}
      onActivate={() => b.setActive('A')}
      onRemove={b.removeHero}
      onRandom={() => randomFill('A')}
    />
  );
  const railB = (
    <RailSide
      label="Side B"
      tint={FACTION_B}
      roster={b.bHeroes}
      synergy={b.synergyB}
      publisher={b.publisherB}
      active={b.active === 'B'}
      flip
      captainW={104}
      captainH={130}
      onActivate={() => b.setActive('B')}
      onRemove={b.removeHero}
      onRandom={() => randomFill('B')}
    />
  );

  const pool = (
    <View style={s.pool}>
      <FilterChips
        publisher={publisher}
        alignment={alignment}
        onPublisher={setPublisher}
        onAlignment={setAlignment}
      />
      <PresetRail
        teams={teams}
        label={`→ ${b.active === 'A' ? 'Side A' : 'Side B'}`}
        tint={activeTint}
        onPick={pickPreset}
      />
      <View style={s.searchWrap}>
        <Ionicons name="search" size={18} color="rgba(41,60,67,0.4)" />
        <TextInput
          style={s.input}
          placeholder="Search any hero or villain…"
          placeholderTextColor="rgba(41,60,67,0.38)"
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="rgba(41,60,67,0.4)" />
          </Pressable>
        ) : null}
      </View>
      {heroes.length === 0 && !searchQ.isPending ? (
        <Text style={s.empty}>No fighters match these filters.</Text>
      ) : (
        <View style={s.grid}>
          {heroes.map((item) => (
            <OpponentCard
              key={item.id}
              item={item}
              onPress={() => add(item)}
              width={96}
              height={134}
            />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* ── Navy stage: title + focal fighter ── */}
      <View style={[s.stage, { paddingHorizontal: contentPad }]}>
        <View style={s.stageInner}>
          <Text style={s.eyebrow}>★ Build a Battle ★</Text>
          <Text style={s.title}>Assemble Your Sides</Text>
          <View style={s.focalRow}>
            <View style={[s.focalCard, { borderColor: activeTint }]}>
              {focalUri ? (
                <Image
                  source={{ uri: focalUri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <Text style={s.focalQ}>?</Text>
              )}
            </View>
            <VsBadge size={46} variant="glass" />
            <Text style={s.focalName} numberOfLines={1}>
              {focalHero?.name ?? 'Pick your fighters'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Beige draft floor ── */}
      <View style={s.floor}>
        {isWide ? (
          <View style={[s.draftRow, { paddingHorizontal: contentPad }]}>
            <View style={s.railCol}>{railA}</View>
            <View style={s.poolCol}>{pool}</View>
            <View style={s.railCol}>{railB}</View>
          </View>
        ) : (
          <View style={[s.draftStack, { paddingHorizontal: contentPad }]}>
            <View style={s.railsRow}>
              {railA}
              {railB}
            </View>
            {pool}
          </View>
        )}

        <View style={s.ctaWrap}>
          {b.canBattle && b.battleHref ? (
            <Pressable
              onPress={() =>
                withViewTransition(() =>
                  router.push(b.battleHref as Parameters<typeof router.push>[0]),
                )
              }
              style={s.fight}
            >
              <Text style={s.fightText}>
                ⚔ FIGHT · {b.aHeroes.length} vs {b.bHeroes.length}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#1a130a" />
            </Pressable>
          ) : (
            <Text style={s.hint}>Add at least one fighter to each side</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  content: { flexGrow: 1 },

  stage: {
    backgroundColor: COLORS.deepNavy,
    ...Platform.select({
      web: { backgroundImage: SURFACE_GRADIENT.stageImmersive } as object,
      default: {},
    }),
    paddingTop: TOPBAR_HEIGHT + 26,
    paddingBottom: 30,
  } as object,
  stageInner: { maxWidth: 880, width: '100%', alignSelf: 'center', alignItems: 'center' },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: COLORS.beige,
    marginBottom: 18,
    textAlign: 'center',
  },
  focalRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  focalCard: {
    width: 96,
    height: 120,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: '#16242b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focalQ: { fontFamily: 'Flame-Regular', fontSize: 40, color: 'rgba(255,255,255,0.3)' },
  focalName: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.beige, maxWidth: 220 },

  floor: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -18,
    paddingTop: 24,
    flex: 1,
  },
  draftRow: {
    flexDirection: 'row',
    gap: 20,
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'flex-start',
  },
  railCol: { width: 168, alignItems: 'center' },
  poolCol: { flex: 1 },
  draftStack: { gap: 18, maxWidth: 760, width: '100%', alignSelf: 'center' },
  railsRow: { flexDirection: 'row', justifyContent: 'center', gap: 28 },

  pool: { gap: 14 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(41,60,67,0.12)',
    paddingHorizontal: 14,
    height: 46,
    gap: 9,
  },
  input: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.navy,
    outlineStyle: 'none' as unknown as undefined,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  empty: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(41,60,67,0.55)',
    paddingVertical: 30,
    textAlign: 'center',
  },

  ctaWrap: { alignItems: 'center', paddingVertical: 26 },
  fight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.goldAccent,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 30,
  },
  fightText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#1a130a', letterSpacing: 0.5 },
  hint: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(41,60,67,0.5)',
    textTransform: 'uppercase',
  },
});
