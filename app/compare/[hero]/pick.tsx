import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { rankResults } from '../../../src/lib/db/heroes';
import { usePickOpponents } from '../../../src/hooks/usePickOpponents';
import { OpponentCard } from '../../../src/components/compare/OpponentCard';
import { VsAnchor } from '../../../src/components/compare/VsAnchor';
import { COLORS } from '../../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GRID_GAP = 12;
const CARD_W = (SCREEN_WIDTH - H_PAD * 2 - GRID_GAP) / 2;
const CARD_H = Math.round(CARD_W * 1.4);
const RAIL_W = 116;
const RAIL_H = 158;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function Rail({
  label,
  items,
  onPick,
  accent,
  tagline,
}: {
  label: string;
  items: { id: string; name: string; image_url?: string | null; portrait_url?: string | null }[];
  onPick: (id: string) => void;
  accent?: boolean;
  tagline?: string;
}) {
  return (
    <View style={styles.section}>
      {accent ? (
        <View style={styles.rivalHead}>
          <Text style={styles.swords}>⚔</Text>
          <Text style={styles.rivalLabel}>{label}</Text>
          <View style={styles.rivalBar} />
        </View>
      ) : (
        <Text style={styles.sectionLabel}>{label}</Text>
      )}
      {accent && tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railRow}
      >
        {items.map((item) => (
          <OpponentCard
            key={item.id}
            item={item}
            onPress={() => onPick(item.id)}
            width={RAIL_W}
            height={RAIL_H}
            compact
            accent={accent}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function PickOpponentScreen() {
  const { hero, name } = useLocalSearchParams<{ hero: string; name: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
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
    router.replace(`/compare/${hero}/${id}`);
  };

  const showSuggestions =
    !debouncedQuery.trim() && (rivals.length > 0 || sameUniverse.length > 0 || similar.length > 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.navy} />
        </Pressable>
        <VsAnchor subject={subject} name={name ?? 'this hero'} />
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
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.orange} />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={{
            paddingHorizontal: H_PAD,
            paddingBottom: insets.bottom + 20,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            showSuggestions ? (
              <View>
                {rivals.length > 0 && (
                  <Rail
                    label="Rivalries"
                    items={rivals}
                    onPick={handlePick}
                    accent
                    tagline="The grudge matches fans want to see."
                  />
                )}
                {sameUniverse.length > 0 && (
                  <Rail label="Same Universe" items={sameUniverse} onPick={handlePick} />
                )}
                {similar.length > 0 && (
                  <Rail label="Similar Power" items={similar} onPick={handlePick} />
                )}
                <Text style={[styles.sectionLabel, styles.allLabel]}>All Heroes</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <OpponentCard
              item={item}
              onPress={() => handlePick(item.id)}
              width={CARD_W}
              height={CARD_H}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 6, paddingBottom: 18 },
  backBtn: {
    position: 'absolute',
    top: 4,
    left: 12,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(41,60,67,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(41,60,67,0.14)',
  },
  backBtnPressed: { backgroundColor: 'rgba(41,60,67,0.12)' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: H_PAD,
    marginTop: 18,
    backgroundColor: 'rgba(41,60,67,0.06)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(41,60,67,0.12)',
    paddingHorizontal: 14,
    height: 46,
    gap: 9,
  },
  input: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  section: { marginBottom: 18 },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(41,60,67,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 11,
  },
  allLabel: { marginTop: 2 },
  // paddingVertical gives the rival ring + press feedback room inside the rail.
  railRow: { gap: 11, paddingRight: H_PAD, paddingTop: 4, paddingBottom: 8 },
  rivalHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 3 },
  swords: { fontSize: 15, color: COLORS.gold },
  rivalLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rivalBar: { flex: 1, height: 2, borderRadius: 1, backgroundColor: 'rgba(176,125,0,0.28)' },
  tagline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12.5,
    fontStyle: 'italic',
    color: 'rgba(41,60,67,0.55)',
    marginBottom: 11,
  },
});
