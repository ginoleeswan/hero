import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { HeroFace } from '../../HeroFace';
import type { HeroSearchResult } from '../../../lib/db/heroes';
import { RoleBadge } from './RoleBadge';

interface SuggestionItemProps {
  hero: HeroSearchResult;
  query?: string;
  onPress: () => void;
  /** Highlighted by the palette's keyboard cursor — renders like a hover. */
  active?: boolean;
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

/** When the query isn't in the visible name, find the real-name/alias that DID
 *  match, so the row explains itself ("Captain Marvel · Billy Batson") instead of
 *  looking random. */
function matchReason(hero: HeroSearchResult, query: string): string | null {
  const q = query.trim().toLowerCase();
  if (!q || hero.name.toLowerCase().includes(q)) return null;
  if (hero.full_name && hero.full_name.toLowerCase().includes(q)) return hero.full_name;
  return (hero.aliases ?? []).find((a) => a.toLowerCase().includes(q)) ?? null;
}

export function SuggestionItem({ hero, query = '', onPress, active = false }: SuggestionItemProps) {
  const segments = splitOnMatch(hero.name, query);
  const reason = matchReason(hero, query);

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.suggestionItem,
          (hovered || active) && (styles.suggestionItemHover as object),
        ] as object
      }
    >
      <HeroFace
        id={hero.id}
        name={hero.name}
        avatarUrl={hero.avatar_url}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        imageMdUrl={hero.image_md_url}
        size={40}
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
        {reason ? (
          <Text style={styles.publisherText} numberOfLines={1}>
            {'·  '}
            {splitOnMatch(reason, query).map((seg, i) => (
              <Text key={i} style={seg.match ? (styles.nameMatch as object) : undefined}>
                {seg.value}
              </Text>
            ))}
          </Text>
        ) : hero.publisher ? (
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

  // Circular = "this is a person/character" — distinct at a glance from the
  // squared team tiles and tall film posters (per-type shape language).
  suggestionImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
