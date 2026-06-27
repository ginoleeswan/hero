import React, { type ComponentProps, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { useSearch } from '../../contexts/SearchContext';
import { useCommandAlerts } from '../../contexts/CommandAlertsContext';
import { useWebChrome } from '../../contexts/WebChromeContext';
import { NotificationBell } from '../admin/health/NotificationBell';
import { HeroLogo } from './HeroLogo';
import { SearchPalette } from './search/SearchPalette';

export const TOPBAR_HEIGHT = 64;

// Versus/Arena entry — the web Arena hub (today's showdown + rivalries + the
// build-your-own / surprise-me actions). The two-slot matchup builder lives one
// step deeper at /compare/pick, reached from the hub's "Build your own".
const VERSUS_PATH = '/versus';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Active = filled glyph, inactive = outline — one consistent family, intentional state.
const NAV: { key: string; path: string; icon: IoniconName; iconOutline: IoniconName }[] = [
  { key: 'home', path: '/explore', icon: 'home', iconOutline: 'home-outline' },
  { key: 'search', path: '/search', icon: 'search', iconOutline: 'search-outline' },
  { key: 'versus', path: VERSUS_PATH, icon: 'git-compare', iconOutline: 'git-compare-outline' },
];

// Transparent floating top bar with a top-down scrim. Logo left, nav icons
// centre (desktop), avatar / sign-in right. Used on every web page, all widths.
// `logoOnly` (auth screens) drops the nav/account controls — just the brand over
// the page's own hero — and renders nothing on desktop, where auth has its own
// split-panel branding.
export function TopBar({ logoOnly = false }: { logoOnly?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { searchFocused, setSearchFocused } = useSearch();
  const { alerts } = useCommandAlerts();
  const { isLight } = useWebChrome();
  const initial = user?.email?.charAt(0).toUpperCase() ?? '';
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  // The command center's alerts bell lives here on mobile (its header band is
  // desktop-only). Only shows on the /admin command center, where alerts publish.
  const showCommandBell = isMobile && pathname.startsWith('/admin');

  // The status-bar inset is owned by AdaptiveStatusBarCover (in _layout.web); the
  // TopBar is just the nav + its scroll frost. Every page is dark-topped, so the
  // bar is always dark chrome — no light-mode branching.

  // Desktop: the search icon opens a command palette; mobile routes to /search.
  const openSearch = () => (isMobile ? router.push('/search') : setSearchFocused(true));

  // Transparent over the page's hero at the top; a frosted bar once content
  // scrolls up behind it (keeps light icons readable over the beige body).
  const [scrolled, setScrolled] = useState(false);
  // Mobile: a hide-on-scroll-down / reveal-on-scroll-up bar. `mobAtTop` keeps it
  // transparent over the page's hero; once scrolled, it slides away going down and
  // slides back with a frosted material going up — so it's never transparent over
  // arbitrary mid-page content.
  const [mobHidden, setMobHidden] = useState(false);
  const [mobAtTop, setMobAtTop] = useState(true);
  useEffect(() => {
    // Only desktop uses `scrolled` (transparent→frosted crossfade); mobile runs its
    // own hide/reveal listener below.
    if (isMobile) return undefined;
    // Capture phase catches scroll from the inner RN ScrollView divs (scroll
    // events don't bubble). Vertical-scroller guard ignores horizontal carousels.
    const onScroll = (e: Event) => {
      const t = e.target;
      // Content routes use native document scroll (enabled in _layout.web.tsx),
      // so they fire with the document as target — read window.scrollY for those.
      if (t === document || t === document.documentElement || t === document.body) {
        setScrolled(window.scrollY > 16);
        return;
      }
      if (!(t instanceof HTMLElement) || t.scrollHeight <= t.clientHeight + 4) return;
      setScrolled(t.scrollTop > 16);
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [isMobile]);
  // Mobile hide/reveal: track scroll direction off the document scroller. A small
  // threshold ignores jitter; at the very top the bar is always shown + transparent.
  useEffect(() => {
    if (!isMobile || typeof window === 'undefined') return undefined;
    let lastY = window.scrollY;
    let ticking = false;
    const apply = () => {
      const y = window.scrollY;
      const atTop = y <= 8;
      setMobAtTop(atTop);
      if (atTop) {
        setMobHidden(false);
      } else {
        const delta = y - lastY;
        if (delta > 6)
          setMobHidden(true); // scrolling down → hide
        else if (delta < -6) setMobHidden(false); // scrolling up → reveal
      }
      lastY = y;
      ticking = false;
    };
    const onScroll = (e: Event) => {
      const t = e.target;
      // Only the document scroller drives the bar; ignore horizontal carousels etc.
      if (!(t === document || t === document.documentElement || t === document.body)) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [isMobile]);

  // New routes start at the top — reset until the next scroll event.
  useEffect(() => {
    setScrolled(false);
    setMobHidden(false);
    setMobAtTop(true);
  }, [pathname]);

  // ⌘K / Ctrl-K (and "/" when not already typing) open the palette on desktop.
  useEffect(() => {
    if (isMobile) return;
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault();
        setSearchFocused(true);
      } else if (k === '/' && !typing) {
        e.preventDefault();
        setSearchFocused(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile, setSearchFocused]);

  // Versus highlights across the whole /compare flow; others match their route.
  const navActive = (key: string, path: string) =>
    key === 'versus'
      ? pathname.startsWith('/versus') || pathname.startsWith('/compare')
      : key === 'search'
        ? searchFocused || pathname === path
        : pathname === path;
  const go = (path: string) => router.push(path as Parameters<typeof router.push>[0]);

  // Glyph colour adapts to the page's top on mobile flow-under: dark ink over a
  // light-topped page, light beige over a dark one (desktop keeps its dark frost,
  // so always light there). Active stays orange — legible on both. A soft halo of
  // the opposite tone rides under each glyph so it survives busy art scrolling
  // beneath without needing a page-bruising scrim.
  const adaptDark = isMobile && isLight;
  const inactiveTint = adaptDark ? 'rgba(11,24,32,0.62)' : 'rgba(245,235,220,0.7)';
  const foreground = adaptDark ? COLORS.deepNavy : COLORS.beige;
  const glyphShadow = !isMobile
    ? null
    : adaptDark
      ? ({ filter: 'drop-shadow(0 1px 2px rgba(245,235,220,0.55))' } as object)
      : ({ filter: 'drop-shadow(0 1px 3px rgba(11,24,32,0.5))' } as object);
  const hoverStyle = c.itemHover as object;

  const renderItem = (it: (typeof NAV)[number]) => {
    const active = navActive(it.key, it.path);
    const tint = active ? COLORS.orange : inactiveTint;
    return (
      <Pressable
        key={it.key}
        aria-label={it.key}
        onPress={() => (it.key === 'search' ? openSearch() : go(it.path))}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
          [c.item, active && (c.itemActive as object), !active && hovered && hoverStyle] as object
        }
      >
        {it.key === 'versus' ? (
          <MaterialCommunityIcons
            name="sword-cross"
            size={22}
            color={tint}
            style={[c.iconTint, glyphShadow] as object}
          />
        ) : (
          <Ionicons
            name={active ? it.icon : it.iconOutline}
            size={22}
            color={tint}
            style={[c.iconTint, glyphShadow] as object}
          />
        )}
      </Pressable>
    );
  };

  // Render directly into document.body via a portal so `position: fixed` is
  // always viewport-relative — bypasses any CSS transform or contain property
  // that ancestor React Native / React Navigation containers might apply, which
  // would otherwise make `position: fixed` relative to that container instead
  // of the viewport and cause the bar to scroll with the page content.
  // Desktop auth keeps its own branding; the logo-only bar is a mobile affordance.
  if (logoOnly && !isMobile) return null;

  // Mobile keeps ONE consistent dark scrim at every scroll position — opaque navy
  // at the top easing into the page below, so the bar never restyles on scroll.
  // Desktop keeps the transparent scrim-over-hero → frosted-bar-on-scroll.
  // Mobile slides the whole bar up when hidden; desktop never moves. translateZ(0)
  // is preserved to keep the fixed bar on its own GPU layer (the iOS pinning fix).
  const barHideStyle = isMobile
    ? ({
        transform: mobHidden ? 'translateY(-115%) translateZ(0)' : 'translateY(0) translateZ(0)',
        transition: 'transform 300ms ease',
      } as object)
    : null;

  const bar = (
    <View style={[c.bar, barHideStyle] as object} pointerEvents="box-none">
      {isMobile ? (
        // Mobile: transparent over the hero at the top; once you scroll up after
        // scrolling down, a header reveals — a gradient scrim + graduated blur that's
        // solid at the very top (so it fuses with the dark body strip) and fades to
        // transparent blur by the bottom, melting into the content. Hidden (opacity 0)
        // at the very top. Scrim follows the page's light/dark to match the glyphs.
        <View
          style={[c.mHeader, mobAtTop ? (c.layerHidden as object) : (c.layerShown as object)] as object}
          pointerEvents="none"
        >
          <View style={[StyleSheet.absoluteFill, c.mHeaderBlur] as object} />
          <View
            style={
              [
                StyleSheet.absoluteFill,
                adaptDark ? (c.mHeaderScrimLight as object) : (c.mHeaderScrimDark as object),
              ] as object
            }
          />
        </View>
      ) : (
        <>
          {/* Desktop: soft dark gradient over the hero at the top… */}
          <View
            style={[c.topScrim, scrolled && (c.layerHidden as object)] as object}
            pointerEvents="none"
          />
          {/* …becoming a frosted bar once content scrolls up behind it. */}
          <View
            style={[c.frost, scrolled && (c.layerShown as object)] as object}
            pointerEvents="none"
          >
            <View style={[StyleSheet.absoluteFill, c.frostA] as object} />
            <View style={[StyleSheet.absoluteFill, c.frostC] as object} />
            <View style={[StyleSheet.absoluteFill, c.frostTintDesktop] as object} />
          </View>
        </>
      )}
      <View
        style={[c.inner, { paddingHorizontal: isMobile ? 16 : 28 }] as object}
        pointerEvents="box-none"
      >
        <Pressable onPress={() => router.push('/explore')} style={[c.logo, glyphShadow] as object}>
          <HeroLogo iconSize={24} fontSize={19} color={foreground} gap={8} />
        </Pressable>

        {!isMobile && !logoOnly && <View style={c.center}>{NAV.map(renderItem)}</View>}

        {!logoOnly && (
          <View style={c.right}>
            {isMobile && NAV.filter((it) => it.key !== 'home').map(renderItem)}
            {showCommandBell ? <NotificationBell alerts={alerts} variant="nav" /> : null}
            {user ? (
              <Pressable
                aria-label="Profile"
                onPress={() => router.push('/profile')}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [c.item, glyphShadow, hovered && hoverStyle] as object
                }
              >
                <View style={c.avatar}>
                  {profile?.avatar_url ? (
                    <Image
                      source={{ uri: profile.avatar_url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={c.avatarText}>{initial}</Text>
                  )}
                </View>
              </Pressable>
            ) : (
              <Pressable
                aria-label="Sign in"
                // RN-web drops the `title` prop, so set the tooltip on the DOM node.
                ref={(node) => {
                  if (node) (node as unknown as HTMLElement).title = 'Sign in';
                }}
                onPress={() => router.push('/(auth)/login')}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [c.item, hovered && hoverStyle] as object
                }
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={foreground}
                  style={[c.iconTint, glyphShadow] as object}
                />
              </Pressable>
            )}
          </View>
        )}
      </View>
      {!isMobile && !logoOnly && <SearchPalette />}
    </View>
  );

  if (typeof document === 'undefined') return bar;
  return createPortal(bar, document.body) as unknown as React.ReactElement;
}

const c = StyleSheet.create({
  bar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    // Grow by the iOS status-bar inset and push content below it, so the bar
    // clears the Dynamic Island now that content bleeds edge-to-edge
    // (viewport-fit=cover). env() resolves to 0 where there's no safe area.
    height: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top))`,
    paddingTop: 'env(safe-area-inset-top)',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
    zIndex: 100,
    justifyContent: 'center',
    // iOS Safari bug: when body has overflow:visible (needed for toolbar
    // collapse), position:fixed elements drift/scroll with the page. A real
    // transform (not just the will-change hint, which Safari may ignore) forces
    // a dedicated GPU compositing layer and keeps the bar reliably pinned.
    transform: 'translateZ(0)',
    willChange: 'transform',
  } as object,
  // Dark scrim: holds near-solid navy across the status-bar inset + icon row (so
  // it fuses with the navy status-bar cover and bright hero art never bleeds
  // behind the logo/avatar) before a long fade to transparent.
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 10px)`,
    backgroundImage:
      'linear-gradient(to bottom, rgba(11,24,32,1) 0%, rgba(11,24,32,0.85) 30%, rgba(11,24,32,0.45) 62%, rgba(11,24,32,0.14) 84%, transparent 100%)',
    opacity: 1,
    transition: 'opacity 300ms ease',
  } as object,
  // Desktop scrolled frost: two blur layers (frostA heavy + frostC light), each
  // masked to a band, so the blur is heaviest at the top behind the icons and
  // tapers to zero by the bottom — a graduated blur with no hard edge, with
  // frostTintDesktop riding on top. (Mobile uses the mHeader scrim+blur instead.)
  frost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 10px)`,
    opacity: 0,
    transition: 'opacity 300ms ease',
  } as object,
  frostA: {
    backdropFilter: 'blur(16px) saturate(150%)',
    WebkitBackdropFilter: 'blur(16px) saturate(150%)',
    maskImage: 'linear-gradient(to bottom, #000 0%, #000 10%, transparent 44%)',
    WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 10%, transparent 44%)',
  } as object,
  frostC: {
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    maskImage: 'linear-gradient(to bottom, #000 0%, #000 52%, transparent 94%)',
    WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 52%, transparent 94%)',
  } as object,
  // Mobile reveal: a full-width header covering the whole bar, faded in once scrolled
  // up (opacity via layerShown/Hidden). Two layers — a graduated blur (strong at the
  // top, masked to nothing by the bottom) and a colour scrim (solid at the very top
  // so it fuses with the body strip, easing to transparent at the bottom so it melts
  // into the content). Scrim colour follows the page light/dark to match the glyphs.
  mHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    transition: 'opacity 240ms ease',
  } as object,
  mHeaderBlur: {
    backdropFilter: 'blur(18px) saturate(150%)',
    WebkitBackdropFilter: 'blur(18px) saturate(150%)',
    maskImage: 'linear-gradient(to bottom, #000 0%, #000 45%, transparent 96%)',
    WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 45%, transparent 96%)',
  } as object,
  mHeaderScrimDark: {
    backgroundImage:
      'linear-gradient(to bottom, #0b1820 0%, #0b1820 48%, rgba(11,24,32,0.62) 74%, transparent 100%)',
  } as object,
  mHeaderScrimLight: {
    backgroundImage:
      'linear-gradient(to bottom, #f5ebdc 0%, #f5ebdc 48%, rgba(245,235,220,0.62) 74%, transparent 100%)',
  } as object,
  // Desktop: the original light frosted glass — no system status bar to match.
  frostTintDesktop: {
    backgroundImage:
      'linear-gradient(to bottom, rgba(11,24,32,0.5) 0%, rgba(11,24,32,0.26) 52%, transparent 86%)',
  } as object,
  layerHidden: { opacity: 0 } as object,
  layerShown: { opacity: 1 } as object,
  // Ease icon/glyph colour when the chrome flips dark↔light, in step with the
  // background cross-fade and the status-bar tint.
  iconTint: { transition: 'color 300ms ease' } as object,
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  logo: { flex: 1 } as object,
  center: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  right: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },

  item: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  itemActive: { backgroundColor: 'rgba(231,115,51,0.16)' } as object,
  itemHover: { backgroundColor: 'rgba(255,255,255,0.08)' } as object,
  // Both account states (avatar / logged-out icon) sit inside the shared `item`
  // hover container, so the whole top bar hovers identically.
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as object,
  avatarText: { fontFamily: 'Flame-Regular', fontSize: 14, color: '#fff' },
});
