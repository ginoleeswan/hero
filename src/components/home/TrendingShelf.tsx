// src/components/home/TrendingShelf.tsx — "what's current" zone, grouped by title.
// Each title shows its poster + a strip of its top characters, so the show↔character
// link is explicit (vs. a flat row of faces). Poster taps into the title page;
// character thumbs open the character screen.
import { View, Text, FlatList, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import { trendingTitleMeta, type TrendingTitle } from '../../lib/db/trending';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POSTER_W = Math.round(SCREEN_WIDTH * 0.28);
const POSTER_H = Math.round(POSTER_W * 1.5); // 2:3 poster
const CHAR_W = Math.round(POSTER_H * 0.62);
const CHAR_H = POSTER_H;

export interface TrendingShelfProps {
  label: string;
  title: string;
  accent?: string;
  titles: TrendingTitle[];
  onHeroPress: (item: {
    id: string;
    portrait_url?: string | null;
    image_url?: string | null;
  }) => void;
  onTitlePress: (titleId: string) => void;
  disabled?: boolean;
}

function CharacterThumb({
  character,
  onPress,
  disabled,
}: {
  character: TrendingTitle['characters'][number];
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable style={s.charCard} onPress={onPress} disabled={disabled}>
      <HeroImage
        id={character.id}
        name={character.name}
        imageUrl={character.image_url}
        portraitUrl={character.portrait_url}
        grid
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill as object}
        recyclingKey={character.id}
      />
      <LinearGradient
        colors={['transparent', 'rgba(29,45,51,0.9)']}
        locations={[0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Text style={s.charName} numberOfLines={1}>
        {character.name}
      </Text>
    </Pressable>
  );
}

function TitleBlock({
  t,
  onHeroPress,
  onTitlePress,
  disabled,
}: {
  t: TrendingTitle;
  onHeroPress: TrendingShelfProps['onHeroPress'];
  onTitlePress: TrendingShelfProps['onTitlePress'];
  disabled?: boolean;
}) {
  const meta = trendingTitleMeta(t);
  const posterUri = t.poster_url ?? t.backdrop_url ?? undefined;
  return (
    <View style={s.block}>
      <Pressable style={s.poster} onPress={() => onTitlePress(t.id)} disabled={disabled}>
        {posterUri ? (
          <Image source={{ uri: posterUri }} contentFit="cover" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.posterFallback]} />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(11,24,32,0.92)']}
          locations={[0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.posterText}>
          <Text style={s.posterTitle} numberOfLines={2}>
            {t.title}
          </Text>
          {!!meta && (
            <Text style={s.posterMeta} numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>
      </Pressable>

      <FlatList
        horizontal
        data={t.characters}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.charStrip}
        removeClippedSubviews
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        renderItem={({ item }) => (
          <CharacterThumb character={item} disabled={disabled} onPress={() => onHeroPress(item)} />
        )}
      />
    </View>
  );
}

export function TrendingShelf({
  label,
  title,
  accent = COLORS.orange,
  titles,
  onHeroPress,
  onTitlePress,
  disabled = false,
}: TrendingShelfProps) {
  if (titles.length === 0) return null;
  return (
    <View style={s.section}>
      <View style={s.header}>
        <View style={[s.accentBar, { backgroundColor: accent }]} />
        <View style={s.headerText}>
          <Text style={[s.label, { color: accent }]}>{label}</Text>
          <Text style={s.title}>{title}</Text>
        </View>
      </View>
      {titles.map((t) => (
        <TitleBlock
          key={t.id}
          t={t}
          onHeroPress={onHeroPress}
          onTitlePress={onTitlePress}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingTop: 14, paddingBottom: 8 },
  header: {
    paddingHorizontal: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 11,
  },
  accentBar: { width: 4, borderRadius: 2, backgroundColor: COLORS.orange },
  headerText: { gap: 2, justifyContent: 'center' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.navy, lineHeight: 28 },

  block: { flexDirection: 'row', paddingLeft: 15, marginBottom: 16, gap: 10 },
  poster: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  posterFallback: { backgroundColor: COLORS.navy },
  posterText: { position: 'absolute', bottom: 8, left: 8, right: 8 },
  posterTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    color: COLORS.beige,
    lineHeight: 15,
  },
  posterMeta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.skin,
    letterSpacing: 0.6,
    marginTop: 2,
  },

  charStrip: { gap: 8, paddingRight: 15 },
  charCard: {
    width: CHAR_W,
    height: CHAR_H,
    borderRadius: 10,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
  },
  charName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.beige,
    lineHeight: 12,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
});
