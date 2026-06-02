import { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useSearch } from '../../contexts/SearchContext';
import { HeroLogo } from './HeroLogo';
import { SearchSuggestions } from './search/SearchSuggestions';

const EXPLORE_PATH = '/explore';
const SEARCH_PATH = '/search';
const DESKTOP_BP = 768;

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { query, setQuery, searchFocused, setSearchFocused } = useSearch();
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);
  const containerRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const initial = user?.email?.charAt(0).toUpperCase() ?? '';
  const isDesktop = width >= DESKTOP_BP;
  const avatarActive = menuOpen || pathname === '/profile';
  const showSearch = isDesktop && (pathname === EXPLORE_PATH || pathname === SEARCH_PATH);
  // Mobile: a tappable search entry sits inline in the nav row (logo + search +
  // avatar). It opens the dedicated /search screen. Not shown on /search itself,
  // which has its own input.
  const showMobileSearch = !isDesktop && pathname === EXPLORE_PATH;

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
    // Typing only drives the live dropdown — it never navigates. Committing
    // (Enter, or "View all" in the dropdown) is what opens the results page.
    setQuery(text);
  };

  const handleSubmitSearch = () => {
    const q = query.trim();
    if (!q) return;
    inputRef.current?.blur(); // close the dropdown so the results page is unobstructed
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleProfile = () => {
    setMenuOpen(false);
    router.push('/profile');
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.replace('/explore');
  };

  return (
    <View style={styles.nav as object}>
      <View style={[styles.inner, !isDesktop && (styles.innerMobile as object)] as object}>
        {/* Logo */}
        <Pressable onPress={() => router.push('/explore')} style={styles.logoWrap}>
          <HeroLogo iconSize={24} fontSize={19} color={COLORS.beige} gap={8} />
        </Pressable>

        {/* Center — search field on desktop; spacer otherwise (mobile uses an icon) */}
        {showSearch ? (
          <View style={styles.searchContainer as object}>
            <View
              style={
                [styles.searchWrap, searchFocused && (styles.searchWrapFocused as object)] as object
              }
            >
              <Ionicons
                name="search"
                size={15}
                color={searchFocused ? COLORS.orange : 'rgba(245,235,220,0.4)'}
              />
              <TextInput
                ref={inputRef}
                style={styles.searchInput as object}
                placeholder="Search heroes…"
                placeholderTextColor="rgba(245,235,220,0.35)"
                value={query}
                onChangeText={handleQueryChange}
                onSubmitEditing={handleSubmitSearch}
                returnKeyType="search"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {query.length > 0 ? (
                <Pressable
                  onPress={() => setQuery('')}
                  style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                    [styles.clearBtn, hovered && (styles.clearBtnHover as object)] as object
                  }
                >
                  <Text style={styles.clearX as object}>×</Text>
                </Pressable>
              ) : null}
            </View>
            <SearchSuggestions />
          </View>
        ) : (
          <View style={styles.centerSpacer} />
        )}

        {/* Right slot — search icon (mobile) + avatar/dropdown or sign-in button */}
        <View style={styles.rightSlot}>
          {showMobileSearch && (
            <Pressable
              aria-label="Search"
              onPress={() => router.push('/search')}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [styles.iconBtn, hovered && (styles.iconBtnHover as object)] as object
              }
            >
              <Ionicons name="search" size={22} color={COLORS.beige} />
            </Pressable>
          )}
          {user ? (
            <View ref={containerRef} style={styles.menuContainer as object}>
              <Pressable
                aria-label="Account"
                onPress={() => setMenuOpen((o) => !o)}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
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
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                      [styles.menuItem, hovered && (styles.menuItemHover as object)] as object
                    }
                  >
                    <Text style={styles.menuItemText}>Profile</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSignOut}
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                      [styles.menuItem, hovered && (styles.menuItemHover as object)] as object
                    }
                  >
                    <Text style={[styles.menuItemText, styles.menuItemSignOut]}>Sign out</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            <Pressable
              onPress={() => router.push('/(auth)/login')}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [styles.signInBtn, hovered && (styles.signInBtnHover as object)] as object
              }
            >
              <Text style={styles.signInText}>Sign In</Text>
            </Pressable>
          )}
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
  innerMobile: { paddingHorizontal: 16, gap: 10 } as object,

  logoWrap: {
    flexShrink: 0,
  },

  centerSpacer: {
    flex: 1,
  },

  // ── Mobile search icon (tappable → /search) ──────────────────────────────────
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  iconBtnHover: { backgroundColor: 'rgba(245,235,220,0.1)' } as object,

  // ── Search input ───────────────────────────────────────────────────────────
  searchContainer: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
  } as object,

  searchWrap: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(245,235,220,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.12)',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    transition: 'border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease',
  } as object,
  searchWrapFocused: {
    borderColor: 'rgba(231,115,51,0.55)',
    backgroundColor: 'rgba(245,235,220,0.09)',
    boxShadow: '0 0 0 3px rgba(231,115,51,0.14)',
  } as object,
  searchInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.beige,
    outlineStyle: 'none',
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
    gap: 6,
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

  // ── Guest sign-in button ────────────────────────────────────────────────────
  signInBtn: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  signInBtnHover: { opacity: 0.85 } as object,
  signInText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'white',
    letterSpacing: 0.3,
  },
});
