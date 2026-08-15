// src/components/home/RightNowBand.tsx — the "what's happening now" editorial
// zone. One continuous dark band that gives the dynamic/personal content its own
// chapter: a live pulse + freshness cue, a cinematic campaign hero, the trending
// title shelves (badged), and a personalized "In Your Universe" strip.
import { useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList, useWindowDimensions } from 'react-native';
import { Text } from '../ui/Text';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  useReducedMotion,
  cancelAnimation,
  withSequence,
} from 'react-native-reanimated';
import { useScreenFocused } from '../../hooks/useScreenFocused';
import { HeroImage } from '../HeroImage';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { TitlePosterRail } from './TitlePosterRail';
import { ComicCoverRail } from './ComicCoverRail';
import { TrendingMovers } from './TrendingMovers';
import { ThisMonthInHistory } from './ThisMonthInHistory';
import { PulseRail } from './PulseRail';
import {
  mergeTrendingTitles,
  type Campaign,
  type TrendingTitle,
  type TrendingTitleCharacter,
  type WikiTrendingHero,
} from '../../lib/db/trending';
import type { NewComic } from '../../lib/db/comics';
import type { DebutIssue } from '../../lib/db/anniversaries';
import { computeFreshness } from '../../lib/home/freshness';
import type { PulseEvent } from '../../lib/home/pulse';
import { railCardWidth } from '../../constants/layout';
import { sectionGap } from './homeGeometry';

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
  /** Ranked timestamped events — the Pulse rail at the top of the band. */
  pulse?: PulseEvent[];
  /** Name of a detected real-world event in progress (SDCC, a Direct). Drives the
   *  header's live label; absent means the band falls back to content timestamps. */
  liveEventName?: string | null;
  onHeroPress: HeroPress;
  onTitlePress: (titleId: string) => void;
  onIssuePress: (issueId: string) => void;
  /** A live event → the EDITION that is live, falling back to the hub at
   *  /event/[slug] when the edition row does not exist yet. */
  onEventPress: (slug: string, editionSlug: string | null) => void;
  /** Forwarded to the rail's trailing card. See PulseRail — /event had no
   *  inbound link anywhere in the app before this. */
  onArchivePress?: () => void;
  disabled?: boolean;
}

/** The live dot. Only animates when the band's content is genuinely recent — a
 *  throbbing dot over week-old cards reads as an abandoned app. */
function PulseDot({ animate }: { animate: boolean }) {
  const v = useSharedValue(1);
  // A dot that throbs forever is the single most literal thing Reduce Motion
  // exists to suppress — more so than any transition, because it never ends.
  // Every other loop in this app checked it; this one did not.
  const reduced = useReducedMotion();
  // ...and it holds still on another tab. NativeTabs keeps Explore mounted, so
  // without this it blinks in an unwatched screen for as long as the app runs.
  const focused = useScreenFocused();
  const live = animate && !reduced && focused;
  useEffect(() => {
    if (!live) {
      // Rest at full opacity, never mid-blink: cancelling on blur would freeze
      // a live indicator at 30% and leave it looking broken on return.
      cancelAnimation(v);
      v.value = 1;
      return;
    }
    v.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 800 }), withTiming(1, { duration: 800 })),
      -1,
      false,
    );
    return () => cancelAnimation(v);
  }, [v, live]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[bandStyles.pulse, !live && bandStyles.pulseIdle, style]} />;
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
  const { width: winW } = useWindowDimensions();
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
      style={[hero.wrap, { height: Math.round(Math.min(winW, 720) * 0.62) }]}
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
  const posterSize = usePosterSize();
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
          <Pressable
            style={[ps.card, posterSize]}
            onPress={() => onHeroPress(item)}
            disabled={disabled}
          >
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
  pulse = [],
  liveEventName,
  onHeroPress,
  onTitlePress,
  onIssuePress,
  onEventPress,
  onArchivePress,
  disabled = false,
}: RightNowBandProps) {
  // Above the early return — the band bails out when it has nothing to show,
  // and a hook after that would run conditionally.
  const { width } = useWindowDimensions();
  const hasAny =
    !!campaign ||
    onScreen.length > 0 ||
    comingSoon.length > 0 ||
    streaming.length > 0 ||
    personalized.length > 0 ||
    newComics.length > 0 ||
    wikiTrending.length > 0 ||
    pulse.length > 0 ||
    debuts.length > 0;
  if (!hasAny) return null;

  // Derived from the freshest real event in the band, not from a hardcoded
  // string. Suppressed entirely once the content is stale — see freshness.ts.
  const fresh = computeFreshness({
    // The Pulse carries the sharpest timestamps (trailer drops); comics are the
    // fallback when it's empty or the migration hasn't landed.
    publishedAt: pulse.map((e) => e.occurredAt),
    storeDates: newComics.map((c) => c.storeDate),
    liveEventOngoing: !!liveEventName,
    liveEventLabel: liveEventName,
  });

  // The live card's one line of proof, from the wikiTrending already in props —
  // no extra fetch. `avatar_url` is famous-tier-only and was null on 13 of 14
  // rows in production, so this is a name and a number rather than faces.
  const topMover = wikiTrending[0]
    ? { name: wikiTrending[0].name, spikePct: wikiTrending[0].spikePct }
    : null;

  // The band's top padding IS the boundary under the ticker — one number from
  // the same scale as every other dark-stage boundary (see sectionGap).
  const gap = sectionGap(width, { top: 20, bottom: 18 });

  return (
    <View style={[bandStyles.band, { paddingTop: gap.top }]}>
      <View style={bandStyles.header}>
        {/* Freshness belongs beside the kicker — it describes THIS band. That
            frees the right edge for one navigational affordance, which is where
            a reader looks for one. It was a 104px card at the end of a
            horizontal rail, i.e. only findable by someone who had already
            scrolled past everything it was competing with. */}
        <PulseDot animate={fresh.pulse} />
        <Text style={bandStyles.kicker}>Right Now</Text>
        {!!fresh.label && <Text style={bandStyles.fresh}>{fresh.label}</Text>}
        <View style={{ flex: 1 }} />
        {!!onArchivePress && (
          <Pressable
            onPress={onArchivePress}
            style={bandStyles.archiveLink}
            accessibilityRole="link"
            accessibilityLabel="All events"
            hitSlop={8}
          >
            <Text style={bandStyles.archiveText}>All events</Text>
            <Ionicons name="chevron-forward" size={12} color={COLORS.beige} />
          </Pressable>
        )}
      </View>

      <PulseRail
        events={pulse}
        topMover={topMover}
        onTitlePress={onTitlePress}
        onIssuePress={onIssuePress}
        onEventPress={onEventPress}
        onHeroPress={onHeroPress}
        disabled={disabled}
      />

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
    // paddingTop is the section boundary and comes from sectionGap(); the
    // bottom is internal to the band, not a boundary — the beige Library seam
    // follows it, and that seam is a device of its own.
    backgroundColor: COLORS.deepNavy,
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
    color: INK_TEXT.faint,
  },
  archiveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  archiveText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.4,
    color: COLORS.beige,
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

/**
 * The poster's size, live and capped.
 *
 * 28% of the window is a 90pt thumbnail on a phone and a 334pt poster on a
 * landscape iPad, which would make the small "also showing" strip out-shout the
 * campaign hero above it.
 */
function usePosterSize() {
  const { width } = useWindowDimensions();
  const h = Math.round(railCardWidth(width, 0.28, 150) * 1.5);
  return { width: Math.round(h * 0.62), height: h };
}
const ps = StyleSheet.create({
  wrap: { marginTop: 4 },
  strip: { gap: 8, paddingHorizontal: 15, paddingBottom: 4 },
  card: {
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
