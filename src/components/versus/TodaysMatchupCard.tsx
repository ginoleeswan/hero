// src/components/versus/TodaysMatchupCard.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { VsBadge } from '../compare/VsBadge';
import type { TodaysMatchup } from '../../lib/matchup';
import type { FighterArt } from '../../lib/compareHandoff';

export function TodaysMatchupCard({
  matchup,
  onOpen,
}: {
  matchup: TodaysMatchup;
  onOpen: (a: FighterArt, b: FighterArt) => void;
}) {
  const { heroA, heroB, verdict } = matchup;

  return (
    <Pressable
      onPress={() => onOpen(heroA, heroB)}
      accessibilityRole="button"
      accessibilityLabel={`Open today's matchup: ${heroA.name} versus ${heroB.name}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.portraits}>
        <View style={styles.portraitWrap}>
          <HeroImage
            id={heroA.id}
            name={heroA.name}
            imageUrl={heroA.image_url}
            portraitUrl={heroA.portrait_url}
            contentFit="cover"
            contentPosition="top"
            style={[StyleSheet.absoluteFill, styles.portrait]}
          />
          <View style={styles.scrim} />
          <Text style={styles.name} numberOfLines={1}>
            {heroA.name}
          </Text>
        </View>

        <View style={styles.badge}>
          <VsBadge size={48} variant="solid" />
        </View>

        <View style={styles.portraitWrap}>
          <HeroImage
            id={heroB.id}
            name={heroB.name}
            imageUrl={heroB.image_url}
            portraitUrl={heroB.portrait_url}
            contentFit="cover"
            contentPosition="top"
            style={[StyleSheet.absoluteFill, styles.portrait]}
          />
          <View style={styles.scrim} />
          <Text style={[styles.name, styles.nameRight]} numberOfLines={1}>
            {heroB.name}
          </Text>
        </View>
      </View>

      {verdict ? (
        <Text style={styles.verdict} numberOfLines={3}>
          "{verdict}"
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1b2a30',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,235,220,0.12)',
  },
  cardPressed: { opacity: 0.92 },
  portraits: { flexDirection: 'row', height: 200 },
  portraitWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.navy },
  portrait: {},
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    backgroundColor: 'rgba(12,17,20,0.55)',
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    padding: 12,
  },
  nameRight: { textAlign: 'right' },
  badge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  verdict: {
    fontFamily: 'Nunito_400Regular',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(245,235,220,0.82)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
