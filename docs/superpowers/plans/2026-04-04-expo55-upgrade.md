# Hero App — Expo 55 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Hero app from Expo SDK 42 to Expo SDK 55 with Expo Router, Supabase (auth + data + user favourites), a centralised API layer, and TypeScript throughout.

**Architecture:** Fresh-scaffold-in-place strategy — config files are replaced, old routing removed, and the codebase rebuilt around Expo Router file-based navigation with auth-gated tabs. Assets (fonts, images) are moved to the root `assets/` directory and preserved exactly.

**Tech Stack:** Expo SDK 55, Expo Router 4, TypeScript, Supabase (auth + postgres), react-native-reanimated-carousel, expo-image, @expo/vector-icons, react-native-circular-progress, react-native-image-viewing

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Replace | New deps, Expo 55, `expo-router/entry` main |
| `app.config.ts` | Create | Dynamic config with env vars |
| `tsconfig.json` | Create | TypeScript config extending expo base |
| `babel.config.js` | Replace | Expo 55 + reanimated plugin |
| `metro.config.js` | Replace | Expo 55 metro config |
| `.env.local` | Create | API keys (gitignored) |
| `.env.example` | Create | Key names without values |
| `App.js` | Delete | Replaced by Expo Router entry |
| `index.js` | Delete | Replaced by Expo Router entry |
| `app.json` | Delete | Replaced by `app.config.ts` |
| `react-native.config.js` | Delete | Not needed in Expo 55 |
| `assets/fonts/` | Move from `app/assets/fonts/` | Custom fonts |
| `assets/images/` | Move from `app/assets/images/` | Hero images |
| `src/constants/colors.ts` | Create | Port from `app/styles/colors.js` |
| `src/constants/heroImages.ts` | Create | Local require() map by hero ID |
| `src/types/index.ts` | Create | Shared TypeScript types |
| `src/lib/supabase.ts` | Create | Supabase client initialisation |
| `src/lib/api.ts` | Create | SuperheroAPI + ComicVine calls |
| `src/hooks/useAuth.ts` | Create | Auth state hook |
| `src/components/HeroCard.tsx` | Create | Reusable hero carousel card |
| `app/_layout.tsx` | Create | Root layout: fonts, providers, auth gate |
| `app/(auth)/_layout.tsx` | Create | Auth group stack layout |
| `app/(auth)/login.tsx` | Create | Login screen |
| `app/(auth)/signup.tsx` | Create | Signup screen |
| `app/(tabs)/_layout.tsx` | Create | Bottom tab layout |
| `app/(tabs)/index.tsx` | Create | Home screen |
| `app/(tabs)/search.tsx` | Create | Search shell |
| `app/(tabs)/profile.tsx` | Create | Profile screen |
| `app/character/[id].tsx` | Create | Character detail (dynamic route) |
| `__tests__/lib/api.test.ts` | Create | API layer unit tests |
| `__tests__/hooks/useAuth.test.ts` | Create | Auth hook unit tests |
| `__tests__/components/HeroCard.test.tsx` | Create | HeroCard render test |
| `CLAUDE.md` | Create | Project setup + commands |

---

## Phase 1: Foundation

### Task 1: Delete old files

**Files:**
- Delete: `App.js`, `index.js`, `app.json`, `react-native.config.js`
- Delete: `app/` directory (entire old routing folder)

- [ ] **Step 1: Remove old entry points and config**

```bash
rm App.js index.js app.json react-native.config.js
```

- [ ] **Step 2: Remove old app directory**

```bash
rm -rf app/
```

- [ ] **Step 3: Verify only root config files remain**

```bash
ls
```

Expected output includes: `babel.config.js  ios/  metro.config.js  package-lock.json  package.json  README.md  LICENSE  CODE_OF_CONDUCT.md  docs/`

---

### Task 2: Move assets

**Files:**
- Create: `assets/fonts/` (moved from `app/assets/fonts/`)
- Create: `assets/images/` (moved from `app/assets/images/`)

- [ ] **Step 1: Create assets directory and move fonts and images**

```bash
mkdir -p assets
mv app/assets/fonts assets/fonts
mv app/assets/images assets/images
```

- [ ] **Step 2: Verify**

```bash
ls assets/fonts && ls assets/images | head -5
```

Expected: `Flame-Bold.ttf  Flame-Regular.ttf  FlameSans-Regular.ttf` and image files listed.

---

### Task 3: Create project config files

**Files:**
- Create: `package.json`
- Create: `app.config.ts`
- Create: `tsconfig.json`
- Replace: `babel.config.js`
- Replace: `metro.config.js`
- Create: `.env.local`
- Create: `.env.example`
- Update: `.gitignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "hero",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "test": "jest --watchAll",
    "test:ci": "jest --ci"
  },
  "dependencies": {},
  "devDependencies": {},
  "private": true,
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated)"
    ],
    "setupFilesAfterEnv": [
      "@testing-library/jest-native/extend-expect"
    ]
  }
}
```

- [ ] **Step 2: Write `app.config.ts`**

```typescript
import 'dotenv/config';
import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'hero',
  slug: 'hero',
  scheme: 'hero',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    resizeMode: 'contain',
    backgroundColor: '#f5ebdc',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.hero.app',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#f5ebdc',
    },
    package: 'com.hero.app',
  },
  web: {
    bundler: 'metro',
    output: 'static',
  },
  plugins: [
    'expo-router',
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/FlameSans-Regular.ttf',
          './assets/fonts/Flame-Regular.ttf',
          './assets/fonts/Flame-Bold.ttf',
        ],
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#f5ebdc',
        resizeMode: 'contain',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    superheroApiKey: process.env.SUPERHERO_API_KEY,
    comicvineApiKey: process.env.COMICVINE_API_KEY,
  },
};

export default config;
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.d.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 4: Replace `babel.config.js`**

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

- [ ] **Step 5: Replace `metro.config.js`**

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
module.exports = config;
```

- [ ] **Step 6: Write `.env.example`**

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPERHERO_API_KEY=
COMICVINE_API_KEY=
```

- [ ] **Step 7: Write `.env.local`** (fill in real values)

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPERHERO_API_KEY=4204884039587685
COMICVINE_API_KEY=02dbe748c04865c7601c8c67ffb9a0e95438bbf1
```

- [ ] **Step 8: Update `.gitignore`** — add these lines if not present

```
.env.local
.env*.local
node_modules/
.expo/
```

---

### Task 4: Install dependencies

**Files:**
- Modify: `package.json` (deps added by installers)
- Modify: `package-lock.json`

- [ ] **Step 1: Install Expo SDK 55 and Expo Router**

```bash
npm install expo@~55.0.0
npx expo install expo-router expo-font expo-splash-screen expo-linear-gradient expo-image expo-constants expo-status-bar expo-updates
```

- [ ] **Step 2: Install React Native core packages via Expo**

```bash
npx expo install react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-reanimated react-native-svg @react-native-async-storage/async-storage
```

- [ ] **Step 3: Install Google Fonts**

```bash
npx expo install @expo-google-fonts/nunito @expo-google-fonts/righteous
```

- [ ] **Step 4: Install non-Expo packages**

```bash
npm install @supabase/supabase-js react-native-url-polyfill react-native-reanimated-carousel react-native-figma-squircle react-native-touchable-scale @react-native-masked-view/masked-view react-native-circular-progress react-native-progress react-native-image-viewing
```

- [ ] **Step 5: Install dev / test dependencies**

```bash
npm install --save-dev jest-expo @testing-library/react-native @testing-library/jest-native dotenv typescript
```

- [ ] **Step 6: Verify install**

```bash
npx expo doctor
```

Expected: No critical errors (warnings about iOS/Android config are fine at this stage).

---

### Task 5: Create source constants

**Files:**
- Create: `src/constants/colors.ts`
- Create: `src/constants/heroImages.ts`

- [ ] **Step 1: Create `src/constants/colors.ts`**

```typescript
export const COLORS = {
  beige: '#f5ebdc',
  orange: '#E77333',
  navy: '#293C43',
  grey: '#A2A19B',
  red: '#B5302B',
  yellow: '#F9B222',
  green: '#63A936',
  skin: '#F7D173',
  blue: '#15A1AB',
  black: '#2D2D2D',
  brown: '#502314',
} as const;
```

- [ ] **Step 2: Create `src/constants/heroImages.ts`**

This maps SuperheroAPI hero IDs to bundled local images, avoiding network requests for hero card thumbnails.

```typescript
export const HERO_IMAGES: Record<string, ReturnType<typeof require>> = {
  '620': require('../../assets/images/spiderman.jpg'),
  '346': require('../../assets/images/ironman.jpg'),
  '70':  require('../../assets/images/batman.jpg'),
  '644': require('../../assets/images/superman.jpg'),
  '370': require('../../assets/images/joker.jpg'),
  '149': require('../../assets/images/captain-america.jpg'),
  '226': require('../../assets/images/doctor-strange.jpg'),
  '720': require('../../assets/images/wonder-woman.jpg'),
  '717': require('../../assets/images/wolverine.jpg'),
  '659': require('../../assets/images/thor.jpg'),
  '332': require('../../assets/images/hulk.jpg'),
  '213': require('../../assets/images/deadpool.jpg'),
  '313': require('../../assets/images/hawkeye.jpg'),
  '414': require('../../assets/images/loki.jpg'),
  '687': require('../../assets/images/venom.jpeg'),
  '630': require('../../assets/images/star-lord.jpg'),
  '106': require('../../assets/images/black-panther.jpg'),
  '30':  require('../../assets/images/ant-man.jpg'),
  '222': require('../../assets/images/doctor-doom.jpg'),
  '208': require('../../assets/images/darth-vader.jpg'),
  '479': require('../../assets/images/mysterio.jpg'),
  '650': require('../../assets/images/terminator.jpeg'),
  '225': require('../../assets/images/doctor-octopus.jpg'),
  '299': require('../../assets/images/green-goblin.jpg'),
  '423': require('../../assets/images/magneto.jpg'),
  '196': require('../../assets/images/cyclops.jpg'),
  '480': require('../../assets/images/mystique.jpg'),
  '638': require('../../assets/images/storm.jpg'),
  '75':  require('../../assets/images/beast.jpg'),
  '567': require('../../assets/images/rogue.jpg'),
  '185': require('../../assets/images/colossus.png'),
  '490': require('../../assets/images/nightcrawler.jpg'),
  '710': require('../../assets/images/weapon-x.jpg'),
  '274': require('../../assets/images/gambit.jpg'),
  // Publisher logos
  'marvel-logo': require('../../assets/images/Marvel-Logo.jpg'),
  'dc-logo':     require('../../assets/images/DC-Logo.png'),
};
```

- [ ] **Step 3: Commit**

```bash
git add src/ assets/ package.json package-lock.json app.config.ts tsconfig.json babel.config.js metro.config.js .env.example .gitignore
git commit -m "feat: scaffold Expo 55 foundation — config, assets, constants"
```

---

### Task 6: Create root shell layout

**Files:**
- Create: `app/_layout.tsx`

- [ ] **Step 1: Create `app/_layout.tsx`** (shell — auth gate added in Phase 2)

```tsx
import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { Righteous_400Regular } from '@expo-google-fonts/righteous';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'FlameSans-Regular': require('../assets/fonts/FlameSans-Regular.ttf'),
    'Flame-Regular': require('../assets/fonts/Flame-Regular.ttf'),
    'Flame-Bold': require('../assets/fonts/Flame-Bold.ttf'),
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_900Black,
    Righteous_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
```

- [ ] **Step 2: Verify the app boots**

```bash
npx expo start --clear
```

Expected: Metro bundler starts. Opening on a simulator should show a blank beige screen (no crash). Fix any module-not-found errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "feat: add root Expo Router layout shell"
```

---

## Phase 2: Supabase + Auth

### Task 7: Set up Jest

**Files:**
- Create: `__tests__/` directory structure

- [ ] **Step 1: Create test directory structure**

```bash
mkdir -p __tests__/lib __tests__/hooks __tests__/components
```

- [ ] **Step 2: Write a sanity-check test**

Create `__tests__/sanity.test.ts`:

```typescript
describe('test setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run tests and verify they pass**

```bash
npm run test:ci
```

Expected: `PASS __tests__/sanity.test.ts` with 1 test passing.

---

### Task 8: Create Supabase client

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Write `src/lib/supabase.ts`**

```typescript
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase config. Check .env.local and app.config.ts.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

---

### Task 9: Create and test useAuth hook

**Files:**
- Create: `src/hooks/useAuth.ts`
- Create: `__tests__/hooks/useAuth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/hooks/useAuth.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from '../../src/hooks/useAuth';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

describe('useAuth', () => {
  it('returns null user initially', async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
  });

  it('exposes signIn, signUp, signOut functions', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe('function');
    expect(typeof result.current.signUp).toBe('function');
    expect(typeof result.current.signOut).toBe('function');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npm run test:ci -- --testPathPattern=useAuth
```

Expected: FAIL — `Cannot find module '../../src/hooks/useAuth'`

- [ ] **Step 3: Write `src/hooks/useAuth.ts`**

```typescript
import { useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signIn, signUp, signOut };
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm run test:ci -- --testPathPattern=useAuth
```

Expected: `PASS __tests__/hooks/useAuth.test.ts` — 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.ts __tests__/hooks/useAuth.test.ts
git commit -m "feat: add useAuth hook with Supabase auth state management"
```

---

### Task 10: Build auth screens and wire root layout

**Files:**
- Create: `app/(auth)/_layout.tsx`
- Create: `app/(auth)/login.tsx`
- Create: `app/(auth)/signup.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Create `app/(auth)/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
```

- [ ] **Step 2: Create `app/(auth)/login.tsx`**

```tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS } from '../../src/constants/colors';

export default function LoginScreen() {
  const { signIn } = useAuth();
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
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>hero</Text>
      <Text style={styles.subtitle}>the Superhero Encyclopedia</Text>

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

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={COLORS.beige} />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </TouchableOpacity>

      <Link href="/(auth)/signup" style={styles.link}>
        Don't have an account? Sign up
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  title: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 56,
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.navy,
  },
  button: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonText: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.beige,
    fontSize: 16,
  },
  link: {
    fontFamily: 'Nunito_400Regular',
    color: COLORS.navy,
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontSize: 14,
  },
  error: {
    fontFamily: 'Nunito_400Regular',
    color: COLORS.red,
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 14,
  },
});
```

- [ ] **Step 3: Create `app/(auth)/signup.tsx`**

```tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS } from '../../src/constants/colors';

export default function SignupScreen() {
  const { signUp } = useAuth();
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>hero</Text>
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

      <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={COLORS.beige} />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </TouchableOpacity>

      <Link href="/(auth)/login" style={styles.link}>
        Already have an account? Sign in
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  title: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 56,
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.navy,
  },
  button: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonText: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.beige,
    fontSize: 16,
  },
  link: {
    fontFamily: 'Nunito_400Regular',
    color: COLORS.navy,
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontSize: 14,
  },
  error: {
    fontFamily: 'Nunito_400Regular',
    color: COLORS.red,
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 14,
  },
  message: {
    fontFamily: 'Nunito_400Regular',
    color: COLORS.green,
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 14,
  },
});
```

- [ ] **Step 4: Update `app/_layout.tsx` with auth gate**

Replace the file with:

```tsx
import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { Righteous_400Regular } from '@expo-google-fonts/righteous';
import { useAuth } from '../src/hooks/useAuth';

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'FlameSans-Regular': require('../assets/fonts/FlameSans-Regular.ttf'),
    'Flame-Regular': require('../assets/fonts/Flame-Regular.ttf'),
    'Flame-Bold': require('../assets/fonts/Flame-Bold.ttf'),
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_900Black,
    Righteous_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <AuthGate />
    </>
  );
}
```

- [ ] **Step 5: Verify auth flow works on simulator**

```bash
npx expo start --clear
```

Expected: App opens to login screen. Entering valid credentials navigates to tabs. If no Supabase project exists yet, create one now — see Task 11 for the SQL schema.

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "feat: add auth screens and root layout auth gate"
```

---

### Task 11: Create Supabase schema and seed data

This task is performed in the Supabase dashboard SQL editor for your project.

- [ ] **Step 1: Run schema SQL**

In the Supabase dashboard → SQL Editor, run:

```sql
-- Heroes table (curated lists)
create table if not exists heroes (
  id          text primary key,
  name        text not null,
  publisher   text,
  image_url   text,
  category    text check (category in ('popular', 'villain', 'xmen'))
);

-- User favourites
create table if not exists user_favourites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade,
  hero_id     text references heroes(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(user_id, hero_id)
);

-- User profiles (shell)
create table if not exists user_profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at   timestamptz default now()
);

-- Row Level Security
alter table heroes enable row level security;
alter table user_favourites enable row level security;
alter table user_profiles enable row level security;

-- Heroes: anyone authenticated can read
create policy "heroes_select" on heroes for select to authenticated using (true);

-- Favourites: users manage their own
create policy "favourites_select" on user_favourites for select to authenticated using (auth.uid() = user_id);
create policy "favourites_insert" on user_favourites for insert to authenticated with check (auth.uid() = user_id);
create policy "favourites_delete" on user_favourites for delete to authenticated using (auth.uid() = user_id);

-- Profiles: users manage their own
create policy "profiles_select" on user_profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert" on user_profiles for insert to authenticated with check (auth.uid() = id);
```

- [ ] **Step 2: Seed heroes data**

In the Supabase dashboard → SQL Editor, run:

```sql
insert into heroes (id, name, publisher, image_url, category) values
-- Popular
('620', 'Spider-Man',      'Marvel Comics', 'spiderman',      'popular'),
('346', 'Iron Man',        'Marvel Comics', 'ironman',        'popular'),
('70',  'Batman',          'DC Comics',     'batman',         'popular'),
('644', 'Superman',        'DC Comics',     'superman',       'popular'),
('149', 'Captain America', 'Marvel Comics', 'captain-america','popular'),
('226', 'Doctor Strange',  'Marvel Comics', 'doctor-strange', 'popular'),
('720', 'Wonder Woman',    'DC Comics',     'wonder-woman',   'popular'),
('717', 'Wolverine',       'Marvel Comics', 'wolverine',      'popular'),
('659', 'Thor',            'Marvel Comics', 'thor',           'popular'),
('332', 'Hulk',            'Marvel Comics', 'hulk',           'popular'),
('213', 'Deadpool',        'Marvel Comics', 'deadpool',       'popular'),
('313', 'Hawkeye',         'Marvel Comics', 'hawkeye',        'popular'),
('414', 'Loki',            'Marvel Comics', 'loki',           'popular'),
('687', 'Venom',           'Marvel Comics', 'venom',          'popular'),
('630', 'Star Lord',       'Marvel Comics', 'star-lord',      'popular'),
('106', 'Black Panther',   'Marvel Comics', 'black-panther',  'popular'),
('30',  'Ant Man',         'Marvel Comics', 'ant-man',        'popular'),
-- Villains
('370', 'Joker',           'DC Comics',     'joker',          'villain'),
('222', 'Doctor Doom',     'Marvel Comics', 'doctor-doom',    'villain'),
('208', 'Darth Vader',     'Marvel Comics', 'darth-vader',    'villain'),
('479', 'Mysterio',        'Marvel Comics', 'mysterio',       'villain'),
('650', 'Terminator',      'Dark Horse Comics','terminator',  'villain'),
('225', 'Doctor Octopus',  'Marvel Comics', 'doctor-octopus', 'villain'),
('299', 'Green Goblin',    'Marvel Comics', 'green-goblin',   'villain'),
('423', 'Magneto',         'Marvel Comics', 'magneto',        'villain'),
-- X-Men
('196', 'Cyclops',         'Marvel Comics', 'cyclops',        'xmen'),
('480', 'Mystique',        'Marvel Comics', 'mystique',       'xmen'),
('638', 'Storm',           'Marvel Comics', 'storm',          'xmen'),
('75',  'Beast',           'Marvel Comics', 'beast',          'xmen'),
('567', 'Rogue',           'Marvel Comics', 'rogue',          'xmen'),
('185', 'Colossus',        'Marvel Comics', 'colossus',       'xmen'),
('490', 'Nightcrawler',    'Marvel Comics', 'nightcrawler',   'xmen'),
('710', 'Weapon X',        'Marvel Comics', 'weapon-x',       'xmen'),
('274', 'Gambit',          'Marvel Comics', 'gambit',         'xmen')
on conflict (id) do nothing;
```

Note: `image_url` stores the asset key (e.g. `'spiderman'`) which maps to `HERO_IMAGES` in `src/constants/heroImages.ts`. Wolverine and Loki appear in both popular and villain categories in the original app — here they're in popular only; their villain/xmen counterparts share the same hero ID so the category filter handles display.

- [ ] **Step 3: Verify data in Supabase table editor**

Check that the `heroes` table has rows for all 3 categories. No commit needed — this is DB work.

---

## Phase 3: Home Screen + Navigation

### Task 12: Create TypeScript types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write `src/types/index.ts`**

```typescript
// Hero as stored in Supabase
export interface Hero {
  id: string;
  name: string;
  publisher: string | null;
  image_url: string | null;  // local asset key, e.g. 'spiderman'
  category: 'popular' | 'villain' | 'xmen';
}

// SuperheroAPI response
export interface HeroStats {
  id: string;
  name: string;
  powerstats: {
    intelligence: string;
    strength: string;
    speed: string;
    durability: string;
    power: string;
    combat: string;
  };
  biography: {
    'full-name': string;
    'alter-egos': string;
    aliases: string[];
    'place-of-birth': string;
    'first-appearance': string;
    publisher: string;
    alignment: string;
  };
  appearance: {
    gender: string;
    race: string;
    height: string[];
    weight: string[];
    'eye-color': string;
    'hair-color': string;
  };
  work: {
    occupation: string;
    base: string;
  };
  connections: {
    'group-affiliation': string;
    relatives: string;
  };
  image: {
    url: string;
  };
}

// ComicVine character response
export interface HeroDetails {
  summary: string | null;
  publisher: string | null;
  firstIssueId: string | null;
}

// ComicVine first issue response
export interface FirstIssue {
  id: string;
  imageUrl: string | null;
}

// Combined character data for the character screen
export interface CharacterData {
  stats: HeroStats;
  details: HeroDetails;
  firstIssue: FirstIssue | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

### Task 13: Create and test HeroCard component

**Files:**
- Create: `src/components/HeroCard.tsx`
- Create: `__tests__/components/HeroCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/HeroCard.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { HeroCard } from '../../src/components/HeroCard';

jest.mock('react-native-touchable-scale', () => 'TouchableScale');
jest.mock('@react-native-masked-view/masked-view', () => 'MaskedView');
jest.mock('react-native-figma-squircle', () => ({
  SquircleView: 'SquircleView',
}));

describe('HeroCard', () => {
  it('renders the hero name', () => {
    const { getByText } = render(
      <HeroCard
        id="620"
        name="Spider-Man"
        imageUrl="spiderman"
        onPress={() => {}}
      />
    );
    expect(getByText('Spider-Man')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test and confirm it fails**

```bash
npm run test:ci -- --testPathPattern=HeroCard
```

Expected: FAIL — `Cannot find module '../../src/components/HeroCard'`

- [ ] **Step 3: Write `src/components/HeroCard.tsx`**

```tsx
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import TouchableScale from 'react-native-touchable-scale';
import { SquircleView } from 'react-native-figma-squircle';
import MaskedView from '@react-native-masked-view/masked-view';
import { Image } from 'expo-image';
import { COLORS } from '../constants/colors';
import { HERO_IMAGES } from '../constants/heroImages';

interface HeroCardProps {
  id: string;
  name: string;
  imageUrl: string | null;
  onPress: () => void;
}

export function HeroCard({ id, name, imageUrl, onPress }: HeroCardProps) {
  const imageSource = imageUrl ? HERO_IMAGES[imageUrl] ?? HERO_IMAGES[id] : HERO_IMAGES[id];

  return (
    <View style={styles.card}>
      <TouchableScale
        delayPressIn={50}
        activeScale={0.9}
        tension={160}
        friction={2}
        onPress={onPress}
      >
        <MaskedView
          maskElement={
            <SquircleView
              style={StyleSheet.absoluteFill}
              squircleParams={{
                cornerRadius: 50,
                cornerSmoothing: 1,
                fillColor: 'pink',
              }}
            />
          }
        >
          <Image
            source={imageSource}
            contentFit="cover"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            style={styles.image}
          />
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{name}</Text>
          </View>
        </MaskedView>
      </TouchableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    height: 300,
    marginHorizontal: 5,
    marginBottom: 25,
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.39,
    shadowRadius: 8.3,
    elevation: 13,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  nameContainer: {
    position: 'absolute',
    bottom: -5,
    padding: 30,
    width: '100%',
    justifyContent: 'center',
    borderRadius: 20,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    textShadowColor: 'rgba(0, 0, 0, 1)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 5,
  },
});
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm run test:ci -- --testPathPattern=HeroCard
```

Expected: `PASS __tests__/components/HeroCard.test.tsx` — 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/HeroCard.tsx __tests__/components/HeroCard.test.tsx
git commit -m "feat: add HeroCard component"
```

---

### Task 14: Build tab layout

**Files:**
- Create: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Create `app/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.beige,
        tabBarInactiveTintColor: COLORS.grey,
        tabBarLabelStyle: {
          fontFamily: 'Nunito_700Bold',
          fontSize: 10,
          marginTop: 15,
        },
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          backgroundColor: COLORS.black,
          borderWidth: 0,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          height: 70,
          elevation: 0,
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <Ionicons
                name={focused ? 'layers' : 'layers-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <View style={styles.searchButton}>
              <Ionicons
                name={focused ? 'search' : 'search-outline'}
                size={24}
                color={COLORS.beige}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    position: 'absolute',
    top: '50%',
  },
  searchButton: {
    position: 'absolute',
    top: -30,
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 70,
    borderColor: COLORS.grey,
    borderWidth: 1,
    backgroundColor: COLORS.navy,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    elevation: 5,
  },
});
```

---

### Task 15: Build Home screen

**Files:**
- Create: `app/(tabs)/index.tsx`

- [ ] **Step 1: Create `app/(tabs)/index.tsx`**

```tsx
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import Carousel from 'react-native-reanimated-carousel';
import * as Progress from 'react-native-progress';
import { supabase } from '../../src/lib/supabase';
import { HeroCard } from '../../src/components/HeroCard';
import { COLORS } from '../../src/constants/colors';
import type { Hero } from '../../src/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [popular, setPopular] = useState<Hero[]>([]);
  const [villains, setVillains] = useState<Hero[]>([]);
  const [xmen, setXmen] = useState<Hero[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [40, 100 + insets.top],
          [40, insets.top - 100],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  useEffect(() => {
    async function fetchHeroes() {
      const { data } = await supabase
        .from('heroes')
        .select('*')
        .order('name');

      if (data) {
        setPopular(data.filter((h: Hero) => h.category === 'popular'));
        setVillains(data.filter((h: Hero) => h.category === 'villain'));
        setXmen(data.filter((h: Hero) => h.category === 'xmen'));
      }
    }
    fetchHeroes();
  }, []);

  const handleHeroPress = (hero: Hero) => {
    setLoading(true);
    router.push({
      pathname: '/character/[id]',
      params: { id: hero.id, name: hero.name, imageUrl: hero.image_url ?? '', publisher: hero.publisher ?? '' },
    });
  };

  const renderCarousel = (data: Hero[]) => (
    <Carousel
      data={data}
      width={260}
      height={300}
      loop
      mode="parallax"
      modeConfig={{ parallaxScrollingScale: 0.9, parallaxScrollingOffset: 50 }}
      style={{ width: SCREEN_WIDTH }}
      renderItem={({ item }) => (
        <HeroCard
          id={item.id}
          name={item.name}
          imageUrl={item.image_url}
          onPress={() => handleHeroPress(item)}
        />
      )}
    />
  );

  return (
    <>
      <View style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <SafeAreaView style={{ flex: 1, width: SCREEN_WIDTH }}>
          <Animated.View style={[styles.header, headerStyle]}>
            <View>
              <Text style={styles.appTitle}>hero</Text>
              <Text style={styles.tagline}>the Superhero Encyclopedia</Text>
            </View>
          </Animated.View>

          <Animated.ScrollView
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingBottom: 80, width: SCREEN_WIDTH }}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular</Text>
              {renderCarousel(popular)}
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Villains</Text>
              {renderCarousel(villains)}
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>X-Men</Text>
              {renderCarousel(xmen)}
            </View>
          </Animated.ScrollView>

          <LinearGradient
            colors={[COLORS.beige, '#ffffff00']}
            style={styles.topGradient}
            locations={[0, 1]}
            pointerEvents="none"
          />
        </SafeAreaView>
      </View>

      {loading && (
        <Modal statusBarTranslucent>
          <View style={styles.loadingContainer}>
            <Progress.CircleSnail
              color={[COLORS.navy, COLORS.orange, COLORS.blue]}
              size={80}
              thickness={10}
              strokeCap="round"
            />
            <Text style={styles.loadingText}>loading...</Text>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    height: 100,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  appTitle: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 40,
    textAlign: 'right',
    color: COLORS.navy,
  },
  tagline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 7,
    marginTop: -2,
    left: -2,
    color: COLORS.black,
  },
  section: {
    marginTop: 40,
    alignItems: 'flex-start',
  },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 28,
    color: COLORS.navy,
    paddingLeft: 15,
    marginBottom: 10,
  },
  topGradient: {
    position: 'absolute',
    top: 44,
    left: 0,
    width: '100%',
    height: 60,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.beige,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Flame-Regular',
    marginTop: -15,
    left: 3,
    color: COLORS.navy,
    fontSize: 16,
  },
});
```

---

### Task 16: Create shell screens

**Files:**
- Create: `app/(tabs)/search.tsx`
- Create: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Create `app/(tabs)/search.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/colors';

export default function SearchScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Search</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 32,
    color: COLORS.navy,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: COLORS.grey,
  },
});
```

- [ ] **Step 2: Create `app/(tabs)/profile.tsx`** (shell — updated to show email + favourites in Task 21)

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/colors';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 32,
    color: COLORS.navy,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: COLORS.grey,
  },
});
```

- [ ] **Step 3: Verify Home screen loads hero carousels**

```bash
npx expo start --clear
```

Expected: Login → tabs → Home shows three carousels with hero cards loaded from Supabase.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/
git commit -m "feat: add tab layout, Home screen with Supabase hero data, shell screens"
```

---

## Phase 4: Character Screen

### Task 17: Create and test API layer

**Files:**
- Create: `src/lib/api.ts`
- Create: `__tests__/lib/api.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/api.test.ts`:

```typescript
import { fetchHeroStats, fetchHeroDetails, fetchFirstIssue } from '../../src/lib/api';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockClear();
});

describe('fetchHeroStats', () => {
  it('returns parsed hero stats on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '620', name: 'Spider-Man', powerstats: {} }),
    });

    const result = await fetchHeroStats('620');
    expect(result.name).toBe('Spider-Man');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/620/')
    );
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(fetchHeroStats('000')).rejects.toThrow('Hero stats fetch failed: 404');
  });
});

describe('fetchHeroDetails', () => {
  it('returns summary, publisher, firstIssueId on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{
          deck: 'A hero summary',
          publisher: { name: 'Marvel Comics' },
          first_appeared_in_issue: { id: '1234' },
        }],
      }),
    });

    const result = await fetchHeroDetails('Spider-Man', 'Marvel Comics');
    expect(result.summary).toBe('A hero summary');
    expect(result.publisher).toBe('Marvel Comics');
    expect(result.firstIssueId).toBe('1234');
  });

  it('returns nulls when results are empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const result = await fetchHeroDetails('Unknown', '');
    expect(result.summary).toBeNull();
    expect(result.publisher).toBeNull();
    expect(result.firstIssueId).toBeNull();
  });
});

describe('fetchFirstIssue', () => {
  it('returns imageUrl on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: { image: { original_url: 'https://example.com/comic.jpg' } },
      }),
    });

    const result = await fetchFirstIssue('1234');
    expect(result?.imageUrl).toBe('https://example.com/comic.jpg');
  });

  it('returns null when issueId is null', async () => {
    const result = await fetchFirstIssue(null);
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npm run test:ci -- --testPathPattern=api.test
```

Expected: FAIL — `Cannot find module '../../src/lib/api'`

- [ ] **Step 3: Write `src/lib/api.ts`**

```typescript
import Constants from 'expo-constants';
import type { HeroStats, HeroDetails, FirstIssue } from '../types';

const SUPERHERO_KEY = Constants.expoConfig?.extra?.superheroApiKey as string;
const COMICVINE_KEY = Constants.expoConfig?.extra?.comicvineApiKey as string;

export async function fetchHeroStats(id: string): Promise<HeroStats> {
  const res = await fetch(`https://superheroapi.com/api/${SUPERHERO_KEY}/${id}/`);
  if (!res.ok) throw new Error(`Hero stats fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchHeroDetails(
  name: string,
  publisher: string
): Promise<HeroDetails> {
  const res = await fetch(
    `https://comicvine.gamespot.com/api/characters/?api_key=${COMICVINE_KEY}&filter=name:${encodeURIComponent(name)},publisher:${encodeURIComponent(publisher)}&field_list=deck,publisher,first_appeared_in_issue&format=json`
  );
  if (!res.ok) throw new Error(`Hero details fetch failed: ${res.status}`);
  const data = await res.json();

  const result = data.results?.[0];
  if (!result) {
    return { summary: null, publisher: null, firstIssueId: null };
  }

  return {
    summary: result.deck ?? null,
    publisher: result.publisher?.name ?? null,
    firstIssueId: result.first_appeared_in_issue?.id?.toString() ?? null,
  };
}

export async function fetchFirstIssue(issueId: string | null): Promise<FirstIssue | null> {
  if (!issueId) return null;

  const res = await fetch(
    `https://comicvine.gamespot.com/api/issue/4000-${issueId}/?api_key=${COMICVINE_KEY}&format=json`
  );
  if (!res.ok) return null;

  const data = await res.json();
  return {
    id: issueId,
    imageUrl: data.results?.image?.original_url ?? null,
  };
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm run test:ci -- --testPathPattern=api.test
```

Expected: `PASS __tests__/lib/api.test.ts` — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts __tests__/lib/api.test.ts
git commit -m "feat: add centralised API layer for SuperheroAPI and ComicVine"
```

---

### Task 18: Build Character screen

**Files:**
- Create: `app/character/[id].tsx`

- [ ] **Step 1: Create `app/character/[id].tsx`**

```tsx
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions, Platform,
  StatusBar, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import ImageViewing from 'react-native-image-viewing';
import { fetchHeroStats, fetchHeroDetails, fetchFirstIssue } from '../../src/lib/api';
import { COLORS } from '../../src/constants/colors';
import { HERO_IMAGES } from '../../src/constants/heroImages';
import type { CharacterData } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STATS: Array<{ key: keyof CharacterData['stats']['powerstats']; label: string }> = [
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'strength', label: 'Strength' },
  { key: 'speed', label: 'Speed' },
  { key: 'durability', label: 'Durability' },
  { key: 'power', label: 'Power' },
  { key: 'combat', label: 'Combat' },
];

export default function CharacterScreen() {
  const { id, name, imageUrl, publisher } = useLocalSearchParams<{
    id: string; name: string; imageUrl: string; publisher: string;
  }>();
  const router = useRouter();
  const [data, setData] = useState<CharacterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [stats, details] = await Promise.all([
          fetchHeroStats(id),
          fetchHeroDetails(name, publisher),
        ]);
        const firstIssue = await fetchFirstIssue(details.firstIssueId);
        setData({ stats, details, firstIssue });
      } catch (e) {
        setError('Failed to load character data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const localImage = HERO_IMAGES[imageUrl] ?? HERO_IMAGES[id];
  const publisherKey = publisher === 'Marvel Comics' || publisher === 'Marvel'
    ? 'marvel-logo'
    : publisher === 'DC Comics' ? 'dc-logo' : null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.navy} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { stats, details, firstIssue } = data;

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={COLORS.navy} />
        </TouchableOpacity>

        {/* Hero image */}
        <Image
          source={localImage}
          contentFit="contain"
          style={styles.heroImage}
        />
        <LinearGradient
          colors={['#ffffff00', COLORS.beige]}
          style={styles.bottomFade}
          locations={[0.3, 1]}
          pointerEvents="none"
        />

        {/* Info panel */}
        <View style={styles.infoPanel}>
          {/* Title */}
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.heroName}>{stats.name}</Text>
              <Text style={styles.fullName}>{stats.biography['full-name']}</Text>
            </View>
            {publisherKey && (
              <Image
                source={HERO_IMAGES[publisherKey]}
                contentFit="contain"
                style={publisherKey === 'dc-logo' ? styles.publisherSquare : styles.publisherRect}
              />
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          <ScrollView
            style={{ height: 340 }}
            contentContainerStyle={{ paddingBottom: 40, marginTop: 10 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Summary */}
            {details.summary && (
              <Text style={styles.summary}>{details.summary}</Text>
            )}

            {/* Power stats */}
            <View style={styles.statsRow}>
              {STATS.map(({ key, label }) => (
                <View key={key} style={styles.statItem}>
                  <AnimatedCircularProgress
                    size={60}
                    width={10}
                    duration={2000}
                    backgroundWidth={8}
                    rotation={-124}
                    arcSweepAngle={250}
                    fill={Number(stats.powerstats[key])}
                    tintColor={COLORS.red}
                    tintColorSecondary={COLORS.green}
                    backgroundColor={COLORS.navy}
                    lineCap="round"
                    padding={0}
                  >
                    {(fill) => (
                      <Text style={styles.statValue}>{Math.floor(fill)}</Text>
                    )}
                  </AnimatedCircularProgress>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Biography */}
            <Text style={styles.sectionHeading}>Biography</Text>
            <View style={styles.thinDivider} />
            {Object.entries(stats.biography).map(([key, value]) => (
              <View key={key} style={styles.detailRow}>
                <Text style={styles.detailKey}>{key}:</Text>
                <Text style={styles.detailValue}>
                  {Array.isArray(value) ? value.join(', ') : String(value) || 'unknown'}
                </Text>
              </View>
            ))}

            {/* First issue comic */}
            {firstIssue?.imageUrl && (
              <View style={styles.comicContainer}>
                <Text style={styles.sectionHeading}>First Appearance</Text>
                <View style={styles.thinDivider} />
                <TouchableOpacity onPress={() => setLightboxVisible(true)}>
                  <Image
                    source={{ uri: firstIssue.imageUrl }}
                    contentFit="contain"
                    style={styles.comicImage}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Appearance */}
            <Text style={styles.sectionHeading}>Appearance</Text>
            <View style={styles.thinDivider} />
            {Object.entries(stats.appearance).map(([key, value]) => (
              <View key={key} style={styles.detailRow}>
                <Text style={styles.detailKey}>{key}:</Text>
                <Text style={styles.detailValue}>
                  {Array.isArray(value) ? value.join(', ') : String(value)}
                </Text>
              </View>
            ))}

            {/* Connections */}
            <Text style={styles.sectionHeading}>Connections</Text>
            <View style={styles.thinDivider} />
            {Object.entries(stats.connections).map(([key, value]) => (
              <View key={key} style={{ marginBottom: 5 }}>
                <Text style={styles.detailKey}>{key}:</Text>
                <Text style={styles.detailValue}>{String(value)}</Text>
              </View>
            ))}
          </ScrollView>

          <LinearGradient
            colors={['#ffffff00', COLORS.beige]}
            style={styles.scrollFade}
            locations={[0.8, 1]}
            pointerEvents="none"
          />
        </View>
      </SafeAreaView>

      {firstIssue?.imageUrl && (
        <ImageViewing
          images={[{ uri: firstIssue.imageUrl }]}
          imageIndex={0}
          visible={lightboxVisible}
          onRequestClose={() => setLightboxVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.beige },
  errorText: { fontFamily: 'Flame-Regular', color: COLORS.red, fontSize: 16, marginBottom: 12 },
  backLink: { fontFamily: 'Nunito_400Regular', color: COLORS.navy, textDecorationLine: 'underline' },
  backButton: { position: 'absolute', top: 0, left: 10, zIndex: 10, padding: 10 },
  heroImage: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? -120 : -150,
    left: 0,
    zIndex: -2,
    width: '100%',
    height: '100%',
  },
  bottomFade: { position: 'absolute', top: 0, left: 0, zIndex: -1, width: '100%', height: 500 },
  infoPanel: { position: 'absolute', width: '100%', top: 340, left: 0, padding: 20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  heroName: { fontFamily: 'Righteous_400Regular', fontSize: 35, color: COLORS.navy },
  fullName: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.navy, marginLeft: 3 },
  publisherSquare: { width: 30, height: 30, borderRadius: 4 },
  publisherRect: { width: 50, height: 30, borderRadius: 4 },
  divider: { height: 3, backgroundColor: COLORS.navy, borderRadius: 30, marginBottom: 10 },
  thinDivider: { height: 2, backgroundColor: COLORS.navy, borderRadius: 30, marginBottom: 15 },
  summary: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: COLORS.navy, marginBottom: 20, lineHeight: 18 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', marginBottom: 10 },
  statItem: { alignItems: 'center', justifyContent: 'center', padding: 5 },
  statValue: { fontFamily: 'Flame-Regular', color: COLORS.navy, left: 1 },
  statLabel: { fontFamily: 'Flame-Regular', fontSize: 10, color: COLORS.navy, marginTop: -10 },
  sectionHeading: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.navy, textTransform: 'capitalize', paddingVertical: 5 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, flexWrap: 'wrap' },
  detailKey: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.navy, textTransform: 'capitalize' },
  detailValue: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: COLORS.navy },
  comicContainer: { marginVertical: 20, alignItems: 'center' },
  comicImage: { width: 160, height: 240 },
  scrollFade: { position: 'absolute', top: 170, left: 20, zIndex: 1, width: '100%', height: 300 },
});
```

- [ ] **Step 2: Verify tapping a hero navigates and loads character data**

```bash
npx expo start --clear
```

Expected: Tapping a card shows loading indicator, then character detail screen with stats, biography, and first issue comic if available.

- [ ] **Step 3: Commit**

```bash
git add app/character/
git commit -m "feat: add character detail screen with stats, biography, and first issue"
```

---

### Task 19: Add favouriting

**Files:**
- Modify: `app/character/[id].tsx`
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Add favourite state and toggle to `app/character/[id].tsx`**

Add these imports at the top:

```tsx
import { useEffect, useState } from 'react';
// (already imported — add supabase)
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/hooks/useAuth';
```

Add this hook after the existing `useState` declarations:

```tsx
const { user } = useAuth();
const [isFavourite, setIsFavourite] = useState(false);

useEffect(() => {
  if (!user) return;
  supabase
    .from('user_favourites')
    .select('id')
    .eq('user_id', user.id)
    .eq('hero_id', id)
    .maybeSingle()
    .then(({ data }) => setIsFavourite(!!data));
}, [user, id]);

const toggleFavourite = async () => {
  if (!user) return;
  if (isFavourite) {
    await supabase
      .from('user_favourites')
      .delete()
      .eq('user_id', user.id)
      .eq('hero_id', id);
    setIsFavourite(false);
  } else {
    await supabase
      .from('user_favourites')
      .insert({ user_id: user.id, hero_id: id });
    setIsFavourite(true);
  }
};
```

Add a favourite button next to the back button (inside `SafeAreaView`, after the back button `TouchableOpacity`):

```tsx
<TouchableOpacity style={styles.favouriteButton} onPress={toggleFavourite}>
  <Ionicons
    name={isFavourite ? 'heart' : 'heart-outline'}
    size={28}
    color={isFavourite ? COLORS.red : COLORS.navy}
  />
</TouchableOpacity>
```

Add to `StyleSheet.create`:

```tsx
favouriteButton: { position: 'absolute', top: 0, right: 10, zIndex: 10, padding: 10 },
```

- [ ] **Step 2: Verify favouriting persists across app restarts**

Tap the heart on a character screen. Force-close the app and reopen. Navigate to the same character — the heart should still be filled.

- [ ] **Step 3: Commit**

```bash
git add app/character/[id].tsx
git commit -m "feat: add favourite toggle on character screen, persisted to Supabase"
```

---

## Phase 5: Polish

### Task 20: Update Profile screen

**Files:**
- Replace: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Replace `app/(tabs)/profile.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { supabase } from '../../src/lib/supabase';
import { COLORS } from '../../src/constants/colors';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [favouriteCount, setFavouriteCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_favourites')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setFavouriteCount(count ?? 0));
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Favourites</Text>
        {favouriteCount === null ? (
          <ActivityIndicator color={COLORS.navy} />
        ) : (
          <Text style={styles.value}>{favouriteCount} heroes saved</Text>
        )}
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
    padding: 24,
  },
  title: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 40,
    color: COLORS.navy,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  value: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.navy,
  },
  signOutButton: {
    marginTop: 'auto',
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.beige,
    fontSize: 16,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/profile.tsx
git commit -m "feat: update profile screen with email and favourite count"
```

---

### Task 21: Run all tests

- [ ] **Step 1: Run the full test suite**

```bash
npm run test:ci
```

Expected: All tests pass. Fix any failures before proceeding.

- [ ] **Step 2: Commit test fixes if any**

```bash
git add -A
git commit -m "fix: resolve any test failures after full implementation"
```

---

### Task 22: Write CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create `CLAUDE.md`**

```markdown
# hero

A React Native / Expo superhero encyclopedia app. Displays popular heroes, villains, and X-Men from a Supabase-backed list. Tapping a card fetches live data from SuperheroAPI + ComicVine and navigates to a detail screen. Users can sign in and save favourites.

## Quick Start

1. Create a Supabase project at supabase.com
2. Run the schema SQL from `docs/superpowers/plans/2026-04-04-expo55-upgrade.md` (Task 11)
3. Copy `.env.example` to `.env.local` and fill in values
4. Install dependencies and start:

```bash
npm install
npx expo start
```

## Commands

```bash
npm run start          # start Metro (scan QR for Expo Go)
npm run ios            # run on iOS simulator (requires Xcode)
npm run android        # run on Android emulator (requires Android Studio)
npm run web            # run in browser
npm run test           # run tests in watch mode
npm run test:ci        # run tests once (CI)
```

## Architecture

```
app/                        # Expo Router file-based routing
  _layout.tsx               # Root: fonts, auth gate (redirects unauthenticated → login)
  (auth)/                   # Unauthenticated screens (login, signup)
  (tabs)/                   # Authenticated tab screens (index=Home, search, profile)
  character/[id].tsx        # Character detail — dynamic route
src/
  lib/supabase.ts           # Supabase client (reads URL + key from expo-constants)
  lib/api.ts                # SuperheroAPI + ComicVine fetch functions
  hooks/useAuth.ts          # Auth state: user, signIn, signUp, signOut
  components/HeroCard.tsx   # Hero carousel card
  constants/colors.ts       # Shared colour palette
  constants/heroImages.ts   # Map of hero ID → bundled local image require()
  types/index.ts            # Shared TypeScript types
assets/
  fonts/                    # Flame-Regular, Flame-Bold, FlameSans-Regular (custom)
  images/                   # Hero + publisher images (bundled)
```

## Env vars

| Key | Where to get it |
|-----|----------------|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API |
| `SUPERHERO_API_KEY` | superheroapi.com |
| `COMICVINE_API_KEY` | comicvine.gamespot.com/api |

## Gotchas

- `heroImages.ts` maps hero ID (string) → local require(). `image_url` in Supabase stores the asset key (e.g. `'spiderman'`), NOT a real URL.
- Auth gate lives in `app/_layout.tsx` — `useAuth` must not be called before fonts are loaded.
- `babel-preset-expo` must come before `react-native-reanimated/plugin` in `babel.config.js`.
- `react-native-url-polyfill/auto` must be the first import in `app/_layout.tsx` for Supabase to work on React Native.
- Carousel uses `react-native-reanimated-carousel` (not the old unmaintained `react-native-snap-carousel`).
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with setup instructions and architecture overview"
```

---

### Task 23: Clean up old app/ directory remnants

- [ ] **Step 1: Verify no old app/ files remain outside routing**

```bash
ls app/
```

Expected: Only routing files (`_layout.tsx`, `(auth)/`, `(tabs)/`, `character/`).

- [ ] **Step 2: Remove the old `app/` backup if it still exists**

If `app/` contains any `.js` files from the old codebase:

```bash
find app/ -name "*.js" -not -name "*.config.js"
```

If any old `.js` files appear, delete them:

```bash
find app/ -name "*.js" -not -name "*.config.js" -delete
```

- [ ] **Step 3: Final test run**

```bash
npm run test:ci
```

Expected: All tests pass.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup — remove any remaining old JS files"
```

---

## Done

At completion the app:
- Boots with Expo SDK 55 on iOS, Android, and Web
- Redirects unauthenticated users to login
- Loads hero carousels from Supabase
- Navigates to a full character detail screen with live API data
- Lets users favourite heroes, persisted to Supabase
- Shows profile with email and favourite count
- Has a passing test suite covering the API layer, auth hook, and HeroCard component
