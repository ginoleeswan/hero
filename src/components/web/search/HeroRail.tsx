// src/components/web/search/HeroRail.tsx — a horizontal rail of character
// portraits for the dark /search landing. Used for both "Popular" (fame-ranked
// icons) and "Recently viewed" — the icons ARE the content, so circular portraits
// read as people/icons and tap straight into /character/[id].
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';

export interface RailHero {
  id: string;
  name: string;
  image_url?: string | null;
  image_md_url?: string | null;
  portrait_url?: string | null;
}

export function HeroRail({
  heroes,
  onPress,
  edge = 0,
}: {
  heroes: RailHero[];
  onPress: (hero: RailHero) => void;
  /** Horizontal page padding to bleed past — the rail scrolls edge-to-edge while
   *  its first card still lines up with the inset section label. */
  edge?: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -edge } as object}
      contentContainerStyle={[styles.track, { paddingLeft: edge, paddingRight: edge }] as object}
    >
      {heroes.map((h) => (
        <Pressable
          key={h.id}
          onPress={() => onPress(h)}
          accessibilityRole="link"
          accessibilityLabel={h.name}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [styles.card, hovered && (styles.cardHover as object)] as object
          }
        >
          <View style={styles.portrait as object}>
            <HeroImage
              id={h.id}
              name={h.name}
              imageUrl={h.image_url}
              portraitUrl={h.portrait_url}
              imageMdUrl={h.image_md_url}
              grid
              contentFit="cover"
              contentPosition={{ top: '12%', left: '50%' }}
              style={StyleSheet.absoluteFill as object}
            />
          </View>
          <Text style={styles.name as object} numberOfLines={1}>
            {h.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const SIZE = 74;

const styles = StyleSheet.create({
  track: { gap: 14, paddingVertical: 2 } as object,
  card: {
    width: SIZE,
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'transform 180ms ease',
  } as object,
  cardHover: { transform: [{ translateY: -3 }] } as object,
  portrait: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.12)',
  } as object,
  name: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    lineHeight: 14,
    color: 'rgba(245,235,220,0.85)',
    textAlign: 'center',
    marginTop: 7,
    width: SIZE + 8,
  } as object,
});
