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
import { useHeroSearchInfinite } from '../../src/lib/query/heroQueries';
import { OpponentCard } from '../../src/components/compare/OpponentCard';
import { VsBadge } from '../../src/components/compare/VsBadge';
import { ANCHOR_H } from '../../src/components/compare/FighterAnchor';
import { BuilderSide } from '../../src/components/versus/BuilderSide';
import { TeammatesRail } from '../../src/components/versus/TeammatesRail';
import { useBattleBuilder } from '../../src/hooks/useBattleBuilder';
import { FACTION_A, FACTION_B } from '../../src/components/versus/factionColors';
import { COLORS, SURFACE, SURFACE_GRADIENT } from '../../src/constants/colors';
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
  const isDesktop = width >= 768;
  const contentPad = width < 640 ? 16 : 32;
  const b = useBattleBuilder();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 200);

  const searchQ = useHeroSearchInfinite(debounced, 'All', 'All');
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
  const activeCaptain = (b.active === 'A' ? b.aHeroes : b.bHeroes)[0];

  const cols = width >= 1100 ? 6 : width >= 700 ? 5 : 3;
  const cardW = Math.floor((Math.min(width, 1100) - contentPad * 2 - (cols - 1) * 12) / cols);
  const anchorW = isDesktop ? 128 : Math.min(120, (width - contentPad * 2 - 78) / 2);
  const anchorH = isDesktop ? ANCHOR_H : Math.round(anchorW * 1.25);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* ── Navy stage: the matchup taking shape ── */}
      <View style={[s.stage, { paddingHorizontal: contentPad }]}>
        <View style={s.stageInner}>
          <Text style={s.eyebrow}>★ Build a Battle ★</Text>
          <Text style={s.title}>Assemble Your Sides</Text>
          <View style={s.matchup}>
            <View style={s.anchorRow}>
              <BuilderSide
                label="Side A"
                tint={FACTION_A}
                roster={b.aHeroes}
                synergy={b.synergyA}
                publisher={b.publisherA}
                active={b.active === 'A'}
                anchorW={anchorW}
                anchorH={anchorH}
                onActivate={() => b.setActive('A')}
                onRemove={b.removeHero}
              />
              <View style={[s.vsWrap, { height: anchorH }]}>
                <VsBadge size={48} variant="glass" />
              </View>
              <BuilderSide
                label="Side B"
                tint={FACTION_B}
                roster={b.bHeroes}
                synergy={b.synergyB}
                publisher={b.publisherB}
                active={b.active === 'B'}
                flip
                anchorW={anchorW}
                anchorH={anchorH}
                onActivate={() => b.setActive('B')}
                onRemove={b.removeHero}
              />
            </View>
          </View>

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
                BATTLE · {b.aHeroes.length} vs {b.bHeroes.length}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </Pressable>
          ) : (
            <Text style={s.hint}>Tap heroes to fill each side</Text>
          )}
        </View>
      </View>

      {/* ── Beige sheet: the roster ── */}
      <View style={s.sheet}>
        <View style={[s.sheetInner, { paddingHorizontal: contentPad }]}>
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

          {activeCaptain ? (
            <TeammatesRail
              captainName={activeCaptain.name}
              sideLabel={b.active === 'A' ? 'Side A' : 'Side B'}
              tint={b.active === 'A' ? FACTION_A : FACTION_B}
              items={b.teammates}
              onAdd={add}
            />
          ) : null}

          <View style={s.grid}>
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
    paddingBottom: 36,
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
    marginBottom: 22,
    textAlign: 'center',
  },
  matchup: { alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  anchorRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 18 },
  vsWrap: { justifyContent: 'center' },

  fight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.goldAccent,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 22,
  },
  fightText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#1a130a', letterSpacing: 0.5 },
  hint: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.goldAccent,
    textTransform: 'uppercase',
    marginTop: 22,
  },

  sheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -18,
    flex: 1,
  },
  sheetInner: { maxWidth: 1100, width: '100%', alignSelf: 'center', paddingTop: 22, gap: 16 },
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 40 },
});
