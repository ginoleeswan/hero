import { type ComponentProps } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { HeroLogo } from './HeroLogo';

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
  const initial = user?.email?.charAt(0).toUpperCase() ?? '';
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Versus highlights across the whole /compare flow; others match their route.
  const navActive = (key: string, path: string) =>
    key === 'versus' ? pathname.startsWith('/compare') : pathname === path;
  const go = (path: string) => router.push(path as Parameters<typeof router.push>[0]);

  const renderItem = (it: (typeof NAV)[number]) => {
    const active = navActive(it.key, it.path);
    const tint = active ? COLORS.orange : 'rgba(245,235,220,0.7)';
    return (
      <Pressable
        key={it.key}
        aria-label={it.key}
        onPress={() => go(it.path)}
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
      <View style={c.scrim as object} pointerEvents="none" />
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
                [c.avatar, hovered && (c.avatarHover as object)] as object
              }
            >
              <Text style={c.avatarText}>{initial}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/(auth)/login')}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [c.signIn, hovered && (c.signInHover as object)] as object
              }
            >
              <Text style={c.signInText}>Sign In</Text>
            </Pressable>
          )}
        </View>
      </View>
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
  // Scrim: a gradient layer slightly taller than the bar, fading gradually to
  // transparent with a long soft tail. No blur, so it never hazes content — it
  // just darkens for legibility over a dark header, then dissolves.
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 32px)`,
    backgroundImage:
      'linear-gradient(to bottom, rgba(11,24,32,0.96) 0%, rgba(11,24,32,0.78) 32%, rgba(11,24,32,0.4) 64%, rgba(11,24,32,0.12) 84%, transparent 100%)',
  } as object,
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  avatarHover: { opacity: 0.85 } as object,
  avatarText: { fontFamily: 'Flame-Regular', fontSize: 15, color: '#fff' },
  signIn: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  signInHover: { opacity: 0.85 } as object,
  signInText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff', letterSpacing: 0.3 },
});
