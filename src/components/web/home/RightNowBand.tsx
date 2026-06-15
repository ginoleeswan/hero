// src/components/web/home/RightNowBand.tsx — the "what's happening now" editorial
// zone for web. Desktop: a campaign hero beside a ranked "What's Hot" sidebar,
// then the badged trending shelves. Mobile-web: a clean vertical stack.
import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { HeroImage } from '../../HeroImage';
import { COLORS } from '../../../constants/colors';
import { TrendingShelf } from './TrendingShelf';
import {
  trendingBadge,
  type BadgeTone,
  type Campaign,
  type TrendingTitle,
  type TrendingTitleCharacter,
} from '../../../lib/db/trending';

const BADGE_COLOR: Record<BadgeTone, string> = {
  theaters: COLORS.orange,
  streaming: COLORS.blue,
  coming: COLORS.gold,
};

interface RightNowBandProps {
  campaign?: Campaign | null;
  onScreen: TrendingTitle[];
  comingSoon: TrendingTitle[];
  streaming: TrendingTitle[];
  personalized: TrendingTitleCharacter[];
  onHeroPress: (id: string) => void;
  onTitlePress: (id: string) => void;
}

function CampaignHero({
  campaign,
  onHeroPress,
  tall,
}: {
  campaign: Campaign;
  onHeroPress: (id: string) => void;
  tall: boolean;
}) {
  const accent = campaign.accent ?? COLORS.orange;
  const top = campaign.characters[0];
  const bgUri = top?.image_url ?? top?.portrait_url ?? undefined;
  return (
    <Pressable
      onPress={() => top && onHeroPress(top.id)}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [ch.wrap, { minHeight: tall ? 320 : 220 }, hovered && (ch.wrapHover as object)] as object
      }
    >
      {bgUri ? (
        <Image
          source={{ uri: bgUri }}
          contentFit="cover"
          contentPosition="top"
          style={{ position: 'absolute', inset: 0 } as object}
        />
      ) : (
        <View
          style={[{ position: 'absolute', inset: 0, backgroundColor: COLORS.navy }] as object}
        />
      )}
      <View style={ch.overlay as object} />
      <View style={ch.content}>
        <Text style={[ch.eyebrow, { color: accent }] as object}>{campaign.label}</Text>
        <Text style={ch.headline as object} numberOfLines={2}>
          {campaign.headline}
        </Text>
        {!!campaign.blurb && (
          <Text style={ch.blurb as object} numberOfLines={2}>
            {campaign.blurb}
          </Text>
        )}
        <View style={ch.bottom}>
          <View style={ch.avatars}>
            {campaign.characters.slice(0, 6).map((c, i) => (
              <View key={c.id} style={[ch.avatar, { marginLeft: i === 0 ? 0 : -12 }] as object}>
                <HeroImage
                  id={c.id}
                  name={c.name}
                  imageUrl={c.image_url}
                  portraitUrl={c.portrait_url}
                  grid
                  contentFit="cover"
                  contentPosition="top"
                  style={{ position: 'absolute', inset: 0 } as object}
                  recyclingKey={c.id}
                />
              </View>
            ))}
          </View>
          <View style={[ch.cta, { backgroundColor: accent }] as object}>
            <Text style={ch.ctaText as object}>Explore ›</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function WhatsHot({
  titles,
  onTitlePress,
}: {
  titles: TrendingTitle[];
  onTitlePress: (id: string) => void;
}) {
  if (titles.length === 0) return null;
  return (
    <View style={wh.wrap}>
      <Text style={wh.heading as object}>What’s Hot</Text>
      {titles.slice(0, 6).map((t, i) => {
        const badge = trendingBadge(t);
        const posterUri = t.poster_url ?? t.backdrop_url ?? undefined;
        return (
          <Pressable
            key={t.id}
            onPress={() => onTitlePress(t.id)}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [wh.row, hovered && (wh.rowHover as object)] as object
            }
          >
            <Text style={wh.rank as object}>{i + 1}</Text>
            <View style={wh.thumb as object}>
              {posterUri ? (
                <Image
                  source={{ uri: posterUri }}
                  contentFit="cover"
                  style={{ position: 'absolute', inset: 0 } as object}
                />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={wh.title as object} numberOfLines={1}>
                {t.title}
              </Text>
              {badge && (
                <Text
                  style={[wh.badge, { color: BADGE_COLOR[badge.tone] }] as object}
                  numberOfLines={1}
                >
                  {badge.label}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function PersonalRow({
  characters,
  onHeroPress,
}: {
  characters: TrendingTitleCharacter[];
  onHeroPress: (id: string) => void;
}) {
  const { width } = useWindowDimensions();
  const pagePad = width < 640 ? 16 : 32;
  return (
    <View style={{ marginTop: 8 }}>
      <View style={[pr.header, { paddingLeft: pagePad }]}>
        <View style={[pr.accentBar, { backgroundColor: COLORS.skin }]} />
        <View>
          <Text style={pr.label as object}>For You</Text>
          <Text style={pr.title as object}>In Your Universe</Text>
        </View>
      </View>
      <View style={[pr.strip, { paddingLeft: pagePad, paddingRight: pagePad }] as object}>
        {characters.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => onHeroPress(c.id)}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [pr.card, hovered && (pr.cardHover as object)] as object
            }
          >
            <HeroImage
              id={c.id}
              name={c.name}
              imageUrl={c.image_url}
              portraitUrl={c.portrait_url}
              grid
              contentFit="cover"
              contentPosition="top"
              style={{ position: 'absolute', inset: 0 } as object}
              recyclingKey={c.id}
            />
            <View style={pr.cardOverlay as object} />
            <Text style={pr.cardName as object} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function RightNowBand({
  campaign,
  onScreen,
  comingSoon,
  streaming,
  personalized,
  onHeroPress,
  onTitlePress,
}: RightNowBandProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const pagePad = width < 640 ? 16 : 32;
  const hasAny =
    !!campaign ||
    onScreen.length > 0 ||
    comingSoon.length > 0 ||
    streaming.length > 0 ||
    personalized.length > 0;
  if (!hasAny) return null;

  // "What's Hot" ranks the live slate by popularity — on_screen leads, then streaming.
  const hotTitles = [...onScreen, ...streaming];

  return (
    <View style={band.band}>
      <View style={[band.header, { paddingHorizontal: pagePad }]}>
        <View style={band.pulse as object} />
        <Text style={band.kicker as object}>Right Now</Text>
        <View style={{ flex: 1 }} />
        <Text style={band.fresh as object}>Updated today</Text>
      </View>

      {isDesktop && campaign && campaign.characters.length > 0 ? (
        <View style={[band.topRow, { paddingHorizontal: pagePad }]}>
          <View style={{ flex: 1 }}>
            <CampaignHero campaign={campaign} onHeroPress={onHeroPress} tall />
          </View>
          <WhatsHot titles={hotTitles} onTitlePress={onTitlePress} />
        </View>
      ) : (
        campaign &&
        campaign.characters.length > 0 && (
          <View style={{ paddingHorizontal: pagePad }}>
            <CampaignHero campaign={campaign} onHeroPress={onHeroPress} tall={false} />
          </View>
        )
      )}

      <TrendingShelf
        label="In Theaters & Recent"
        title="On the Big Screen"
        accent={COLORS.orange}
        tone="dark"
        titles={onScreen}
        onHeroPress={onHeroPress}
        onTitlePress={onTitlePress}
      />
      <TrendingShelf
        label="Releasing Soon"
        title="Coming Soon"
        accent={COLORS.gold}
        tone="dark"
        titles={comingSoon}
        onHeroPress={onHeroPress}
        onTitlePress={onTitlePress}
      />
      <TrendingShelf
        label="Now Streaming"
        title="Streaming Now"
        accent={COLORS.blue}
        tone="dark"
        titles={streaming}
        onHeroPress={onHeroPress}
        onTitlePress={onTitlePress}
      />

      {personalized.length > 0 && (
        <PersonalRow characters={personalized} onHeroPress={onHeroPress} />
      )}
    </View>
  );
}

const band = StyleSheet.create({
  band: { backgroundColor: COLORS.deepNavy, paddingTop: 28, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 18 },
  pulse: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.orange,
    boxShadow: `0 0 0 4px ${COLORS.orange}33`,
  } as object,
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: COLORS.beige,
  } as object,
  fresh: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.45)',
  } as object,
  topRow: { flexDirection: 'row', gap: 20, marginBottom: 24, alignItems: 'stretch' },
});

const ch = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  wrapHover: {
    transform: [{ translateY: -3 }],
    boxShadow: '0 22px 50px rgba(0,0,0,0.4)',
  } as object,
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(11,24,32,0.96) 0%, rgba(11,24,32,0.45) 55%, rgba(11,24,32,0.2) 100%)',
  } as object,
  content: { padding: 24, gap: 2 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  } as object,
  headline: {
    fontFamily: 'Flame-Regular',
    fontSize: 40,
    color: COLORS.beige,
    lineHeight: 42,
  } as object,
  blurb: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(245,235,220,0.75)',
    marginTop: 8,
    maxWidth: 520,
  } as object,
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  avatars: { flexDirection: 'row' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.deepNavy,
    backgroundColor: COLORS.navy,
  } as object,
  cta: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24 } as object,
  ctaText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  } as object,
});

const wh = StyleSheet.create({
  wrap: {
    width: 320,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    gap: 4,
  } as object,
  heading: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    marginBottom: 8,
  } as object,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 7,
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  rowHover: { backgroundColor: 'rgba(255,255,255,0.05)' } as object,
  rank: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: 'rgba(245,235,220,0.35)',
    width: 26,
    textAlign: 'center',
  } as object,
  thumb: {
    width: 38,
    height: 54,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  } as object,
  title: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.beige } as object,
  badge: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  } as object,
});

const pr = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'stretch', gap: 14, marginTop: 8, marginBottom: 14 },
  accentBar: { width: 4, borderRadius: 2, minHeight: 36 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.skin,
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: COLORS.beige,
    lineHeight: 30,
  } as object,
  strip: {
    flexDirection: 'row',
    gap: 12,
    overflowX: 'auto',
    paddingBottom: 8,
    scrollbarWidth: 'none',
  } as object,
  card: {
    width: 120,
    height: 170,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    cursor: 'pointer',
    justifyContent: 'flex-end',
    transition: 'transform 200ms ease',
  } as object,
  cardHover: { transform: [{ translateY: -4 }] } as object,
  cardOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(to top, rgba(29,45,51,0.92) 0%, transparent 60%)',
  } as object,
  cardName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.beige,
    paddingHorizontal: 8,
    paddingBottom: 8,
  } as object,
});
