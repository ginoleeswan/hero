// src/components/search/PortraitCard.tsx — portrait result card for the search grid
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      activeOpacity={0.82}
      disabled={disabled}
      style={[styles.wrap, { width: cardWidth, height: Math.round(cardWidth * 1.48) }]}
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
        style={styles.gradient}
      />
      {hasLogo ? (
        <View style={styles.logoWrap}>
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
        <View style={styles.pubTextWrap}>
          <Text style={styles.pubText} numberOfLines={1}>
            {item.publisher}
          </Text>
        </View>
      ) : null}
      <View style={styles.bottom}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
