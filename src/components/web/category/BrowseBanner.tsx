import { useEffect, useLayoutEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import { BrandLogoView } from '../../PublisherBadge';
import type { BrandLogo } from '../../../constants/publishers';
import { TOPBAR_HEIGHT } from '../TopBar';

/**
 * Editorial "set banner" for a universe browse page. A brand-coloured stage
 * (colour glow → near-black) with a faded roster montage on the right and a
 * masthead — the universe LOGO big, a hairline rule, then the stat line.
 *
 * Choreography (`sticky`, desktop): the banner scrolls away normally, but the
 * LOGO detaches — it tracks its in-flow slot until it reaches the top, then
 * pins just below the nav and scales down, ending alone above the grid/filters.
 * Driven imperatively from scroll (no re-renders), so it's smooth.
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
    const maxW = compact ? 250 : 440;
    logoH = compact ? 62 : 122;
    logoW = logoH * aspect;
    if (logoW > maxW) {
      logoW = maxW;
      logoH = logoW / aspect;
    }
  }
  const hasLogo = logoW > 0;
  // The detaching logo only applies on desktop (sticky) when there's a logo.
  const detach = !!sticky && hasLogo;

  const slotRef = useRef<View>(null);
  const logoRef = useRef<View>(null);

  useLayoutEffect(() => {
    if (!detach || typeof window === 'undefined') return;
    const PARK = TOPBAR_HEIGHT + 12;
    let docTop: number | null = null;
    let raf = 0;
    const place = () => {
      raf = 0;
      const slot = slotRef.current as unknown as HTMLElement | null;
      const lg = logoRef.current as unknown as HTMLElement | null;
      if (!slot || !lg) return;
      const r = slot.getBoundingClientRect();
      if (docTop == null) docTop = r.top + window.scrollY;
      const slotTop = docTop - window.scrollY;
      const top = Math.max(slotTop, PARK);
      const range = Math.max(docTop - PARK, 1);
      const p = Math.min(Math.max(window.scrollY / range, 0), 1);
      const scale = 1 - p * (1 - 0.42);
      lg.style.top = `${top}px`;
      lg.style.left = `${r.left}px`;
      lg.style.transform = `scale(${scale})`;
      lg.style.opacity = '1';
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
  }, [detach, logoW, logoH]);

  const logoEl = hasLogo ? (
    <BrandLogoView logo={logo!} width={logoW} height={logoH} tint={logoTint} />
  ) : null;

  return (
    <>
      <View
        style={
          [
            styles.banner,
            {
              minHeight: compact ? 210 : 300,
              paddingBottom: compact ? 26 : 40,
              paddingHorizontal: compact ? 16 : 32,
              paddingTop: compact ? 58 : 84,
              backgroundImage: `radial-gradient(125% 140% at 92% 4%, ${color} 0%, ${colorDark} 42%, #0b0d12 100%)`,
            },
          ] as object
        }
      >
        {heroImageUrls && heroImageUrls.length > 0 ? (
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
        ) : null}
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
        <View style={styles.content}>
          {/* Logo slot — reserves the logo's space so the caption sits right.
              When detaching, the real logo is the fixed overlay below and this
              slot is invisible; otherwise the logo renders inline here. */}
          {hasLogo ? (
            <View ref={slotRef} style={{ width: logoW, height: logoH }}>
              {detach ? null : logoEl}
            </View>
          ) : (
            <Text
              style={[styles.title, compact && (styles.titleCompact as object)] as object}
              numberOfLines={2}
            >
              {title}
            </Text>
          )}
          {stat ? (
            <>
              <View style={styles.rule} />
              <Text style={styles.caption}>{stat}</Text>
            </>
          ) : null}
        </View>
      </View>

      {/* Detaching logo: fixed overlay that tracks the slot, then parks + scales. */}
      {detach ? (
        <View ref={logoRef} style={styles.detachLogo as object} pointerEvents="none">
          {logoEl}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
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
  detachLogo: {
    position: 'fixed',
    top: 0,
    left: 0,
    transformOrigin: 'top left',
    opacity: 0,
    zIndex: 20,
  } as object,
  rule: {
    width: 64,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(245,235,220,0.4)',
    marginTop: 24,
    marginBottom: 14,
  },
  caption: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    textShadow: '0 1px 8px rgba(0,0,0,0.5)',
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 72,
    lineHeight: 72,
    color: COLORS.beige,
    textShadow: '0 2px 18px rgba(0,0,0,0.5)',
  } as object,
  titleCompact: { fontSize: 42, lineHeight: 44 },
});
