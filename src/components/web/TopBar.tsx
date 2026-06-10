import { type ComponentProps, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useSearch } from '../../contexts/SearchContext';
import { HeroLogo } from './HeroLogo';
import { SearchPalette } from './search/SearchPalette';

export const TOPBAR_HEIGHT = 64;

// Versus/Arena entry — the two-slot matchup builder (pick both fighters).
const VERSUS_PATH = '/compare/pick';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Active = filled glyph, inactive = outline — one consistent family, intentional state.
const NAV: { key: string; path: string; icon: IoniconName; iconOutline: IoniconName }[] = [
  { key: 'home', path: '/explore', icon: 'home', iconOutline: 'home-outline' },
  { key: 'search', path: '/search', icon: 'search', iconOutline: 'search-outline' },
  { key: 'versus', path: VERSUS_PATH, icon: 'git-compare', iconOutline: 'git-compare-outline' },
];

// Transparent floating top bar with a top-down scrim. Logo left, nav icons
// centre (desktop), avatar / sign-in right. Used on every web page, all widths.
export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { searchFocused, setSearchFocused } = useSearch();
  const initial = user?.email?.charAt(0).toUpperCase() ?? '';
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Desktop: the search icon opens a command palette; mobile routes to /search.
  const openSearch = () => (isMobile ? router.push('/search') : setSearchFocused(true));

  // Transparent over the page's hero at the top; a frosted bar once content
  // scrolls up behind it (keeps light icons readable over the beige body).
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
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
  }, []);
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
      ? pathname.startsWith('/compare')
      : key === 'search'
        ? searchFocused || pathname === path
        : pathname === path;
  const go = (path: string) => router.push(path as Parameters<typeof router.push>[0]);

  const renderItem = (it: (typeof NAV)[number]) => {
    const active = navActive(it.key, it.path);
    const tint = active ? COLORS.orange : 'rgba(245,235,220,0.7)';
    return (
      <Pressable
        key={it.key}
        aria-label={it.key}
        onPress={() => (it.key === 'search' ? openSearch() : go(it.path))}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
          [
            c.item,
            active && (c.itemActive as object),
            !active && hovered && (c.itemHover as object),
          ] as object
        }
      >
        {it.key === 'versus' ? (
          <MaterialCommunityIcons name="sword-cross" size={22} color={tint} />
        ) : (
          <Ionicons name={active ? it.icon : it.iconOutline} size={22} color={tint} />
        )}
      </Pressable>
    );
  };

  return (
    <View style={c.bar as object} pointerEvents="box-none">
      {/* At top: a soft gradient for icon legibility over the hero. */}
      <View style={[c.topScrim, scrolled && (c.layerHidden as object)] as object} pointerEvents="none" />
      {/* On scroll: progressive frost — stacked blur layers tapering from strong
          (top, behind the icons) to none (bottom), so it dissolves with no edge. */}
      <View style={[c.frost, scrolled && (c.layerShown as object)] as object} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, c.frostA] as object} />
        <View style={[StyleSheet.absoluteFill, c.frostB] as object} />
        <View style={[StyleSheet.absoluteFill, c.frostC] as object} />
        <View style={[StyleSheet.absoluteFill, c.frostTint] as object} />
      </View>
      <View style={[c.inner, { paddingHorizontal: isMobile ? 16 : 28 }] as object} pointerEvents="box-none">
        <Pressable onPress={() => router.push('/explore')} style={c.logo}>
          <HeroLogo iconSize={24} fontSize={19} color={COLORS.beige} gap={8} />
        </Pressable>

        {!isMobile && <View style={c.center}>{NAV.map(renderItem)}</View>}

        <View style={c.right}>
          {isMobile && NAV.filter((it) => it.key !== 'home').map(renderItem)}
          {user ? (
            <Pressable
              aria-label="Profile"
              onPress={() => router.push('/profile')}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [c.item, hovered && (c.itemHover as object)] as object
              }
            >
              <View style={c.avatar}>
                <Text style={c.avatarText}>{initial}</Text>
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
                [c.item, hovered && (c.itemHover as object)] as object
              }
            >
              <Ionicons name="person-outline" size={20} color={COLORS.beige} />
            </Pressable>
          )}
        </View>
      </View>
      {!isMobile && <SearchPalette />}
    </View>
  );
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
  } as object,
  // At-top scrim: a soft gradient with a long tail, just enough to keep light
  // icons legible over the hero (incl. bright art under the right-side avatar).
  // Navy-over-navy reads as seamless on the dark headers.
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 30px)`,
    backgroundImage:
      'linear-gradient(to bottom, rgba(11,24,32,0.85) 0%, rgba(11,24,32,0.5) 42%, rgba(11,24,32,0.16) 76%, transparent 100%)',
    opacity: 1,
    transition: 'opacity 220ms ease',
  } as object,
  // Scrolled frost: a stack of blur layers, each masked to a band, so the blur
  // is heaviest at the top (all three stacked, behind the icons) and tapers to
  // zero by the bottom — a graduated blur with no hard edge where sharp content
  // would otherwise snap back. A light tint rides on top purely for icon contrast.
  frost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 28px)`,
    opacity: 0,
    transition: 'opacity 220ms ease',
  } as object,
  frostA: {
    backdropFilter: 'blur(16px) saturate(150%)',
    WebkitBackdropFilter: 'blur(16px) saturate(150%)',
    maskImage: 'linear-gradient(to bottom, #000 0%, #000 10%, transparent 44%)',
    WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 10%, transparent 44%)',
  } as object,
  frostB: {
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    maskImage: 'linear-gradient(to bottom, #000 0%, #000 28%, transparent 68%)',
    WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 28%, transparent 68%)',
  } as object,
  frostC: {
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    maskImage: 'linear-gradient(to bottom, #000 0%, #000 52%, transparent 94%)',
    WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 52%, transparent 94%)',
  } as object,
  frostTint: {
    backgroundImage:
      'linear-gradient(to bottom, rgba(11,24,32,0.5) 0%, rgba(11,24,32,0.26) 52%, transparent 86%)',
  } as object,
  layerHidden: { opacity: 0 } as object,
  layerShown: { opacity: 1 } as object,
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  logo: { flex: 1 } as object,
  center: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  right: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6 },

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
  } as object,
  avatarText: { fontFamily: 'Flame-Regular', fontSize: 14, color: '#fff' },
});
