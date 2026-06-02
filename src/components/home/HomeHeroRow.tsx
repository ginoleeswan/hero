// src/components/home/HomeHeroRow.tsx
import { View, Text, FlatList, StyleSheet, Dimensions, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { HeroCard, HERO_CARD_RADIUS } from '../HeroCard';
import { ThumbCard, type ThumbHero } from './ThumbCard';
import { heroImageSource } from '../../constants/heroImages';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PORTRAIT_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
const PORTRAIT_CARD_HEIGHT = 300;

export interface RowHero extends ThumbHero {}

interface HomeHeroRowProps {
  label?: string;
  title: string;
  heroes: RowHero[];
  variant?: 'portrait' | 'thumb';
  onPress: (item: RowHero) => void;
  onViewAll?: () => void;
  disabled?: boolean;
}

export function HomeHeroRow({
  label,
  title,
  heroes,
  variant = 'portrait',
  onPress,
  onViewAll,
  disabled = false,
}: HomeHeroRowProps) {
  const isPortrait = variant === 'portrait';

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {!!label && <Text style={styles.label}>{label}</Text>}
          <Text style={styles.title}>{title}</Text>
        </View>
        {!!onViewAll && (
          <Pressable onPress={onViewAll} style={styles.seeAll}>
            <Text style={styles.seeAllText}>See All</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        horizontal
        data={heroes}
        keyExtractor={(h) => h.id}
        showsHorizontalScrollIndicator={false}
        decelerationRate={isPortrait ? 'fast' : 'normal'}
        snapToInterval={isPortrait ? PORTRAIT_CARD_WIDTH + 12 : undefined}
        contentContainerStyle={[styles.listContent, { gap: isPortrait ? 12 : 8 }]}
        renderItem={({ item }) =>
          isPortrait ? (
            <Link
              href={{
                pathname: '/character/[id]',
                params: {
                  id: item.id,
                  imageUri: item.portrait_url ?? item.image_url ?? undefined,
                },
              }}
              asChild
            >
              {/* Shadow + sizing live here, OUTSIDE Link.AppleZoom, so the
                  zoom snapshot is just the rounded card — no shadow box bleeds
                  into the transition on the way back. */}
              <Pressable style={styles.cardSlot}>
                {/* Static portrait behind the zoom card. Fully covered by the
                    live card at rest; only revealed in the brief moment iOS
                    hides the live card during the zoom dismiss, so the detail
                    screen contracts into the hero image — seamless, never an
                    empty slot. */}
                <Image
                  source={heroImageSource(item.id, item.image_url, item.portrait_url)}
                  contentFit="cover"
                  style={styles.slotImage}
                  cachePolicy="memory-disk"
                  recyclingKey={`${item.id}-slot`}
                  transition={null}
                />
                <Link.AppleZoom>
                  <HeroCard
                    id={item.id}
                    name={item.name}
                    imageUrl={item.image_url}
                    portraitUrl={item.portrait_url}
                    width={PORTRAIT_CARD_WIDTH}
                    height={PORTRAIT_CARD_HEIGHT}
                  />
                </Link.AppleZoom>
              </Pressable>
            </Link>
          ) : (
            <ThumbCard item={item} onPress={() => onPress(item)} disabled={disabled} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 14, paddingBottom: 16 },
  header: {
    paddingHorizontal: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerLeft: { gap: 2 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.navy },
  seeAll: { paddingBottom: 2 },
  seeAllText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.orange,
    letterSpacing: 0.3,
  },
  listContent: { paddingHorizontal: 15, paddingBottom: 20 },
  cardSlot: {
    // No backgroundColor on purpose: this View sits OUTSIDE Link.AppleZoom and
    // stays visible while the zoom briefly hides the live card, so an opaque
    // fill here would flash as a solid box on the way back. boxShadow still
    // renders fine on a transparent View (it follows the rounded border box).
    width: PORTRAIT_CARD_WIDTH,
    height: PORTRAIT_CARD_HEIGHT,
    marginVertical: 8,
    borderRadius: HERO_CARD_RADIUS,
    borderCurve: 'continuous',
    boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.3)',
  },
  slotImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: HERO_CARD_RADIUS,
    borderCurve: 'continuous',
    backgroundColor: COLORS.navy,
  },
});
