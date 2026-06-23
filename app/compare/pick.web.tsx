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
  const debounced = useDebounce(query, 200);

  const searchQ = useHeroSearchInfinite(debounced, publisher, alignment);
  const heroes = useMemo(
    () => (searchQ.data?.pages ?? []).flat().filter((h) => !b.isPlaced(h.id)).slice(0, 120),
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
  const cardW = isWide ? 104 : 96;

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
      wide={isWide}
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
      wide={isWide}
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
        <Ionicons name="search" size={18} color="rgba(245,235,220,0.4)" />
        <TextInput
          style={s.input}
          placeholder="Search any hero or villain…"
          placeholderTextColor="rgba(245,235,220,0.4)"
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.4)" />
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
              width={cardW}
              height={Math.round(cardW * 1.32)}
            />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingHorizontal: contentPad }]}>
      <View style={s.header}>
        <Text style={s.eyebrow}>★ Build a Battle ★</Text>
        <Text style={s.title}>Select Your Fighters</Text>
      </View>

      {isWide ? (
        <View style={s.arena}>
          <View style={s.flankCol}>{flankA}</View>
          <View style={s.poolCol}>{pool}</View>
          <View style={s.flankCol}>{flankB}</View>
        </View>
      ) : (
        <View style={s.stack}>
          <View style={s.flanksRow}>
            {flankA}
            {flankB}
          </View>
          {pool}
        </View>
      )}

      <View style={s.ctaWrap}>
        {b.canBattle && b.battleHref ? (
          <Pressable
            onPress={() =>
              withViewTransition(() => router.push(b.battleHref as Parameters<typeof router.push>[0]))
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
    </ScrollView>
  );
}

/** One edge of the fighter-select: the side's latest pick as a big render facing
 *  centre, the rest of the squad as removable chips, synergy + dice. */
function Flank({
  label,
  tint,
  roster,
  synergy,
  publisher,
  active,
  flip = false,
  wide,
  onActivate,
  onRemove,
  onRandom,
}: {
  label: string;
  tint: string;
  roster: PickedHero[];
  synergy: number;
  publisher: 'marvel' | 'dc' | null;
  active: boolean;
  flip?: boolean;
  wide: boolean;
  onActivate: () => void;
  onRemove: (id: string) => void;
  onRandom: () => void;
}) {
  const star = roster[roster.length - 1] ?? null;
  const starUri = star?.portrait_url ?? star?.image_url ?? undefined;
  const renderW = wide ? 200 : 150;
  const renderH = Math.round(renderW * 1.32);

  return (
    <View style={[fs.flank, active ? { borderColor: COLORS.goldAccent } : fs.idle]}>
      <Pressable onPress={onActivate} style={[fs.render, { width: renderW, height: renderH, borderColor: tint }]}>
        {starUri ? (
          <Image source={{ uri: starUri }} style={[StyleSheet.absoluteFill, flip ? fs.mirror : null]} contentFit="cover" />
        ) : (
          <View style={fs.empty}>
            <Text style={fs.emptyQ}>?</Text>
            <Text style={fs.emptyHint}>Tap heroes →</Text>
          </View>
        )}
        <View style={[fs.nameTag, { backgroundColor: tint }]}>
          <Text style={fs.name} numberOfLines={1}>
            {star?.name ?? label}
          </Text>
        </View>
      </Pressable>

      <View style={fs.chips}>
        {Array.from({ length: MAX_SIDE }).map((_, i) => {
          const hero = roster[i];
          if (!hero) return <View key={i} style={[fs.chip, fs.chipEmpty]} />;
          const uri = hero.portrait_url ?? hero.image_url ?? undefined;
          return (
            <Pressable key={hero.id} onPress={() => onRemove(hero.id)} style={[fs.chip, { borderColor: tint }]}>
              {uri ? (
                <Image source={{ uri }} style={[StyleSheet.absoluteFill, flip ? fs.mirror : null]} contentFit="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
              )}
              <View style={fs.rm}>
                <Text style={fs.rmx}>×</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={fs.meta}>
        {publisher ? <Text style={fs.pub}>{publisher === 'dc' ? 'all-DC' : 'all-Marvel'}</Text> : null}
        {roster.length >= 2 ? <Text style={[fs.syn, { color: tint }]}>SYNERGY +{synergy}%</Text> : null}
      </View>

      <Pressable onPress={onRandom} style={fs.dice}>
        <Text style={fs.diceText}>🎲 Random</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  content: {
    flexGrow: 1,
    ...Platform.select({ web: { backgroundImage: SURFACE_GRADIENT.stageImmersive } as object, default: {} }),
    paddingTop: TOPBAR_HEIGHT + 22,
    paddingBottom: 40,
  } as object,

  header: { alignItems: 'center', marginBottom: 22 },
  eyebrow: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, letterSpacing: 4, textTransform: 'uppercase', color: COLORS.goldAccent, marginBottom: 6 },
  title: { fontFamily: 'Flame-Regular', fontSize: 28, color: COLORS.beige, textAlign: 'center' },

  arena: { flexDirection: 'row', gap: 22, maxWidth: 1320, width: '100%', alignSelf: 'center', alignItems: 'flex-start' },
  flankCol: { width: 232, alignItems: 'center' },
  poolCol: { flex: 1 },
  stack: { gap: 20, maxWidth: 760, width: '100%', alignSelf: 'center' },
  flanksRow: { flexDirection: 'row', justifyContent: 'center', gap: 24 },

  pool: { gap: 14 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, height: 46, gap: 9 },
  input: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.beige, outlineStyle: 'none' as unknown as undefined },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: 'rgba(245,235,220,0.5)', paddingVertical: 30, textAlign: 'center' },

  ctaWrap: { alignItems: 'center', paddingTop: 30 },
  fight: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.goldAccent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 34 },
  fightText: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#1a130a', letterSpacing: 0.5 },
  hint: { fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 2, color: 'rgba(245,235,220,0.5)', textTransform: 'uppercase' },
});

const fs = StyleSheet.create({
  flank: { alignItems: 'center', gap: 12, padding: 10, borderRadius: 20, borderWidth: 1.5, width: '100%' },
  idle: { borderColor: 'transparent' },
  render: { borderRadius: 16, overflow: 'hidden', borderWidth: 2, backgroundColor: '#16242b', alignItems: 'center', justifyContent: 'center' },
  mirror: { transform: [{ scaleX: -1 }] },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  emptyQ: { fontFamily: 'Flame-Regular', fontSize: 48, color: 'rgba(255,255,255,0.22)' },
  emptyHint: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' },
  nameTag: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 5, paddingHorizontal: 8 },
  name: { fontFamily: 'Flame-Regular', fontSize: 15, color: '#fff', textAlign: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5 },
  chip: { width: 34, height: 34, borderRadius: 8, overflow: 'hidden', borderWidth: 1, backgroundColor: '#1b2a30' },
  chipEmpty: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)', borderStyle: 'dashed', backgroundColor: 'transparent' },
  rm: { position: 'absolute', top: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(11,24,32,0.82)', alignItems: 'center', justifyContent: 'center' },
  rmx: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: '#fff', lineHeight: 11 },

  meta: { alignItems: 'center', gap: 3, minHeight: 14 },
  pub: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: COLORS.goldAccent, borderWidth: 1, borderColor: 'rgba(206,155,51,0.5)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  syn: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 0.3 },

  dice: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  diceText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(245,235,220,0.85)' },
});
