// app/publisher/[slug].tsx — heroes for a single publisher (Marvel/DC/Image/Dark Horse)
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { getHeroesByPublisher, type Hero } from '../../src/lib/db/heroes';
import { publisherBySlug } from '../../src/constants/publishers';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS } from '../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = SCREEN_WIDTH >= 768 ? 4 : 3;
const GAP = 8;
const H_PAD = 16;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.35);
const SEARCH_BAR_PAD = 16;

const headerOptions = {
  headerShown: true,
  headerTitle: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
} as const;

function HeroGridCard({ hero, onPress }: { hero: Hero; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      <HeroImage
        id={hero.id}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        recyclingKey={String(hero.id)}
      />
      <LinearGradient
        colors={['transparent', 'rgba(29,45,51,0.88)']}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.cardName} numberOfLines={2}>
        {hero.name}
      </Text>
    </TouchableOpacity>
  );
}

export default function PublisherScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Registered brands route by their stable slug (and carry a short ilike
  // `query`); every other universe routes by its raw name encoded into the slug,
  // which we decode and match against the column directly.
  const brand = publisherBySlug(slug);
  const rawName = (() => {
    if (!slug) return '';
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  })();
  const title = brand?.name ?? rawName ?? 'Universe';
  const query = brand?.query ?? rawName;

  // Tint the stage with the universe's brand colour (registered brands only);
  // unregistered universes fall back to the app navy.
  const accentTop = brand?.color ?? COLORS.navy;
  const accentBottom = brand?.colorDark ?? COLORS.navy;

  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getHeroesByPublisher(query, 200)
      .then((h) => setHeroes(h))
      .catch(() => setHeroes([]))
      .finally(() => setLoading(false));
  }, [query]);

  const handleHeroPress = useCallback(
    (hero: Hero) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const img = hero.portrait_url ?? hero.image_url;
      const suffix = img ? `?imageUri=${encodeURIComponent(img)}` : '';
      router.push(`/character/${hero.id}${suffix}`);
    },
    [router],
  );

  const headerHeight = insets.top + (Platform.OS === 'ios' ? 44 : 56);

  const listHeader = (
    <>
      <LinearGradient
        colors={[accentTop, accentBottom]}
        style={[styles.stage, { paddingTop: headerHeight + SEARCH_BAR_PAD }]}
      >
        <Text style={styles.eyebrow}>{`${heroes.length.toLocaleString()} CHARACTERS`}</Text>
        <Text style={styles.stageTitle} numberOfLines={2}>
          {title}
        </Text>
      </LinearGradient>
      <View style={styles.sheetTop} />
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: accentTop }]}>
      <Stack.Screen options={headerOptions} />
      <StatusBar style="light" />
      {loading ? (
        <View style={[styles.center, { paddingTop: headerHeight }]}>
          <ActivityIndicator color={COLORS.orange} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={heroes}
          keyExtractor={(h) => String(h.id)}
          numColumns={NUM_COLUMNS}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <HeroGridCard hero={item} onPress={() => handleHeroPress(item)} />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>No heroes found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  list: { flex: 1, backgroundColor: COLORS.navy },
  listContent: { backgroundColor: COLORS.beige, flexGrow: 1 },
  stage: { backgroundColor: COLORS.navy, paddingHorizontal: H_PAD, paddingBottom: 28 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 6,
  },
  stageTitle: { fontFamily: 'Flame-Regular', fontSize: 32, color: COLORS.beige, lineHeight: 36 },
  sheetTop: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: 'continuous',
    marginTop: -16,
    height: 30,
  },
  row: { gap: GAP, marginBottom: GAP, paddingHorizontal: H_PAD },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    padding: 6,
  },
  cardName: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.beige, lineHeight: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.grey },
});
