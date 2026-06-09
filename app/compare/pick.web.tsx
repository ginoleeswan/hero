// app/compare/pick.web.tsx — Versus matchup builder. Two fighter slots (both
// empty to start), pick either from the roster below, swap freely, then Fight.
// The character → Compare flow still uses /compare/[hero]/pick (one locked).
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/colors';
import { heroImageSource } from '../../src/constants/heroImages';
import { searchHeroes, getSearchIdleHeroes, type HeroSearchResult } from '../../src/lib/db/heroes';
import { TOPBAR_HEIGHT } from '../../src/components/web/NavVariants';
import { VsBadge } from '../../src/components/compare/VsBadge';

type Fighter = HeroSearchResult;
type Slot = 'a' | 'b';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── A single fighter slot — empty placeholder or filled portrait card ──────────
function FighterSlot({
  fighter,
  active,
  label,
  size,
  onSelect,
  onClear,
}: {
  fighter: Fighter | null;
  active: boolean;
  label: string;
  size: number;
  onSelect: () => void;
  onClear: () => void;
}) {
  const source = fighter
    ? heroImageSource(String(fighter.id), fighter.image_url, fighter.portrait_url)
    : null;
  return (
    <Pressable
      onPress={onSelect}
      style={
        [s.slot, { width: size, height: size * 1.32 }, active && (s.slotActive as object)] as object
      }
    >
      {fighter && source ? (
        <>
          <Image
            source={source}
            contentFit="cover"
            contentPosition="top"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object}
            cachePolicy="memory-disk"
            recyclingKey={String(fighter.id)}
            transition={160}
          />
          <View style={s.slotOverlay as object} />
          <Pressable aria-label="Remove" onPress={onClear} style={s.slotClear as object}>
            <Ionicons name="close" size={16} color={COLORS.beige} />
          </Pressable>
          <Text style={s.slotName as object} numberOfLines={1}>
            {fighter.name}
          </Text>
        </>
      ) : (
        <View style={s.slotEmpty}>
          <View style={s.slotPlus as object}>
            <Ionicons name="add" size={26} color="rgba(245,235,220,0.5)" />
          </View>
          <Text style={s.slotEmptyText as object}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ── Roster result card ─────────────────────────────────────────────────────────
function RosterCard({ hero, onPick }: { hero: Fighter; onPick: () => void }) {
  const source = heroImageSource(String(hero.id), hero.image_url, hero.portrait_url);
  return (
    <Pressable
      onPress={onPick}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [rc.card, hovered && (rc.cardHover as object)] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object}
        cachePolicy="memory-disk"
        recyclingKey={String(hero.id)}
        transition={160}
      />
      <View style={rc.overlay as object} />
      <Text style={rc.name as object} numberOfLines={1}>
        {hero.name}
      </Text>
    </Pressable>
  );
}

export default function PickArena() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const contentPad = width < 640 ? 16 : 32;

  const [a, setA] = useState<Fighter | null>(null);
  const [b, setB] = useState<Fighter | null>(null);
  const [active, setActive] = useState<Slot>('a');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Fighter[]>([]);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = debouncedQuery.trim();
    const p = q ? searchHeroes(q, 'All', 48) : getSearchIdleHeroes(36);
    p.then((r) => !cancelled && setResults(r))
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const pick = (hero: Fighter) => {
    if (active === 'a') {
      setA(hero);
      if (!b) setActive('b'); // auto-advance to the still-empty slot
    } else {
      setB(hero);
      if (!a) setActive('a');
    }
  };

  const ready = !!a && !!b;
  const fight = () => {
    if (a && b) router.push(`/compare/${a.id}/${b.id}` as Parameters<typeof router.push>[0]);
  };

  const slotSize = isDesktop ? 150 : Math.min(132, (width - contentPad * 2 - 72) / 2);

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* ── Navy stage: the matchup taking shape ── */}
        <View style={[s.stage, { paddingHorizontal: contentPad }] as object}>
          <View style={s.stageInner}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [s.backBtn, hovered && (s.backBtnHover as object)] as object
              }
            >
              <Ionicons name="arrow-back" size={15} color="rgba(245,235,220,0.6)" />
              <Text style={s.backText as object}>Back</Text>
            </Pressable>

            <Text style={s.eyebrow as object}>Build a Matchup</Text>
            <Text style={s.title as object}>Versus</Text>

            <View style={s.slots}>
              <FighterSlot
                fighter={a}
                active={active === 'a'}
                label="Fighter 1"
                size={slotSize}
                onSelect={() => setActive('a')}
                onClear={() => {
                  setA(null);
                  setActive('a');
                }}
              />
              <VsBadge size={isDesktop ? 52 : 42} variant="solid" />
              <FighterSlot
                fighter={b}
                active={active === 'b'}
                label="Fighter 2"
                size={slotSize}
                onSelect={() => setActive('b')}
                onClear={() => {
                  setB(null);
                  setActive('b');
                }}
              />
            </View>

            <Pressable
              onPress={fight}
              disabled={!ready}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [
                  s.fight,
                  !ready && (s.fightDisabled as object),
                  ready && hovered && (s.fightHover as object),
                ] as object
              }
            >
              <Text style={[s.fightText, !ready && (s.fightTextDisabled as object)] as object}>
                {ready ? `${a!.name} vs ${b!.name}` : 'Pick two fighters'}
              </Text>
              {ready && <Ionicons name="arrow-forward" size={16} color="#fff" />}
            </Pressable>
          </View>
        </View>

        {/* ── Beige sheet: the roster ── */}
        <View style={[s.sheet, { paddingHorizontal: contentPad }] as object}>
          <View style={s.sheetInner}>
            <Text style={s.prompt as object}>
              {active === 'a' ? 'Choose fighter 1' : 'Choose fighter 2'}
            </Text>
            <Pressable style={s.searchWrap as object} onPress={() => inputRef.current?.focus()}>
              <Ionicons name="search" size={18} color="rgba(41,60,67,0.4)" />
              <TextInput
                ref={inputRef}
                style={s.input as object}
                placeholder="Search any hero or villain…"
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

            {loading ? (
              <Text style={s.muted as object}>Loading…</Text>
            ) : results.length === 0 ? (
              <Text style={s.muted as object}>No fighters found.</Text>
            ) : (
              <View style={s.grid as object}>
                {results.map((h) => (
                  <RosterCard key={h.id} hero={h} onPick={() => pick(h)} />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },

  // ── Navy stage ──
  stage: { backgroundColor: COLORS.navy, paddingTop: TOPBAR_HEIGHT + 16, paddingBottom: 36 },
  stageInner: { maxWidth: 760, width: '100%', alignSelf: 'center', alignItems: 'center' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  backBtnHover: { opacity: 0.55 } as object,
  backText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  } as object,
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 14,
  } as object,
  title: { fontFamily: 'Flame-Regular', fontSize: 38, color: COLORS.beige, marginTop: 2 },

  slots: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 24 },
  slot: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,235,220,0.05)',
    borderWidth: 2,
    borderColor: 'rgba(245,235,220,0.12)',
    cursor: 'pointer',
    transition: 'border-color 160ms ease',
  } as object,
  slotActive: { borderColor: COLORS.orange } as object,
  slotOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(11,24,32,0.92) 0%, rgba(11,24,32,0.05) 55%, transparent 100%)',
  } as object,
  slotClear: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(11,24,32,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } as object,
  slotName: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.beige,
    textShadow: '0 1px 6px rgba(0,0,0,0.8)',
  } as object,
  slotEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  slotPlus: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'rgba(245,235,220,0.18)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  } as object,
  slotEmptyText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.5)',
    letterSpacing: 0.3,
  } as object,

  fight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 26,
    backgroundColor: COLORS.orange,
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 30,
    cursor: 'pointer',
    transition: 'transform 150ms ease, opacity 150ms ease',
  } as object,
  fightHover: { transform: [{ translateY: -2 }] } as object,
  fightDisabled: { backgroundColor: 'rgba(245,235,220,0.1)', cursor: 'default' } as object,
  fightText: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.3,
  } as object,
  fightTextDisabled: { color: 'rgba(245,235,220,0.4)' } as object,

  // ── Beige roster sheet ──
  sheet: { paddingTop: 26 },
  sheetInner: { maxWidth: 1080, width: '100%', alignSelf: 'center' },
  prompt: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
    marginBottom: 14,
  } as object,
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(41,60,67,0.06)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 22,
  } as object,
  input: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.navy,
    outlineStyle: 'none',
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
    gridAutoRows: '188px',
    gap: 14,
  } as object,
});

const rc = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 180ms ease, box-shadow 180ms ease',
  } as object,
  cardHover: {
    transform: [{ translateY: -5 }],
    boxShadow: '0 16px 40px rgba(0,0,0,0.32)',
  } as object,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.95) 0%, rgba(29,45,51,0.05) 55%, transparent 100%)',
  } as object,
  name: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.beige,
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
  } as object,
});
