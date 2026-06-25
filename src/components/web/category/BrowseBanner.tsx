import { useLayoutEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import { BrandLogoView } from '../../PublisherBadge';
import type { BrandLogo } from '../../../constants/publishers';
import { TOPBAR_HEIGHT } from '../TopBar';

const BEIGE = COLORS.beige;
const NAVY = COLORS.navy;
const TITLE_SHADOW = '0 2px 18px rgba(0,0,0,0.5)';

/**
 * Editorial "set banner" for a universe browse page. A brand-coloured stage
 * with a faded roster montage on the right and a masthead headline (the logo,
 * or the name in the display face).
 *
 * Choreography (`sticky`, desktop): the banner scrolls away normally, but the
 * HEADLINE detaches — it tracks its in-flow slot, then pins below the nav and
 * scales down, ending above the grid/filters. A text headline also fades from
 * beige to navy as it parks so it reads on the beige canvas. Driven imperatively
 * from scroll (no re-renders). Web-only.
 */
export function BrowseBanner({
  title,
  color,
  colorDark,
  total,
  leadName,
  logo,
  badgeSize,
  logoTint,
  heroImageUrls,
  compact,
  sticky,
}: {
  title: string;
  color: string;
  colorDark: string;
  total: number;
  leadName?: string | null;
  logo?: BrandLogo;
  badgeSize?: { width: number; height: number };
  logoTint?: string;
  heroImageUrls?: string[];
  compact?: boolean;
  sticky?: boolean;
}) {
  const stat =
    total > 0
      ? `${total.toLocaleString()} ${total === 1 ? 'CHARACTER' : 'CHARACTERS'}${
          leadName ? `  ·  LED BY ${leadName.toUpperCase()}` : ''
        }`
      : '';

  let logoW = 0;
  let logoH = 0;
  if (logo && badgeSize) {
    const aspect = badgeSize.width / badgeSize.height;
    const maxW = compact ? 268 : 440;
    logoH = compact ? 62 : 122;
    logoW = logoH * aspect;
    if (logoW > maxW) {
      logoW = maxW;
      logoH = logoW / aspect;
    }
  }
  const hasLogo = logoW > 0;
  // Light logos (white-tinted) vanish on the beige canvas once parked, so they
  // get darkened to a silhouette on park — same idea as recolouring text to navy.
  const lightLogo = hasLogo && (logoTint === '#FFFFFF' || logoTint === '#fff');
  const detach = !!sticky; // desktop: detach the headline (logo or text) on scroll

  const slotRef = useRef<View>(null);
  const overlayRef = useRef<View>(null);
  const textRef = useRef<Text>(null);

  useLayoutEffect(() => {
    if (!detach || typeof window === 'undefined') return;
    const PARK = TOPBAR_HEIGHT + 12;
    let docTop: number | null = null;
    let raf = 0;
    const place = () => {
      raf = 0;
      const slot = slotRef.current as unknown as HTMLElement | null;
      const ov = overlayRef.current as unknown as HTMLElement | null;
      if (!slot || !ov) return;
      const r = slot.getBoundingClientRect();
      if (docTop == null) docTop = r.top + window.scrollY;
      const slotTop = docTop - window.scrollY;
      const top = Math.max(slotTop, PARK);
      const range = Math.max(docTop - PARK, 1);
      const p = Math.min(Math.max(window.scrollY / range, 0), 1);
      ov.style.top = `${top}px`;
      ov.style.left = `${r.left}px`;
      ov.style.width = `${r.width}px`;
      ov.style.transform = `scale(${1 - p * (1 - 0.42)})`;
      ov.style.opacity = '1';
      // Headline darkens as it settles onto the beige canvas: text → navy, a
      // light logo → silhouette (so white marks like Image don't disappear).
      const onPaper = p > 0.7;
      const txt = textRef.current as unknown as HTMLElement | null;
      if (txt) {
        txt.style.color = onPaper ? NAVY : BEIGE;
        txt.style.textShadow = onPaper ? 'none' : TITLE_SHADOW;
      }
      if (lightLogo) ov.style.filter = onPaper ? 'brightness(0)' : 'none';
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(place);
    };
    const onResize = () => {
      docTop = null;
      place();
    };
    place();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [detach, logoW, logoH, title, lightLogo]);

  // The headline, built twice: once invisibly in the slot (reserves layout),
  // once in the fixed overlay (the visible, animated copy). For text the overlay
  // copy gets the ref so it can recolour.
  const renderHeadline = (overlay: boolean) =>
    hasLogo ? (
      <BrandLogoView logo={logo!} width={logoW} height={logoH} tint={logoTint} />
    ) : (
      <Text
        ref={overlay ? textRef : undefined}
        style={[styles.title, compact && (styles.titleCompact as object)] as object}
        numberOfLines={2}
      >
        {title}
      </Text>
    );

  return (
    <>
      <View
        style={
          [
            styles.banner,
            {
              minHeight: compact ? 170 : 332,
              paddingBottom: compact ? 40 : 36,
              paddingHorizontal: compact ? 16 : 32,
              paddingTop: compact ? 66 : 80,
              // Brand radial wash, then a linear fade over the lower half to the
              // exact canvas ink — the banner's bottom dissolves seamlessly into
              // the gallery floor with no visible edge (top layer drawn first).
              backgroundImage: `linear-gradient(180deg, transparent 48%, ${COLORS.deepNavy} 100%), radial-gradient(125% 140% at 92% 4%, ${color} 0%, ${colorDark} 45%, ${COLORS.deepNavy} 100%)`,
            },
          ] as object
        }
      >
        {/* Roster montage — DESKTOP ONLY: a faded row of portraits on the right.
            On mobile the brand gradient + glowing edge carry the masthead; a
            blurred portrait wash there just muddied the brand colour (the lead
            hero's hue fights the brand's), so it's dropped. */}
        {!compact && heroImageUrls && heroImageUrls.length > 0 ? (
          <>
            <View
              style={
                [
                  styles.montage,
                  { maskImage: 'linear-gradient(to left, #000 30%, transparent 100%)' },
                ] as object
              }
              pointerEvents="none"
            >
              {heroImageUrls.slice(0, 6).map((uri, i) => (
                <Image
                  key={`${uri}-${i}`}
                  source={{ uri }}
                  contentFit="cover"
                  contentPosition="top"
                  style={styles.montageTile}
                />
              ))}
            </View>
            <View
              style={
                [
                  styles.montageScrim,
                  {
                    backgroundImage: `linear-gradient(90deg, ${colorDark} 6%, transparent 58%), radial-gradient(120% 120% at 90% 4%, ${color}55 0%, transparent 55%)`,
                  },
                ] as object
              }
              pointerEvents="none"
            />
          </>
        ) : null}
        <View style={styles.content}>
          {/* Slot reserves the headline's space; invisible when it detaches. */}
          <View ref={slotRef} style={detach ? (styles.hiddenSlot as object) : undefined}>
            {renderHeadline(false)}
          </View>
          {stat ? <Text style={styles.caption}>{stat}</Text> : null}
        </View>
      </View>

      {/* Detaching headline: fixed overlay that tracks the slot, parks + scales. */}
      {detach ? (
        <View ref={overlayRef} style={styles.detach as object} pointerEvents="none">
          {renderHeadline(true)}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
  } as object,
  montage: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '62%' as unknown as number,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    opacity: 0.5,
  },
  montageTile: {
    height: '100%' as unknown as number,
    aspectRatio: 0.75,
    marginLeft: -28,
    borderRadius: 4,
  },
  montageScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  content: { position: 'relative', maxWidth: 820, alignItems: 'flex-start' },
  hiddenSlot: { opacity: 0 },
  detach: {
    position: 'fixed',
    top: 0,
    left: 0,
    transformOrigin: 'top left',
    opacity: 0,
    zIndex: 20,
    // Smooths the darken-on-park (text colour / logo silhouette).
    transition: 'color 200ms ease, text-shadow 200ms ease, filter 200ms ease',
  } as object,
  caption: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginTop: 12,
    textShadow: '0 1px 8px rgba(0,0,0,0.5)',
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 72,
    lineHeight: 84,
    color: BEIGE,
    textShadow: TITLE_SHADOW,
    transition: 'color 200ms ease, text-shadow 200ms ease',
  } as object,
  titleCompact: { fontSize: 42, lineHeight: 52 },
});
