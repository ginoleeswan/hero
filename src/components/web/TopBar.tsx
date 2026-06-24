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
  useEffect(() => {
    // Only desktop uses `scrolled` (transparent→frosted crossfade); the mobile
    // scrim is constant, so don't run a scroll listener there.
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
  // New routes start at the top — reset until the next scroll event.
  useEffect(() => setScrolled(false), [pathname]);

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

  // Light glyphs on the dark scrim; active stays orange.
  const inactiveTint = 'rgba(245,235,220,0.7)';
  const foreground = COLORS.beige;
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
          <MaterialCommunityIcons name="sword-cross" size={22} color={tint} style={c.iconTint} />
        ) : (
          <Ionicons
            name={active ? it.icon : it.iconOutline}
            size={22}
            color={tint}
            style={c.iconTint}
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
  const bar = (
    <View style={c.bar as object} pointerEvents="box-none">
      {isMobile ? (
        // Spread frosted scrim, consistent at every scroll position. The blur is
        // the universal blender: frosted glass is background-agnostic, so it
        // feathers the bottom edge cleanly over BOTH the dark navy versus pages
        // and the beige catalogue pages — no color smudge. So the heavy navy tint
        // holds up top (status-bar fusion + icon contrast) and fades out before
        // the bottom, while a soft blur layer carries the tail all the way down.
        // (Also the GPU-compositing layer that keeps the fixed bar from scrolling
        // on iOS.)
        <View style={c.scrim as object} pointerEvents="none">
          <View style={[StyleSheet.absoluteFill, c.frostMobHeavy] as object} />
          <View style={[StyleSheet.absoluteFill, c.frostMobSoft] as object} />
          <View style={[StyleSheet.absoluteFill, c.frostTintDark] as object} />
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
        <Pressable onPress={() => router.push('/explore')} style={c.logo}>
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
                  [c.item, hovered && hoverStyle] as object
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
                <Ionicons name="person-outline" size={20} color={foreground} style={c.iconTint} />
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
  // Consistent mobile scrim container — the gradient (frostTintDark/Light) is
  // applied on top. Spans the bar + a short tail so the tint reaches transparent
  // by the bar's bottom edge, easing into the page.
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 24px)`,
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
  // Scrolled frost: two blur layers (frostA heavy + frostC light), each masked to
  // a band, so the blur is heaviest at the top behind the icons and tapers to zero
  // by the bottom — a graduated blur with no hard edge. The tint that rides on top
  // is platform-specific (frostTintDark on mobile, frostTintDesktop on desktop).
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
  // Mobile-only progressive-blur pair (desktop keeps frostA/frostC). Both masks
  // ease MONOTONICALLY (no hold-then-drop knee, so no boundary line) but are pulled
  // UP relative to the navy tint: the frost tapers to zero around the bar's bottom
  // edge (~75%) so it never blurs the content/card-tops below. The navy tint
  // carries the gentle ramp the rest of the way down — that's just colour, it
  // doesn't frost anything, so it keeps the balanced spread without smearing cards.
  // Because the blur is already near-zero where it ends, dropping it higher leaves
  // no seam. Heavy blur is weighted toward the icons, soft reaches slightly lower.
  frostMobHeavy: {
    backdropFilter: 'blur(13px) saturate(140%)',
    WebkitBackdropFilter: 'blur(13px) saturate(140%)',
    maskImage:
      'linear-gradient(to bottom, #000 0%, #000 24%, rgba(0,0,0,0.72) 40%, rgba(0,0,0,0.4) 52%, rgba(0,0,0,0.14) 64%, transparent 74%)',
    WebkitMaskImage:
      'linear-gradient(to bottom, #000 0%, #000 24%, rgba(0,0,0,0.72) 40%, rgba(0,0,0,0.4) 52%, rgba(0,0,0,0.14) 64%, transparent 74%)',
  } as object,
  frostMobSoft: {
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    maskImage:
      'linear-gradient(to bottom, #000 0%, #000 32%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.28) 66%, rgba(0,0,0,0.08) 78%, transparent 86%)',
    WebkitMaskImage:
      'linear-gradient(to bottom, #000 0%, #000 32%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.28) 66%, rgba(0,0,0,0.08) 78%, transparent 86%)',
  } as object,
  // Mobile dark-topped pages: opaque deep-navy caps the very top (fused with the
  // navy status-bar cover), then eases MONOTONICALLY to transparent by ~90%. The
  // solid cap is kept short (12%) and the opacity steps are evenly spaced for a
  // balanced, gradual descent — no steep early drop. It still runs
  // a touch longer than the blur (which bows out ~75%, around the bar's bottom
  // edge): the colour-only tail carries the last of the ramp without frosting. Continuous gentle slope (no flat-then-drop
  // knee) and pure navy throughout — a warm hue would smear on the dark versus
  // pages, whereas the faint low-opacity navy tail stays subtle on any canvas.
  frostTintDark: {
    backgroundImage:
      'linear-gradient(to bottom, #0b1820 0%, #0b1820 12%, rgba(11,24,32,0.85) 22%, rgba(11,24,32,0.70) 32%, rgba(11,24,32,0.56) 42%, rgba(11,24,32,0.43) 52%, rgba(11,24,32,0.31) 62%, rgba(11,24,32,0.20) 72%, rgba(11,24,32,0.11) 80%, rgba(11,24,32,0.05) 85%, transparent 90%)',
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
