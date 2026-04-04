import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { COLORS } from '../../constants/colors';

const NAV_LINKS = [
  { label: 'Discover', path: '/' },
  { label: 'Search', path: '/search' },
  { label: 'Profile', path: '/profile' },
] as const;

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.nav}>
      <Pressable onPress={() => router.push('/')}>
        <Text style={styles.logo}>HERO</Text>
      </Pressable>
      <View style={styles.links}>
        {NAV_LINKS.map(({ label, path }) => {
          const active = pathname === path;
          return (
            <Pressable key={path} onPress={() => router.push(path)} style={styles.linkWrap}>
              <Text style={[styles.link, active && styles.linkActive]}>{label}</Text>
              {active && <View style={styles.underline} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: 52,
    backgroundColor: COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },
  logo: {
    fontFamily: 'Flame-Bold',
    fontSize: 20,
    color: COLORS.orange,
    letterSpacing: 2,
  },
  links: {
    flexDirection: 'row',
    gap: 8,
  },
  linkWrap: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    overflow: 'visible',
  },
  link: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.55)',
  },
  linkActive: {
    color: COLORS.beige,
    fontFamily: 'Nunito_700Bold',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: COLORS.orange,
  },
});
