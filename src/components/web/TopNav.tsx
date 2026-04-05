import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { HeroLogo } from './HeroLogo';

const NAV_LINKS = [
  { label: 'Discover', path: '/' },
  { label: 'Search', path: '/search' },
  { label: 'Profile', path: '/profile' },
] as const;

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.nav as object}>
      {/* Inner container — matches page content max-width so logo aligns with cards */}
      <View style={styles.inner}>
        {/* Logo — left */}
        <Pressable onPress={() => router.push('/')} style={styles.logoWrap}>
          <HeroLogo iconSize={22} fontSize={18} color={COLORS.beige} gap={7} />
        </Pressable>

        {/* Links — center */}
        <View style={styles.links}>
          {NAV_LINKS.map(({ label, path }) => {
            const active = pathname === path;
            return (
              <Pressable
                key={path}
                onPress={() => router.push(path)}
                style={styles.linkWrap}
              >
                {({ hovered }: { hovered?: boolean }) => (
                  <View style={styles.linkInner}>
                    <Text
                      style={[
                        styles.link,
                        hovered && !active && (styles.linkHover as object),
                        active && styles.linkActive,
                      ]}
                    >
                      {label}
                    </Text>
                    {active && <View style={styles.activeDot} />}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Right slot — mirrors logo width for symmetry */}
        <View style={styles.rightSlot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    height: 58,
    backgroundColor: 'rgba(41,60,67,0.88)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.07)',
    justifyContent: 'center',
  } as object,

  // Constrained inner — aligns logo/links with page content (maxWidth: 1200)
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

  // Links centered between logo and right slot
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  linkWrap: {
    paddingHorizontal: 14,
    paddingVertical: 8, // ~44px total tap target with nav height
  },

  linkInner: {
    alignItems: 'center',
    gap: 5,
  },

  link: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.45)',
    transition: 'color 150ms ease',
  } as object,

  linkHover: {
    color: 'rgba(245,235,220,0.82)',
  },

  linkActive: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.beige,
  },

  // Small orange dot replaces the chunky underline
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
  },

  // Same flex weight as logoWrap — keeps links visually centered
  rightSlot: {
    flex: 1,
  },
});
