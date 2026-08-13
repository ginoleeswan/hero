// src/components/search/PortraitCard.tsx — portrait result card for the search grid
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Link, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { PressScale } from '../ui/PressScale';
import { HeroImage } from '../HeroImage';
import { PublisherBadge } from '../PublisherBadge';
import { COLORS } from '../../constants/colors';
import type { HeroSearchResult } from '../../lib/db/heroes';

export function PortraitCard({
  item,
  cardWidth,
  href,
  onPress,
  onLongPress,
  disabled,
  onDark,
}: {
  item: HeroSearchResult;
  cardWidth: number;
  /**
   * Navigate via a <Link> instead of an imperative push, which is what lets
   * this card be the ORIGIN of Apple's fluid zoom transition — the same one
   * the Explore rows already use. Without it the identical hero zoomed from
   * the feed and slid from search. `onPress` still runs (side effects only:
   * haptics, recording the term); the Link performs the navigation, and
   * Radix's Slot composes both handlers.
   */
  href?: Href;
  onPress: () => void;
  onLongPress?: () => void;
  disabled: boolean;
  onDark?: boolean;
}) {
  // Real name disambiguates same-named heroes (e.g. the three "Batman"s:
  // Bruce Wayne / Terry McGinnis / Dick Grayson) and adds useful context.
  const realName =
    item.full_name && item.full_name.toLowerCase() !== item.name.toLowerCase()
      ? item.full_name
      : null;

  const card = (
    <PressScale
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      scale={0.96}
      style={{ width: cardWidth, height: Math.round(cardWidth * 1.5) }}
    >
      <Link.AppleZoom>
        <View style={[styles.card, onDark && styles.cardOnDark]}>
          <HeroImage
            id={item.id}
            name={item.name}
            imageUrl={item.image_url}
            portraitUrl={item.portrait_url}
            imageMdUrl={item.image_md_url}
            grid
            contentFit="cover"
            contentPosition="top"
            style={StyleSheet.absoluteFill}
            recyclingKey={item.id}
            transition={null}
          />
          <LinearGradient
            colors={['transparent', 'rgba(20,30,34,0.16)', 'rgba(20,30,34,0.97)']}
            locations={[0, 0.48, 1]}
            style={StyleSheet.absoluteFill}
          />

          <PublisherBadge publisher={item.publisher} />

          <View style={styles.bottom}>
            <Text style={styles.name} numberOfLines={realName ? 1 : 2}>
              {item.name}
            </Text>
            {realName && (
              <Text style={styles.realName} numberOfLines={1}>
                {realName}
              </Text>
            )}
          </View>
        </View>
      </Link.AppleZoom>
    </PressScale>
  );

  // Link.AppleZoom needs a Link ancestor for its source context. Without an
  // href the card stays imperative (callers that push themselves), and
  // AppleZoom degrades to a plain Slot — same markup, no zoom.
  return href ? (
    <Link href={href} asChild>
      {card}
    </Link>
  ) : (
    card
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  cardOnDark: { boxShadow: '0 0 0 1px rgba(245,235,220,0.08)' },
  bottom: { position: 'absolute', bottom: 12, left: 13, right: 13 },
  name: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.beige, lineHeight: 20 },
  realName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    color: 'rgba(245,235,220,0.62)',
    letterSpacing: 0.3,
    marginTop: 2,
  },
});
