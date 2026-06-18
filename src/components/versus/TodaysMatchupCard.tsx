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
  // The card poses the question — it never shows the verdict. The answer (vote →
  // crowd split → tale of the tape) lives in the arena, so we don't spoil the
  // result before the user has taken a side.
  const { heroA, heroB } = matchup;

  return (
    <Pressable
      onPress={() => onOpen(heroA, heroB)}
      accessibilityRole="button"
      accessibilityLabel={`Settle today's matchup: ${heroA.name} versus ${heroB.name}`}
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

      <View style={styles.prompt}>
        <Text style={styles.promptQ}>Who would win?</Text>
        <Text style={styles.promptCta}>Tap to settle it →</Text>
      </View>
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
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  promptQ: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
  },
  promptCta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    letterSpacing: 0.3,
    color: COLORS.orange,
  },
});
