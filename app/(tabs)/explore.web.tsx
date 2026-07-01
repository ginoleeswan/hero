// app/(tabs)/explore.web.tsx — Home screen for web (spotlight + horizontal scroll rows).
// Search lives on the dedicated /search route; this screen is home-only.
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SURFACE, SURFACE_GRADIENT } from '../../src/constants/colors';
import { HeroImage } from '../../src/components/HeroImage';
import { WebHomeSkeleton } from '../../src/components/web/HomeSkeleton';
import { type Hero } from '../../src/lib/db/heroes';
import { RightNowBand } from '../../src/components/web/home/RightNowBand';
import { useExploreData } from '../../src/lib/query/exploreQueries';
import type { FavouriteHero } from '../../src/types';
import { RankingCard } from '../../src/components/web/home/RankingCard';
import { HomeFooter } from '../../src/components/web/home/HomeFooter';
import {
  TodaysMatchup as TodaysMatchupCard,
  TodaysMatchupSkeleton,
} from '../../src/components/web/home/TodaysMatchup';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { PulseTicker } from '../../src/components/web/home/PulseTicker';
import { DailyChallengeBanner } from '../../src/components/game/DailyChallengeBanner';
import { SeoHead } from '../../src/components/web/SeoHead';
import { PublisherPods } from '../../src/components/web/home/PublisherPods';
import { CategoryBrowseGrid } from '../../src/components/web/home/CategoryBrowseGrid';
import { HallOfFame } from '../../src/components/web/home/HallOfFame';
import { FeaturedRivalry } from '../../src/components/web/home/FeaturedRivalry';

// ── Constants ─────────────────────────────────────────────────────────────────
const ROW_CARD_HEIGHT = 310;
const ROW_CARD_WIDTH = 220;

// ── CSS grid / scroll layouts ─────────────────────────────────────────────────
// The scroll container uses padding + negative margins on all sides so box-shadows
// have room to render inside the overflow:auto boundary.
// Horizontal: paddingLeft/Right 16 + marginLeft/Right -16 → cards appear flush with
// the wrapper edge but the scroll container extends 16px past each side for shadows.
// The fades/arrows must account for this 16px offset (right:-16 / left:-16).
// No paddingRight / marginRight — the scroll track extends to the viewport right edge
// (the wrapper gets a dynamic negative marginRight calculated per row).
// Left side keeps the shadow buffer so the first card's shadow isn't clipped.
const rowScrollStyle = {
  display: 'flex',
  flexDirection: 'row',
  gap: 16,
  overflowX: 'auto',
  paddingTop: 40,
  paddingBottom: 72,
  paddingLeft: 16,
  marginTop: -40,
  marginBottom: -60, // net: 72 - 60 = 12
  marginLeft: -16,
  scrollbarWidth: 'none',
};

// ── Row card (home carousel rows) ────────────────────────────────────────────
function RowCard({ hero, onPress }: { hero: Hero | FavouriteHero; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [rc.wrap, hovered && (rc.wrapHover as object)] as object
      }
    >
      <HeroImage
        id={String(hero.id)}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        contentFit="cover"
        contentPosition="top"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object}
        recyclingKey={String(hero.id)}
      />
      <View style={rc.overlay as object} />
      <View style={rc.bottom}>
        <Text style={rc.name as object} numberOfLines={2}>
          {hero.name}
        </Text>
      </View>
    </Pressable>
  );
}

const rc = StyleSheet.create({
  wrap: {
    width: ROW_CARD_WIDTH,
    height: ROW_CARD_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  wrapHover: {
    transform: [{ translateY: -6 }],
    boxShadow: '0 20px 52px rgba(0,0,0,0.38)',
    zIndex: 2,
  } as object,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.97) 0%, rgba(29,45,51,0.08) 55%, transparent 100%)',
  } as object,
  bottom: { position: 'absolute', bottom: 10, left: 10, right: 10 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.beige,
    lineHeight: 18,
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
  } as object,
});

// Map the raw alignment value (good/bad/neutral) to a display label.
function alignmentLabel(alignment?: string | null): string | null {
  if (!alignment) return null;
  const a = alignment.toLowerCase();
  if (a === 'good') return 'Hero';
  if (a === 'bad') return 'Villain';
  if (a === 'neutral') return 'Anti-Hero';
  return null;
}

// A single power-stat chip: icon + label header, bold value, and a magnitude
// bar (stats run 0–100) so strength reads at a glance.
function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: number;
}) {
  return (
    <View style={pss.statPill as object}>
      <View style={pss.statTop as object}>
        <MaterialCommunityIcons name={icon} size={22} color={COLORS.orange} />
        <Text style={pss.statPillVal as object}>{value}</Text>
      </View>
      <View style={pss.statBarTrack as object}>
        <View style={[pss.statBarFill, { width: `${Math.min(100, value)}%` }] as object} />
      </View>
      <Text style={pss.statPillKey as object}>{label}</Text>
    </View>
  );
}

// ── Portrait strip spotlight ──────────────────────────────────────────────────
const ACCORDION_SCALES = {
  // Extra-wide displays (1600px+) — more, larger cards so the strip fills width
  xlarge: [
    { w: 360, o: 1 },
    { w: 190, o: 0.82 },
    { w: 140, o: 0.66 },
    { w: 108, o: 0.54 },
    { w: 82, o: 0.44 },
    { w: 62, o: 0.36 },
    { w: 46, o: 0.28 },
    { w: 34, o: 0.2 },
    { w: 24, o: 0.13 },
    { w: 18, o: 0.08 },
  ],
  // Ultra-wide displays (1200px+)
  large: [
    { w: 280, o: 1 },
    { w: 140, o: 0.8 },
    { w: 100, o: 0.6 },
    { w: 76, o: 0.5 },
    { w: 54, o: 0.4 },
    { w: 40, o: 0.3 },
    { w: 28, o: 0.2 },
    { w: 20, o: 0.1 },
  ],
  // Standard desktop (900px - 1199px)
  medium: [
    { w: 180, o: 1 },
    { w: 100, o: 0.8 },
    { w: 76, o: 0.5 },
    { w: 54, o: 0.3 },
    { w: 38, o: 0.2 },
    { w: 20, o: 0.1 },
  ],
  // Tablet / Small desktop (768px - 899px)
  small: [
    { w: 160, o: 1 },
    { w: 80, o: 0.7 },
    { w: 40, o: 0.3 },
  ],
};

const PortraitStripSpotlight = React.memo(function PortraitStripSpotlight({
  heroes,
  onViewProfile,
}: {
  heroes: Hero[];
  onViewProfile: (heroId: string) => void;
}) {
  const { width, height: windowHeight } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-advance lives here — only re-renders this component, not the whole page
  useEffect(() => {
    if (heroes.length <= 1) return;
    const timer = setInterval(() => setActiveIndex((i) => (i + 1) % heroes.length), 6000);
    return () => clearInterval(timer);
  }, [heroes.length]);

  const hero = heroes[activeIndex];
  if (!hero) return null;

  const pagePad = width < 640 ? 16 : 32;

  const activeScale =
    width >= 1600
      ? ACCORDION_SCALES.xlarge
      : width >= 1280
        ? ACCORDION_SCALES.large
        : width >= 900
          ? ACCORDION_SCALES.medium
          : ACCORDION_SCALES.small;

  if (isDesktop) {
    // Floor + ceiling, used as a *minimum* (not a hard height): the portrait
    // strip wants to be tall on big screens, but the glass panel's stacked
    // content must never be clipped, so the stage grows to fit it on short
    // windows instead of cropping the name / first-appearance lines.
    const stageHeight = Math.max(440, Math.min(500, windowHeight * 0.62));

    return (
      <View style={[pss.wrap, { paddingHorizontal: pagePad, minHeight: stageHeight }] as object}>
        {/* Atmospheric orbs — decorative, no interaction */}
        <View style={pss.orbA as object} />
        <View style={pss.orbB as object} />

        <View style={pss.strip}>
          {heroes.map((h, index) => {
            const offset = (index - activeIndex + heroes.length) % heroes.length;
            const isActive = offset === 0;
            const isNext = offset === 1;

            const isVisible = offset < activeScale.length;
            const cardWidth = isVisible ? activeScale[offset].w : 0;
            const opacity = isVisible ? activeScale[offset].o : 0;

            return (
              <Pressable
                key={h.id}
                onPress={() => setActiveIndex(index)}
                style={[
                  pss.card,
                  {
                    width: cardWidth,
                    opacity: opacity,
                    borderWidth: cardWidth === 0 ? 0 : undefined,
                  } as object,
                  isActive && (pss.cardActive as object),
                ]}
              >
                <HeroImage
                  id={String(h.id)}
                  name={h.name}
                  imageUrl={h.image_url}
                  portraitUrl={h.portrait_url}
                  contentFit="cover"
                  contentPosition={{ top: 0, left: '50%' }}
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      opacity: isActive ? 1 : 0.4,
                      transition: 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)',
                    } as any,
                  ]}
                  recyclingKey={String(h.id)}
                />
                <View style={pss.cardOverlay as object} />
                <Text
                  style={[
                    pss.cardName as object,
                    isNext && (pss.cardNameNext as object),
                    {
                      opacity: isActive ? 1 : isNext ? 0.7 : 0,
                      transition: 'opacity 250ms ease',
                    } as object,
                  ]}
                  numberOfLines={2}
                >
                  {h.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Glass info panel — flex child beside the portrait strip */}
        <View style={pss.glassPanel as object}>
          <Text style={pss.glassPanelEyebrow as object}>Featured Hero</Text>
          <Text style={pss.glassPanelName as object} numberOfLines={2}>
            {hero.name}
          </Text>
          {!!hero.full_name && hero.full_name !== hero.name && (
            <Text style={pss.glassPanelRealName as object} numberOfLines={1}>
              {hero.full_name}
            </Text>
          )}
          <View style={pss.metaRow as object}>
            {!!hero.publisher && (
              <Text style={pss.glassPanelPub as object} numberOfLines={1}>
                {hero.publisher}
              </Text>
            )}
            {!!alignmentLabel(hero.alignment) && (
              <View style={pss.alignChip as object}>
                <Text style={pss.alignChipText as object}>{alignmentLabel(hero.alignment)}</Text>
              </View>
            )}
          </View>
          {!!hero.summary && (
            <Text style={pss.glassPanelSummary as object} numberOfLines={4}>
              {hero.summary}
            </Text>
          )}
          {hero.intelligence || hero.strength || hero.speed ? (
            <View style={pss.statPills as object}>
              {!!hero.intelligence && (
                <StatChip icon="brain" label="INT" value={hero.intelligence} />
              )}
              {!!hero.strength && <StatChip icon="arm-flex" label="STR" value={hero.strength} />}
              {!!hero.speed && <StatChip icon="run-fast" label="SPD" value={hero.speed} />}
            </View>
          ) : null}
          {!!hero.first_appearance && (
            <Text style={pss.firstAppearance as object} numberOfLines={1}>
              First appearance · {hero.first_appearance}
            </Text>
          )}
          <View style={pss.panelFooter}>
            <Pressable
              onPress={() => onViewProfile(String(hero.id))}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [pss.ctaBtn, hovered && (pss.ctaBtnHover as object)] as object
              }
            >
              <Text style={pss.ctaBtnText}>View Profile →</Text>
            </Pressable>
            <View style={pss.dots}>
              {heroes.slice(0, activeScale.length).map((_, i) => (
                <Pressable
                  key={i}
                  onPress={() => setActiveIndex(i)}
                  style={[pss.dot, i === activeIndex && (pss.dotActive as object)] as object}
                />
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Mobile web: single portrait + info panel
  return (
    <View style={[pss.wrapMobile, { paddingHorizontal: pagePad }]}>
      <View style={pss.singlePortrait}>
        <HeroImage
          id={String(hero.id)}
          name={hero.name}
          imageUrl={hero.image_url}
          portraitUrl={hero.portrait_url}
          contentFit="cover"
          contentPosition="top"
          style={StyleSheet.absoluteFill}
          recyclingKey={String(hero.id)}
        />
        <View style={pss.cardOverlay as object} />
        <Text style={pss.cardName as object} numberOfLines={2}>
          {hero.name}
        </Text>
      </View>
      <View style={pss.panelMobile}>
        <View>
          <Text style={pss.panelLabel as object}>Featured Hero</Text>
          <Text style={pss.panelNameMobile as object} numberOfLines={2}>
            {hero.name}
          </Text>
          {!!hero.publisher && (
            <Text style={pss.panelPub as object} numberOfLines={1}>
              {hero.publisher}
            </Text>
          )}
          {!!hero.summary && (
            <Text style={pss.panelSummaryMobile as object} numberOfLines={5}>
              {hero.summary}
            </Text>
          )}
        </View>
        <View style={pss.panelFooter}>
          <Pressable onPress={() => onViewProfile(String(hero.id))} style={pss.ctaBtn as object}>
            <Text style={pss.ctaBtnText}>View →</Text>
          </Pressable>
          <View style={pss.dots}>
            {heroes.slice(0, 8).map((_, i) => (
              <Pressable
                key={i}
                onPress={() => setActiveIndex(i)}
                style={[pss.dot, i === activeIndex && (pss.dotActive as object)] as object}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
});

const pss = StyleSheet.create({
  // Desktop
  wrap: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 24,
  } as object,
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    contain: 'layout style',
    height: '100%',
  } as object,
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#2c4a56',
    position: 'relative',
    cursor: 'pointer',
    transition:
      'width 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), margin 400ms cubic-bezier(0.16, 1, 0.3, 1)',
    willChange: 'width, opacity',
  } as object,
  cardActive: {
    boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.2)',
  } as object,
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(15,20,24,0.95) 0%, rgba(15,20,24,0.15) 50%, transparent 100%)',
  } as object,
  cardBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    zIndex: 2,
  } as object,
  cardName: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    color: COLORS.beige,
    lineHeight: 22,
    textShadow: '0 2px 8px rgba(0,0,0,0.9)',
    zIndex: 2,
  } as object,
  cardNameNext: {
    fontSize: 11,
    bottom: 10,
    left: 10,
  } as object,

  // Atmospheric orbs (decorative, absolutely positioned)
  orbA: {
    position: 'absolute',
    width: 320,
    height: 320,
    top: -60,
    left: 140,
    borderRadius: 160,
    backgroundImage: 'radial-gradient(circle, rgba(231,115,51,0.10), transparent 70%)',
    pointerEvents: 'none',
  } as object,
  orbB: {
    position: 'absolute',
    width: 220,
    height: 220,
    top: 80,
    right: 180,
    borderRadius: 110,
    backgroundImage: 'radial-gradient(circle, rgba(21,161,171,0.07), transparent 70%)',
    pointerEvents: 'none',
  } as object,

  // Glass info panel (desktop) — flex child beside the portrait strip
  glassPanel: {
    flex: 1,
    minWidth: 280,
    backgroundColor: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 30,
    justifyContent: 'center',
    zIndex: 3,
  } as object,
  glassPanelEyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 10,
  } as object,
  glassPanelName: {
    fontFamily: 'Flame-Regular',
    fontSize: 34,
    color: COLORS.beige,
    // Flame clips its glyph bottoms at a tight line-height; give it ~1.3×.
    lineHeight: 44,
    paddingBottom: 2,
    marginBottom: 4,
  } as object,
  glassPanelRealName: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(245,235,220,0.5)',
    marginBottom: 16,
  } as object,
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  } as object,
  glassPanelPub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  } as object,
  alignChip: {
    backgroundColor: 'rgba(231,115,51,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.4)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  } as object,
  alignChipText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1,
  } as object,
  glassPanelSummary: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.68)',
    lineHeight: 21,
    marginBottom: 20,
  } as object,
  statPills: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  } as object,
  statPill: {
    flex: 1,
    maxWidth: 120,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 9,
  } as object,
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as object,
  statPillKey: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  } as object,
  statPillVal: {
    fontFamily: 'Flame-Regular',
    fontSize: 28,
    color: COLORS.beige,
    lineHeight: 28,
  } as object,
  statBarTrack: {
    height: 4,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  } as object,
  statBarFill: {
    height: 4,
    backgroundColor: COLORS.orange,
    borderRadius: 2,
  } as object,
  firstAppearance: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(245,235,220,0.4)',
  } as object,

  // Shared / mobile panel text
  panelLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 8,
  } as object,
  panelPub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 14,
  } as object,
  panelFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  ctaBtn: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    transition: 'opacity 150ms ease',
  } as object,
  ctaBtnHover: { opacity: 0.85 } as object,
  ctaBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(245,235,220,0.2)',
    cursor: 'pointer',
    transition: 'all 200ms ease',
  } as object,
  dotActive: { width: 20, backgroundColor: COLORS.orange } as object,

  // Mobile Web overrides
  wrapMobile: { flexDirection: 'row', gap: 10, height: 240, marginTop: 6, marginBottom: 20 },
  singlePortrait: {
    width: 150,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    position: 'relative',
  },
  panelMobile: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    padding: 14,
    justifyContent: 'space-between',
  },
  panelNameMobile: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    lineHeight: 22,
    marginBottom: 4,
  } as object,
  panelSummaryMobile: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: 'rgba(245,235,220,0.5)',
    lineHeight: 15,
  } as object,
});

// ── Carousel scroll hook (web desktop) ───────────────────────────────────────
function useCarouselScroll(heroCount: number) {
  const sectionRef = useRef<View>(null);
  const scrollRef = useRef<View>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Hover via native DOM events — avoids Pressable nesting issues
  useEffect(() => {
    const section = sectionRef.current as any;
    if (!section) return;
    const enter = () => setIsHovered(true);
    const leave = () => setIsHovered(false);
    section.addEventListener('mouseenter', enter);
    section.addEventListener('mouseleave', leave);
    return () => {
      section.removeEventListener('mouseenter', enter);
      section.removeEventListener('mouseleave', leave);
    };
  }, []);

  // Scroll position tracking
  useEffect(() => {
    const node = scrollRef.current as any;
    if (!node) return;
    const update = () => {
      setCanScrollLeft(node.scrollLeft > 8);
      setCanScrollRight(node.scrollLeft < node.scrollWidth - node.clientWidth - 8);
    };
    node.addEventListener('scroll', update, { passive: true });
    const t = setTimeout(update, 100);
    return () => {
      node.removeEventListener('scroll', update);
      clearTimeout(t);
    };
  }, [heroCount]);

  const doScrollLeft = useCallback(() => {
    (scrollRef.current as any)?.scrollBy({ left: -720, behavior: 'smooth' });
  }, []);

  const doScrollRight = useCallback(() => {
    (scrollRef.current as any)?.scrollBy({ left: 720, behavior: 'smooth' });
  }, []);

  return {
    sectionRef,
    scrollRef,
    isHovered,
    canScrollLeft,
    canScrollRight,
    doScrollLeft,
    doScrollRight,
  };
}

// ── Carousel arrow button ─────────────────────────────────────────────────────
const ARROW_SIZE = 44;

function CarouselArrow({
  direction,
  onPress,
  contained = false,
}: {
  direction: 'left' | 'right';
  onPress: () => void;
  contained?: boolean;
}) {
  const rightStyle = contained ? arr.rightContained : arr.right;
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation?.();
        onPress();
      }}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          arr.btn,
          direction === 'left' ? arr.left : rightStyle,
          hovered && (arr.btnHover as object),
        ] as object
      }
    >
      <Text style={arr.chevron as object}>{direction === 'left' ? '‹' : '›'}</Text>
    </Pressable>
  );
}

const arr = StyleSheet.create({
  btn: {
    position: 'absolute',
    zIndex: 20,
    top: ROW_CARD_HEIGHT / 2 - ARROW_SIZE / 2,
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    borderRadius: ARROW_SIZE / 2,
    backgroundColor: COLORS.beige,
    boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 150ms ease, box-shadow 150ms ease',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
  } as object,
  btnHover: {
    transform: [{ scale: 1.12 }],
    boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
  } as object,
  left: { left: -12 } as object, // -16 (scroll margin) + 4 inset
  right: { right: 8 } as object, // viewport-breakout row: 8px from viewport edge
  rightContained: { right: -12 } as object, // contained dark row: -16 (scroll margin) + 4 inset
  chevron: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 24,
    color: COLORS.navy,
    lineHeight: 26,
    textAlign: 'center',
    marginTop: -1,
  } as object,
});

// ── Home row section ──────────────────────────────────────────────────────────
function HomeRow({
  label,
  title,
  heroes,
  onPress,
  onViewAll,
  statKey,
}: {
  label?: string;
  title: string;
  heroes: (Hero | FavouriteHero)[];
  onPress: (id: string) => void;
  onViewAll?: () => void;
  statKey?: 'strength' | 'intelligence' | 'speed';
}) {
  const {
    sectionRef,
    scrollRef,
    isHovered,
    canScrollLeft,
    canScrollRight,
    doScrollLeft,
    doScrollRight,
  } = useCarouselScroll(heroes.length);

  const { width: winWidth } = useWindowDimensions();
  const pagePad = winWidth < 640 ? 16 : 32;

  if (heroes.length === 0) return null;
  return (
    <View ref={sectionRef} style={row.section}>
      <View style={[row.header, { paddingLeft: pagePad }]}>
        <View style={row.headerLeft}>
          <View style={row.accentBar} />
          <View style={row.headerText}>
            {!!label && <Text style={row.label}>{label}</Text>}
            {onViewAll ? (
              <Pressable
                onPress={onViewAll}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [row.titleRow, hovered && (row.titleRowHover as object)] as object
                }
              >
                <Text style={row.title}>{title}</Text>
                <Text
                  style={
                    {
                      fontFamily: 'Flame-Regular',
                      fontSize: 44,
                      color: COLORS.navy,
                      marginTop: 4,
                      marginLeft: 4,
                    } as object
                  }
                >
                  ›
                </Text>
              </Pressable>
            ) : (
              <Text style={row.title}>{title}</Text>
            )}
          </View>
        </View>
      </View>
      {/* Scroll track starts at viewport left edge — cards bleed off left when scrolling. */}
      <View style={{ position: 'relative', minHeight: ROW_CARD_HEIGHT } as object}>
        <View
          ref={scrollRef}
          style={[rowScrollStyle, { paddingLeft: pagePad, marginLeft: 0 }] as object}
        >
          {heroes.map((h) =>
            statKey ? (
              <RankingCard
                key={h.id}
                hero={h as Hero}
                statKey={statKey}
                onPress={() => onPress(String(h.id))}
              />
            ) : (
              <RowCard key={h.id} hero={h} onPress={() => onPress(String(h.id))} />
            ),
          )}
        </View>
        {isHovered && canScrollLeft && <CarouselArrow direction="left" onPress={doScrollLeft} />}
        {isHovered && canScrollRight && <CarouselArrow direction="right" onPress={doScrollRight} />}
      </View>
    </View>
  );
}

const row = StyleSheet.create({
  section: { marginBottom: 52 },
  header: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 2,
  } as object,
  headerLeft: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  accentBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
    minHeight: 38,
  },
  headerText: { gap: 2, justifyContent: 'center' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 36, color: COLORS.navy, lineHeight: 38 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
    alignSelf: 'flex-start',
  } as object,
  titleRowHover: { opacity: 0.7 } as object,
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function WebHomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  // Explore opens on the hero stage and closes on the deep-navy footer, so the
  // whole screen reads as one immersive ink surface — top chrome and canvas both
  // lock to ink, declared together so the status bar and toolbar can't drift.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

  // 1. MATCH THE ACCORDION_SCALES EXACTLY
  const optimalPoolSize = width >= 1280 ? 8 : width >= 900 ? 6 : 3;

  // Shared, platform-neutral data layer (see useExploreData). Web keeps reading
  // rows via `homeData.*`; these aliases preserve the existing render references.
  const homeData = useExploreData();
  const { recentlyViewed, favourites } = homeData;
  const homeStarted = homeData.started;
  const totalHeroCount = homeData.heroCount;
  const handlePress = useCallback(
    (id: string) => {
      router.push(`/character/${id}`);
    },
    [router],
  );

  const handleTitlePress = useCallback(
    (id: string) => {
      router.push(`/title/${id}` as Parameters<typeof router.push>[0]);
    },
    [router],
  );

  const handleIssuePress = useCallback(
    (issueId: string) => {
      router.push(`/issue/${issueId}` as Parameters<typeof router.push>[0]);
    },
    [router],
  );

  return (
    <View style={styles.root}>
      <SeoHead
        title="Mythique — Every universe. Every icon."
        description="Explore characters, teams, films and universes from across all fiction — Marvel, DC, Disney, anime, games and beyond — and pit any two against each other on Mythique."
        path="/"
      />
      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {!homeStarted ? (
        <WebHomeSkeleton />
      ) : (
        <View style={[styles.scroll, styles.scrollDark, styles.discoverContent] as object}>
          {/* ── Home content — always rendered. On desktop, committed searches
               go to the dedicated /search route; on mobile-web the inline
               results below still appear. ───────────────────────────────────── */}
          {/* ── Dark stage: spotlight + stat pods + matchup ──────────────────
               Renders at all widths; each child handles its own responsive
               layout. The stage clears the floating header via its own
               paddingTop so the screen owns its clearance (bleedBehindNav). */}
          <View
            style={[styles.darkStage, isMobile && (styles.darkStageMobile as object)] as object}
          >
            {(homeData.spotlight?.length ?? 0) > 0 && (
              <PortraitStripSpotlight
                heroes={homeData.spotlight!.slice(
                  0,
                  Math.min(optimalPoolSize, homeData.spotlight!.length),
                )}
                onViewProfile={handlePress}
              />
            )}
            <PublisherPods
              onNavigate={(path) => router.push(path as Parameters<typeof router.push>[0])}
            />
            {/* Engage row — "Today's Battle" (vote) paired with the daily
                Guess-the-Hero game. On desktop they sit side by side so the
                matchup isn't a full-width bar and the game rides up beside it;
                on mobile they stack. */}
            <View
              style={[styles.engageRow, isMobile && (styles.engageRowStack as object)] as object}
            >
              <View style={isMobile ? undefined : (styles.engageMatchup as object)}>
                {homeData.matchup === undefined ? (
                  <TodaysMatchupSkeleton />
                ) : homeData.matchup ? (
                  <TodaysMatchupCard
                    matchup={homeData.matchup}
                    onOpen={(path) => router.push(path as Parameters<typeof router.push>[0])}
                  />
                ) : null}
              </View>
              <View style={(isMobile ? styles.engageDailyStack : styles.engageDaily) as object}>
                <DailyChallengeBanner
                  onPress={() => router.push('/play')}
                  tall={!isMobile}
                  style={(isMobile ? styles.dailyBannerMobile : styles.dailyBannerGlass) as object}
                />
              </View>
            </View>
          </View>

          {/* ── Orange ticker strip ────────────────────────────────────────── */}
          <PulseTicker
            heroCount={totalHeroCount ?? 0}
            newlyAddedCount={homeData.newlyAdded?.length ?? 0}
          />

          {/* ── Right Now — the dynamic editorial zone (campaign + trending +
               personalized), its own dark chapter under the ticker. ───────── */}
          <RightNowBand
            campaign={homeData.campaigns?.[0] ?? null}
            onScreen={homeData.onScreen ?? []}
            comingSoon={homeData.comingSoon ?? []}
            streaming={homeData.streaming ?? []}
            trendingOnScreen={homeData.trendingOnScreen ?? []}
            personalized={homeData.trendingForUser ?? []}
            newComics={homeData.newComics}
            wikiTrending={homeData.wikiTrending ?? []}
            debuts={homeData.debutsThisMonth ?? []}
            onHeroPress={handlePress}
            onTitlePress={handleTitlePress}
            onIssuePress={handleIssuePress}
          />

          {/* Beige canvas — owns the carousel surface so the dark scroll
              background only shows on the dark stage and on overscroll. */}
          <View style={styles.beigeCanvas}>
            {/* ── Continue (returners) ──────────────────────────────────────── */}
            <HomeRow
              label="Personal"
              title="Jump Back In"
              heroes={recentlyViewed}
              onPress={handlePress}
            />

            {/* ── Hall of Fame — Most Iconic, authored: a chosen #1 + ranked list
                 instead of a flat rail of equals. ──────────────────────────── */}
            <HallOfFame heroes={homeData.iconic ?? []} onPress={handlePress} />

            {/* ── Browse the Universe — the category doorways, with their own
                 header so the grid reads as a deliberate browse block, not an
                 orphaned slab under the carousel. ──────────────────────────── */}
            <View style={styles.browseHead}>
              <Text style={styles.browseKicker as object}>The Library</Text>
              <Text
                style={
                  [styles.browseTitle, isMobile && (styles.browseTitleMobile as object)] as object
                }
              >
                Browse the Universe
              </Text>
              <Text style={styles.browseSubtitle as object}>
                Pick your corner of the multiverse — publishers, teams, media and power rankings.
              </Text>
            </View>

            {/* ── Browse the Universe — one calm grid of doorway tiles. Replaces
                 the wall of category rails (and the old Dark Side rails:
                 villains / horror / anti-heroes are tiles here too). ────────── */}
            <CategoryBrowseGrid
              covers={homeData.browseCovers}
              onNavigate={(path) => router.push(path as Parameters<typeof router.push>[0])}
            />

            {/* ── Fresh to the Vault — the one temporal rail (not a category) ── */}
            <View style={styles.afterGrid}>
              <HomeRow
                label="Fresh to the Vault"
                title="Newly Added"
                heroes={homeData.newlyAdded ?? []}
                onPress={handlePress}
              />
            </View>

            {/* ── The Arena — one featured rivalry leads; the rest live in /versus. */}
            <View style={styles.browseHead}>
              <Text style={styles.browseKicker as object}>The Arena</Text>
              <Text
                style={
                  [styles.browseTitle, isMobile && (styles.browseTitleMobile as object)] as object
                }
              >
                Greatest Rivalries
              </Text>
              <Text style={styles.browseSubtitle as object}>
                The debates that never settle — pick a side and see who the fans crown.
              </Text>
            </View>
            {(homeData.rivalries?.length ?? 0) > 0 && (
              <FeaturedRivalry rivalry={homeData.rivalries![0]} />
            )}
            <Pressable
              onPress={() => router.push('/versus' as Parameters<typeof router.push>[0])}
              style={[styles.seeAllRow, { paddingHorizontal: isMobile ? 16 : 32 }] as object}
            >
              <Text style={styles.seeAllText as object}>See all rivalries →</Text>
            </Pressable>

            {/* ── For You — warm close. Distinct eyebrow from the "Personal /
                 Jump Back In" rail up top so the two don't read as a dupe. ─── */}
            <HomeRow
              label="For You"
              title="Your Favourites"
              heroes={favourites}
              onPress={handlePress}
            />
          </View>

          <HomeFooter
            heroCount={totalHeroCount}
            onNavigate={(path) => router.push(path as Parameters<typeof router.push>[0])}
          />
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Engage row — matchup + daily game. Desktop: matchup takes the larger share,
  // the game a narrower column on the right. Mobile: stack, cards keep own gutters.
  engageRow: {
    flexDirection: 'row',
    // Stretch so the daily card grows to the matchup's height instead of
    // floating short beside it.
    alignItems: 'stretch',
    gap: 20,
    paddingHorizontal: 32,
    marginTop: 16,
  } as object,
  engageRowStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 0,
    paddingHorizontal: 0,
    marginTop: 0,
  } as object,
  engageMatchup: { flex: 1.7, minWidth: 0 } as object,
  engageDaily: { flex: 1, minWidth: 240, maxWidth: 440 } as object,
  engageDailyStack: {} as object,
  // Daily banner restyled to sit on the dark stage: drop the beige-sheet gutter,
  // add a glass hairline so it reads as a sibling of the matchup card.
  dailyBannerGlass: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    cursor: 'pointer',
  } as object,
  dailyBannerMobile: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    cursor: 'pointer',
  } as object,
  root: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flex: 1 },
  // Desktop: the scroll surface is the dark stage colour, so overscroll at the
  // top reveals dark (not beige) and the floating header sits on continuous dark.
  scrollDark: { backgroundColor: COLORS.deepNavy } as object,

  // ── Dark stage (top of explore — spotlight + stat pods) ─────────────────────
  // Clears the transparent top bar; its deep-navy bg still bleeds up under the
  // bar's scrim so the seam is invisible.
  darkStage: {
    backgroundColor: COLORS.deepNavy,
    backgroundImage: SURFACE_GRADIENT.stageImmersive,
    paddingTop: TOPBAR_HEIGHT + 10,
    paddingBottom: 28,
  } as object,
  darkStageMobile: { paddingTop: TOPBAR_HEIGHT - 4, paddingBottom: 16 } as object,

  // Beige canvas owns the carousel section (sits on the dark scroll surface).
  // Comic-paper tactility — a faint halftone ink-dot grid + a whisper of vertical
  // light so the canvas reads as printed stock, not a flat fill.
  beigeCanvas: {
    backgroundColor: COLORS.beige,
    backgroundImage:
      'radial-gradient(rgba(41,60,67,0.09) 1.1px, transparent 1.8px), linear-gradient(to bottom, rgba(255,255,255,0.85), rgba(255,255,255,0) 620px)',
    backgroundSize: '18px 18px, 100% 100%',
    paddingTop: 40,
    paddingBottom: 24,
  } as object,

  // "Browse the Universe" chapter break between the dynamic zone and the library.
  browseHead: { paddingHorizontal: 24, paddingBottom: 30, marginTop: -36 } as object,
  browseKicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 4,
  } as object,
  browseTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 40,
    color: COLORS.navy,
    lineHeight: 42,
  } as object,
  browseTitleMobile: {
    fontSize: 30,
    lineHeight: 32,
  } as object,
  browseSubtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(41,60,67,0.6)',
    lineHeight: 19,
    marginTop: 6,
    maxWidth: 560,
  } as object,

  // Breathing room between the browse grid and the "Newly Added" rail.
  afterGrid: { marginTop: 44 },
  // "See all rivalries →" link under the featured rivalry (the rail it replaced).
  seeAllRow: { marginTop: -24, marginBottom: 52, alignSelf: 'flex-start' } as object,
  seeAllText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.orange,
    letterSpacing: 0.5,
  } as object,

  // ── Home layout ──────────────────────────────────────────────────────────────
  discoverContent: {
    paddingTop: 0,
    paddingBottom: 0,
    width: '100%',
  } as object,
});
