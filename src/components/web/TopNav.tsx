import { useRef } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useSearch } from '../../contexts/SearchContext';
import { HeroLogo } from './HeroLogo';

const EXPLORE_PATH = '/';
const DESKTOP_BP = 768;

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { query, setQuery } = useSearch();
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);

  const initial = user?.email?.charAt(0).toUpperCase() ?? '';
  const isExplore = pathname === EXPLORE_PATH;
  const isDesktop = width >= DESKTOP_BP;
  const showSearch = isExplore && isDesktop;

  return (
    <View style={styles.nav as object}>
      <View style={styles.inner}>

        {/* Logo */}
        <Pressable onPress={() => router.push('/')} style={styles.logoWrap}>
          <HeroLogo iconSize={24} fontSize={19} color={COLORS.beige} gap={8} />
        </Pressable>

        {/* Center — search input on desktop explore, nav links otherwise */}
        {showSearch ? (
          <View style={styles.searchWrap as object}>
            <TextInput
              ref={inputRef}
              style={styles.searchInput as object}
              placeholder="Hero or villain name…"
              placeholderTextColor="rgba(245,235,220,0.28)"
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                style={({ hovered }: { hovered?: boolean }) =>
                  [styles.clearBtn, hovered && (styles.clearBtnHover as object)] as object
                }
              >
                <Text style={styles.clearX as object}>×</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.links}>
            {([{ label: 'Explore', path: '/' }, { label: 'Profile', path: '/profile' }] as const).map(
              ({ label, path }) => {
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
              }
            )}
          </View>
        )}

        {/* Right slot — Profile link (desktop explore only) + avatar */}
        <View style={styles.rightSlot}>
          {showSearch && (
            <Pressable
              onPress={() => router.push('/profile')}
              style={({ hovered }: { hovered?: boolean }) =>
                [styles.profileLink, hovered && (styles.profileLinkHover as object)] as object
              }
            >
              <Text style={styles.profileLinkText}>Profile</Text>
            </Pressable>
          )}
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
    gap: 16,
  },

  logoWrap: {
    flexShrink: 0,
  },

  // ── Nav links (non-explore pages) ──────────────────────────────────────────
  links: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
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

  // ── Search input (desktop explore) ────────────────────────────────────────
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(245,235,220,0.2)',
    paddingBottom: 4,
    gap: 8,
    marginHorizontal: 24,
  } as object,
  searchInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.beige,
    outlineStyle: 'none',
    paddingVertical: 2,
  } as object,
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(245,235,220,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  } as object,
  clearBtnHover: { backgroundColor: 'rgba(245,235,220,0.18)' } as object,
  clearX: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: 'rgba(245,235,220,0.65)',
    lineHeight: 18,
  },

  // ── Right slot ────────────────────────────────────────────────────────────
  rightSlot: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileLink: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    cursor: 'pointer',
  } as object,
  profileLinkHover: {
    backgroundColor: 'rgba(245,235,220,0.09)',
  } as object,
  profileLinkText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.45)',
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
