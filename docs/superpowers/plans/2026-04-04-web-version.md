# Hero Web Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-first version of the Hero app with its own purpose-built screens sharing the existing data layer, while keeping native (iOS/Android) completely unchanged.

**Architecture:** Platform-specific files (`.web.tsx`) override native screens on web. A `metro.config.js` resolver aliases all native-only packages to web stubs, eliminating crashes. The web root layout (`_layout.web.tsx`) injects a persistent `TopNav` and replaces the native tab layout with a plain Stack.

**Tech Stack:** Expo Router `.web.tsx` platform splits, Metro `resolveRequest`, React Native Web CSS Grid via `style as any`, `expo-image`, Supabase, existing `src/lib` data layer.

---

## File Map

**New files:**
- `metro.config.js` — resolver aliases for native-only packages
- `src/web-stubs/MaskedView.js` — View with overflow:hidden
- `src/web-stubs/SquircleView.js` — passthrough View
- `src/web-stubs/TouchableScale.js` — Pressable wrapper
- `src/web-stubs/CircularProgress.js` — no-op (character screen has its own web version)
- `src/components/web/TopNav.tsx` — persistent top nav bar
- `src/components/web/WebHeroCard.tsx` — hero card for CSS grid layouts
- `src/components/web/StatBar.tsx` — horizontal stat progress bar
- `app/_layout.web.tsx` — web root layout: fonts + auth gate + TopNav
- `app/(tabs)/_layout.web.tsx` — replaces NativeTabs with plain Stack on web
- `app/(tabs)/index.web.tsx` — Discover page
- `app/(tabs)/search.web.tsx` — Search page
- `app/(tabs)/profile.web.tsx` — Profile page
- `app/character/[id].web.tsx` — Character detail page
- `app/(auth)/login.web.tsx` — Login with centred card layout
- `app/(auth)/signup.web.tsx` — Signup with centred card layout

**Modified files:**
- `app/(tabs)/profile.tsx` — already updated to use `SquircleMask` (no further changes)

**Deleted files:**
- `src/components/HeroCard.web.tsx` — replaced by Metro resolver + `WebHeroCard`
- `src/components/ui/SquircleMask.web.tsx` — replaced by Metro resolver stubs

---

## Task 1: Metro resolver + web stubs

**Files:**
- Create: `metro.config.js`
- Create: `src/web-stubs/MaskedView.js`
- Create: `src/web-stubs/SquircleView.js`
- Create: `src/web-stubs/TouchableScale.js`
- Create: `src/web-stubs/CircularProgress.js`
- Delete: `src/components/HeroCard.web.tsx`
- Delete: `src/components/ui/SquircleMask.web.tsx`

- [ ] **Step 1: Create the four web stubs**

`src/web-stubs/MaskedView.js`:
```js
import React from 'react';
import { View } from 'react-native';
export default function MaskedView({ children, style }) {
  return <View style={[style, { overflow: 'hidden' }]}>{children}</View>;
}
```

`src/web-stubs/SquircleView.js`:
```js
import { View } from 'react-native';
export const SquircleView = View;
```

`src/web-stubs/TouchableScale.js`:
```js
import React from 'react';
import { Pressable } from 'react-native';
export default function TouchableScale({ children, onPress, style }) {
  return <Pressable onPress={onPress} style={style}>{children}</Pressable>;
}
```

`src/web-stubs/CircularProgress.js`:
```js
import React from 'react';
import { View } from 'react-native';
export function AnimatedCircularProgress({ children }) {
  return <View>{children ? children(0) : null}</View>;
}
```

- [ ] **Step 2: Create `metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const webAliases = {
  '@react-native-masked-view/masked-view': path.resolve(__dirname, 'src/web-stubs/MaskedView.js'),
  'react-native-figma-squircle': path.resolve(__dirname, 'src/web-stubs/SquircleView.js'),
  'react-native-touchable-scale': path.resolve(__dirname, 'src/web-stubs/TouchableScale.js'),
  'react-native-circular-progress': path.resolve(__dirname, 'src/web-stubs/CircularProgress.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webAliases[moduleName]) {
    return { filePath: webAliases[moduleName], type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
```

- [ ] **Step 3: Delete the old workarounds**

```bash
rm src/components/HeroCard.web.tsx
rm src/components/ui/SquircleMask.web.tsx
```

- [ ] **Step 4: Verify the web server starts and returns HTTP 200**

```bash
bunx expo start --web --port 8090 &
sleep 12
curl -s -o /dev/null -w "%{http_code}" http://localhost:8090/
# Expected: 200
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add metro.config.js src/web-stubs/
git rm src/components/HeroCard.web.tsx src/components/ui/SquircleMask.web.tsx
git commit -m "feat(web): metro resolver aliases for native-only packages"
```

---

## Task 2: Web layouts (root + tabs)

**Files:**
- Create: `app/_layout.web.tsx`
- Create: `app/(tabs)/_layout.web.tsx`

- [ ] **Step 1: Create `app/_layout.web.tsx`**

```tsx
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Nunito_400Regular, Nunito_700Bold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { Righteous_400Regular } from '@expo-google-fonts/righteous';
import { useAuth } from '../src/hooks/useAuth';
import { TopNav } from '../src/components/web/TopNav';
import { COLORS } from '../src/constants/colors';

function WebAuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, loading, segments]);

  const inAuthGroup = segments[0] === '(auth)';

  return (
    <View style={styles.root}>
      {!inAuthGroup && <TopNav />}
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}

export default function WebRootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'FlameSans-Regular': require('../assets/fonts/FlameSans-Regular.ttf'),
    'Flame-Regular': require('../assets/fonts/Flame-Regular.ttf'),
    'Flame-Bold': require('../assets/fonts/Flame-Bold.ttf'),
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_900Black,
    Righteous_400Regular,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <>
      <StatusBar style="dark" />
      <WebAuthGate />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  content: { flex: 1 },
});
```

- [ ] **Step 2: Create `app/(tabs)/_layout.web.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function WebTabsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/_layout.web.tsx app/(tabs)/_layout.web.tsx
git commit -m "feat(web): web root layout and tab layout shell"
```

---

## Task 3: TopNav component

**Files:**
- Create: `src/components/web/TopNav.tsx`

- [ ] **Step 1: Create `src/components/web/TopNav.tsx`**

```tsx
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
    fontFamily: 'Flame-Regular',
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
    bottom: -14,
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: COLORS.orange,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/web/TopNav.tsx
git commit -m "feat(web): TopNav component"
```

---

## Task 4: Shared web components — WebHeroCard + StatBar

**Files:**
- Create: `src/components/web/WebHeroCard.tsx`
- Create: `src/components/web/StatBar.tsx`

- [ ] **Step 1: Create `src/components/web/WebHeroCard.tsx`**

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import { heroImageSource } from '../../constants/heroImages';

interface WebHeroCardProps {
  id: string;
  name: string;
  imageUrl: string | null;
  featured?: boolean;
  publisher?: string;
  onPress: () => void;
}

export function WebHeroCard({
  id,
  name,
  imageUrl,
  featured = false,
  publisher,
  onPress,
}: WebHeroCardProps) {
  const source = heroImageSource(id, imageUrl);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, featured && (styles.featured as object)]}
    >
      <Image source={source} contentFit="cover" style={StyleSheet.absoluteFill} />
      <View style={styles.overlay} />
      {featured && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Featured</Text>
        </View>
      )}
      <View style={styles.nameContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {featured && publisher ? (
          <Text style={styles.publisher} numberOfLines={1}>
            {publisher}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    overflow: 'hidden',
    height: 180,
    cursor: 'pointer',
  } as object,
  featured: {
    gridColumn: 'span 2',
    gridRow: 'span 2',
    height: '100%',
    minHeight: 380,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)',
  } as object,
  badge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: COLORS.orange,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameContainer: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
  },
  publisher: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.6)',
    marginTop: 2,
  },
});
```

- [ ] **Step 2: Create `src/components/web/StatBar.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface StatBarProps {
  label: string;
  value: string;
  color: string;
}

export function StatBar({ label, value, color }: StatBarProps) {
  const numeric = parseInt(value, 10);
  const fill = isNaN(numeric) ? 0 : Math.min(numeric, 100);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color }]}>{fill}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fill}%` as unknown as number, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
  },
  value: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    fontWeight: '700',
  },
  track: {
    height: 6,
    backgroundColor: '#e8ddd0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%' as unknown as number,
    borderRadius: 3,
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add src/components/web/WebHeroCard.tsx src/components/web/StatBar.tsx
git commit -m "feat(web): WebHeroCard and StatBar shared components"
```

---

## Task 5: Discover page

**Files:**
- Create: `app/(tabs)/index.web.tsx`

- [ ] **Step 1: Create `app/(tabs)/index.web.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getHeroesByCategory, type Hero, type HeroesByCategory } from '../../src/lib/db/heroes';
import { WebHeroCard } from '../../src/components/web/WebHeroCard';
import { COLORS } from '../../src/constants/colors';

const SECTIONS: { key: keyof HeroesByCategory; label: string }[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'villain', label: 'Villains' },
  { key: 'xmen', label: 'X-Men' },
];

export default function WebDiscoverScreen() {
  const router = useRouter();
  const [data, setData] = useState<HeroesByCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHeroesByCategory()
      .then(setData)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Failed to load heroes')
      );
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.orange} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {SECTIONS.map(({ key, label }) => {
        const heroes = data[key];
        if (heroes.length === 0) return null;
        return (
          <View key={key} style={styles.section}>
            <Text style={styles.sectionTitle}>{label}</Text>
            <View style={styles.divider} />
            <View style={styles.grid as object}>
              {heroes.map((hero: Hero, index: number) => (
                <WebHeroCard
                  key={hero.id}
                  id={hero.id}
                  name={hero.name}
                  imageUrl={hero.image_url}
                  featured={key === 'popular' && index === 0}
                  publisher={hero.name}
                  onPress={() => router.push(`/character/${hero.id}`)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: { padding: 24, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.beige },
  errorText: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: COLORS.red },
  section: { marginBottom: 40 },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.navy,
    marginBottom: 8,
  },
  divider: {
    height: 2,
    backgroundColor: COLORS.navy,
    borderRadius: 2,
    marginBottom: 16,
    opacity: 0.15,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
});
```

- [ ] **Step 2: Verify in browser**

Start the dev server (`bun start`), open `http://localhost:8081` in a browser. Confirm:
- Top nav renders with HERO logo and three links
- Three sections render with hero cards
- First card in Popular is larger (featured)
- Clicking a card navigates to `/character/[id]`

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/index.web.tsx
git commit -m "feat(web): Discover page"
```

---

## Task 6: Search page

**Files:**
- Create: `app/(tabs)/search.web.tsx`

- [ ] **Step 1: Create `app/(tabs)/search.web.tsx`**

```tsx
import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { WebHeroCard } from '../../src/components/web/WebHeroCard';
import { COLORS } from '../../src/constants/colors';

const CDN_URL = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json';

interface CdnHero {
  id: number;
  name: string;
  biography: { publisher: string };
  images: { md: string };
}

const PUBLISHER_FILTERS = ['All', 'Marvel', 'DC', 'Other'] as const;
type PublisherFilter = (typeof PUBLISHER_FILTERS)[number];

export default function WebSearchScreen() {
  const router = useRouter();
  const [allHeroes, setAllHeroes] = useState<CdnHero[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [publisher, setPublisher] = useState<PublisherFilter>('All');

  useEffect(() => {
    fetch(CDN_URL)
      .then((r) => r.json())
      .then((data: CdnHero[]) => setAllHeroes(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    let list = allHeroes;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((h) => h.name.toLowerCase().includes(q));
    }
    if (publisher !== 'All') {
      list = list.filter((h) => {
        const pub = h.biography.publisher ?? '';
        if (publisher === 'Marvel') return pub.toLowerCase().includes('marvel');
        if (publisher === 'DC') return pub.toLowerCase().includes('dc');
        return !pub.toLowerCase().includes('marvel') && !pub.toLowerCase().includes('dc');
      });
    }
    return list.slice(0, 60);
  }, [allHeroes, query, publisher]);

  return (
    <View style={styles.root}>
      {/* Search hero bar */}
      <View style={styles.heroBar}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Search 700+ heroes and villains…"
            placeholderTextColor="rgba(245,235,220,0.4)"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>
        <View style={styles.chips}>
          {PUBLISHER_FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setPublisher(f)}
              style={[styles.chip, publisher === f && styles.chipActive]}
            >
              <Text style={[styles.chipText, publisher === f && styles.chipTextActive]}>
                {f}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.orange} size="large" />
        </View>
      ) : results.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {query ? `No results for "${query}"` : 'Search for a hero or villain…'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.resultsContent}>
          <View style={styles.grid as object}>
            {results.map((hero) => (
              <WebHeroCard
                key={hero.id}
                id={String(hero.id)}
                name={hero.name}
                imageUrl={hero.images.md}
                onPress={() => router.push(`/character/${hero.id}`)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  heroBar: {
    backgroundColor: COLORS.navy,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 14,
  },
  inputWrap: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
    width: '100%',
    maxWidth: 560,
  },
  input: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.beige,
    outlineStyle: 'none',
  } as object,
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: { backgroundColor: COLORS.orange },
  chipText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: 'rgba(245,235,220,0.6)',
  },
  chipTextActive: { color: 'white', fontFamily: 'Nunito_700Bold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: COLORS.grey,
  },
  resultsContent: {
    padding: 24,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 14,
  },
});
```

- [ ] **Step 2: Verify in browser**

Navigate to `/search`. Confirm:
- Dark hero bar at top with search input and publisher chips
- Typing filters cards in real-time
- Publisher chip filters work
- Clicking a card navigates to `/character/[id]`

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/search.web.tsx"
git commit -m "feat(web): Search page"
```

---

## Task 7: Character detail page

**Files:**
- Create: `app/character/[id].web.tsx`

- [ ] **Step 1: Create `app/character/[id].web.tsx`**

```tsx
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { fetchHeroStats, fetchHeroDetails, fetchFirstIssue } from '../../src/lib/api';
import { isFavourited, addFavourite, removeFavourite } from '../../src/lib/db/favourites';
import { useAuth } from '../../src/hooks/useAuth';
import { heroImageSource } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';
import { StatBar } from '../../src/components/web/StatBar';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../src/components/ui/SkeletonProvider';
import type { CharacterData } from '../../src/types';

const STAT_CONFIG = [
  { key: 'intelligence', label: 'Intelligence', color: COLORS.blue },
  { key: 'strength', label: 'Strength', color: COLORS.red },
  { key: 'speed', label: 'Speed', color: COLORS.yellow },
  { key: 'durability', label: 'Durability', color: COLORS.green },
  { key: 'power', label: 'Power', color: COLORS.orange },
  { key: 'combat', label: 'Combat', color: COLORS.brown },
];

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '-' || value === 'null' || value === '') return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionDivider} />
      {children}
    </View>
  );
}

export default function WebCharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<CharacterData | null>(null);
  const [comicVineLoading, setComicVineLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favourited, setFavourited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchHeroStats(id)
      .then((stats) => {
        setData({ stats, details: { summary: null, publisher: null, firstIssueId: null }, firstIssue: null });
        fetchHeroDetails(stats.name)
          .then(async (details) => {
            const firstIssue = details.firstIssueId
              ? await fetchFirstIssue(details.firstIssueId).catch(() => null)
              : null;
            setData({ stats, details, firstIssue });
          })
          .catch(() => {})
          .finally(() => setComicVineLoading(false));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    isFavourited(user.id, id).then(setFavourited).catch(() => {});
  }, [user, id]);

  const toggleFavourite = useCallback(async () => {
    if (!user || !id || favLoading) return;
    setFavLoading(true);
    const next = !favourited;
    setFavourited(next);
    try {
      await (next ? addFavourite(user.id, id) : removeFavourite(user.id, id));
    } catch {
      setFavourited(!next);
    } finally {
      setFavLoading(false);
    }
  }, [user, id, favourited, favLoading]);

  const heroImage = data?.stats.image.url
    ? { uri: data.stats.image.url }
    : id
    ? heroImageSource(id, null)
    : null;

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.orange} size="large" />
      </View>
    );
  }

  const { stats, details, firstIssue } = data;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Top bar: back + favourite */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={COLORS.navy} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        {user && (
          <Pressable onPress={toggleFavourite} disabled={favLoading} style={styles.favBtn}>
            <Ionicons
              name={favourited ? 'heart' : 'heart-outline'}
              size={22}
              color={favourited ? COLORS.red : COLORS.navy}
            />
          </Pressable>
        )}
      </View>

      {/* Hero banner */}
      <View style={styles.banner}>
        <View style={styles.bannerText}>
          <Text style={styles.heroName}>{stats.name}</Text>
          {stats.biography['full-name'] ? (
            <Text style={styles.heroAlias}>{stats.biography['full-name']}</Text>
          ) : null}
          {stats.biography.publisher ? (
            <Text style={styles.heroPublisher}>{stats.biography.publisher}</Text>
          ) : null}
        </View>
        {heroImage && (
          <Image source={heroImage} contentFit="cover" contentPosition="top" style={styles.bannerImage} />
        )}
      </View>

      {/* Sections grid */}
      <View style={styles.grid as object}>
        {/* Summary — full width */}
        {comicVineLoading ? (
          <SkeletonProvider>
            <View style={[styles.section, styles.fullWidth as object]}>
              <Skeleton height={12} borderRadius={5} style={{ marginBottom: 7 }} />
              <Skeleton width="85%" height={12} borderRadius={5} style={{ marginBottom: 7 }} />
              <Skeleton width="60%" height={12} borderRadius={5} />
            </View>
          </SkeletonProvider>
        ) : details.summary ? (
          <View style={[styles.section, styles.fullWidth as object]}>
            <Text style={styles.summary}>{details.summary}</Text>
          </View>
        ) : null}

        {/* Power Stats */}
        <Section title="Power Stats">
          {STAT_CONFIG.map(({ key, label, color }) => (
            <StatBar
              key={key}
              label={label}
              value={(stats.powerstats as Record<string, string>)[key] ?? '0'}
              color={color}
            />
          ))}
        </Section>

        {/* Biography */}
        <Section title="Biography">
          <InfoRow label="Full name" value={stats.biography['full-name']} />
          <InfoRow label="Alter egos" value={stats.biography['alter-egos']} />
          <InfoRow label="Place of birth" value={stats.biography['place-of-birth']} />
          <InfoRow label="First appearance" value={stats.biography['first-appearance']} />
          <InfoRow label="Alignment" value={stats.biography.alignment} />
          {stats.biography.aliases.filter((a) => a && a !== '-').length > 0 && (
            <InfoRow label="Aliases" value={stats.biography.aliases.join(', ')} />
          )}
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <InfoRow label="Gender" value={stats.appearance.gender} />
          <InfoRow label="Race" value={stats.appearance.race} />
          <InfoRow label="Height" value={stats.appearance.height.join(' / ')} />
          <InfoRow label="Weight" value={stats.appearance.weight.join(' / ')} />
          <InfoRow label="Eyes" value={stats.appearance['eye-color']} />
          <InfoRow label="Hair" value={stats.appearance['hair-color']} />
        </Section>

        {/* Work */}
        <Section title="Work">
          <InfoRow label="Occupation" value={stats.work.occupation} />
          <InfoRow label="Base" value={stats.work.base} />
        </Section>

        {/* Connections */}
        <Section title="Connections">
          <InfoRow label="Group affiliation" value={stats.connections['group-affiliation']} />
          <InfoRow label="Relatives" value={stats.connections.relatives} />
        </Section>

        {/* First Appearance — full width */}
        {firstIssue?.imageUrl ? (
          <View style={[styles.section, styles.fullWidth as object, styles.comicSection]}>
            <Text style={styles.sectionTitle}>First Appearance</Text>
            <View style={styles.sectionDivider} />
            <Image
              source={{ uri: firstIssue.imageUrl }}
              contentFit="contain"
              style={styles.comicImage}
            />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: {
    maxWidth: 860,
    alignSelf: 'center',
    width: '100%',
    padding: 24,
    paddingBottom: 60,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.beige },
  errorText: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: COLORS.red },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.navy },
  favBtn: { padding: 4 },

  banner: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    padding: 28,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    minHeight: 140,
  },
  bannerText: { flex: 1 },
  heroName: {
    fontFamily: 'Flame-Regular',
    fontSize: 36,
    color: COLORS.beige,
    lineHeight: 40,
  },
  heroAlias: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.6)',
    marginTop: 4,
  },
  heroPublisher: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bannerImage: {
    width: 120,
    height: 140,
    borderRadius: 8,
    marginLeft: 20,
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  fullWidth: {
    gridColumn: 'span 2',
  },

  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e8ddd0',
  },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e8ddd0',
    marginBottom: 12,
  },
  summary: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ea',
  },
  infoLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.grey,
    textTransform: 'capitalize',
  },
  infoValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 12,
    color: COLORS.navy,
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
    textTransform: 'capitalize',
  },
  comicSection: { alignItems: 'center' },
  comicImage: { width: 160, height: 240, marginTop: 8 },
});
```

- [ ] **Step 2: Verify in browser**

Navigate to a hero card and click it. Confirm:
- Banner shows hero name, alias, publisher and image
- Power Stats section shows 6 horizontal bars with correct colours
- Biography, Appearance, Work, Connections sections show key/value rows
- Back button returns to previous page
- Favourite button (if logged in) toggles heart icon

- [ ] **Step 3: Commit**

```bash
git add "app/character/[id].web.tsx"
git commit -m "feat(web): character detail page"
```

---

## Task 8: Profile page

**Files:**
- Create: `app/(tabs)/profile.web.tsx`

- [ ] **Step 1: Create `app/(tabs)/profile.web.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { getUserFavouriteHeroes, type FavouriteHero } from '../../src/lib/db/favourites';
import { WebHeroCard } from '../../src/components/web/WebHeroCard';
import { COLORS } from '../../src/constants/colors';

export default function WebProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [favourites, setFavourites] = useState<FavouriteHero[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserFavouriteHeroes(user.id)
      .then(setFavourites)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace('/(auth)/login');
  };

  const email = user?.email ?? '';
  const initial = email.charAt(0).toUpperCase();

  return (
    <View style={styles.root}>
      {/* Left panel */}
      <View style={styles.panel}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.username}>{email.split('@')[0]}</Text>
        <Text style={styles.email}>{email}</Text>
        <View style={styles.panelDivider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Favourites</Text>
          <Text style={styles.statValue}>{favourites.length}</Text>
        </View>
        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          style={styles.signOutBtn}
        >
          <Text style={styles.signOutText}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Text>
        </Pressable>
      </View>

      {/* Right panel */}
      <View style={styles.rightPanel}>
        <Text style={styles.rightTitle}>Favourites</Text>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.orange} />
          </View>
        ) : favourites.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No favourites yet.</Text>
            <Pressable onPress={() => router.push('/')} style={styles.browseBtn}>
              <Text style={styles.browseBtnText}>Browse heroes</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid as object}>
            {favourites.map((hero) => (
              <WebHeroCard
                key={hero.id}
                id={hero.id}
                name={hero.name}
                imageUrl={hero.image_url}
                onPress={() => router.push(`/character/${hero.id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.beige },

  panel: {
    width: 260,
    backgroundColor: COLORS.navy,
    padding: 24,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontFamily: 'Flame-Regular',
    fontSize: 28,
    color: 'white',
  },
  username: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
  },
  email: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.5)',
    marginTop: 3,
  },
  panelDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'stretch',
    marginVertical: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  statLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: 'rgba(245,235,220,0.4)',
  },
  statValue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.beige,
  },
  signOutBtn: {
    marginTop: 'auto' as unknown as number,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(232,98,26,0.15)',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.orange,
  },

  rightPanel: { flex: 1, padding: 24 },
  rightTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.navy,
    marginBottom: 16,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.grey,
  },
  browseBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  browseBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.beige,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 14,
  },
});
```

- [ ] **Step 2: Verify in browser**

Navigate to `/profile` (must be logged in). Confirm:
- Left panel shows avatar initial, email, favourite count, sign-out button
- Right panel shows favourite hero cards in a grid
- Empty state shows "Browse heroes" button
- Sign-out navigates to `/login`

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/profile.web.tsx"
git commit -m "feat(web): Profile page"
```

---

## Task 9: Auth pages (login + signup)

**Files:**
- Create: `app/(auth)/login.web.tsx`
- Create: `app/(auth)/signup.web.tsx`

- [ ] **Step 1: Create `app/(auth)/login.web.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS } from '../../src/constants/colors';

export default function WebLoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.logo}>HERO</Text>
        <Text style={styles.subtitle}>The Superhero Encyclopedia</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.grey}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={COLORS.grey}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={COLORS.beige} />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.link}>Don't have an account? Sign up</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 40,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  logo: {
    fontFamily: 'Flame-Regular',
    fontSize: 42,
    color: COLORS.orange,
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    marginBottom: 32,
  },
  error: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.red,
    textAlign: 'center',
    marginBottom: 12,
  },
  input: {
    backgroundColor: COLORS.beige,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.navy,
    outlineStyle: 'none',
  } as object,
  button: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  buttonText: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.beige,
    fontSize: 15,
  },
  link: {
    fontFamily: 'Nunito_400Regular',
    color: COLORS.navy,
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontSize: 13,
  },
});
```

- [ ] **Step 2: Create `app/(auth)/signup.web.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS } from '../../src/constants/colors';

export default function WebSignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error } = await signUp(email, password);
    if (error) {
      setError(error.message);
    } else {
      setMessage('Check your email to confirm your account.');
    }
    setLoading(false);
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.logo}>HERO</Text>
        <Text style={styles.subtitle}>Create your account</Text>

        {error && <Text style={styles.error}>{error}</Text>}
        {message && <Text style={styles.message}>{message}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.grey}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={COLORS.grey}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable style={styles.button} onPress={handleSignup} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={COLORS.beige} />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 40,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  logo: {
    fontFamily: 'Flame-Regular',
    fontSize: 42,
    color: COLORS.orange,
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    marginBottom: 32,
  },
  error: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.red,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.green,
    textAlign: 'center',
    marginBottom: 12,
  },
  input: {
    backgroundColor: COLORS.beige,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.navy,
    outlineStyle: 'none',
  } as object,
  button: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  buttonText: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.beige,
    fontSize: 15,
  },
  link: {
    fontFamily: 'Nunito_400Regular',
    color: COLORS.navy,
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontSize: 13,
  },
});
```

- [ ] **Step 3: Verify in browser**

Navigate to `http://localhost:8081` while logged out. Confirm:
- Redirected to `/login`
- Centred white card on beige background
- HERO logo in orange
- Sign in works and redirects to Discover
- "Sign up" link navigates to `/signup`
- Sign up form shows email-confirmation message on success

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/login.web.tsx" "app/(auth)/signup.web.tsx"
git commit -m "feat(web): login and signup pages"
```

---

## Self-Review Notes

- **Spec coverage:** All 5 screens (Discover, Search, Character Detail, Profile, Login/Signup) are covered. Metro resolver + stubs covers the web crash fix. TopNav covers shared navigation. Web layouts cover root + tabs.
- **Native unchanged:** All new files use `.web.tsx` extension. The resolver only applies to `platform === 'web'`. Existing `_layout.tsx`, `(tabs)/_layout.tsx`, and all `.tsx` screens are untouched.
- **Type consistency:** `HeroesByCategory`, `Hero`, `FavouriteHero`, `CharacterData`, `HeroStats` used consistently throughout — all imported from existing `src/lib/db/heroes`, `src/lib/db/favourites`, `src/types`.
- **CSS Grid:** `display: 'grid'` used via `style as object` cast in all grid containers. `gridColumn: 'span 2'` on featured card in `WebHeroCard` — passed as `style as object` cast.
- **`outlineStyle: 'none'`**: Applied to web TextInput styles as `as object` cast to suppress browser default outline. TypeScript doesn't know this prop but React Native Web passes it through to CSS.
- **Sign-out marginal case:** `marginTop: 'auto'` in profile panel uses `as unknown as number` cast — valid CSS on web, bypasses RN type system.
