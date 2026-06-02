import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import { heroGridImageSource } from '../../../constants/heroImages';
import type { HeroSearchResult } from '../../../lib/db/heroes';
import { RoleBadge } from './RoleBadge';

interface SuggestionItemProps {
  hero: HeroSearchResult;
  query?: string;
  onPress: () => void;
}

/** Split a name into matched / unmatched segments for highlighting. */
function splitOnMatch(text: string, query: string): { value: string; match: boolean }[] {
  const q = query.trim();
  if (!q) return [{ value: text, match: false }];

  const parts: { value: string; match: boolean }[] = [];
  const lower = text.toLowerCase();
  const lq = q.toLowerCase();
  let i = 0;

  while (i < text.length) {
    const idx = lower.indexOf(lq, i);
    if (idx < 0) {
      parts.push({ value: text.slice(i), match: false });
      break;
    }
    if (idx > i) parts.push({ value: text.slice(i, idx), match: false });
    parts.push({ value: text.slice(idx, idx + q.length), match: true });
    i = idx + q.length;
  }

  return parts;
}

export function SuggestionItem({ hero, query = '', onPress }: SuggestionItemProps) {
  const source = heroGridImageSource(hero.id, hero.image_url, hero.portrait_url, hero.image_md_url);

  const segments = splitOnMatch(hero.name, query);

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [styles.suggestionItem, hovered && (styles.suggestionItemHover as object)] as object
      }
    >
      <Image
        source={source}
        style={styles.suggestionImage}
        contentFit="cover"
        contentPosition="top"
      />
      <View style={styles.metaRow}>
        <Text style={styles.suggestionName} numberOfLines={1}>
          {segments.map((seg, idx) => (
            <Text key={idx} style={seg.match ? (styles.nameMatch as object) : undefined}>
              {seg.value}
            </Text>
          ))}
        </Text>
        <RoleBadge alignment={hero.alignment} />
        {hero.publisher ? (
          <Text style={styles.publisherText} numberOfLines={1}>
            {`·  ${hero.publisher}`}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginHorizontal: 6,
    gap: 10,
    height: 52,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,

  suggestionItemHover: {
    backgroundColor: 'rgba(245,235,220,0.08)',
  } as object,

  suggestionImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(245,235,220,0.08)',
    flexShrink: 0,
  } as object,

  metaRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  } as object,

  suggestionName: {
    flexShrink: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.beige,
  },

  nameMatch: {
    color: COLORS.orange,
  },

  publisherText: {
    flexShrink: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.5)',
  },
});
