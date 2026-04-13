// app/category/[slug].web.tsx — Full grid view for a hero category (web)
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllHeroesBySlug,
  CATEGORY_LABELS,
  type CategorySlug,
  type Hero,
} from '../../src/lib/db/heroes';
import { heroGridImageSource } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';

const VALID_SLUGS = new Set<CategorySlug>([
  'popular',
  'villain',
  'xmen',
  'anti-heroes',
  'marvel',
  'dc',
  'strongest',
  'most-intelligent',
]);

// ── Card ──────────────────────────────────────────────────────────────────────
function HeroCard({ hero, onPress }: { hero: Hero; onPress: () => void }) {
  const source = heroGridImageSource(String(hero.id), hero.image_url, hero.portrait_url);
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [card.wrap, hovered && (card.wrapHover as object)] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top center"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={String(hero.id)}
        transition={typeof source === 'object' && 'uri' in source ? 150 : null}
      />
      <View style={card.overlay as object} />
      <View style={card.bottom}>
        <Text style={card.name as object} numberOfLines={2}>
          {hero.name}
        </Text>
      </View>
    </Pressable>
  );
}

const card = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
    aspectRatio: '3 / 4',
  } as object,
  wrapHover: {
    transform: [{ scale: 1.04 }],
    boxShadow: '0 20px 56px rgba(0,0,0,0.32)',
    zIndex: 2,
  } as object,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.97) 0%, rgba(29,45,51,0.08) 55%, transparent 100%)',
  } as object,
  bottom: { position: 'absolute', bottom: 10, left: 10, right: 10 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.beige,
    lineHeight: 18,
    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
  } as object,
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function WebCategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [loading, setLoading] = useState(true);

  const categorySlug = VALID_SLUGS.has(slug as CategorySlug) ? (slug as CategorySlug) : null;
  const title = categorySlug ? CATEGORY_LABELS[categorySlug] : (slug ?? 'Heroes');

  useEffect(() => {
    if (!categorySlug) {
      setLoading(false);
      return;
    }
    getAllHeroesBySlug(categorySlug)
      .then(setHeroes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [categorySlug]);

  const handlePress = useCallback(
    (id: string) => {
      router.push(`/character/${id}`);
    },
    [router],
  );

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: isDesktop
      ? 'repeat(auto-fill, minmax(180px, 1fr))'
      : 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 12,
  };

  const contentPad = isDesktop ? 32 : 16;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, isDesktop && (styles.headerDesktop as object)] as object}>
        <View style={[styles.headerInner, { paddingHorizontal: contentPad }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ hovered }: { hovered?: boolean }) =>
              [styles.backBtn, hovered && (styles.backBtnHover as object)] as object
            }
          >
            <Ionicons name="arrow-back" size={18} color={COLORS.navy} />
            <Text style={styles.backText as object}>Back</Text>
          </Pressable>
          <View style={styles.titleRow}>
            <Text style={styles.title as object}>{title}</Text>
            {heroes.length > 0 && !loading && (
              <Text style={styles.count as object}>{heroes.length} heroes</Text>
            )}
          </View>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.orange} />
        </View>
      ) : heroes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No heroes found</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll}>
          <View
            style={[styles.gridWrap, { paddingHorizontal: contentPad, paddingBottom: 60 }]}
          >
            <View style={gridStyle as object}>
              {heroes.map((hero) => (
                <HeroCard key={hero.id} hero={hero} onPress={() => handlePress(String(hero.id))} />
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(41,60,67,0.12)',
    backgroundColor: COLORS.beige,
    paddingVertical: 14,
  },
  headerDesktop: {
    position: 'sticky',
    top: 64,
    zIndex: 40,
  } as object,
  headerInner: { maxWidth: 1200, width: '100%', alignSelf: 'center', gap: 6 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    cursor: 'pointer',
    opacity: 1,
    transition: 'opacity 150ms ease',
  } as object,
  backBtnHover: { opacity: 0.55 } as object,
  backText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  } as object,
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 32,
    color: COLORS.navy,
  } as object,
  count: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    letterSpacing: 0.3,
  } as object,
  scroll: { flex: 1 },
  gridWrap: { paddingTop: 24, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.grey },
});
