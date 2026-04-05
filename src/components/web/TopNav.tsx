import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { HeroLogo } from './HeroLogo';

const NAV_LINKS = [
  { label: 'Discover', path: '/' },
  { label: 'Search', path: '/search' },
  { label: 'Profile', path: '/profile' },
] as const;

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const initial = user?.email?.charAt(0).toUpperCase() ?? '';

  return (
    <View style={styles.nav as object}>
      <View style={styles.inner}>

        {/* Logo */}
        <Pressable onPress={() => router.push('/')} style={styles.logoWrap}>
          <HeroLogo iconSize={24} fontSize={19} color={COLORS.beige} gap={8} />
        </Pressable>

        {/* Links — centered */}
        <View style={styles.links}>
          {NAV_LINKS.map(({ label, path }) => {
            const active = pathname === path;
            return (
              <Pressable
                key={path}
                onPress={() => router.push(path)}
                style={({ hovered }: { hovered?: boolean }) =>
                  [styles.pill, (active || hovered) && (styles.pillActive as object)] as object
                }
              >
                {({ hovered }: { hovered?: boolean }) => (
                  <Text
                    style={[
                      styles.link,
                      hovered && !active && styles.linkHover,
                      active && styles.linkActive,
                    ]}
                  >
                    {label}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Right — user avatar */}
        <View style={styles.rightSlot}>
          {user ? (
            <Pressable
              onPress={() => router.push('/profile')}
              style={({ hovered }: { hovered?: boolean }) =>
                [styles.avatar, hovered && (styles.avatarHover as object)] as object
              }
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </Pressable>
          ) : null}
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    height: 64,
    backgroundColor: 'rgba(41,60,67,0.92)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.08)',
    justifyContent: 'center',
  } as object,

  inner: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
  },

  logoWrap: {
    flex: 1,
  },

  // ── Nav links ──────────────────────────────────────────────────────────────
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  // Pill wraps each link — fills on active/hover
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pillActive: {
    backgroundColor: 'rgba(245,235,220,0.09)',
  } as object,

  link: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.45)',
  },
  linkHover: {
    color: 'rgba(245,235,220,0.75)',
  },
  linkActive: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.beige,
  },

  // ── Right slot — user avatar ───────────────────────────────────────────────
  rightSlot: {
    flex: 1,
    alignItems: 'flex-end',
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } as object,
  avatarHover: {
    opacity: 0.85,
  } as object,
  avatarText: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: 'white',
  },
});
