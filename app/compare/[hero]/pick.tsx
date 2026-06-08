import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { rankResults } from '../../../src/lib/db/heroes';
import { usePickOpponents } from '../../../src/hooks/usePickOpponents';
import { OpponentCard } from '../../../src/components/compare/OpponentCard';
import { CardSkeleton } from '../../../src/components/compare/CardSkeleton';
import { VsAnchor } from '../../../src/components/compare/VsAnchor';
import { AccentRail } from '../../../src/components/search/AccentRail';
import { HeroPeek, type PeekHero } from '../../../src/components/compare/HeroPeek';
import { stashFighters } from '../../../src/lib/compareHandoff';
import { COLORS } from '../../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GRID_GAP = 12;
const CARD_W = (SCREEN_WIDTH - H_PAD * 2 - GRID_GAP) / 2;
const CARD_H = Math.round(CARD_W * 1.4);
const RAIL_W = 116;
const RAIL_H = 158;

const headerOptions = {
  headerShown: true,
  headerTitle: '',
  // Transparent so the navy stage reads as one continuous surface — matches the
  // arena; no opaque header bar appearing over the content on scroll.
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerTintColor: COLORS.beige,
  headerBackButtonDisplayMode: 'minimal',
} as const;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Skeleton screen for the initial roster load — mirrors a suggestion rail plus
 *  the grid so content swaps in place instead of jumping in after a spinner. */
function PickSkeleton() {
  return (
    <View style={styles.skelWrap}>
      <View style={[styles.skelLabel, { width: 110 }]} />
      <View style={styles.skelRail}>
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} width={RAIL_W} height={RAIL_H} />
        ))}
      </View>
      <View style={[styles.skelLabel, { width: 80, marginTop: 4 }]} />
      <View style={styles.skelGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} width={CARD_W} height={CARD_H} />
        ))}
      </View>
    </View>
  );
}

export default function PickOpponentScreen() {
  const { hero, name } = useLocalSearchParams<{ hero: string; name: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  // The header floats (transparent), so pad the navy stage down to clear it —
  // plus a little extra so the VsAnchor's gold glow isn't clipped.
  const headerHeight = insets.top + (Platform.OS === 'ios' ? 44 : 56);

  const [query, setQuery] = useState('');
  const [peek, setPeek] = useState<PeekHero | null>(null);
  const debouncedQuery = useDebounce(query, 200);
  const { subject, rivals, sameUniverse, similar, all, loading } = usePickOpponents(
    hero ?? '',
    name,
  );

  const displayed = debouncedQuery.trim()
    ? rankResults(all, debouncedQuery).slice(0, 80)
    : all.slice(0, 80);

  const handlePick = (id: string) => {
    Haptics.selectionAsync();
    // Stash both fighters' art so the arena paints portraits instantly (no
    // blank navy gap) and its slide-in entrance plays over real images.
    const picked = [...rivals, ...sameUniverse, ...similar, ...all].find((h) => h.id === id);
    stashFighters(subject, picked);
    router.replace(`/compare/${hero}/${id}`);
  };

  const openPeek = (item: PeekHero) => {
    Haptics.selectionAsync();
    setPeek(item);
  };

  const showSuggestions =
    !debouncedQuery.trim() && (rivals.length > 0 || sameUniverse.length > 0 || similar.length > 0);

  const header = (
    <>
      <View style={[styles.stage, { paddingTop: headerHeight + 12 }]}>
        <VsAnchor subject={subject} name={name ?? 'this hero'} tone="stage" />
        <View style={styles.intent}>
          <Text style={styles.eyebrow}>Choose your challenger</Text>
        </View>
      </View>

      <View style={styles.sheetTop}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={17} color="rgba(41,60,67,0.4)" />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search any hero or villain…"
            placeholderTextColor="rgba(41,60,67,0.38)"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={19} color="rgba(41,60,67,0.4)" />
            </Pressable>
          )}
        </View>

        {!loading && showSuggestions && (
          <>
            {rivals.length > 0 && (
              <AccentRail
                label="Rivalries"
                items={rivals}
                onPick={handlePick}
                onPeek={openPeek}
                accent
                tagline="The grudge matches fans want to see."
              />
            )}
            {sameUniverse.length > 0 && (
              <AccentRail label="Same Universe" items={sameUniverse} onPick={handlePick} onPeek={openPeek} />
            )}
            {similar.length > 0 && (
              <AccentRail label="Similar Power" items={similar} onPick={handlePick} onPeek={openPeek} />
            )}
            <Text style={[styles.sectionLabel, styles.allLabel]}>All Heroes</Text>
          </>
        )}
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={headerOptions} />
      <StatusBar style="light" />
      <FlatList
        style={styles.list}
        data={loading ? [] : displayed}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? <PickSkeleton /> : null}
        renderItem={({ item }) => (
          <OpponentCard
            item={item}
            onPress={() => handlePick(item.id)}
            onLongPress={() => openPeek(item)}
            width={CARD_W}
            height={CARD_H}
          />
        )}
      />

      {peek && (
        <HeroPeek
          hero={peek}
          subjectName={subject?.name ?? name}
          onClose={() => setPeek(null)}
          onFight={() => handlePick(peek.id)}
          onViewProfile={() => {
            setPeek(null);
            router.push(`/character/${peek.id}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  list: { flex: 1, backgroundColor: COLORS.navy },
  listContent: { backgroundColor: COLORS.beige, flexGrow: 1 },

  // Loading skeleton
  skelWrap: { paddingHorizontal: H_PAD, paddingTop: 4 },
  skelLabel: {
    height: 11,
    borderRadius: 4,
    backgroundColor: 'rgba(41,60,67,0.12)',
    marginBottom: 14,
  },
  skelRail: {
    flexDirection: 'row',
    gap: 11,
    marginHorizontal: -H_PAD,
    paddingHorizontal: H_PAD,
    marginBottom: 22,
    overflow: 'hidden',
  },
  skelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },

  // Navy stage — top padding is applied inline (header height + glow room).
  stage: { backgroundColor: COLORS.navy, paddingBottom: 34 },
  intent: { minHeight: 22, marginTop: 14, alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
  },

  // Beige sheet
  sheetTop: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    paddingTop: 22,
    paddingHorizontal: H_PAD,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(41,60,67,0.06)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(41,60,67,0.12)',
    paddingHorizontal: 14,
    height: 46,
    gap: 9,
    marginBottom: 22,
  },
  input: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },

  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP, paddingHorizontal: H_PAD },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(41,60,67,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 11,
  },
  allLabel: { marginTop: 2, marginBottom: 2 },
});
