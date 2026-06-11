// app/compare/pick.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useHeroSearchInfinite } from '../../src/lib/query/heroQueries';
import { OpponentCard } from '../../src/components/compare/OpponentCard';
import { CardSkeleton } from '../../src/components/compare/CardSkeleton';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';
import { COLORS } from '../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GRID_GAP = 12;
const CARD_W = (SCREEN_WIDTH - H_PAD * 2 - GRID_GAP) / 2;
const CARD_H = Math.round(CARD_W * 1.4);

const headerOptions = {
  headerShown: true,
  headerTitle: '',
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

function PickSkeleton() {
  return (
    <View style={styles.skelGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} width={CARD_W} height={CARD_H} />
      ))}
    </View>
  );
}

export default function PickFirstFighterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const headerHeight = insets.top + (Platform.OS === 'ios' ? 44 : 56);

  const [query, setQuery] = useState('');
  const [peek, setPeek] = useState<PeekHero | null>(null);
  const debouncedQuery = useDebounce(query, 200);

  const searchQ = useHeroSearchInfinite(debouncedQuery, 'All', 'All');
  const heroes = useMemo(
    () => (searchQ.data?.pages ?? []).flat().slice(0, 120),
    [searchQ.data],
  );
  const loading = searchQ.isPending;

  const handlePick = (id: string, name: string) => {
    Haptics.selectionAsync();
    router.push(`/compare/${id}/pick?name=${encodeURIComponent(name)}`);
  };

  const header = (
    <>
      <View style={[styles.stage, { paddingTop: headerHeight + 12 }]}>
        <Text style={styles.eyebrow}>Choose your first fighter</Text>
        <Text style={styles.title}>Who's in the ring?</Text>
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
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={19} color="rgba(41,60,67,0.4)" />
            </Pressable>
          )}
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={headerOptions} />
      <StatusBar style="light" />
      <FlatList
        style={styles.list}
        data={loading ? [] : heroes}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <PickSkeleton />
          ) : (
            <Text style={styles.empty}>No heroes found</Text>
          )
        }
        onEndReached={() => {
          if (searchQ.hasNextPage && !searchQ.isFetchingNextPage) searchQ.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <OpponentCard
            item={item}
            onPress={() => handlePick(item.id, item.name)}
            onLongPress={() => setPeek(item)}
            width={CARD_W}
            height={CARD_H}
          />
        )}
      />

      {peek && (
        <HeroPeek
          hero={peek}
          onClose={() => setPeek(null)}
          onFight={() => {
            const { id, name } = peek;
            setPeek(null);
            handlePick(id, name);
          }}
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

  stage: { backgroundColor: COLORS.navy, paddingBottom: 34, paddingHorizontal: H_PAD },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 6,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 30, color: COLORS.beige },

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
  skelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: H_PAD,
  },
  empty: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: 'rgba(41,60,67,0.6)',
    textAlign: 'center',
    paddingTop: 40,
  },
});
