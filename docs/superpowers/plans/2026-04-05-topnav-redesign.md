# TopNav Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inconsistent TopNav with a clean three-slot layout: logo left, global search center (desktop), avatar account dropdown right.

**Architecture:** Single file rewrite of `src/components/web/TopNav.tsx`. Nav pills and the redundant "Profile" text link are removed. The search bar becomes globally visible on desktop (not gated to the Explore page). The avatar becomes an account button that opens a floating dropdown with "Profile" and "Sign out". Outside-click dismissal uses a `document.addEventListener('mousedown')` listener with a ref — avoids CSS stacking context issues with a fixed overlay.

**Tech Stack:** React Native Web, expo-router (`useRouter`, `usePathname`), `useAuth`, `useSearch` (SearchContext), `useWindowDimensions`, `useState`, `useEffect`, `useRef`.

---

### Task 1: Remove nav pills + make search bar global on desktop

**Files:**
- Modify: `src/components/web/TopNav.tsx`

The current file uses a `showSearch` boolean (`isExplore && isDesktop`) to decide whether to show the search bar or nav pills in the center. This task removes the pills entirely, removes the redundant `profileLink` right-slot element, and shows the search bar whenever `isDesktop` is true — regardless of the current path.

- [ ] **Step 1: Replace the full contents of `src/components/web/TopNav.tsx`**

```tsx
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
  const { user } = useAuth();
  const { query, setQuery } = useSearch();
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);

  const initial = user?.email?.charAt(0).toUpperCase() ?? '';
  const isDesktop = width >= DESKTOP_BP;

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (text.length > 0 && pathname !== EXPLORE_PATH) {
      router.push('/');
    }
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

        {/* Right slot — avatar */}
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
```

- [ ] **Step 2: Verify in the browser**

Run `bun start` and open the web app. Check:
- Desktop Explore: search bar appears in the nav center, pills are gone, no "Profile" text link
- Desktop Profile: search bar still appears in the nav center
- Typing a search term while on Profile navigates to Explore and shows results
- Mobile: nav center is empty, no pills, avatar still present

- [ ] **Step 3: Commit**

```bash
git add src/components/web/TopNav.tsx
git commit -m "feat(web): global search bar in TopNav, remove nav pills"
```

---

### Task 2: Add account dropdown to the avatar

**Files:**
- Modify: `src/components/web/TopNav.tsx`

Replace the avatar's simple `router.push('/profile')` with a toggle for a `menuOpen` dropdown. The dropdown floats below the avatar and contains "Profile" and "Sign out" items. Outside-click and Escape key close it.

The outside-click mechanism uses `document.addEventListener('mousedown')` with a `containerRef` on the View wrapping the avatar + menu — cleaner than a fixed overlay in React Native Web's stacking context.

- [ ] **Step 1: Replace the full contents of `src/components/web/TopNav.tsx` with the dropdown version**

```tsx
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
    if (text.length > 0 && pathname !== EXPLORE_PATH) {
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
```

- [ ] **Step 2: Verify in the browser**

Run `bun start` and open the web app. Check each of the following:

1. **Avatar ring** — navigate to `/profile`; the avatar should show an orange ring border
2. **Dropdown opens** — click the avatar from any page; a navy panel appears below with "Profile" and "Sign out"
3. **Dropdown closes on outside click** — with menu open, click anywhere on the page outside the menu; it should close
4. **Dropdown closes on Escape** — with menu open, press Escape; it should close
5. **Profile item** — click "Profile" in the dropdown; navigates to `/profile` and menu closes
6. **Sign out item** — click "Sign out"; signs out and redirects to the login screen
7. **Ring while open** — avatar shows orange ring while the menu is open, even on pages other than `/profile`
8. **Mobile** — resize below 768px; the search bar hides, avatar still present, dropdown still works

- [ ] **Step 3: Commit**

```bash
git add src/components/web/TopNav.tsx
git commit -m "feat(web): avatar account dropdown with Profile + Sign out"
```
