// app/compare/pick.web.tsx — Versus matchup builder. Two fighter slots (both
// empty to start); pick either from the roster, swap freely, then Fight. The
// roster reacts to the *other* chosen fighter (rivals / same universe). Shares
// the design language (FighterAnchor, OpponentCard) + view-transition morphs of
// the character-locked picker — only the flow differs.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { rankResults, type HeroSearchResult } from '../../src/lib/db/heroes';
import { usePickOpponents } from '../../src/hooks/usePickOpponents';
import { OpponentCard } from '../../src/components/compare/OpponentCard';
import { VsBadge } from '../../src/components/compare/VsBadge';
import { FighterAnchor, ANCHOR_H } from '../../src/components/compare/FighterAnchor';
import { stashFighters } from '../../src/lib/compareHandoff';
import { withViewTransition } from '../../src/lib/viewTransition';
import { COLORS } from '../../src/constants/colors';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { useWebDocumentScroll } from '../../src/hooks/useWebDocumentScroll';

type Fighter = Pick<HeroSearchResult, 'id' | 'name' | 'image_url' | 'portrait_url'>;
type Slot = 'a' | 'b';

const VT_A = 'vt-fighter-a';
const VT_B = 'vt-fighter-b';
const SHEET_MAX = 1180;
const railFadeMask = 'linear-gradient(to right, #000 92%, transparent 100%)';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function PickArena() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const wide = width >= 1024;
  const contentPad = width < 640 ? 16 : 32;
  const inputRef = useRef<TextInput>(null);

  // Document scroll so content bleeds edge-to-edge under the iOS Safari toolbar.
  useWebDocumentScroll(COLORS.beige);

  const [a, setA] = useState<Fighter | null>(null);
  const [b, setB] = useState<Fighter | null>(null);
  const [active, setActive] = useState<Slot>('a');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 200);

  // The roster reacts to the *other* slot — its rivals / same-universe lead.
  const contextId = active === 'a' ? b?.id ?? '' : a?.id ?? '';
  const contextName = active === 'a' ? b?.name : a?.name;
  const { rivals, sameUniverse, similar, all, loading } = usePickOpponents(contextId);

  const pickedIds = useMemo(
    () => new Set([a?.id, b?.id].filter(Boolean) as string[]),
    [a?.id, b?.id],
  );
  const exclude = useCallback(
    <T extends { id: string }>(list: T[]) => list.filter((h) => !pickedIds.has(h.id)),
    [pickedIds],
  );

  const q = debouncedQuery.trim();
  const showSuggestions =
    !q && !!contextId && (rivals.length > 0 || sameUniverse.length > 0 || similar.length > 0);
  const displayed = q
    ? rankResults(all, q).filter((h) => !pickedIds.has(h.id)).slice(0, 120)
    : exclude(all).slice(0, 120);

  const pick = useCallback(
    (hero: Fighter) => {
      withViewTransition(() => {
        if (active === 'a') {
          setA(hero);
          if (!b) setActive('b');
        } else {
          setB(hero);
          if (!a) setActive('a');
        }
        setQuery('');
      });
    },
    [active, a, b],
  );

  const ready = !!a && !!b;
  const fight = useCallback(() => {
    if (!a || !b) return;
    stashFighters(a, b);
    withViewTransition(() =>
      router.push(`/compare/${a.id}/${b.id}` as Parameters<typeof router.push>[0]),
    );
  }, [a, b, router]);

  const anchorW = isDesktop ? 128 : Math.min(124, (width - contentPad * 2 - 78) / 2);
  const anchorH = isDesktop ? ANCHOR_H : Math.round(anchorW * 1.25);
  const promptText = contextName
    ? `Pick a challenger for ${contextName}`
    : `Choose fighter ${active === 'a' ? 1 : 2}`;

  return (
    <View style={s.root}>
      <View style={[s.scroll, s.scrollContent] as object}>
        {/* ── Navy stage: the matchup taking shape ── */}
        <View style={[s.stage, { paddingHorizontal: contentPad }] as object}>
          <View style={s.stageInner}>
            {/* Anchors — shared FighterAnchor, both swappable, gold spotlight behind. */}
            <View style={s.matchup}>
              <View style={s.spotlight as object} pointerEvents="none" />
              <View style={s.anchorRow}>
                <FighterAnchor
                  fighter={a}
                  seatLabel="Fighter 1"
                  active={active === 'a'}
                  vtName={VT_A}
                  w={anchorW}
                  h={anchorH}
                  onPress={() => setActive('a')}
                  onClear={() =>
                    withViewTransition(() => {
                      setA(null);
                      setActive('a');
                    })
                  }
                />
                <View style={[s.vsWrap, { height: anchorH }] as object}>
                  <VsBadge size={48} variant="glass" />
                </View>
                <FighterAnchor
                  fighter={b}
                  seatLabel="Fighter 2"
                  active={active === 'b'}
                  vtName={VT_B}
                  flip
                  w={anchorW}
                  h={anchorH}
                  onPress={() => setActive('b')}
                  onClear={() =>
                    withViewTransition(() => {
                      setB(null);
                      setActive('b');
                    })
                  }
                />
              </View>
            </View>

            {ready ? (
              <Pressable
                onPress={fight}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [s.fight, hovered && (s.fightHover as object)] as object
                }
              >
                <Text style={s.fightText as object}>
                  {a!.name} vs {b!.name}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </Pressable>
            ) : (
              <Text style={s.chooseEyebrow as object}>
                {a || b ? 'Choose your challenger' : 'Choose your fighters'}
              </Text>
            )}
          </View>
        </View>

        {/* ── Beige sheet: the roster (overlaps the stage like the arena) ── */}
        <View style={s.sheet}>
          <View style={[s.sheetInner, wide && (s.sheetInnerWide as object)] as object}>
            <Pressable style={s.searchWrap as object} onPress={() => inputRef.current?.focus()}>
              <Ionicons name="search" size={18} color="rgba(41,60,67,0.4)" />
              <TextInput
                ref={inputRef}
                style={s.input as object}
                placeholder={
                  contextName ? `Search a rival for ${contextName}…` : 'Search any hero or villain…'
                }
                placeholderTextColor="rgba(41,60,67,0.38)"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color="rgba(41,60,67,0.4)" />
                </Pressable>
              )}
            </Pressable>

            <Text style={s.prompt as object}>{promptText}</Text>

            {showSuggestions && (
              <View style={s.sections}>
                {rivals.length > 0 && (
                  <View style={s.section}>
                    <View style={s.rivalHead as object}>
                      <Text style={s.swords as object}>⚔</Text>
                      <Text style={s.rivalLabel as object}>Rivalries</Text>
                      <View style={s.rivalBar as object} />
                    </View>
                    <Text style={s.tagline as object}>The grudge matches fans want to see.</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={s.railFade as object}
                      contentContainerStyle={s.railRow as object}
                    >
                      {exclude(rivals).map((item) => (
                        <OpponentCard
                          key={item.id}
                          item={item}
                          onPress={() => pick(item)}
                          width={138}
                          height={196}
                          accent
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}
                {sameUniverse.length > 0 && (
                  <View style={s.section}>
                    <Text style={s.sectionLabel as object}>Same Universe</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={s.railFade as object}
                      contentContainerStyle={s.railRow as object}
                    >
                      {exclude(sameUniverse).map((item) => (
                        <OpponentCard
                          key={item.id}
                          item={item}
                          onPress={() => pick(item)}
                          width={138}
                          height={196}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}
                <Text style={s.sectionLabel as object}>All Heroes</Text>
              </View>
            )}

            {loading ? (
              <Text style={s.muted as object}>Loading roster…</Text>
            ) : displayed.length === 0 ? (
              <Text style={s.muted as object}>No fighters found.</Text>
            ) : (
              <View style={s.grid as object}>
                {displayed.map((item) => (
                  <OpponentCard key={item.id} item={item} onPress={() => pick(item)} fill />
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 0 },

  // ── Navy stage ──
  stage: { backgroundColor: COLORS.navy, paddingTop: TOPBAR_HEIGHT + 18, paddingBottom: 38 },
  stageInner: { maxWidth: 760, width: '100%', alignSelf: 'center', alignItems: 'center' },

  matchup: { alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  spotlight: {
    position: 'absolute',
    top: -6,
    width: 520,
    height: 240,
    ...Platform.select({
      web: {
        backgroundImage:
          'radial-gradient(ellipse at center, rgba(206,155,51,0.22) 0%, rgba(206,155,51,0) 64%)',
      } as object,
      default: {},
    }),
  } as object,
  anchorRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 16 },
  vsWrap: { justifyContent: 'center' } as object,

  fight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 26,
    backgroundColor: COLORS.orange,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 30,
    cursor: 'pointer',
    transition: 'transform 150ms ease',
  } as object,
  fightHover: { transform: [{ translateY: -2 }] } as object,
  fightText: { fontFamily: 'Flame-Regular', fontSize: 16, color: '#fff', letterSpacing: 0.3 } as object,
  chooseEyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    color: COLORS.goldAccent,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginTop: 26,
  } as object,

  // ── Beige sheet (rounded, overlapping the stage like the arena) ──
  sheet: {
    flexGrow: 1,
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -16,
    paddingTop: 30,
  },
  sheetInner: {
    width: '100%',
    maxWidth: SHEET_MAX,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 90,
  },
  sheetInnerWide: { paddingHorizontal: 32 } as object,

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    marginBottom: 26,
    backgroundColor: 'rgba(41,60,67,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
    paddingHorizontal: 16,
    height: 52,
    gap: 10,
  } as object,
  input: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.navy,
    outlineStyle: 'none',
  } as object,

  prompt: { fontFamily: 'Flame-Regular', fontSize: 21, color: COLORS.navy, marginBottom: 18 } as object,

  sections: { marginBottom: 6 },
  section: { marginBottom: 6 },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(41,60,67,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 12,
  } as object,
  railFade: { maskImage: railFadeMask, WebkitMaskImage: railFadeMask } as object,
  railRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 14,
    paddingRight: 8,
    paddingTop: 6,
    paddingBottom: 30,
  } as object,
  rivalHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 } as object,
  swords: { fontSize: 16, color: COLORS.gold } as object,
  rivalLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.gold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  } as object,
  rivalBar: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundImage: 'linear-gradient(to right, rgba(176,125,0,0.5), rgba(176,125,0,0))',
  } as object,
  tagline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(41,60,67,0.55)',
    marginBottom: 12,
  } as object,

  muted: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(41,60,67,0.5)',
    textAlign: 'center',
    paddingVertical: 40,
  } as object,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gridAutoRows: '198px',
    gap: 14,
  } as object,
});
