import { useRef, useState, useEffect } from 'react';
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
  const { user, signOut } = useAuth();
  const { query, setQuery } = useSearch();
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);
  const containerRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const initial = user?.email?.charAt(0).toUpperCase() ?? '';
  const isDesktop = width >= DESKTOP_BP;
  const avatarActive = menuOpen || pathname === '/profile';

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      // RNW renders View as a DOM element at runtime; the TS type doesn't reflect this.
      const node = containerRef.current as unknown as Element | null;
      if (node && !node.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [menuOpen]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (text.length === 1 && pathname !== EXPLORE_PATH) {
      router.push('/');
    }
  };

  const handleProfile = () => {
    setMenuOpen(false);
    router.push('/profile');
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.nav as object}>
      <View style={styles.inner}>

        {/* Logo */}
        <Pressable onPress={() => router.push('/')} style={styles.logoWrap}>
          <HeroLogo iconSize={24} fontSize={19} color={COLORS.beige} gap={8} />
        </Pressable>

        {/* Center — search on desktop, empty spacer on mobile */}
        {isDesktop ? (
          <View style={styles.searchWrap as object}>
            <TextInput
              ref={inputRef}
              style={styles.searchInput as object}
              placeholder="Hero or villain name…"
              placeholderTextColor="rgba(245,235,220,0.28)"
              value={query}
              onChangeText={handleQueryChange}
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
          <View style={styles.centerSpacer} />
        )}

        {/* Right slot — avatar + dropdown */}
        <View style={styles.rightSlot}>
          {user ? (
            <View ref={containerRef} style={styles.menuContainer as object}>
              <Pressable
                aria-label="Account"
                onPress={() => setMenuOpen((o) => !o)}
                style={({ hovered }: { hovered?: boolean }) =>
                  [
                    styles.avatar,
                    avatarActive && (styles.avatarActive as object),
                    !avatarActive && hovered && (styles.avatarHover as object),
                  ] as object
                }
              >
                <Text style={styles.avatarText}>{initial}</Text>
              </Pressable>

              {menuOpen && (
                <View style={styles.menu as object}>
                  <Pressable
                    onPress={handleProfile}
                    style={({ hovered }: { hovered?: boolean }) =>
                      [styles.menuItem, hovered && (styles.menuItemHover as object)] as object
                    }
                  >
                    <Text style={styles.menuItemText}>Profile</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSignOut}
                    style={({ hovered }: { hovered?: boolean }) =>
                      [styles.menuItem, hovered && (styles.menuItemHover as object)] as object
                    }
                  >
                    <Text style={[styles.menuItemText, styles.menuItemSignOut]}>Sign out</Text>
                  </Pressable>
                </View>
              )}
            </View>
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

  centerSpacer: {
    flex: 1,
  },

  // ── Search input ───────────────────────────────────────────────────────────
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

  // ── Right slot ─────────────────────────────────────────────────────────────
  rightSlot: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },

  menuContainer: {
    position: 'relative',
  } as object,

  // ── Avatar ─────────────────────────────────────────────────────────────────
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    borderWidth: 2,
    borderColor: 'transparent',
  } as object,
  avatarActive: {
    borderColor: COLORS.orange,
    backgroundColor: 'rgba(232,98,26,0.65)',
  } as object,
  avatarHover: {
    opacity: 0.85,
  } as object,
  avatarText: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: 'white',
  },

  // ── Dropdown menu ──────────────────────────────────────────────────────────
  menu: {
    position: 'absolute',
    top: 42,
    right: 0,
    zIndex: 200,
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.1)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
    minWidth: 160,
    overflow: 'hidden',
  } as object,
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    cursor: 'pointer',
  } as object,
  menuItemHover: {
    backgroundColor: 'rgba(245,235,220,0.07)',
  } as object,
  menuItemText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: COLORS.beige,
  },
  menuItemSignOut: {
    color: COLORS.orange,
  },
});
