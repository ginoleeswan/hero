// src/components/home/RightNowBand.tsx — the "what's happening now" editorial
// zone. One continuous dark band that gives the dynamic/personal content its own
// chapter: a live pulse + freshness cue, a cinematic campaign hero, the trending
// title shelves (badged), and a personalized "In Your Universe" strip.
import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import { TitlePosterRail } from './TitlePosterRail';
import { ComicCoverRail } from './ComicCoverRail';
import { TrendingMovers } from './TrendingMovers';
import { ThisMonthInHistory } from './ThisMonthInHistory';
import {
  mergeTrendingTitles,
  type Campaign,
  type TrendingTitle,
  type TrendingTitleCharacter,
  type WikiTrendingHero,
} from '../../lib/db/trending';
import type { NewComic } from '../../lib/db/comics';
import type { DebutIssue } from '../../lib/db/anniversaries';
import type { LiveEvent } from '../../lib/db/events';
import { computeFreshness } from '../../lib/home/freshness';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type HeroPress = (item: {
  id: string;
  portrait_url?: string | null;
  image_url?: string | null;
}) => void;

export interface RightNowBandProps {
  campaign?: Campaign | null;
  onScreen: TrendingTitle[];
  comingSoon: TrendingTitle[];
  streaming: TrendingTitle[];
  personalized: TrendingTitleCharacter[];
  newComics: NewComic[];
  wikiTrending: WikiTrendingHero[];
  debuts: DebutIssue[];
  /** A detected real-world event in progress (SDCC, a Direct). Drives the header's
   *  live label; absent means the band falls back to content timestamps. */
  liveEvent?: LiveEvent | null;
  onHeroPress: HeroPress;
  onTitlePress: (titleId: string) => void;
  onIssuePress: (issueId: string) => void;
  disabled?: boolean;
}

/** The live dot. Only animates when the band's content is genuinely recent — a
 *  throbbing dot over week-old cards reads as an abandoned app. */
function PulseDot({ animate }: { animate: boolean }) {
  const v = useSharedValue(1);
  useEffect(() => {
    if (!animate) {
      v.value = 1;
      return;
    }
    v.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 800 }), withTiming(1, { duration: 800 })),
      -1,
      false,
    );
  }, [v, animate]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[bandStyles.pulse, !animate && bandStyles.pulseIdle, style]} />;
}

function CampaignHero({
  campaign,
  onHeroPress,
  onTitlePress,
  disabled,
}: {
  campaign: Campaign;
  onHeroPress: HeroPress;
  onTitlePress: (titleId: string) => void;
  disabled?: boolean;
}) {
  const accent = campaign.accent ?? COLORS.orange;
  const top = campaign.characters[0];
  const avatarChars = campaign.characters.slice(0, 5);
  // Prefer the linked title's TMDB backdrop (composed for wide framing); fall
  // back to character art for franchise-/hero-only campaigns with no title.
  const bgUri = campaign.backdrop_url ?? top?.image_url ?? top?.portrait_url ?? undefined;
  // The cover is the title (media); tap it to open the title page, only falling
  // back to the lead character when the campaign has no linked title.
  const openCover = () => {
    if (campaign.title_id) onTitlePress(campaign.title_id);
    else if (top) onHeroPress(top);
  };
  return (
    <Pressable
      style={hero.wrap}
      onPress={openCover}
      disabled={disabled || (!campaign.title_id && !top)}
    >
      {bgUri ? (
        <Image
          source={{ uri: bgUri }}
          contentFit="cover"
          // Wide cinematic backdrop, not a portrait — center the crop so subjects
          // stay in frame instead of being pushed off the bottom edge.
          contentPosition="center"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.navy }]} />
      )}
      <LinearGradient
        colors={['rgba(11,24,32,0.35)', 'rgba(11,24,32,0.96)']}
        locations={[0, 0.78]}
        style={StyleSheet.absoluteFill}
      />
      <View style={hero.content}>
        <Text style={[hero.eyebrow, { color: accent }]}>{campaign.label}</Text>
        <Text style={hero.headline} numberOfLines={2}>
          {campaign.headline}
        </Text>
        {!!campaign.blurb && (
          <Text style={hero.blurb} numberOfLines={2}>
            {campaign.blurb}
          </Text>
        )}
        <View style={hero.bottom}>
          <View style={hero.avatars}>
            {avatarChars.map((c, i) => (
              <View
                key={c.id}
                // Descending zIndex so each chip overlaps the one to its right —
                // the left chip's edge sits on top instead of being clipped.
                style={[
                  hero.avatar,
                  { marginLeft: i === 0 ? 0 : -10, zIndex: avatarChars.length - i },
                ]}
              >
                <HeroImage
                  id={c.id}
                  name={c.name}
                  imageUrl={c.image_url}
                  portraitUrl={c.portrait_url}
                  grid
                  contentFit="cover"
                  contentPosition={{ top: '20%', left: '50%' }}
                  style={StyleSheet.absoluteFill as object}
                  recyclingKey={c.id}
                />
              </View>
            ))}
          </View>
          <View style={[hero.cta, { backgroundColor: accent }]}>
            <Text style={hero.ctaText}>Explore ›</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function PersonalStrip({
  characters,
  onHeroPress,
  disabled,
}: {
  characters: TrendingTitleCharacter[];
  onHeroPress: HeroPress;
  disabled?: boolean;
}) {
  return (
    <View style={ps.wrap}>
      <View style={bandStyles.shelfHeader}>
        <View style={[bandStyles.accentBar, { backgroundColor: COLORS.skin }]} />
        <View>
          <Text style={[bandStyles.shelfLabel, { color: COLORS.skin }]}>For You</Text>
          <Text style={bandStyles.shelfTitle}>In Your Universe</Text>
        </View>
      </View>
      <FlatList
        horizontal
        data={characters}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ps.strip}
        removeClippedSubviews
        initialNumToRender={5}
        renderItem={({ item }) => (
          <Pressable style={ps.card} onPress={() => onHeroPress(item)} disabled={disabled}>
            <HeroImage
              id={item.id}
              name={item.name}
              imageUrl={item.image_url}
              portraitUrl={item.portrait_url}
              grid
              contentFit="cover"
              contentPosition="top"
              style={StyleSheet.absoluteFill as object}
              recyclingKey={item.id}
            />
            <LinearGradient
              colors={['transparent', 'rgba(29,45,51,0.9)']}
              locations={[0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={ps.name} numberOfLines={1}>
              {item.name}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

export function RightNowBand({
  campaign,
  onScreen,
  comingSoon,
  streaming,
  personalized,
  newComics,
  wikiTrending,
  debuts,
  liveEvent,
  onHeroPress,
  onTitlePress,
  onIssuePress,
  disabled = false,
}: RightNowBandProps) {
  const hasAny =
    !!campaign ||
    onScreen.length > 0 ||
    comingSoon.length > 0 ||
    streaming.length > 0 ||
    personalized.length > 0 ||
    newComics.length > 0 ||
    wikiTrending.length > 0 ||
    debuts.length > 0;
  if (!hasAny) return null;

  // Derived from the freshest real event in the band, not from a hardcoded
  // string. Suppressed entirely once the content is stale — see freshness.ts.
  const fresh = computeFreshness({
    storeDates: newComics.map((c) => c.storeDate),
    liveEventOngoing: liveEvent?.ongoing,
    liveEventLabel: liveEvent?.headline,
  });

  return (
    <View style={bandStyles.band}>
      <View style={bandStyles.header}>
        <PulseDot animate={fresh.pulse} />
        <Text style={bandStyles.kicker}>Right Now</Text>
        <View style={{ flex: 1 }} />
        {!!fresh.label && <Text style={bandStyles.fresh}>{fresh.label}</Text>}
      </View>

      {campaign && campaign.characters.length > 0 && (
        <CampaignHero
          campaign={campaign}
          onHeroPress={onHeroPress}
          onTitlePress={onTitlePress}
          disabled={disabled}
        />
      )}

      {/* One calm rail — theatrical, upcoming and streaming merged; the badge
          on each poster carries the distinction. */}
      <TitlePosterRail
        label="In Cinemas & Streaming"
        title="On Screen Now"
        titles={mergeTrendingTitles(onScreen, comingSoon, streaming, 20)}
        onTitlePress={onTitlePress}
      />

      <ComicCoverRail comics={newComics} onIssuePress={onIssuePress} />

      <TrendingMovers heroes={wikiTrending} onHeroPress={(id) => onHeroPress({ id })} />

      <ThisMonthInHistory debuts={debuts} onHeroPress={(id) => onHeroPress({ id })} />

      {personalized.length > 0 && (
        <PersonalStrip characters={personalized} onHeroPress={onHeroPress} disabled={disabled} />
      )}
    </View>
  );
}

const bandStyles = StyleSheet.create({
  band: {
    backgroundColor: COLORS.deepNavy,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.orange },
  // Stale content gets a dimmed, still dot rather than a confident live one.
  pulseIdle: { backgroundColor: COLORS.grey },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: COLORS.beige,
  },
  fresh: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.45)',
  },
  shelfHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 11,
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  accentBar: { width: 4, borderRadius: 2 },
  shelfLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  shelfTitle: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige, lineHeight: 28 },
});

const hero = StyleSheet.create({
  wrap: {
    height: Math.round(SCREEN_WIDTH * 0.62),
    marginHorizontal: 15,
    marginBottom: 18,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  content: { flex: 1, justifyContent: 'flex-end', padding: 16 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  headline: { fontFamily: 'Flame-Regular', fontSize: 28, color: COLORS.beige, lineHeight: 35 },
  blurb: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(245,235,220,0.72)',
    marginTop: 6,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  avatars: { flexDirection: 'row' },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.deepNavy,
    backgroundColor: COLORS.navy,
  },
  cta: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  ctaText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

const POSTER_H = Math.round(Math.round(SCREEN_WIDTH * 0.28) * 1.5);
const ps = StyleSheet.create({
  wrap: { marginTop: 4 },
  strip: { gap: 8, paddingHorizontal: 15, paddingBottom: 4 },
  card: {
    width: Math.round(POSTER_H * 0.62),
    height: POSTER_H,
    borderRadius: 10,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
  },
  name: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.beige,
    lineHeight: 12,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
});
