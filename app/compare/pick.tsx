import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useHeroSearchInfinite } from '../../src/lib/query/heroQueries';
import { OpponentCard } from '../../src/components/compare/OpponentCard';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';
import { VsBadge } from '../../src/components/compare/VsBadge';
import { BuilderSide } from '../../src/components/versus/BuilderSide';
import { FilterChips } from '../../src/components/versus/FilterChips';
import { PresetRail } from '../../src/components/versus/PresetRail';
import { useBattleBuilder } from '../../src/hooks/useBattleBuilder';
import { usePresetTeams } from '../../src/hooks/usePresetTeams';
import { FACTION_A, FACTION_B } from '../../src/components/versus/factionColors';
import { COLORS } from '../../src/constants/colors';
import { getTeamRoster } from '../../src/lib/db/teams';
import type { PickedHero } from '../../src/lib/battleBuilderState';
import type { PublisherFilter, AlignmentFilter } from '../../src/lib/db/heroes/types';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 16;
const GAP = 10;
const CARD_W = (SCREEN_W - H_PAD * 2 - GAP * 2) / 3;
const CARD_H = Math.round(CARD_W * 1.4);

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

export default function BattleBuilderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const b = useBattleBuilder();
  const { teams } = usePresetTeams();
  const [query, setQuery] = useState('');
  const [publisher, setPublisher] = useState<PublisherFilter>('All');
  const [alignment, setAlignment] = useState<AlignmentFilter>('All');
  const [focal, setFocal] = useState<PickedHero | null>(null);
  const [peek, setPeek] = useState<PeekHero | null>(null);
  const debounced = useDebounce(query, 200);

  const searchQ = useHeroSearchInfinite(debounced, publisher, alignment);
  const heroes = useMemo(
    () => (searchQ.data?.pages ?? []).flat().filter((h) => !b.isPlaced(h.id)).slice(0, 120),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- granular inputs, not the unstable `b`
    [searchQ.data, b.aHeroes, b.bHeroes, b.isPlaced],
  );

  const add = (hero: PickedHero) => {
    Haptics.selectionAsync();
    b.addToActive(hero);
    setFocal(hero);
  };
  const pickPreset = async (teamId: string) => {
    const roster = (await getTeamRoster(teamId, 5)) as PickedHero[];
    b.fillActive(roster);
    if (roster[0]) setFocal(roster[0]);
  };
  const randomFill = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const picks = pickRandom(heroes, 3);
    b.fillActive(picks);
    if (picks[0]) setFocal(picks[0]);
  };

  const activeTint = b.active === 'A' ? FACTION_A : FACTION_B;
  const activeRoster = b.active === 'A' ? b.aHeroes : b.bHeroes;
  const focalHero = focal ?? activeRoster[0] ?? null;
  const focalUri = focalHero?.portrait_url ?? focalHero?.image_url ?? undefined;

  const header = (
    <>
      <LinearGradient colors={['#1c2f5a', '#13203a', '#0c1526']} style={[styles.stage, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.eyebrow}>★ Build a Battle ★</Text>
        <Text style={styles.title}>Assemble Your Sides</Text>

        <View style={styles.focalRow}>
          <View style={[styles.focalCard, { borderColor: activeTint }]}>
            {focalUri ? (
              <Image source={{ uri: focalUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Text style={styles.focalQ}>?</Text>
            )}
          </View>
          <VsBadge size={40} variant="glass" />
          <Text style={styles.focalName} numberOfLines={1}>
            {focalHero?.name ?? 'Pick your fighters'}
          </Text>
        </View>

        {/* Segmented Side A | Side B */}
        <View style={styles.seg}>
          <Segment label="Side A" count={b.aHeroes.length} synergy={b.synergyA} tint={FACTION_A} active={b.active === 'A'} onPress={() => b.setActive('A')} />
          <Segment label="Side B" count={b.bHeroes.length} synergy={b.synergyB} tint={FACTION_B} active={b.active === 'B'} onPress={() => b.setActive('B')} />
        </View>

        {/* The active side's roster, detailed */}
        <BuilderSide
          label={b.active === 'A' ? 'Side A' : 'Side B'}
          tint={activeTint}
          roster={activeRoster}
          synergy={b.active === 'A' ? b.synergyA : b.synergyB}
          publisher={b.active === 'A' ? b.publisherA : b.publisherB}
          active
          flip={b.active === 'B'}
          anchorW={108}
          anchorH={135}
          slot={30}
          onActivate={() => {}}
          onRemove={b.removeHero}
        />
        <Pressable onPress={randomFill} style={styles.dice}>
          <Text style={styles.diceText}>🎲 Random fill</Text>
        </Pressable>
      </LinearGradient>

      <View style={styles.sheetTop}>
        <FilterChips publisher={publisher} alignment={alignment} onPublisher={setPublisher} onAlignment={setAlignment} />
        <PresetRail teams={teams} label={`→ ${b.active === 'A' ? 'Side A' : 'Side B'}`} tint={activeTint} onPick={pickPreset} />
        <View style={styles.searchRow}>
          <Ionicons name="search" size={17} color="rgba(41,60,67,0.4)" />
          <TextInput
            style={styles.input}
            placeholder="Search any hero or villain…"
            placeholderTextColor="rgba(41,60,67,0.38)"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
        </View>
        {heroes.length === 0 && !searchQ.isPending ? (
          <Text style={styles.empty}>No fighters match these filters.</Text>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <FlatList
        data={heroes}
        keyExtractor={(it) => it.id}
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 96 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        onEndReached={() => {
          if (searchQ.hasNextPage && !searchQ.isFetchingNextPage) searchQ.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <OpponentCard item={item} onPress={() => add(item)} onLongPress={() => setPeek(item)} width={CARD_W} height={CARD_H} />
        )}
      />

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable
          disabled={!b.canBattle || !b.battleHref}
          onPress={() => {
            if (b.battleHref) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(b.battleHref as Parameters<typeof router.push>[0]);
            }
          }}
          style={[styles.cta, !b.canBattle ? styles.ctaDim : null]}
        >
          <Text style={[styles.ctaTxt, !b.canBattle ? styles.ctaTxtDim : null]}>
            {b.canBattle ? `⚔ FIGHT · ${b.aHeroes.length} vs ${b.bHeroes.length} →` : 'Add at least one fighter to each side'}
          </Text>
        </Pressable>
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

function Segment({
  label,
  count,
  synergy,
  tint,
  active,
  onPress,
}: {
  label: string;
  count: number;
  synergy: number;
  tint: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.segBtn, active ? styles.segOn : null]}>
      <Text style={[styles.segLabel, { color: active ? tint : 'rgba(245,235,220,0.6)' }]}>
        {label} · {count}
      </Text>
      {count >= 2 ? <Text style={[styles.segSyn, { color: active ? tint : 'rgba(245,235,220,0.4)' }]}>+{synergy}%</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  stage: { paddingHorizontal: H_PAD, paddingBottom: 18, alignItems: 'center', gap: 12 },
  eyebrow: { fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: COLORS.goldAccent, marginBottom: 2 },
  title: { fontFamily: 'Flame-Regular', fontSize: 23, color: COLORS.beige, textAlign: 'center' },
  focalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  focalCard: { width: 66, height: 84, borderRadius: 12, overflow: 'hidden', borderWidth: 2, backgroundColor: '#16242b', alignItems: 'center', justifyContent: 'center' },
  focalQ: { fontFamily: 'Flame-Regular', fontSize: 30, color: 'rgba(255,255,255,0.3)' },
  focalName: { fontFamily: 'Flame-Regular', fontSize: 17, color: COLORS.beige, maxWidth: 150 },

  seg: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 3, gap: 3, alignSelf: 'stretch' },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 9, gap: 1 },
  segOn: { backgroundColor: 'rgba(206,155,51,0.12)', borderWidth: 1.5, borderColor: COLORS.goldAccent },
  segLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
  segSyn: { fontFamily: 'Nunito_700Bold', fontSize: 10 },

  dice: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  diceText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(245,235,220,0.85)' },

  sheetTop: { backgroundColor: COLORS.beige, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -14, paddingTop: 16, paddingHorizontal: H_PAD, gap: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(41,60,67,0.06)', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(41,60,67,0.12)', paddingHorizontal: 14, height: 46, gap: 9 },
  input: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: 'rgba(41,60,67,0.55)', paddingTop: 8 },

  listContent: { backgroundColor: COLORS.beige, flexGrow: 1 },
  gridRow: { gap: GAP, marginBottom: GAP, paddingHorizontal: H_PAD },
  ctaBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: H_PAD, paddingTop: 10, backgroundColor: 'rgba(11,24,32,0.92)' },
  cta: { backgroundColor: COLORS.goldAccent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ctaDim: { backgroundColor: 'rgba(255,255,255,0.12)' },
  ctaTxt: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#1a130a', letterSpacing: 0.5 },
  ctaTxtDim: { color: 'rgba(245,235,220,0.6)' },
});
