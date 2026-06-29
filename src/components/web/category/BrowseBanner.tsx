import { useLayoutEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import { withCloudinaryTransform, withComicVineScale } from '../../../constants/heroImages';
import { BrandLogoView } from '../../PublisherBadge';
import type { BrandLogo } from '../../../constants/publishers';
import { TOPBAR_HEIGHT } from '../TopBar';

const BEIGE = COLORS.beige;
const TITLE_SHADOW = '0 2px 18px rgba(0,0,0,0.5)';

// Montage tiles are small, faded (0.5), grayscale + brand-tinted, so they need
// almost no resolution — shrink the source bytes so the above-the-fold banner
// fills in fast. Off their host each transform is a no-op.
const MONTAGE_WIDTH = 420;
const montageUri = (uri: string) =>
  withComicVineScale(withCloudinaryTransform(uri, MONTAGE_WIDTH), 'scale_medium');

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
  montage,
  compact,
  sticky,
  unitLabel = 'CHARACTER',
}: {
  title: string;
  color: string;
  colorDark: string;
  total: number;
  leadName?: string | null;
  logo?: BrandLogo;
  badgeSize?: { width: number; height: number };
  logoTint?: string;
  /** Roster portraits for the desktop montage, each with an optional BlurHash LQIP. */
  montage?: { uri: string; blurhash?: string | null }[];
  compact?: boolean;
  sticky?: boolean;
  /** Noun for the count, uppercased — "CHARACTER" for universes, "MEMBER" for teams. */
  unitLabel?: string;
}) {
  const stat =
    total > 0
      ? `${total.toLocaleString()} ${total === 1 ? unitLabel : `${unitLabel}S`}${
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
      // Park progress drives when the headline pins + darkens (tied to the slot
      // reaching PARK). Scale progress is separate, run over a longer FLOORED
      // range so the shrink stays gradual even on a short banner that parks after
      // little scroll — otherwise the logo collapses almost immediately.
      const parkRange = Math.max(docTop - PARK, 1);
      const scaleRange = Math.max(parkRange, 340);
      const scaleP = Math.min(Math.max(window.scrollY / scaleRange, 0), 1);
      ov.style.top = `${top}px`;
      ov.style.left = `${r.left}px`;
      ov.style.width = `${r.width}px`;
      ov.style.transform = `scale(${1 - scaleP * (1 - 0.42)})`;
      ov.style.opacity = '1';
      // Browse pages park the headline over the DARK gallery canvas, so it stays
      // light the whole way — no darken-to-silhouette (that was for the old beige
      // canvas, where light marks like the Image logo would have vanished).
      const txt = textRef.current as unknown as HTMLElement | null;
      if (txt) {
        txt.style.color = BEIGE;
        txt.style.textShadow = TITLE_SHADOW;
      }
      if (lightLogo) ov.style.filter = 'none';
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
              minHeight: compact ? 170 : 292,
              paddingBottom: compact ? 40 : 32,
              paddingHorizontal: compact ? 16 : 32,
              paddingTop: compact ? 66 : 70,
              // Brand radial wash only. The bottom-fade to canvas ink is a
              // separate overlay (styles.bottomFade) rendered ABOVE the desktop
              // portrait montage, so it dissolves the portraits into the floor
              // too — not just the background behind them.
              backgroundImage: `radial-gradient(125% 140% at 92% 4%, ${color} 0%, ${colorDark} 45%, ${COLORS.deepNavy} 100%)`,
            },
          ] as object
        }
      >
        {/* Roster montage — DESKTOP ONLY: a faded row of portraits on the right.
            On mobile the brand gradient + glowing edge carry the masthead; a
            blurred portrait wash there just muddied the brand colour (the lead
            hero's hue fights the brand's), so it's dropped. */}
        {!compact && montage && montage.length > 0 ? (
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
              {montage.slice(0, 6).map(({ uri, blurhash }, i, arr) => (
                <Image
                  key={`${uri}-${i}`}
                  source={{ uri: montageUri(uri) }}
                  contentFit="cover"
                  contentPosition="top"
                  // Instant blurred preview while the portrait downloads (LQIP).
                  placeholder={blurhash ? { blurhash } : undefined}
                  placeholderContentFit="cover"
                  // Above the fold → load these before the grid thumbnails below.
                  priority="high"
                  cachePolicy="memory-disk"
                  recyclingKey={uri}
                  // Fade in over the brand gradient instead of popping in late.
                  transition={400}
                  // Descending z-index (leftmost on top) so each tile overlaps the
                  // LEFT edge of the next — every visible tile shows the same
                  // width; only the masked leftmost is uncovered.
                  style={[styles.montageTile, { zIndex: arr.length - i }] as object}
                />
              ))}
              {/* Duotone: a brand-colour wash blended onto the grayscale tiles
                  (mix-blend `color` keeps their luminance, swaps the hue) so the
                  roster reads as one brand-tinted "ghost gallery" on every
                  universe — never muddy or dull regardless of the source art. */}
              <View
                style={[styles.montageTint, { backgroundColor: color }] as object}
                pointerEvents="none"
              />
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
        {/* Bottom-fade to the canvas ink — above the montage, below the logo +
            caption — so the masthead (portraits and brand wash alike) dissolves
            seamlessly into the gallery floor with no edge. */}
        <View style={styles.bottomFade as object} pointerEvents="none" />
        <View style={styles.content}>
          {/* Slot reserves the headline's space; invisible when it detaches. */}
          <View ref={slotRef} style={detach ? (styles.hiddenSlot as object) : undefined}>
            {renderHeadline(false)}
          </View>
          {stat ? (
            <Text style={[styles.caption, !compact && (styles.captionDesktop as object)] as object}>
              {stat}
            </Text>
          ) : null}
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
    // Bleed the strip slightly off the right edge so the last portrait runs out
    // of frame — balances the soft left fade (banner overflow:hidden clips it).
    right: -16,
    width: '78%' as unknown as number,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    opacity: 0.5,
  },
  montageTile: {
    height: '100%' as unknown as number,
    aspectRatio: 0.75,
    // Crossfade ribbon: deep overlap + a feathered leading (right) edge. With the
    // per-tile descending z-index (render), each tile sits on top of the next and
    // dissolves into it across the feather, so the portraits melt into one
    // another instead of reading as hard panels. The feather % and the overlap
    // are paired — the overlap should be ≈ the faded zone so the tile beneath
    // backs the whole fade.
    marginLeft: -44,
    filter: 'grayscale(1)', // monochrome base for the brand-tint duotone overlay
    // Feather BOTH edges: the lower tile fades IN on its left exactly as the
    // upper tile fades OUT on its right, so there's no hard seam — a true
    // crossfade. The overlap is sized to the fade zones so they coincide.
    maskImage: 'linear-gradient(to right, transparent 0%, #000 32%, #000 68%, transparent 100%)',
    WebkitMaskImage:
      'linear-gradient(to right, transparent 0%, #000 32%, #000 68%, transparent 100%)',
  } as object,
  // Brand-tint overlay for the duotone (see render). Isolated by the montage
  // container's opacity group, so it recolours only the tiles beneath it.
  montageTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    mixBlendMode: 'color',
    zIndex: 20, // above every tile's z-index so it tints all of them
  } as object,
  montageScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Seamless bottom edge: transparent over the top ~half, ramping to the exact
  // canvas ink at the base. Overlays the montage so portraits fade out too.
  bottomFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `linear-gradient(180deg, transparent 42%, ${COLORS.deepNavy} 100%)`,
  } as object,
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
  // More air under the (larger) desktop logo before the caption.
  captionDesktop: { marginTop: 34 } as object,
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
