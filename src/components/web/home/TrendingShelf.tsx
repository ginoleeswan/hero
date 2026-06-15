// src/components/web/home/TrendingShelf.tsx — "what's current" zone for web,
// grouped by title (poster + its cast) so the show↔character link is explicit.
import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { HeroImage } from '../../HeroImage';
import { COLORS } from '../../../constants/colors';
import { trendingTitleMeta, type TrendingTitle } from '../../../lib/db/trending';

const POSTER_W = 150;
const POSTER_H = 225;
const CHAR_W = 132;
const CHAR_H = 190;

function CharacterCard({
  character,
  onPress,
}: {
  character: TrendingTitle['characters'][number];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [cc.wrap, hovered && (cc.wrapHover as object)] as object
      }
    >
      <HeroImage
        id={character.id}
        name={character.name}
        imageUrl={character.image_url}
        portraitUrl={character.portrait_url}
        grid
        contentFit="cover"
        contentPosition="top"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object}
        recyclingKey={character.id}
      />
      <View style={cc.overlay as object} />
      <Text style={cc.name as object} numberOfLines={2}>
        {character.name}
      </Text>
    </Pressable>
  );
}

function TitleBlock({
  t,
  onHeroPress,
  onTitlePress,
}: {
  t: TrendingTitle;
  onHeroPress: (id: string) => void;
  onTitlePress: (id: string) => void;
}) {
  const meta = trendingTitleMeta(t);
  const posterUri = t.poster_url ?? t.backdrop_url ?? undefined;
  return (
    <View style={blk.row}>
      <Pressable
        onPress={() => onTitlePress(t.id)}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
          [blk.poster, hovered && (blk.posterHover as object)] as object
        }
      >
        {posterUri ? (
          <Image
            source={{ uri: posterUri }}
            contentFit="cover"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object}
          />
        ) : (
          <View style={[blk.posterFallback, { position: 'absolute', inset: 0 }] as object} />
        )}
        <View style={blk.posterOverlay as object} />
        <View style={blk.posterText}>
          <Text style={blk.posterTitle as object} numberOfLines={2}>
            {t.title}
          </Text>
          {!!meta && (
            <Text style={blk.posterMeta as object} numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>
      </Pressable>

      <View style={blk.strip as object}>
        {t.characters.map((c) => (
          <CharacterCard key={c.id} character={c} onPress={() => onHeroPress(c.id)} />
        ))}
      </View>
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
}: {
  label: string;
  title: string;
  accent?: string;
  titles: TrendingTitle[];
  onHeroPress: (id: string) => void;
  onTitlePress: (id: string) => void;
}) {
  const { width } = useWindowDimensions();
  const pagePad = width < 640 ? 16 : 32;
  if (titles.length === 0) return null;
  return (
    <View style={sec.section}>
      <View style={[sec.header, { paddingLeft: pagePad }]}>
        <View style={[sec.accentBar, { backgroundColor: accent }]} />
        <View style={sec.headerText}>
          <Text style={[sec.label, { color: accent }] as object}>{label}</Text>
          <Text style={sec.title as object}>{title}</Text>
        </View>
      </View>
      <View style={{ paddingLeft: pagePad, paddingRight: pagePad }}>
        {titles.map((t) => (
          <TitleBlock key={t.id} t={t} onHeroPress={onHeroPress} onTitlePress={onTitlePress} />
        ))}
      </View>
    </View>
  );
}

const sec = StyleSheet.create({
  section: { marginBottom: 40 },
  header: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
  },
  accentBar: { width: 4, borderRadius: 2, backgroundColor: COLORS.orange, minHeight: 38 },
  headerText: { gap: 2, justifyContent: 'center' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 30,
    color: COLORS.navy,
    lineHeight: 34,
  } as object,
});

const blk = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, marginBottom: 20, alignItems: 'flex-start' },
  poster: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  posterHover: {
    transform: [{ translateY: -4 }],
    boxShadow: '0 16px 40px rgba(0,0,0,0.32)',
  } as object,
  posterFallback: { backgroundColor: COLORS.navy } as object,
  posterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(11,24,32,0.94) 0%, rgba(11,24,32,0.1) 55%, transparent 100%)',
  } as object,
  posterText: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  posterTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.beige,
    lineHeight: 18,
  } as object,
  posterMeta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.skin,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  } as object,
  strip: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    overflowX: 'auto',
    paddingBottom: 8,
    scrollbarWidth: 'none',
  } as object,
});

const cc = StyleSheet.create({
  wrap: {
    width: CHAR_W,
    height: CHAR_H,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  wrapHover: {
    transform: [{ translateY: -5 }],
    boxShadow: '0 16px 40px rgba(0,0,0,0.34)',
    zIndex: 2,
  } as object,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.95) 0%, rgba(29,45,51,0.08) 55%, transparent 100%)',
  } as object,
  name: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.beige,
    lineHeight: 14,
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
  } as object,
});
