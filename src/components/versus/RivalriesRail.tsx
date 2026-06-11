// src/components/versus/RivalriesRail.tsx
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import { heroImageSource } from '../../constants/heroImages';
import { VsBadge } from '../compare/VsBadge';
import type { Rivalry } from '../../lib/db/heroes';
import type { FighterArt } from '../../lib/compareHandoff';

function RivalryCard({ r, onPress }: { r: Rivalry; onPress: () => void }) {
  const imgA = heroImageSource(r.a.id, r.a.image_url, r.a.portrait_url);
  const imgB = heroImageSource(r.b.id, r.b.image_url, r.b.portrait_url);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${r.a.name} versus ${r.b.name}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Image source={imgA} contentFit="cover" contentPosition="top" style={styles.half} />
      <Image source={imgB} contentFit="cover" contentPosition="top" style={styles.half} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      <View style={styles.badge}>
        <VsBadge size={34} variant="solid" />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {r.a.name} vs {r.b.name}
      </Text>
    </Pressable>
  );
}

export function RivalriesRail({
  rivalries,
  onOpen,
}: {
  rivalries: Rivalry[];
  onOpen: (a: FighterArt, b: FighterArt) => void;
}) {
  if (rivalries.length === 0) return null;
  return (
    <View>
      <Text style={styles.heading}>Greatest Rivalries</Text>
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
const CARD_H = 132;

const styles = StyleSheet.create({
  heading: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  row: { gap: 12, paddingHorizontal: 16, paddingBottom: 4 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#1b2a30',
    justifyContent: 'flex-end',
  },
  cardPressed: { opacity: 0.9 },
  half: { width: CARD_W / 2, height: CARD_H },
  scrim: { backgroundColor: 'rgba(12,17,20,0.28)' },
  badge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.beige,
    backgroundColor: 'rgba(12,17,20,0.5)',
  },
});
