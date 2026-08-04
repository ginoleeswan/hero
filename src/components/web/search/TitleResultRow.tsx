import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { COLORS, INK_TEXT, PAPER_TEXT } from '../../../constants/colors';
import type { TitleSearchResult } from '../../../lib/db/titles';

const MEDIA_LABEL: Record<string, string> = { film: 'Film', tv: 'TV', game: 'Game' };

// A film/show search-hit row: poster thumbnail + title + `year · media` meta,
// linking to /title/[id]. Dark variant for the palette panel, light for the
// beige results page.
export function TitleResultRow({
  title,
  onPress,
  variant = 'dark',
  active = false,
}: {
  title: TitleSearchResult;
  onPress: () => void;
  variant?: 'dark' | 'light';
  active?: boolean;
}) {
  const light = variant === 'light';
  const meta = [title.year ?? null, MEDIA_LABEL[title.media_type] ?? title.media_type]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={title.title}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.row,
          (hovered || active) && ((light ? styles.rowHoverLight : styles.rowHover) as object),
        ] as object
      }
    >
      <View style={styles.poster as object}>
        {title.poster_url ? (
          <Image
            source={{ uri: title.poster_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : null}
      </View>
      <View style={styles.text}>
        <Text
          style={[styles.title, light && (styles.titleLight as object)] as object}
          numberOfLines={1}
        >
          {title.title}
        </Text>
        <Text style={[styles.meta, light && (styles.metaLight as object)] as object}>{meta}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  rowHover: { backgroundColor: 'rgba(245,235,220,0.06)' } as object,
  rowHoverLight: { backgroundColor: 'rgba(29,45,51,0.06)' } as object,
  poster: {
    width: 30,
    height: 44,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,235,220,0.12)',
  } as object,
  text: { flexDirection: 'column' },
  title: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige } as object,
  titleLight: { color: COLORS.navy } as object,
  meta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: INK_TEXT.faint,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  } as object,
  metaLight: { color: PAPER_TEXT.faint } as object,
});
