// src/components/home/MonthInHistoryRail.tsx — "This Month in History": the vintage
// debut ISSUES of the current calendar month (deduped — one card per issue), each
// showing its anniversary and the cast of characters who first appeared in it as
// tappable face-chips. The cover taps to the lead (most famous) character; each
// chip taps to its own character. Sibling of ComicCoverRail.
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { DebutIssue, DebutCharacter } from '../../lib/db/anniversaries';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Match the sibling cover rail (ComicCoverRail) so the cards align in width.
const CARD_W = Math.min(132, Math.round(SCREEN_WIDTH * 0.34));
const CARD_H = Math.round(CARD_W * 1.5);
const MAX_CHIPS = 3;

const MONTH = new Date().toLocaleString('en-US', { month: 'long' });

// "Superman" · "Superman & Lois Lane" · "Simba +2"
function castLine(chars: DebutCharacter[]): string {
  if (chars.length === 0) return '';
  if (chars.length === 1) return chars[0].name;
  if (chars.length === 2) return `${chars[0].name} & ${chars[1].name}`;
  return `${chars[0].name} +${chars.length - 1}`;
}

function issueLine(issue: DebutIssue): string {
  const num = issue.issueNumber ? ` #${issue.issueNumber}` : '';
  return `${issue.seriesName}${num} · ${issue.year}`;
}

export function MonthInHistoryRail({
  debuts,
  onHeroPress,
}: {
  debuts: DebutIssue[];
  onHeroPress: (id: string) => void;
}) {
  // Self-align to the surrounding rails: native (always < 640) keeps the 16px
  // gutter and 24px title; on wider web both grow to 32 / 26 so the section lines
  // up with the sibling rails (New Comics / Trending Now / In Your Universe).
  const { width } = useWindowDimensions();
  const pagePad = width < 640 ? 16 : 32;
  const titleSize = width < 640 ? 24 : 26;

  if (debuts.length === 0) return null;
  return (
    <View style={s.section}>
      <View style={[s.header, { paddingHorizontal: pagePad, marginBottom: width < 640 ? 12 : 14 }]}>
        <Text style={s.label}>This Month</Text>
        <Text style={[s.title, { fontSize: titleSize }]}>Debuts in {MONTH}</Text>
      </View>
      <FlatList
        horizontal
        data={debuts}
        keyExtractor={(d) => d.issueId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.strip, { paddingHorizontal: pagePad }]}
        initialNumToRender={4}
        renderItem={({ item }) => {
          const lead = item.characters[0];
          const visible = item.characters.slice(0, MAX_CHIPS);
          const extra = item.characters.length - visible.length;
          return (
            <Pressable style={s.card} onPress={() => lead && onHeroPress(lead.id)} disabled={!lead}>
              {item.cover_url ? (
                <Image
                  source={{ uri: item.cover_url }}
                  contentFit="cover"
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, s.fallback]} />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(11,24,32,0.55)', 'rgba(11,24,32,0.95)']}
                locations={[0.3, 0.6, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.badge}>
                <Text style={s.badgeText}>{item.yearsAgo} yrs</Text>
              </View>
              <View style={s.foot}>
                <View style={s.chips}>
                  {visible.map((c, i) => (
                    <Pressable
                      key={c.id}
                      style={[s.chip, { marginLeft: i === 0 ? 0 : -9, zIndex: visible.length - i }]}
                      onPress={() => onHeroPress(c.id)}
                    >
                      <HeroImage
                        id={c.id}
                        name={c.name}
                        imageUrl={c.image_url}
                        portraitUrl={c.portrait_url}
                        grid
                        contentFit="cover"
                        contentPosition="top"
                        style={StyleSheet.absoluteFill as object}
                        recyclingKey={c.id}
                      />
                    </Pressable>
                  ))}
                  {extra > 0 ? (
                    <View style={[s.chip, s.moreChip, { marginLeft: -9 }]}>
                      <Text style={s.moreText}>+{extra}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.cast} numberOfLines={1}>
                  {castLine(item.characters)}
                </Text>
                <Text style={s.issue} numberOfLines={1}>
                  {issueLine(item)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const CHIP = 28;
const s = StyleSheet.create({
  section: { marginTop: 4, marginBottom: 6 },
  header: {},
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige, lineHeight: 28 },
  strip: { gap: 10, paddingBottom: 4 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 12,
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
  foot: { paddingHorizontal: 9, paddingBottom: 9, gap: 5 },
  chips: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    width: CHIP,
    height: CHIP,
    borderRadius: CHIP / 2,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(245,235,220,0.85)',
    backgroundColor: COLORS.navy,
  },
  moreChip: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.navy },
  moreText: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: COLORS.beige },
  cast: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.beige, lineHeight: 14 },
  issue: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 9.5,
    color: 'rgba(245,235,220,0.62)',
    lineHeight: 12,
  },
});
