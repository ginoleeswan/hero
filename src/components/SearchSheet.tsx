// src/components/SearchSheet.tsx
import {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { heroGridImageSource } from '../constants/heroImages';
import { searchHeroes, rankResults } from '../lib/db/heroes';
import type { HeroSearchResult, PublisherFilter } from '../lib/db/heroes';

const PUBLISHER_PILLS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];
const GRID_COLUMNS = 2;
const H_PAD = 12;
const GAP = 8;
const DISPLAY_LIMIT = 100;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MARVEL_LOGO = require('../../assets/images/Marvel-Logo.jpg') as number;
const DC_LOGO = require('../../assets/images/DC-Logo.png') as number;
const DARK_HORSE_LOGO = require('../../assets/images/Dark_Horse_Comics_logo.png') as number;
const STAR_WARS_LOGO = require('../../assets/images/star-wars-logo.png') as number;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function PortraitCard({
  item,
  cardWidth,
  onPress,
  disabled,
}: {
  item: HeroSearchResult;
  cardWidth: number;
  onPress: () => void;
  disabled: boolean;
}) {
  const source = heroGridImageSource(item.id, item.image_url, item.portrait_url);
  const pub = (item.publisher ?? '').toLowerCase();
  const isMarvel = pub.includes('marvel');
  const isDC = pub.includes('dc');
  const isDarkHorse = pub.includes('dark horse');
  const isStarWars = pub.includes('george lucas') || pub.includes('star wars');
  const hasLogo = isMarvel || isDC || isDarkHorse || isStarWars;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      disabled={disabled}
      style={[pcard.wrap, { width: cardWidth, height: Math.round(cardWidth * 1.48) }]}
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={item.id}
        transition={null}
      />
      <LinearGradient
        colors={['transparent', 'rgba(29,45,51,0.18)', 'rgba(29,45,51,0.97)']}
        locations={[0, 0.45, 1]}
        style={pcard.gradient}
      />
      {hasLogo ? (
        <View style={pcard.logoWrap}>
          <Image
            source={
              isMarvel ? MARVEL_LOGO
              : isDC ? DC_LOGO
              : isDarkHorse ? DARK_HORSE_LOGO
              : STAR_WARS_LOGO
            }
            style={
              isMarvel ? pcard.logoMarvel
              : isDC ? pcard.logoDC
              : isDarkHorse ? pcard.logoDarkHorse
              : pcard.logoStarWars
            }
            contentFit="contain"
          />
        </View>
      ) : item.publisher ? (
        <View style={pcard.pubTextWrap}>
          <Text style={pcard.pubText} numberOfLines={1}>{item.publisher}</Text>
        </View>
      ) : null}
      <View style={pcard.bottom}>
        <Text style={pcard.name} numberOfLines={2}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );
}

const pcard = StyleSheet.create({
  wrap: { borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.navy },
  gradient: { ...StyleSheet.absoluteFillObject },
  logoWrap: { position: 'absolute', top: 10, left: 10 },
  logoMarvel: { width: 38, height: 15, borderRadius: 3 },
  logoDC: { width: 22, height: 22, borderRadius: 3 },
  logoDarkHorse: { width: 18, height: 26, borderRadius: 2 },
  logoStarWars: { width: 36, height: 36, borderRadius: 2 },
  pubTextWrap: { position: 'absolute', top: 10, left: 10, right: 10 },
  pubText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottom: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  name: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige, lineHeight: 18 },
});

interface SearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onHeroPress: (id: string) => void;
}

export function SearchSheet({ visible, onClose, onHeroPress }: SearchSheetProps) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [mounted, setMounted] = useState(false);
  const [allHeroes, setAllHeroes] = useState<HeroSearchResult[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [query, setQuery] = useState('');
  const [publisherFilter, setPublisherFilter] = useState<PublisherFilter>('All');
  const cardWidth = (SCREEN_WIDTH - H_PAD * 2 - GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const debouncedQuery = useDebounce(query, 150);

  useEffect(() => {
    searchHeroes('', 'All', 600)
      .then(setAllHeroes)
      .catch(() => {})
      .finally(() => setLoadingAll(false));
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start(() => inputRef.current?.focus());
    } else {
      Animated.spring(slideAnim, {
        toValue: SCREEN_HEIGHT,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start(({ finished }) => {
        if (finished) {
          setMounted(false);
          setQuery('');
          setPublisherFilter('All');
        }
      });
    }
  }, [visible]);

  const filteredHeroes = useMemo(() => {
    let list =
      publisherFilter === 'All'
        ? allHeroes
        : allHeroes.filter((h) => {
            const pub = (h.publisher ?? '').toLowerCase();
            if (publisherFilter === 'Marvel') return pub.includes('marvel');
            if (publisherFilter === 'DC') return pub.includes('dc');
            return !pub.includes('marvel') && !pub.includes('dc');
          });
    return debouncedQuery.trim() ? rankResults(list, debouncedQuery) : list;
  }, [allHeroes, debouncedQuery, publisherFilter]);

  const displayedHeroes = filteredHeroes.slice(0, DISPLAY_LIMIT);

  const handlePress = useCallback(
    (id: string) => {
      onHeroPress(id);
    },
    [onHeroPress],
  );

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <KeyboardAvoidingView
          style={styles.sheetInner}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.handle} />
          <View style={styles.searchBar}>
            <Ionicons name="search" size={17} color="rgba(245,235,220,0.45)" />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Hero, villain, or real name…"
              placeholderTextColor="rgba(245,235,220,0.35)"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.4)" />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsContainer}
            style={styles.pillsScroll}
            keyboardShouldPersistTaps="handled"
          >
            {PUBLISHER_PILLS.map((pill) => {
              const active = publisherFilter === pill;
              return (
                <TouchableOpacity
                  key={pill}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setPublisherFilter(pill)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{pill}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {loadingAll ? (
            <View style={styles.center}>
              <Text style={styles.loadingText}>Loading heroes…</Text>
            </View>
          ) : displayedHeroes.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyHeadline}>No heroes found</Text>
              <Text style={styles.emptySub}>Try a different search or filter</Text>
            </View>
          ) : (
            <FlatList
              data={displayedHeroes}
              keyExtractor={(h) => h.id}
              numColumns={GRID_COLUMNS}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.grid}
              columnWrapperStyle={styles.gridRow}
              ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
              renderItem={({ item }) => (
                <PortraitCard
                  item={item}
                  cardWidth={cardWidth}
                  onPress={() => handlePress(item.id)}
                  disabled={false}
                />
              )}
            />
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,45,51,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.88,
    backgroundColor: COLORS.navy,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetInner: { flex: 1 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(245,235,220,0.25)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,235,220,0.1)',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.beige,
  },
  pillsScroll: { flexGrow: 0, height: 44, marginBottom: 4 },
  pillsContainer: { paddingHorizontal: 16, paddingVertical: 2, gap: 8, alignItems: 'center' },
  pill: {
    height: 34,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(245,235,220,0.2)',
  },
  pillActive: { backgroundColor: COLORS.beige, borderColor: COLORS.beige },
  pillText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(245,235,220,0.5)' },
  pillTextActive: { color: COLORS.navy },
  grid: { paddingHorizontal: H_PAD, paddingBottom: 40 },
  gridRow: { gap: GAP },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: 'rgba(245,235,220,0.5)' },
  emptyHeadline: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige },
  emptySub: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: 'rgba(245,235,220,0.55)' },
});
