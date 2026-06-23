import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHeroSearchInfinite } from '../../src/lib/query/heroQueries';
import { OpponentCard } from '../../src/components/compare/OpponentCard';
import { RosterTray } from '../../src/components/versus/RosterTray';
import { TeammatesRail } from '../../src/components/versus/TeammatesRail';
import { useBattleBuilder } from '../../src/hooks/useBattleBuilder';
import { FACTION_A, FACTION_B } from '../../src/components/versus/factionColors';
import { COLORS, SURFACE } from '../../src/constants/colors';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { withViewTransition } from '../../src/lib/viewTransition';
import type { PickedHero } from '../../src/lib/battleBuilderState';

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export default function BattleBuilderWeb() {
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 6 : width >= 700 ? 5 : 3;
  const b = useBattleBuilder();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 200);

  const searchQ = useHeroSearchInfinite(debounced, 'All', 'All');
  const heroes = useMemo(() => (searchQ.data?.pages ?? []).flat().slice(0, 120), [searchQ.data]);

  const add = (hero: PickedHero) => b.addToActive(hero);
  const activeCaptain = (b.active === 'A' ? b.aHeroes : b.bHeroes)[0];
  const cardW = Math.floor((Math.min(width, 1100) - 64 - (cols - 1) * 12) / cols);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: TOPBAR_HEIGHT + 20 }]}
    >
      <View style={styles.band}>
        <View style={styles.trays}>
          <View style={styles.trayCell}>
            <RosterTray
              label="Side A"
              tint={FACTION_A}
              roster={b.aHeroes}
              synergy={b.synergyA}
              publisher={b.publisherA}
              active={b.active === 'A'}
              onActivate={() => b.setActive('A')}
              onRemove={b.removeHero}
              slot={46}
            />
          </View>
          <Text style={styles.vs}>VS</Text>
          <View style={styles.trayCell}>
            <RosterTray
              label="Side B"
              tint={FACTION_B}
              roster={b.bHeroes}
              synergy={b.synergyB}
              publisher={b.publisherB}
              active={b.active === 'B'}
              onActivate={() => b.setActive('B')}
              onRemove={b.removeHero}
              slot={46}
            />
          </View>
        </View>
      </View>

      <View style={styles.sheet}>
        {activeCaptain ? (
          <TeammatesRail
            captainName={activeCaptain.name}
            sideLabel={b.active === 'A' ? 'Side A' : 'Side B'}
            tint={b.active === 'A' ? FACTION_A : FACTION_B}
            items={b.teammates}
            onAdd={add}
          />
        ) : null}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color="rgba(41,60,67,0.4)" />
          <TextInput
            style={styles.input}
            placeholder="Search any hero or villain…"
            placeholderTextColor="rgba(41,60,67,0.38)"
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <View style={styles.grid}>
          {heroes.map((item) => (
            <OpponentCard
              key={item.id}
              item={item}
              onPress={() => add(item)}
              width={cardW}
              height={Math.round(cardW * 1.4)}
            />
          ))}
        </View>
        <View style={styles.ctaWrap}>
          <Pressable
            disabled={!b.canBattle || !b.battleHref}
            onPress={() => {
              if (b.battleHref)
                withViewTransition(() =>
                  router.push(b.battleHref as Parameters<typeof router.push>[0]),
                );
            }}
            style={[styles.cta, !b.canBattle ? styles.ctaDim : null]}
          >
            <Text style={[styles.ctaTxt, !b.canBattle ? styles.ctaTxtDim : null]}>
              {b.canBattle
                ? `BATTLE · ${b.aHeroes.length} vs ${b.bHeroes.length} →`
                : 'Add a hero to each side'}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  content: { flexGrow: 1 },
  band: { backgroundColor: COLORS.deepNavy, paddingHorizontal: 32, paddingBottom: 22 },
  trays: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  trayCell: { flex: 1, maxWidth: 380 },
  vs: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.goldAccent },
  sheet: {
    backgroundColor: COLORS.beige,
    paddingHorizontal: 32,
    paddingTop: 20,
    gap: 14,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  searchRow: {
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  ctaWrap: { alignItems: 'center', paddingVertical: 24 },
  cta: {
    backgroundColor: COLORS.goldAccent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
    minWidth: 300,
  },
  ctaDim: { backgroundColor: 'rgba(41,60,67,0.12)' },
  ctaTxt: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: '#1a130a',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  ctaTxtDim: { color: 'rgba(41,60,67,0.5)' },
});
