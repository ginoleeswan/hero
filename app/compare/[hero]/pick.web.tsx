import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { rankResults } from '../../../src/lib/db/heroes';
import type { HeroSearchResult, HeroPowerResult } from '../../../src/lib/db/heroes';
import { usePickOpponents } from '../../../src/hooks/usePickOpponents';
import { OpponentCard } from '../../../src/components/compare/OpponentCard';
import { VsAnchor, type AnchorPreview } from '../../../src/components/compare/VsAnchor';
import { COLORS } from '../../../src/constants/colors';

const rosterGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gridAutoRows: '210px',
  gap: 12,
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
  onPick,
  onHover,
  accent,
  tagline,
}: {
  label: string;
  items: RailItem[];
  onPick: (id: string) => void;
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
        {items.map((item) => (
          <OpponentCard
            key={item.id}
            item={item}
            onPress={() => onPick(item.id)}
            onHoverIn={() => onHover(item)}
            onHoverOut={() => onHover(null)}
            width={132}
            height={188}
            compact
            accent={accent}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function WebPickOpponentScreen() {
  const { hero, name } = useLocalSearchParams<{ hero: string; name: string }>();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<AnchorPreview | null>(null);
  const debouncedQuery = useDebounce(query, 200);
  const { subject, rivals, sameUniverse, similar, all, loading } = usePickOpponents(
    hero ?? '',
    name,
  );

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const handlePick = useCallback(
    (id: string) => router.replace(`/compare/${hero}/${id}`),
    [router, hero],
  );
  const handleHover = useCallback(
    (item: AnchorPreview | null) => setPreview((p) => (item ? item : p?.id ? null : p)),
    [],
  );

  const showSuggestions =
    !debouncedQuery.trim() && (rivals.length > 0 || sameUniverse.length > 0 || similar.length > 0);
  const displayed = debouncedQuery.trim()
    ? rankResults(all, debouncedQuery).slice(0, 120)
    : all.slice(0, 120);

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content as object}>
        <Pressable
          onPress={() => router.back()}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [styles.backBtn, hovered && (styles.backBtnHover as object)] as object
          }
        >
          <Ionicons name="chevron-back" size={16} color={COLORS.navy} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <VsAnchor subject={subject} name={name ?? 'this hero'} preview={preview} />

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
                    onPick={handlePick}
                    onHover={handleHover}
                    accent
                    tagline="The grudge matches fans want to see."
                  />
                )}
                {sameUniverse.length > 0 && (
                  <Rail
                    label="Same Universe"
                    items={sameUniverse}
                    onPick={handlePick}
                    onHover={handleHover}
                  />
                )}
                {similar.length > 0 && (
                  <Rail
                    label="Similar Power"
                    items={similar}
                    onPick={handlePick}
                    onHover={handleHover}
                  />
                )}
                <Text style={styles.sectionLabel}>All Heroes</Text>
              </View>
            )}
            <View style={rosterGrid as object}>
              {displayed.map((item) => (
                <OpponentCard
                  key={item.id}
                  item={item}
                  onPress={() => handlePick(item.id)}
                  onHoverIn={() => handleHover(item)}
                  onHoverOut={() => handleHover(null)}
                  fill
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const CONTENT_MAX = 1100;
const GUTTER = 24;
// Soft right-edge fade so the last card reads as "scroll for more" rather than a
// hard cut — the rail stays aligned with the centred content on both sides.
const railFadeMask = 'linear-gradient(to right, #000 90%, transparent 100%)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  center: { paddingVertical: 80, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: {
    maxWidth: CONTENT_MAX,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: GUTTER,
    paddingTop: 20,
    paddingBottom: 80,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(41,60,67,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
    cursor: 'pointer',
    marginBottom: 16,
    transition: 'background-color 140ms ease',
  } as object,
  backBtnHover: { backgroundColor: 'rgba(41,60,67,0.12)' } as object,
  backText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 540,
    marginTop: 24,
    marginBottom: 36,
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
    gap: 12,
    paddingRight: 8,
    // Vertical room so the hover lift + drop shadow aren't clipped by the rail.
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
