// src/components/search/PortraitCard.tsx — portrait result card for the search grid
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PressScale } from '../ui/PressScale';
import { COLORS } from '../../constants/colors';
import { heroGridImageSource } from '../../constants/heroImages';
import type { HeroSearchResult } from '../../lib/db/heroes';

const MARVEL_LOGO = require('../../../assets/images/Marvel-Logo.jpg') as number;
const DC_LOGO = require('../../../assets/images/DC-Logo.png') as number;
const DARK_HORSE_LOGO = require('../../../assets/images/Dark_Horse_Comics_logo.png') as number;
const STAR_WARS_LOGO = require('../../../assets/images/star-wars-logo.png') as number;

export function PortraitCard({
  item,
  cardWidth,
  onPress,
  onLongPress,
  disabled,
}: {
  item: HeroSearchResult;
  cardWidth: number;
  onPress: () => void;
  onLongPress?: () => void;
  disabled: boolean;
}) {
  const source = heroGridImageSource(item.id, item.image_url, item.portrait_url, item.image_md_url);
  const pub = (item.publisher ?? '').toLowerCase();
  const isMarvel = pub.includes('marvel');
  const isDC = pub.includes('dc');
  const isDarkHorse = pub.includes('dark horse');
  const isStarWars = pub.includes('george lucas') || pub.includes('star wars');
  const hasLogo = isMarvel || isDC || isDarkHorse || isStarWars;

  // Real name disambiguates same-named heroes (e.g. the three "Batman"s:
  // Bruce Wayne / Terry McGinnis / Dick Grayson) and adds useful context.
  const realName =
    item.full_name && item.full_name.toLowerCase() !== item.name.toLowerCase()
      ? item.full_name
      : null;

  return (
    <PressScale
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      scale={0.96}
      style={{ width: cardWidth, height: Math.round(cardWidth * 1.5) }}
    >
      <View style={styles.card}>
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
          colors={['transparent', 'rgba(20,30,34,0.16)', 'rgba(20,30,34,0.97)']}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />

        {hasLogo ? (
          <View style={styles.badge}>
            <Image
              source={
                isMarvel ? MARVEL_LOGO : isDC ? DC_LOGO : isDarkHorse ? DARK_HORSE_LOGO : STAR_WARS_LOGO
              }
              style={
                isMarvel
                  ? styles.logoMarvel
                  : isDC
                    ? styles.logoDC
                    : isDarkHorse
                      ? styles.logoDarkHorse
                      : styles.logoStarWars
              }
              contentFit="contain"
            />
          </View>
        ) : item.publisher ? (
          <View style={styles.pubPill}>
            <Text style={styles.pubText} numberOfLines={1}>
              {item.publisher}
            </Text>
          </View>
        ) : null}

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
    </PressScale>
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
  // Logos float on a faint frosted chip so they read on light artwork too.
  badge: {
    position: 'absolute',
    top: 9,
    left: 9,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(18,24,28,0.42)',
  },
  logoMarvel: { width: 36, height: 14, borderRadius: 2 },
  logoDC: { width: 20, height: 20 },
  logoDarkHorse: { width: 16, height: 24 },
  logoStarWars: { width: 32, height: 32 },
  pubPill: {
    position: 'absolute',
    top: 9,
    left: 9,
    backgroundColor: 'rgba(18,24,28,0.5)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pubText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottom: { position: 'absolute', bottom: 12, left: 13, right: 13 },
  name: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.beige, lineHeight: 19 },
  realName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    color: 'rgba(245,235,220,0.62)',
    letterSpacing: 0.3,
    marginTop: 2,
  },
});
