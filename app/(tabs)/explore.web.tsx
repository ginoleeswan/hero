// app/(tabs)/explore.web.tsx — Home screen for web (spotlight + horizontal scroll rows).
// Search lives on the dedicated /search route; this screen is home-only.
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { COLORS } from '../../src/constants/colors';
import { heroImageSource } from '../../src/constants/heroImages';
import { useSearch } from '../../src/contexts/SearchContext';
import { WebHomeSkeleton } from '../../src/components/web/HomeSkeleton';
import {
  getHeroCount,
  getXMen,
  getAntiHeroes,
  getVillains,
  getIconicHeroes,
  getSpotlightHeroes,
  getNewlyAddedCV,
  getHeroesByPublisher,
  getHeroesByStatRanking,
  type Hero,
  type PublisherFilter,
} from '../../src/lib/db/heroes';
import { getUserFavouriteHeroes } from '../../src/lib/db/favourites';
import { getRecentlyViewed } from '../../src/lib/db/viewHistory';
import { useAuth } from '../../src/hooks/useAuth';
import type { FavouriteHero } from '../../src/types';

// ── Constants ─────────────────────────────────────────────────────────────────
const PUBLISHER_FILTERS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];
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
  const source = heroImageSource(String(hero.id), hero.image_url, hero.portrait_url);
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [rc.wrap, hovered && (rc.wrapHover as object)] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object}
        cachePolicy="memory-disk"
        recyclingKey={String(hero.id)}
        transition={typeof source === 'object' && 'uri' in source ? 200 : null}
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
    lineHeight: 16,
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
  } as object,
});

// ── Portrait strip spotlight ──────────────────────────────────────────────────
const ACCORDION_SCALES = {
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
    width >= 1280
      ? ACCORDION_SCALES.large
      : width >= 900
        ? ACCORDION_SCALES.medium
        : ACCORDION_SCALES.small;

  if (isDesktop) {
    const dynamicHeight = Math.min(320, windowHeight * 0.6);

    return (
      <View style={[pss.wrap, { paddingHorizontal: pagePad, height: dynamicHeight }]}>
        <View style={pss.strip}>
          {heroes.map((h, index) => {
            const offset = (index - activeIndex + heroes.length) % heroes.length;
            const isActive = offset === 0;
            const isNext = offset === 1;

            const isVisible = offset < activeScale.length;
            const cardWidth = isVisible ? activeScale[offset].w : 0;
            const opacity = isVisible ? activeScale[offset].o : 0;

            const source = heroImageSource(String(h.id), h.image_url, h.portrait_url);

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
                <Image
                  source={source}
                  contentFit="cover"
                  contentPosition={{ top: 0, left: '50%' }}
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      opacity: isActive ? 1 : 0.4,
                      transition: 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)',
                    } as any,
                  ]}
                  cachePolicy="memory-disk"
                  recyclingKey={String(h.id)}
                />
                <View style={pss.cardOverlay as object} />

                <Text
                  style={[
                    pss.cardBadge as object,
                    { opacity: isActive ? 1 : 0, transition: 'opacity 250ms ease' } as object,
                  ]}
                >
                  Featured
                </Text>

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

        {/* Info panel */}
        <View style={pss.panel}>
          <View>
            <Text style={pss.panelLabel as object}>Featured Hero</Text>
            <Text style={pss.panelName as object} numberOfLines={2}>
              {hero.name}
            </Text>
            {!!hero.publisher && (
              <Text style={pss.panelPub as object} numberOfLines={1}>
                {hero.publisher}
              </Text>
            )}
            {!!hero.summary && (
              <Text style={pss.panelSummary as object} numberOfLines={4}>
                {hero.summary}
              </Text>
            )}
          </View>
          <View style={pss.panelFooter}>
            <Pressable
              onPress={() => onViewProfile(String(hero.id))}
              style={({ hovered }: { hovered?: boolean }) =>
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
  const source = heroImageSource(String(hero.id), hero.image_url, hero.portrait_url);
  return (
    <View style={[pss.wrapMobile, { paddingHorizontal: pagePad }]}>
      <View style={pss.singlePortrait}>
        <Image
          source={source}
          contentFit="cover"
          contentPosition="top"
          style={StyleSheet.absoluteFill}
          cachePolicy="memory-disk"
          recyclingKey={String(hero.id)}
          transition={200}
        />
        <View style={pss.cardOverlay as object} />
        <Text style={pss.cardBadge as object}>Featured</Text>
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
    justifyContent: 'center',
    flexDirection: 'row',
    marginVertical: 32,
    gap: 12,
  },
  strip: { flexDirection: 'row', alignItems: 'stretch', gap: 12, contain: 'layout style' } as object,
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

  // Info Panel
  panel: {
    flex: 1,
    minWidth: 260,
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    padding: 24,
    justifyContent: 'space-between',
  },
  panelLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 8,
  } as object,
  panelName: {
    fontFamily: 'Flame-Regular',
    fontSize: 34,
    color: COLORS.beige,
    lineHeight: 38,
    marginBottom: 6,
    transition: 'opacity 200ms ease',
  } as object,
  panelPub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 14,
  } as object,
  panelSummary: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.6)',
    lineHeight: 20,
  } as object,
  panelFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
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
  wrapMobile: { flexDirection: 'row', gap: 10, height: 240, marginVertical: 20 },
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
      style={({ hovered }: { hovered?: boolean }) =>
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
}: {
  label?: string;
  title: string;
  heroes: (Hero | FavouriteHero)[];
  onPress: (id: string) => void;
  onViewAll?: () => void;
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
                style={({ hovered }: { hovered?: boolean }) =>
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
          {heroes.map((h) => (
            <RowCard key={h.id} hero={h} onPress={() => onPress(String(h.id))} />
          ))}
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

// ── Dark editorial row section ────────────────────────────────────────────────
function DarkHomeRow({
  label,
  title,
  heroes,
  onPress,
  onViewAll,
}: {
  label?: string;
  title: string;
  heroes: (Hero | FavouriteHero)[];
  onPress: (id: string) => void;
  onViewAll?: () => void;
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
    <View ref={sectionRef} style={drow.section}>
      <View style={[drow.header, { paddingLeft: pagePad }]}>
        <View style={drow.headerLeft}>
          <View style={drow.accentBar} />
          <View style={drow.headerText}>
            {!!label && <Text style={drow.label}>{label}</Text>}
            {onViewAll ? (
              <Pressable
                onPress={onViewAll}
                style={({ hovered }: { hovered?: boolean }) =>
                  [drow.titleRow, hovered && (drow.titleRowHover as object)] as object
                }
              >
                <Text style={drow.title}>{title}</Text>
                <Text
                  style={
                    {
                      fontFamily: 'Flame-Regular',
                      fontSize: 44,
                      color: COLORS.beige,
                      marginTop: 4,
                      marginLeft: 4,
                    } as object
                  }
                >
                  ›
                </Text>
              </Pressable>
            ) : (
              <Text style={drow.title}>{title}</Text>
            )}
          </View>
        </View>
      </View>
      {/* Scroll track starts at viewport left edge — cards bleed off sides when scrolling. */}
      <View style={{ position: 'relative', minHeight: ROW_CARD_HEIGHT } as object}>
        <View
          ref={scrollRef}
          style={[rowScrollStyle, { paddingLeft: pagePad, marginLeft: 0 }] as object}
        >
          {heroes.map((h) => (
            <RowCard key={h.id} hero={h} onPress={() => onPress(String(h.id))} />
          ))}
        </View>
        {isHovered && canScrollLeft && (
          <CarouselArrow direction="left" onPress={doScrollLeft} contained />
        )}
        {isHovered && canScrollRight && (
          <CarouselArrow direction="right" onPress={doScrollRight} contained />
        )}
      </View>
    </View>
  );
}

const drow = StyleSheet.create({
  section: {
    backgroundColor: COLORS.navy,
    paddingTop: 28,
    paddingBottom: 8,
    marginBottom: 52,
  } as object,
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
  title: { fontFamily: 'Flame-Regular', fontSize: 36, color: COLORS.beige, lineHeight: 38 },
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
  const isDesktop = width >= 768;

  // 1. MATCH THE ACCORDION_SCALES EXACTLY
  const optimalPoolSize = width >= 1280 ? 8 : width >= 900 ? 6 : 3;

  const { publisher, setPublisher } = useSearch();
  const { user } = useAuth();

  // Home data — partial so rows render as each query resolves
  interface HomeData {
    spotlight: Hero[];
    iconic: Hero[];
    xmen: Hero[];
    villains: Hero[];
    antiHeroes: Hero[];
    marvel: Hero[];
    dc: Hero[];
    strongest: Hero[];
    mostIntelligent: Hero[];
    newlyAdded: Hero[];
  }
  const [homeData, setHomeData] = useState<Partial<HomeData>>({});
  const [homeStarted, setHomeStarted] = useState(false); // true once spotlight arrives
  const [recentlyViewed, setRecentlyViewed] = useState<FavouriteHero[]>([]);
  const [favourites, setFavourites] = useState<FavouriteHero[]>([]);
  const [totalHeroCount, setTotalHeroCount] = useState<number | null>(null);

  // Fire every query independently — rows appear as each resolves.
  // Spotlight fires first since it's above the fold.
  useEffect(() => {
    getHeroCount().then(setTotalHeroCount).catch(() => {});

    const set = <K extends keyof HomeData>(key: K) => (val: HomeData[K]) =>
      setHomeData((d) => ({ ...d, [key]: val }));

    getSpotlightHeroes(10)
      .then((v) => { set('spotlight')(v); setHomeStarted(true); })
      .catch(() => setHomeStarted(true));

    getIconicHeroes(25).then(set('iconic')).catch(() => {});
    getXMen(25).then(set('xmen')).catch(() => {});
    getAntiHeroes(20).then(set('antiHeroes')).catch(() => {});
    getVillains(25).then(set('villains')).catch(() => {});
    getHeroesByPublisher('marvel', 25).then(set('marvel')).catch(() => {});
    getHeroesByPublisher('dc', 25).then(set('dc')).catch(() => {});
    getHeroesByStatRanking('strength', 20).then(set('strongest')).catch(() => {});
    getHeroesByStatRanking('intelligence', 20).then(set('mostIntelligent')).catch(() => {});
    getNewlyAddedCV(25).then(set('newlyAdded')).catch(() => {});
  }, []);

  // Personal rows
  useEffect(() => {
    if (!user?.id) return;
    getRecentlyViewed(user.id)
      .then(setRecentlyViewed)
      .catch(() => {});
    getUserFavouriteHeroes(user.id)
      .then(setFavourites)
      .catch(() => {});
  }, [user?.id]);

  const handlePress = useCallback(
    (id: string) => {
      router.push(`/character/${id}`);
    },
    [router],
  );

  return (
    <View style={styles.root}>
      {/* ── Desktop: editorial beige filter strip ────────────────────────────── */}
      {isDesktop && (
        <View style={styles.filterStrip as object}>
          <View style={styles.filterInner}>
            <View style={styles.filterTabs as object}>
              {PUBLISHER_FILTERS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() =>
                    f === 'All' ? setPublisher('All') : router.push(`/search?publisher=${f}`)
                  }
                  style={({ hovered }: { hovered?: boolean }) =>
                    [
                      styles.filterTab,
                      publisher === f && (styles.filterTabActive as object),
                      hovered && publisher !== f && (styles.filterTabHover as object),
                    ] as object
                  }
                >
                  <Text
                    style={[styles.filterTabText, publisher === f && styles.filterTabTextActive]}
                  >
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.filterCount as object}>
              {totalHeroCount !== null
                ? `${totalHeroCount.toLocaleString()} heroes in the encyclopedia`
                : ''}
            </Text>
          </View>
        </View>
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {!homeStarted ? (
        <WebHomeSkeleton />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.discoverContent, isMobile && { paddingTop: 0 }] as object}
        >
          {/* ── Home content — always rendered. On desktop, committed searches
               go to the dedicated /search route; on mobile-web the inline
               results below still appear. ───────────────────────────────────── */}
          {/* Spotlight */}
          {(homeData.spotlight?.length ?? 0) > 0 && (
            <PortraitStripSpotlight
              heroes={homeData.spotlight!.slice(0, Math.min(optimalPoolSize, homeData.spotlight!.length))}
              onViewProfile={handlePress}
            />
          )}

          {/* Personal rows */}
          <HomeRow label="Personal" title="Jump Back In" heroes={recentlyViewed} onPress={handlePress} />
          <HomeRow label="Personal" title="Your Favourites" heroes={favourites} onPress={handlePress} />

          {/* Curated rows — each appears as its query resolves */}
          <HomeRow
            label="By Appearances"
            title="Most Iconic"
            heroes={homeData.iconic ?? []}
            onPress={handlePress}
            onViewAll={() => router.push('/category/most-iconic')}
          />
          <DarkHomeRow
            label="The Dark Side"
            title="Villains"
            heroes={homeData.villains ?? []}
            onPress={handlePress}
            onViewAll={() => router.push('/category/villain')}
          />
          <HomeRow
            label="Marvel Comics"
            title="Marvel Universe"
            heroes={homeData.marvel ?? []}
            onPress={handlePress}
            onViewAll={() => router.push('/category/marvel')}
          />
          <HomeRow
            label="DC Comics"
            title="DC Universe"
            heroes={homeData.dc ?? []}
            onPress={handlePress}
            onViewAll={() => router.push('/category/dc')}
          />
          <DarkHomeRow
            label="Neither Good Nor Evil"
            title="Anti-Heroes"
            heroes={homeData.antiHeroes ?? []}
            onPress={handlePress}
            onViewAll={() => router.push('/category/anti-heroes')}
          />
          <HomeRow
            label="By Power Stats"
            title="Strongest Heroes"
            heroes={homeData.strongest ?? []}
            onPress={handlePress}
            onViewAll={() => router.push('/category/strongest')}
          />
          <DarkHomeRow
            label="Charles Xavier's School for Gifted Youngsters"
            title="X-Men"
            heroes={homeData.xmen ?? []}
            onPress={handlePress}
            onViewAll={() => router.push('/category/xmen')}
          />
          <HomeRow
            label="By Power Stats"
            title="Brightest Minds"
            heroes={homeData.mostIntelligent ?? []}
            onPress={handlePress}
            onViewAll={() => router.push('/category/most-intelligent')}
          />
          <HomeRow
            label="New to the Encyclopedia"
            title="Recently Added"
            heroes={homeData.newlyAdded ?? []}
            onPress={handlePress}
          />

          <View style={styles.footerRule} />
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flex: 1 },

  // ── Desktop editorial filter strip ──────────────────────────────────────────
  filterStrip: {
    position: 'sticky',
    top: 64,
    zIndex: 50,
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.08)',
    height: 46,
    justifyContent: 'center',
  } as object,
  filterInner: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTabs: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
  } as object,
  filterTab: {
    paddingHorizontal: 18,
    height: 46,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    cursor: 'pointer',
    transition: 'border-color 150ms ease',
  } as object,
  filterTabActive: { borderBottomColor: COLORS.orange } as object,
  filterTabHover: { borderBottomColor: 'rgba(245,235,220,0.25)' } as object,
  filterTabText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.38)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  filterTabTextActive: { color: COLORS.beige },
  filterCount: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.28)',
    letterSpacing: 0.3,
  },

  // ── Home layout ──────────────────────────────────────────────────────────────
  discoverContent: {
    paddingTop: 0,
    paddingBottom: 100,
    width: '100%',
  },
  footerRule: { height: 1, backgroundColor: COLORS.navy, opacity: 0.08, marginTop: 16 },
});
