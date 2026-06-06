import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { rankResults } from '../../../src/lib/db/heroes';
import type { HeroSearchResult, HeroPowerResult } from '../../../src/lib/db/heroes';
import { usePickOpponents, type PickSubject } from '../../../src/hooks/usePickOpponents';
import { OpponentCard } from '../../../src/components/compare/OpponentCard';
import { VsAnchor, type AnchorPreview } from '../../../src/components/compare/VsAnchor';
import {
  stashFighters,
  getFighterArt,
  type FighterArt,
} from '../../../src/lib/compareHandoff';
import { withViewTransition } from '../../../src/lib/viewTransition';
import { COLORS } from '../../../src/constants/colors';

// Shared view-transition-names: the locked hero (A) and the chosen card (B)
// morph into the matching arena portraits.
const VT_HERO = 'vt-fighter-a';
const VT_PICK = 'vt-fighter-b';

const rosterGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
  gridAutoRows: '214px',
  gap: 14,
};

type RailItem = HeroSearchResult | HeroPowerResult;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Module-scope so a hover (preview) state change never remounts the rail. */
function Rail({
  label,
  items,
  group,
  morphKey,
  onPick,
  onHover,
  accent,
  tagline,
}: {
  label: string;
  items: RailItem[];
  group: string;
  morphKey: string | null;
  onPick: (key: string, item: RailItem) => void;
  onHover: (item: AnchorPreview | null) => void;
  accent?: boolean;
  tagline?: string;
}) {
  return (
    <View style={styles.section}>
      {accent ? (
        <View style={styles.rivalHead as object}>
          <Text style={styles.swords}>⚔</Text>
          <Text style={styles.rivalLabel}>{label}</Text>
          <View style={styles.rivalBar as object} />
        </View>
      ) : (
        <Text style={styles.sectionLabel}>{label}</Text>
      )}
      {accent && tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.railFade as object}
        contentContainerStyle={styles.railRow as object}
      >
        {items.map((item) => {
          const key = `${group}-${item.id}`;
          return (
            <OpponentCard
              key={item.id}
              item={item}
              onPress={() => onPick(key, item)}
              onHoverIn={() => onHover(item)}
              onHoverOut={() => onHover(null)}
              width={138}
              height={196}
              compact
              accent={accent}
              vtName={morphKey === key ? VT_PICK : undefined}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function WebPickOpponentScreen() {
  const { hero, name } = useLocalSearchParams<{ hero: string; name: string }>();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const { width } = useWindowDimensions();
  const wide = width >= 1024;

  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<AnchorPreview | null>(null);
  const [morphKey, setMorphKey] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 200);
  const { subject, rivals, sameUniverse, similar, all, loading } = usePickOpponents(
    hero ?? '',
    name,
  );

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  // Tag the locked hero + the clicked card with matching view-transition-names,
  // stash both portraits for the arena to paint instantly, then navigate inside
  // a view transition — the card morphs into the arena portrait.
  const pick = useCallback(
    (key: string, item: FighterArt) => {
      stashFighters(subject, {
        id: item.id,
        name: item.name,
        image_url: item.image_url,
        portrait_url: item.portrait_url,
      });
      // Commit the view-transition-name onto the clicked card synchronously so
      // it's in the "old" snapshot, then run the navigation inside the transition.
      flushSync(() => setMorphKey(key));
      withViewTransition(() => router.replace(`/compare/${hero}/${item.id}`));
    },
    [router, hero, subject],
  );
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(`/character/${hero}`);
  }, [router, hero]);
  const handleHover = useCallback(
    (item: AnchorPreview | null) => setPreview((p) => (item ? item : p?.id ? null : p)),
    [],
  );

  // Until the subject row resolves, fall back to the art the arena stashed on
  // its way here (the swap-back morph) so the locked portrait paints instantly
  // and the reverse view-transition has a real target to morph into.
  const handoffSubject: PickSubject | null = (() => {
    const art = getFighterArt(hero);
    if (!art) return null;
    return {
      id: hero,
      name: art.name ?? name ?? 'this hero',
      image_url: art.image_url ?? null,
      portrait_url: art.portrait_url ?? null,
    };
  })();
  const lockedSubject = subject ?? handoffSubject;
  const subjectName = lockedSubject?.name ?? name ?? 'this hero';
  const showSuggestions =
    !debouncedQuery.trim() && (rivals.length > 0 || sameUniverse.length > 0 || similar.length > 0);
  const displayed = debouncedQuery.trim()
    ? rankResults(all, debouncedQuery).slice(0, 120)
    : all.slice(0, 120);

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* ── Navy stage: the matchup, your fighter lit, the seat waiting ── */}
        <View style={[styles.stage, wide && styles.stageWide] as object}>
          <View style={styles.controls as object}>
            <Pressable
              onPress={goBack}
              accessibilityLabel="Go back"
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [styles.controlBtn, hovered && (styles.controlBtnHover as object)] as object
              }
            >
              <Ionicons name="arrow-back" size={15} color="rgba(245,235,220,0.75)" />
              <Text style={styles.controlText}>Back</Text>
            </Pressable>
          </View>

          <VsAnchor
            subject={lockedSubject}
            name={subjectName}
            preview={preview}
            tone="stage"
            morphName={VT_HERO}
          />

          <View style={styles.intent}>
            {preview ? (
              <Text style={styles.matchupLine}>
                {subjectName} <Text style={styles.matchupVs}>vs</Text> {preview.name}
              </Text>
            ) : (
              <Text style={styles.eyebrow}>Choose your challenger</Text>
            )}
          </View>
        </View>

        {/* ── Beige sheet: the roster, same surface as the arena scorecard ── */}
        <View style={styles.sheet}>
          <View style={[styles.sheetInner, wide && styles.sheetInnerWide] as object}>
            <View style={styles.searchWrap as object}>
              <Ionicons name="search" size={18} color="rgba(41,60,67,0.4)" />
              <TextInput
                ref={inputRef}
                style={styles.input as object}
                placeholder="Search any hero or villain…"
                placeholderTextColor="rgba(41,60,67,0.38)"
                value={query}
                onChangeText={setQuery}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color="rgba(41,60,67,0.4)" />
                </Pressable>
              )}
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={COLORS.orange} />
              </View>
            ) : (
              <>
                {showSuggestions && (
                  <View style={styles.sections}>
                    {rivals.length > 0 && (
                      <Rail
                        label="Rivalries"
                        items={rivals}
                        group="rivalries"
                        morphKey={morphKey}
                        onPick={pick}
                        onHover={handleHover}
                        accent
                        tagline="The grudge matches fans want to see."
                      />
                    )}
                    {sameUniverse.length > 0 && (
                      <Rail
                        label="Same Universe"
                        items={sameUniverse}
                        group="same"
                        morphKey={morphKey}
                        onPick={pick}
                        onHover={handleHover}
                      />
                    )}
                    {similar.length > 0 && (
                      <Rail
                        label="Similar Power"
                        items={similar}
                        group="similar"
                        morphKey={morphKey}
                        onPick={pick}
                        onHover={handleHover}
                      />
                    )}
                    <Text style={styles.sectionLabel}>All Heroes</Text>
                  </View>
                )}
                <View style={rosterGrid as object}>
                  {displayed.map((item) => {
                    const key = `grid-${item.id}`;
                    return (
                      <OpponentCard
                        key={item.id}
                        item={item}
                        onPress={() => pick(key, item)}
                        onHoverIn={() => handleHover(item)}
                        onHoverOut={() => handleHover(null)}
                        fill
                        vtName={morphKey === key ? VT_PICK : undefined}
                      />
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const SHEET_MAX = 1180;
const railFadeMask = 'linear-gradient(to right, #000 92%, transparent 100%)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  center: { paddingVertical: 80, alignItems: 'center', justifyContent: 'center' },

  // ── Navy stage ──
  stage: { backgroundColor: COLORS.navy, paddingBottom: 36, alignItems: 'center' },
  stageWide: { paddingBottom: 44 } as object,
  controls: {
    width: '100%',
    maxWidth: SHEET_MAX + 80,
    alignSelf: 'center',
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 10,
  } as object,
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(245,235,220,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.16)',
    cursor: 'pointer',
    transition: 'background-color 140ms ease',
  } as object,
  controlBtnHover: { backgroundColor: 'rgba(245,235,220,0.13)' } as object,
  controlText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: 'rgba(245,235,220,0.75)' },
  intent: { minHeight: 28, marginTop: 16, paddingHorizontal: 20, justifyContent: 'center' },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    textAlign: 'center',
  },
  matchupLine: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    textAlign: 'center',
  },
  matchupVs: { color: 'rgba(245,235,220,0.5)', fontSize: 14 },

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
    marginBottom: 34,
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

  sections: { marginBottom: 18 },
  section: { marginBottom: 6 },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(41,60,67,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 12,
  },
  railFade: { maskImage: railFadeMask, WebkitMaskImage: railFadeMask } as object,
  railRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 14,
    paddingRight: 8,
    paddingTop: 10,
    paddingBottom: 44,
  } as object,
  rivalHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 } as object,
  swords: { fontSize: 16, color: COLORS.gold },
  rivalLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.gold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
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
  },
});
