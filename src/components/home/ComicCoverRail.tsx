// src/components/home/ComicCoverRail.tsx — a calm horizontal rail of this week's
// comic covers for the "New This Week" section of the Right Now band. Sibling of
// TitlePosterRail; taps open the lightweight issue page.
import { View, Text, FlatList, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import type { NewComic } from '../../lib/db/comics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// ~34% of a phone width, but capped so the rail stays sane on wide web/tablet
// (this component is reused on the web issue page, not just the mobile band).
const CARD_W = Math.min(132, Math.round(SCREEN_WIDTH * 0.34));
const CARD_H = Math.round(CARD_W * 1.5);

function onSaleDay(storeDate: string | null): string | null {
  if (!storeDate) return null;
  const d = new Date(storeDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ComicCoverRail({
  comics,
  onIssuePress,
  onLight,
  alignEnd = false,
  hideHeader = false,
}: {
  comics: NewComic[];
  /** Right-align the header (the character page's section-title grammar). */
  alignEnd?: boolean;
  /** Host renders its own section header (e.g. the character page's In Print band). */
  hideHeader?: boolean;
  onIssuePress: (issueId: string) => void;
  /** Set on a light/paper background (e.g. the character In Print section) so the
   *  title reads dark instead of the band's beige. */
  onLight?: boolean;
}) {
  if (comics.length === 0) return null;
  return (
    <View style={s.section}>
      {!hideHeader ? (
        <View style={[s.header, alignEnd && s.headerEnd]}>
          <Text style={s.label}>This Week</Text>
          <Text style={[s.title, onLight && s.titleOnLight]}>New Comics</Text>
        </View>
      ) : null}
      <FlatList
        horizontal
        data={comics}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.strip}
        initialNumToRender={4}
        renderItem={({ item }) => {
          const day = onSaleDay(item.storeDate);
          return (
            <Pressable style={s.card} onPress={() => onIssuePress(item.id)}>
              {item.coverUrl ? (
                <Image
                  source={{ uri: item.coverUrl }}
                  contentFit="cover"
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, s.fallback]} />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(11,24,32,0.92)']}
                locations={[0.45, 1]}
                style={StyleSheet.absoluteFill}
              />
              {!!day && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{day}</Text>
                </View>
              )}
              <Text style={s.name} numberOfLines={2}>
                {item.volumeName}
                {item.issueNumber ? ` #${item.issueNumber}` : ''}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 4, marginBottom: 6 },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  headerEnd: { alignItems: 'flex-end' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige, lineHeight: 28 },
  titleOnLight: { color: COLORS.navy },
  strip: { gap: 10, paddingHorizontal: 15, paddingBottom: 4 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 10,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
  },
  fallback: { backgroundColor: COLORS.navy },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.orange,
  },
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#fff',
  },
  name: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.beige,
    lineHeight: 13,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
});
