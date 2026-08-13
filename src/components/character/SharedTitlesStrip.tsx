import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Image } from 'expo-image';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { sharedTitlesCaption, type SharedTitles } from '../../lib/db/heroes/sharedTitles';

/**
 * The evidence for a relationship: what the two of them are actually in.
 *
 * Everything else on the card is inference — a shared roster, a count of
 * mutual acquaintances, a stat comparison. This is the one section that shows
 * rather than tells, and it does it with the artefacts themselves. "Batman v
 * Superman, Zack Snyder's Justice League, The Flash" answers "how are these
 * two connected" better than any sentence available from the data.
 *
 * Posters rather than titles-as-text on purpose: the whole strip reads in one
 * glance, and film art is the most recognisable object in the catalogue.
 */
export function SharedTitlesStrip({
  shared,
  onOpenTitle,
}: {
  shared: SharedTitles;
  onOpenTitle?: (titleId: string) => void;
}) {
  const caption = sharedTitlesCaption(shared);
  if (!caption || shared.titles.length === 0) return null;
  const hidden = shared.total - shared.titles.length;

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Seen together</Text>
      <View style={styles.row}>
        {shared.titles.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => onOpenTitle?.(t.id)}
            style={styles.poster}
            accessibilityLabel={t.year ? `${t.title} (${t.year})` : t.title}
          >
            <Image
              source={{ uri: t.poster_url ?? undefined }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={160}
              recyclingKey={t.id}
            />
          </Pressable>
        ))}
        {hidden > 0 ? (
          <View style={[styles.poster, styles.more] as object}>
            <Text style={styles.moreText}>+{hidden}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.caption} numberOfLines={2}>
        {caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6, marginTop: 2 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
  },
  row: { flexDirection: 'row', gap: 6 },
  poster: {
    width: 46,
    height: 69, // the 2:3 sheet ratio every poster in the catalogue uses
    borderRadius: 6,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  } as object,
  more: { alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: INK_TEXT.muted },
  caption: { fontFamily: 'FlameSans-Regular', fontSize: 12.5, color: INK_TEXT.muted },
});
