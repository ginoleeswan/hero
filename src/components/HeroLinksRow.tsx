import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import type { HeroLinks } from '../lib/db/people';

function imdbUrl(id: string): string {
  const seg = id.startsWith('tt') ? 'title' : id.startsWith('nm') ? 'name' : id.startsWith('ch') ? 'character' : null;
  return seg ? `https://www.imdb.com/${seg}/${id}/` : `https://www.imdb.com/find/?q=${encodeURIComponent(id)}`;
}

export function heroLinksHasContent(links: HeroLinks | null | undefined): boolean {
  return !!links && (!!links.site || !!links.imdb || !!links.wikidataQid || links.firstAppearanceYear != null);
}

/** External links + canonical debut year for a hero. Renders nothing when empty;
 *  the screen supplies the section header. */
export function HeroLinksRow({ links, contentInset = 20 }: { links: HeroLinks; contentInset?: number }) {
  const items: { label: string; icon: keyof typeof Ionicons.glyphMap; url: string }[] = [];
  if (links.site) items.push({ label: 'Official site', icon: 'globe-outline', url: links.site });
  if (links.imdb) items.push({ label: 'IMDb', icon: 'film-outline', url: imdbUrl(links.imdb) });
  if (links.wikidataQid) items.push({ label: 'Wikidata', icon: 'library-outline', url: `https://www.wikidata.org/wiki/${links.wikidataQid}` });
  if (items.length === 0 && links.firstAppearanceYear == null) return null;

  return (
    <View style={{ paddingHorizontal: contentInset, gap: 12 }}>
      {links.firstAppearanceYear != null ? (
        <Text style={styles.debut}>First appeared in {links.firstAppearanceYear}</Text>
      ) : null}
      {items.length > 0 ? (
        <View style={styles.row}>
          {items.map((it) => (
            <Pressable key={it.label} onPress={() => Linking.openURL(it.url)} style={styles.pill}>
              <Ionicons name={it.icon} size={14} color={COLORS.navy} />
              <Text style={styles.pillText}>{it.label}</Text>
              <Ionicons name="open-outline" size={12} color={COLORS.grey} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  debut: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: COLORS.navy + 'cc' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.navy + '0f',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  pillText: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: COLORS.navy },
});
