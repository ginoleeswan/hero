// src/components/versus/RivalriesRail.tsx — the "Greatest Rivalries" deck on the
// native Arena hub. Split-portrait collectible cards under a holographic sheen
// with a gold-rimmed VS coin; tapping one opens that matchup in the arena.
// Matches the web RivalryDeck (src/components/web/versus) so both platforms read
// as one design.
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import type { Rivalry } from '../../lib/db/heroes';
import type { FighterArt } from '../../lib/compareHandoff';

function RivalryCard({ r, onPress }: { r: Rivalry; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${r.a.name} versus ${r.b.name}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <HeroImage
        id={r.a.id}
        name={r.a.name}
        imageUrl={r.a.image_url}
        portraitUrl={r.a.portrait_url}
        contentFit="cover"
        contentPosition={{ top: 0, left: '68%' }}
        style={styles.half}
      />
      <HeroImage
        id={r.b.id}
        name={r.b.name}
        imageUrl={r.b.image_url}
        portraitUrl={r.b.portrait_url}
        contentFit="cover"
        contentPosition={{ top: 0, left: '32%' }}
        style={[styles.half, styles.mirror]}
      />
      <LinearGradient
        colors={['rgba(231,115,51,0.12)', 'transparent', 'rgba(21,161,171,0.12)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(8,12,24,0.9)']}
        locations={[0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.coin}>
        <Text style={styles.coinText}>VS</Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {r.a.name} · {r.b.name}
      </Text>
    </Pressable>
  );
}

export function RivalriesRail({
  rivalries,
  onOpen,
  /** Suppress the built-in heading when the surrounding section supplies one —
   *  two headings for one rail is exactly the duplication this hub had. */
  headless = false,
}: {
  rivalries: Rivalry[];
  onOpen: (a: FighterArt, b: FighterArt) => void;
  headless?: boolean;
}) {
  if (rivalries.length === 0) return null;
  return (
    <View>
      {headless ? null : (
        <View style={styles.head}>
          <Text style={styles.heading}>Greatest Rivalries</Text>
          <Text style={styles.sub}>the grudge matches fans want to see</Text>
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {rivalries.map((r) => (
          <RivalryCard key={`${r.a.id}-${r.b.id}`} r={r} onPress={() => onOpen(r.a, r.b)} />
        ))}
      </ScrollView>
    </View>
  );
}

const CARD_W = 220;
const CARD_H = 140;

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, marginBottom: 14 },
  heading: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige },
  sub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12.5,
    color: INK_TEXT.faint,
    marginTop: 2,
  },
  row: { gap: 12, paddingHorizontal: 16, paddingBottom: 4 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: COLORS.deepNavy,
  },
  cardPressed: { opacity: 0.9 },
  half: { width: CARD_W / 2, height: CARD_H },
  // Mirror the right portrait so the pair faces inward, toward each other.
  mirror: { transform: [{ scaleX: -1 }] },
  coin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 32,
    height: 32,
    borderRadius: 16,
    marginTop: -16,
    marginLeft: -16,
    backgroundColor: COLORS.deepNavy,
    borderWidth: 1.5,
    borderColor: COLORS.goldAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: { fontFamily: 'Flame-Regular', fontSize: 12, color: COLORS.goldAccent },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: COLORS.beige,
  },
});
