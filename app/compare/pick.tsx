import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useHeroSearchInfinite } from '../../src/lib/query/heroQueries';
import { OpponentCard } from '../../src/components/compare/OpponentCard';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';
import { RosterTray } from '../../src/components/versus/RosterTray';
import { TeammatesRail } from '../../src/components/versus/TeammatesRail';
import { useBattleBuilder } from '../../src/hooks/useBattleBuilder';
import { FACTION_A, FACTION_B } from '../../src/components/versus/factionColors';
import { COLORS } from '../../src/constants/colors';
import type { PickedHero } from '../../src/lib/battleBuilderState';

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

export default function BattleBuilderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const b = useBattleBuilder();
  const [query, setQuery] = useState('');
  const [peek, setPeek] = useState<PeekHero | null>(null);
  const debounced = useDebounce(query, 200);

  const searchQ = useHeroSearchInfinite(debounced, 'All', 'All');
  const heroes = useMemo(() => (searchQ.data?.pages ?? []).flat().slice(0, 120), [searchQ.data]);

  const add = (hero: PickedHero) => {
    Haptics.selectionAsync();
    b.addToActive(hero);
  };
  const activeLabel = b.active === 'A' ? 'Side A' : 'Side B';
  const activeCaptain = (b.active === 'A' ? b.aHeroes : b.bHeroes)[0];

  const header = (
    <>
      <View style={[styles.stage, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Build a Battle</Text>
        <RosterTray
          label="Side A"
          tint={FACTION_A}
          roster={b.aHeroes}
          synergy={b.synergyA}
          publisher={b.publisherA}
          active={b.active === 'A'}
          onActivate={() => b.setActive('A')}
          onRemove={b.removeHero}
        />
        <View style={{ height: 8 }} />
        <RosterTray
          label="Side B"
          tint={FACTION_B}
          roster={b.bHeroes}
          synergy={b.synergyB}
          publisher={b.publisherB}
          active={b.active === 'B'}
          onActivate={() => b.setActive('B')}
          onRemove={b.removeHero}
        />
      </View>

      <View style={styles.sheetTop}>
        {activeCaptain ? (
          <TeammatesRail
            captainName={activeCaptain.name}
            sideLabel={activeLabel}
            tint={b.active === 'A' ? FACTION_A : FACTION_B}
            items={b.teammates}
            onAdd={add}
          />
        ) : null}
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
            {b.canBattle ? `BATTLE · ${b.aHeroes.length} vs ${b.bHeroes.length} →` : 'Add a hero to each side'}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  stage: { backgroundColor: COLORS.navy, paddingHorizontal: H_PAD, paddingBottom: 16 },
  title: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.beige, marginBottom: 14 },
  sheetTop: { backgroundColor: COLORS.beige, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -8, paddingTop: 18, paddingHorizontal: H_PAD, gap: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(41,60,67,0.06)', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(41,60,67,0.12)', paddingHorizontal: 14, height: 46, gap: 9 },
  input: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },
  listContent: { backgroundColor: COLORS.beige, flexGrow: 1 },
  gridRow: { gap: GAP, marginBottom: GAP, paddingHorizontal: H_PAD },
  ctaBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: H_PAD, paddingTop: 10, backgroundColor: 'rgba(11,24,32,0.92)' },
  cta: { backgroundColor: COLORS.goldAccent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ctaDim: { backgroundColor: 'rgba(255,255,255,0.12)' },
  ctaTxt: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#1a130a', letterSpacing: 0.5 },
  ctaTxtDim: { color: 'rgba(245,235,220,0.6)' },
});
