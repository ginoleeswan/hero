// src/components/web/home/RightNowBand.tsx — the "what's happening now" editorial
// zone for web. Desktop: a campaign hero beside a ranked "What's Hot" sidebar,
// then the badged trending shelves. Mobile-web: a clean vertical stack.
import React from 'react';
import ReactDOM from 'react-dom';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { HeroImage } from '../../HeroImage';
import { COLORS, EYEBROW, INK_TEXT, pageGutter } from '../../../constants/colors';
import {
  mergeTrendingTitles,
  trendingBadge,
  type BadgeTone,
  type Campaign,
  type TrendingTitle,
  type TrendingTitleCharacter,
  type WikiTrendingHero,
} from '../../../lib/db/trending';
import type { NewComic } from '../../../lib/db/comics';
import { TrendingMovers } from './TrendingMovers';
import { ThisMonthInHistory } from './ThisMonthInHistory';
import type { DebutIssue } from '../../../lib/db/anniversaries';

const BADGE_ICON: Record<BadgeTone, 'ticket-outline' | 'calendar-outline' | null> = {
  theaters: 'ticket-outline',
  coming: 'calendar-outline',
  // No logo came back for this streamer, so the pill carries its name. A ticket
  // would be a lie and a play glyph would imply we can start it.
  streaming: null,
};

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
  trendingOnScreen: TrendingTitle[];
  personalized: TrendingTitleCharacter[];
  newComics: NewComic[];
  wikiTrending: WikiTrendingHero[];
  debuts: DebutIssue[];
  onHeroPress: (id: string) => void;
  onTitlePress: (id: string) => void;
  onIssuePress: (issueId: string) => void;
}

// One avatar chip in the campaign hero. Tracks its own hover so it can lift,
// ring in the accent colour, jump above its neighbours, and show an instant
// name tooltip (the native `title` tooltip is too slow and fights the scale).
function CampaignAvatar({
  character,
  index,
  count,
  accent,
  onPress,
}: {
  character: TrendingTitleCharacter;
  index: number;
  count: number;
  accent: string;
  onPress: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const nodeRef = React.useRef<HTMLElement | null>(null);
  // Tooltip is portalled to <body> so the hero card's overflow:hidden (rounded
  // corners) can't clip it when it sits below the bottom-row chips.
  const [tipPos, setTipPos] = React.useState<{ x: number; y: number } | null>(null);
  const enter = () => {
    setHovered(true);
    const r = nodeRef.current?.getBoundingClientRect();
    if (r) setTipPos({ x: r.left + r.width / 2, y: r.bottom + 8 });
  };
  const leave = () => {
    setHovered(false);
    setTipPos(null);
  };
  return (
    <Pressable
      ref={(node) => {
        nodeRef.current = node as unknown as HTMLElement | null;
      }}
      onHoverIn={enter}
      onHoverOut={leave}
      onPress={(e) => {
        // Don't also trigger the whole-hero cover press.
        (e as unknown as { stopPropagation?: () => void }).stopPropagation?.();
        onPress();
      }}
      aria-label={character.name}
      // Outer slot owns stacking + overlap. Hovered chip tops all of them.
      style={
        [
          ch.avatarSlot,
          { marginLeft: index === 0 ? 0 : -12, zIndex: hovered ? 30 : count - index },
        ] as object
      }
    >
      <View
        style={
          [
            ch.avatar,
            hovered &&
              ({
                transform: [{ translateY: -4 }, { scale: 1.18 }],
                borderColor: accent,
                boxShadow: '0 8px 18px rgba(0,0,0,0.4)',
              } as object),
          ] as object
        }
      >
        <HeroImage
          id={character.id}
          name={character.name}
          imageUrl={character.image_url}
          portraitUrl={character.portrait_url}
          grid
          contentFit="cover"
          contentPosition={{ top: '20%', left: '50%' }}
          style={{ position: 'absolute', inset: 0 } as object}
          recyclingKey={character.id}
        />
      </View>
      {tipPos &&
        typeof document !== 'undefined' &&
        ReactDOM.createPortal(
          <div style={{ ...TIP_STYLE, left: tipPos.x, top: tipPos.y }}>{character.name}</div>,
          document.body,
        )}
    </Pressable>
  );
}

// Fixed-position name tooltip rendered into <body>; merged with per-hover left/top.
const TIP_STYLE: React.CSSProperties = {
  position: 'fixed',
  transform: 'translateX(-50%)',
  padding: '5px 9px',
  borderRadius: 8,
  background: 'rgba(11,24,32,0.97)',
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: '0 6px 16px rgba(0,0,0,0.45)',
  color: COLORS.beige,
  fontFamily: 'Nunito_700Bold',
  fontSize: 11,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  zIndex: 9999,
};

function CampaignHero({
  campaign,
  onHeroPress,
  onTitlePress,
  tall,
}: {
  campaign: Campaign;
  onHeroPress: (id: string) => void;
  onTitlePress: (id: string) => void;
  tall: boolean;
}) {
  const accent = campaign.accent ?? COLORS.orange;
  const top = campaign.characters[0];
  // Prefer the linked title's TMDB backdrop (composed for wide framing); fall
  // back to character art for franchise-/hero-only campaigns with no title.
  const bgUri = campaign.backdrop_url ?? top?.image_url ?? top?.portrait_url ?? undefined;
  const avatarChars = campaign.characters.slice(0, 6);
  // The cover is the title (media); tapping it opens the title page. Only fall
  // back to the lead character when the campaign has no linked title.
  const openCover = () => {
    if (campaign.title_id) onTitlePress(campaign.title_id);
    else if (top) onHeroPress(top.id);
  };
  return (
    <Pressable
      onPress={openCover}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [ch.wrap, { minHeight: tall ? 320 : 220 }, hovered && (ch.wrapHover as object)] as object
      }
    >
      {bgUri ? (
        <Image
          source={{ uri: bgUri }}
          contentFit="cover"
          // Wide cinematic backdrop, not a portrait — center the crop so subjects
          // stay in frame instead of being pushed off the bottom edge.
          contentPosition="center"
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
            {avatarChars.map((c, i) => (
              <CampaignAvatar
                key={c.id}
                character={c}
                index={i}
                count={avatarChars.length}
                accent={accent}
                onPress={() => onHeroPress(c.id)}
              />
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

// Rank tint — the podium warms orange (same ramp as the Hall of Fame), the
// rest stay dim beige.
function hotRankColor(i: number): string {
  if (i === 0) return 'rgba(231,115,51,0.9)';
  if (i === 1) return 'rgba(231,115,51,0.6)';
  if (i === 2) return 'rgba(231,115,51,0.4)';
  return 'rgba(245,235,220,0.35)';
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
            <Text style={[wh.rank, { color: hotRankColor(i) }] as object}>{i + 1}</Text>
            <View style={wh.thumb as object}>
              {posterUri ? (
                <Image
                  source={{ uri: posterUri }}
                  contentFit="cover"
                  style={{ position: 'absolute', inset: 0 } as object}
                  transition={200}
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
  const pagePad = pageGutter(width);
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

function ComicCoverRail({
  comics,
  onIssuePress,
  pagePad,
  gridMode = false,
}: {
  comics: NewComic[];
  onIssuePress: (issueId: string) => void;
  pagePad: number;
  /** 2-row wrap grid for side-by-side desktop layout — fills column height. */
  gridMode?: boolean;
}) {
  if (comics.length === 0) return null;
  // Grid: cap at 10 (5×2). Scroll: uncapped.
  const items = gridMode ? comics.slice(0, 10) : comics;
  return (
    <View>
      <View style={[ccr.header, { paddingLeft: pagePad }]}>
        <Text style={ccr.label as object}>This Week</Text>
        <Text style={ccr.title as object}>New Comics</Text>
      </View>
      <View
        style={
          [
            gridMode ? ccr.grid : ccr.strip,
            { paddingLeft: pagePad, paddingRight: pagePad },
          ] as object
        }
      >
        {items.map((comic) => {
          const saleDay = comic.storeDate
            ? new Date(comic.storeDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : null;
          const issueLabel =
            comic.volumeName && comic.issueNumber
              ? `${comic.volumeName} #${comic.issueNumber}`
              : (comic.volumeName ?? comic.issueNumber ?? '');
          const cardStyle = gridMode ? ccr.gridCard : ccr.card;
          const hoverStyle = gridMode ? ccr.gridCardHover : ccr.cardHover;
          return (
            <Pressable
              key={comic.id}
              onPress={() => onIssuePress(comic.id)}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [cardStyle, hovered && (hoverStyle as object)] as object
              }
            >
              {comic.coverUrl ? (
                <Image
                  source={{ uri: comic.coverUrl }}
                  contentFit="cover"
                  contentPosition="top"
                  style={{ position: 'absolute', inset: 0 } as object}
                  transition={200}
                />
              ) : null}
              <View style={ccr.overlay as object} />
              {saleDay && (
                <View style={ccr.badge as object}>
                  <Text style={ccr.badgeText as object} numberOfLines={1}>
                    {saleDay}
                  </Text>
                </View>
              )}
              <Text style={ccr.name as object} numberOfLines={2}>
                {issueLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Ceiling on the poster rail. The bundle now returns ~19 distinct titles (12 per
 * bucket), so the old default of 12 would have thrown a third of them away.
 * It's a horizontal scroller, so extra titles cost scroll distance, not layout.
 */
const RAIL_CAP = 20;

function PosterRail({
  titles,
  onTitlePress,
  pagePad,
  label = 'In Cinemas & Streaming',
  title = 'On Screen Now',
}: {
  titles: TrendingTitle[];
  onTitlePress: (id: string) => void;
  pagePad: number;
  label?: string;
  title?: string;
}) {
  if (titles.length === 0) return null;
  return (
    <View>
      <View style={[prw.header, { paddingLeft: pagePad }]}>
        <Text style={prw.label as object}>{label}</Text>
        <Text style={prw.title as object}>{title}</Text>
      </View>
      <View style={[prw.strip, { paddingLeft: pagePad, paddingRight: pagePad }] as object}>
        {titles.map((t) => {
          const badge = trendingBadge(t);
          const uri = t.poster_url ?? t.backdrop_url ?? undefined;
          return (
            <Pressable
              key={t.id}
              onPress={() => onTitlePress(t.id)}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [prw.card, hovered && (prw.cardHover as object)] as object
              }
            >
              {uri ? (
                <Image
                  source={{ uri }}
                  contentFit="cover"
                  style={{ position: 'absolute', inset: 0 } as object}
                />
              ) : null}
              <View style={prw.overlay as object} />
              {/* A streamer gets its own mark — a wordmark set in our type reads
                  slower than the logo and forced "HBO Max Amazon Channel" to be
                  truncated to fit. Theatrical and unreleased titles aren't
                  brands, so they keep a labelled pill; the different shape is
                  the point, it separates *where* from *when*. */}
              {t.provider_logo ? (
                <View
                  style={prw.providerMark as object}
                  accessibilityLabel={t.provider ?? 'Streaming'}
                >
                  <Image
                    source={{ uri: t.provider_logo }}
                    contentFit="cover"
                    style={{ width: '100%', height: '100%' } as object}
                  />
                </View>
              ) : badge ? (
                <View style={prw.badge as object}>
                  {BADGE_ICON[badge.tone] ? (
                    <Ionicons
                      name={BADGE_ICON[badge.tone]!}
                      size={11}
                      color={BADGE_COLOR[badge.tone]}
                    />
                  ) : null}
                  <Text style={prw.badgeText as object} numberOfLines={1}>
                    {badge.label}
                  </Text>
                </View>
              ) : null}
              <Text style={prw.name as object} numberOfLines={2}>
                {t.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function RightNowBand({
  campaign,
  onScreen,
  comingSoon,
  streaming,
  trendingOnScreen,
  personalized,
  newComics,
  wikiTrending,
  debuts,
  onHeroPress,
  onTitlePress,
  onIssuePress,
}: RightNowBandProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const pagePad = pageGutter(width);
  const hasAny =
    !!campaign ||
    onScreen.length > 0 ||
    comingSoon.length > 0 ||
    streaming.length > 0 ||
    trendingOnScreen.length > 0 ||
    personalized.length > 0 ||
    newComics.length > 0 ||
    wikiTrending.length > 0 ||
    debuts.length > 0;
  if (!hasAny) return null;

  // "What's Hot" is the real TMDB daily-trending feed (trendingOnScreen). On the
  // rare day nothing trending is in the catalogue, fall back to the live release
  // slate so the sidebar is never empty.
  const slate = mergeTrendingTitles(onScreen, [], streaming);
  const hotTitles = trendingOnScreen.length > 0 ? trendingOnScreen : slate;

  // What the sidebar renders, so the rail beneath it never repeats a poster.
  // The sidebar only exists on the desktop campaign branch.
  const sidebarShown =
    isDesktop && campaign && campaign.characters.length > 0
      ? new Set(hotTitles.slice(0, 6).map((t) => t.id))
      : new Set<string>();
  // Drop the sidebar's titles BEFORE the merge caps at 12, not after. Filtering
  // afterwards spends cap slots on titles that then get removed, so a pool
  // larger than the cap would silently leave the rail short on desktop only.
  // (No visible change today: the pool is 11, under the cap.)
  const notInSidebar = (t: TrendingTitle) => !sidebarShown.has(t.id);
  const railTitles = mergeTrendingTitles(
    onScreen.filter(notInSidebar),
    comingSoon.filter(notInSidebar),
    streaming.filter(notInSidebar),
    RAIL_CAP,
  );

  return (
    <View style={band.band}>
      {/* Chapter head — same kicker + Flame title grammar as The Library and
          The Arena, so the dark zone reads as a chapter, not a stray label. */}
      <View style={[band.header, { paddingHorizontal: pagePad }]}>
        <View style={band.headText}>
          <Text style={band.kicker as object}>The Pulse</Text>
          <Text style={[band.title, !isDesktop && { fontSize: 30, lineHeight: 32 }] as object}>
            Right Now
          </Text>
          <Text style={band.sub as object}>
            The movies, shows and comics moving the multiverse this week.
          </Text>
        </View>
        <View style={band.freshChip as object}>
          <View style={band.pulse as object} />
          <Text style={band.fresh as object}>Updated today</Text>
        </View>
      </View>

      {isDesktop && campaign && campaign.characters.length > 0 ? (
        <View style={[band.topRow, { paddingHorizontal: pagePad }]}>
          <View style={{ flex: 1 }}>
            <CampaignHero
              campaign={campaign}
              onHeroPress={onHeroPress}
              onTitlePress={onTitlePress}
              tall
            />
          </View>
          <WhatsHot titles={hotTitles} onTitlePress={onTitlePress} />
        </View>
      ) : (
        campaign &&
        campaign.characters.length > 0 && (
          <View style={{ paddingHorizontal: pagePad }}>
            <CampaignHero
              campaign={campaign}
              onHeroPress={onHeroPress}
              onTitlePress={onTitlePress}
              tall={false}
            />
          </View>
        )
      )}

      {/* The rail is the release slate — what's in cinemas now, what's coming,
          what just landed on streaming. "What's Hot" is TMDB's trending feed,
          which is a different list (usually TV). Suppressing the rail on desktop
          therefore didn't avoid a duplicate, it dropped the cinema slate
          entirely: at 1440 the page showed Bleach and Rick and Morty while
          mobile showed the Mario movie and Zootopia 2. Keep the rail at every
          width, minus anything the sidebar is already showing. */}
      {railTitles.length > 0 && (
        <View style={{ marginBottom: isDesktop ? 24 : 16 }}>
          <PosterRail titles={railTitles} onTitlePress={onTitlePress} pagePad={pagePad} />
        </View>
      )}

      {/* Comics + Movers: side-by-side on desktop when both have data */}
      {isDesktop && newComics.length > 0 && wikiTrending.length > 0 ? (
        <View style={[tw.row, { paddingHorizontal: pagePad }]}>
          <View style={tw.moversCol}>
            <TrendingMovers heroes={wikiTrending} onHeroPress={onHeroPress} inline />
          </View>
          <View style={tw.divider} />
          <View style={tw.comicsCol}>
            <ComicCoverRail comics={newComics} onIssuePress={onIssuePress} pagePad={0} gridMode />
          </View>
        </View>
      ) : (
        <>
          <ComicCoverRail comics={newComics} onIssuePress={onIssuePress} pagePad={pagePad} />
          <TrendingMovers heroes={wikiTrending} onHeroPress={onHeroPress} />
        </>
      )}

      <ThisMonthInHistory debuts={debuts} onHeroPress={onHeroPress} />

      {personalized.length > 0 && (
        <PersonalRow characters={personalized} onHeroPress={onHeroPress} />
      )}
    </View>
  );
}

const tw = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  comicsCol: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 28,
    marginTop: 4,
  },
  moversCol: {
    width: 360,
    flexShrink: 0,
  },
});

const band = StyleSheet.create({
  band: { backgroundColor: COLORS.deepNavy, paddingTop: 32, paddingBottom: 28 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 22,
  } as object,
  headText: { gap: 2, flexShrink: 1 },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.orange,
    boxShadow: `0 0 0 4px ${COLORS.orange}33`,
  } as object,
  kicker: {
    ...EYEBROW,
    letterSpacing: 2.5,
    marginBottom: 4,
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 40,
    color: COLORS.beige,
    lineHeight: 42,
  } as object,
  sub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: INK_TEXT.muted,
    lineHeight: 19,
    marginTop: 4,
    maxWidth: 560,
  } as object,
  // "Updated today" as a live chip — dot + label, bottom-aligned with the title.
  freshChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 4,
  } as object,
  fresh: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
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
    lineHeight: 49,
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
  // Non-clipping interaction/stacking slot so the tooltip can sit above the chip.
  avatarSlot: { width: 42, height: 42, cursor: 'pointer' } as object,
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.deepNavy,
    backgroundColor: COLORS.navy,
    transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
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
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  } as object,
});

const pr = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'stretch', gap: 14, marginTop: 8, marginBottom: 14 },
  accentBar: { width: 4, borderRadius: 2, minHeight: 36 },
  label: {
    ...EYEBROW,
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

const prw = StyleSheet.create({
  header: { marginBottom: 14 },
  label: {
    ...EYEBROW,
    marginBottom: 2,
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: COLORS.beige,
    lineHeight: 30,
  } as object,
  strip: {
    flexDirection: 'row',
    gap: 14,
    overflowX: 'auto',
    paddingBottom: 8,
    scrollbarWidth: 'none',
  } as object,
  card: {
    width: 150,
    height: 225,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    cursor: 'pointer',
    justifyContent: 'flex-end',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  cardHover: {
    transform: [{ translateY: -5 }],
    boxShadow: '0 18px 44px rgba(0,0,0,0.4)',
  } as object,
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(to top, rgba(11,24,32,0.9) 0%, transparent 55%)',
  } as object,
  // A dark chip, not a block of colour. On a rail whose job is to show posters,
  // a solid orange "IN THEATERS" out-shouted the brand marks beside it and made
  // a status louder than a name. Same footprint and weight as a provider logo
  // now; the colour survives on the icon, where it still reads as a signal.
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: 130,
    backgroundColor: 'rgba(11,24,32,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.22)',
  } as object,
  // The provider logos are square, full-bleed and carry their own brand colour,
  // so they need no chrome — only a hairline to hold their edge against a dark
  // poster, since several of them are near-black themselves.
  providerMark: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 30,
    height: 30,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.28)',
    backgroundColor: COLORS.deepNavy,
  } as object,
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.beige,
  } as object,
  name: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.beige,
    lineHeight: 15,
    paddingHorizontal: 10,
    paddingBottom: 10,
  } as object,
});

// Comic Cover Rail — 2:3 cover cards, gold accent, on-sale-day badge.
const ccr = StyleSheet.create({
  header: { marginBottom: 14 },
  label: {
    ...EYEBROW,
    color: COLORS.gold,
    marginBottom: 2,
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: COLORS.beige,
    lineHeight: 30,
  } as object,

  // Horizontal scroll (mobile / standalone)
  strip: {
    flexDirection: 'row',
    gap: 14,
    overflowX: 'auto',
    paddingBottom: 8,
    scrollbarWidth: 'none',
  } as object,
  card: {
    width: 150,
    height: 225,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    cursor: 'pointer',
    justifyContent: 'flex-end',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  cardHover: {
    transform: [{ translateY: -5 }],
    boxShadow: '0 18px 44px rgba(0,0,0,0.4)',
  } as object,

  // 2-row CSS grid — 5 equal columns that fill the full width with no orphaned gaps.
  // Uses display:grid (web-only) which RNW passes through to the DOM.
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 10,
  } as object,
  gridCard: {
    height: 210,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    justifyContent: 'flex-end',
    position: 'relative',
    transition: 'transform 180ms ease, box-shadow 180ms ease',
  } as object,
  gridCardHover: {
    transform: [{ translateY: -4 }],
    boxShadow: '0 14px 36px rgba(0,0,0,0.45)',
  } as object,

  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(to top, rgba(11,24,32,0.9) 0%, transparent 55%)',
  } as object,
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.gold,
    maxWidth: 130,
  } as object,
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#fff',
  } as object,
  name: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.beige,
    lineHeight: 15,
    paddingHorizontal: 10,
    paddingBottom: 10,
  } as object,
});
