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
const DESKTOP_BP = 768;

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { query, setQuery, searchFocused, setSearchFocused } = useSearch();
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);
  const containerRef = useRef<View>(null);
  const searchAreaRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const initial = user?.email?.charAt(0).toUpperCase() ?? '';
  const isDesktop = width >= DESKTOP_BP;
  const avatarActive = menuOpen || pathname === '/profile';
  // Search is an ambient tool — available on every desktop page where the nav
  // renders (TopNav is already hidden on auth + root). Mobile keeps the inline
  // search icon scoped to Explore (see showMobileSearch below).
  const showSearch = isDesktop;
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

  // Close the search dropdown on outside click. Clicking a non-focusable element
  // (a card, background text) doesn't blur a focused <input>, so onBlur alone
  // never fires — we mirror the avatar menu's outside-click handler here.
  useEffect(() => {
    if (!searchFocused) return;
    const handler = (e: MouseEvent) => {
      // RNW renders View as a DOM element at runtime; the TS type doesn't reflect this.
      const node = searchAreaRef.current as unknown as Element | null;
      if (node && !node.contains(e.target as Node)) {
        inputRef.current?.blur();
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchFocused, setSearchFocused]);

  // Reset the search field on route change. The /search results page owns its
  // query (it mirrors ?q= back into the field), so leave that route alone;
  // everywhere else a navigation clears the field and closes the dropdown.
  useEffect(() => {
    setSearchFocused(false);
    if (pathname !== '/search') setQuery('');
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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

        {/* Center — search field on desktop; spacer on mobile */}
        {showSearch ? (
          <View ref={searchAreaRef} style={styles.searchContainer as object}>
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

        {/* Right slot — mobile search + avatar/dropdown or sign-in button */}
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
  // Outer carrier — transparent. The deep-navy app backdrop (set on the web
  // layout root) shows through behind the floating pill, so there is no band.
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  } as object,

  // The floating glass pill itself.
  inner: {
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
    height: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 10px 34px rgba(0,0,0,0.32)',
  } as object,
  innerMobile: { paddingHorizontal: 14, gap: 10 } as object,

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

  // Flat search — the pill is the container, so the field itself has no box.
  searchWrap: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 6,
    transition: 'opacity 150ms ease',
  } as object,
  searchWrapFocused: {} as object,
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
    backgroundColor: '#0b1820',
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
