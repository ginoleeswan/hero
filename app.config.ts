import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';

// Reversed iOS client ID — registered as a URL scheme in Info.plist so iOS can
// redirect back to the app after Google sign-in completes.
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const googleIosUrlScheme = iosClientId
  ? 'com.googleusercontent.apps.' + iosClientId.replace('.apps.googleusercontent.com', '')
  : undefined;

const config: ExpoConfig = {
  name: IS_DEV ? 'Mythique (Dev)' : 'Mythique',
  slug: 'hero',
  scheme: IS_DEV ? 'mythique-dev' : 'mythique',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Dark, not automatic. The app is dark-first in the places that matter most
  // — the boot stage, Explore's billboard, the Arena, every character page —
  // and 'automatic' meant the SYSTEM chrome disagreed with it on a light-mode
  // device: a cream tab bar under a near-black Arena, and with it a hard cap on
  // the accent that could sit there (no orange clears 4.5:1 on a light bar and
  // stays recognisably orange). Pinning dark makes the chrome agree with the
  // product and frees the tab tint to be the bright orange.
  //
  // NATIVE: this is UIUserInterfaceStyle in Info.plist, so it takes effect on
  // the next build, not over the air. TAB_ACTIVE is still paired with
  // ORANGE_INK via DynamicColorIOS for exactly that reason — until the rebuild
  // lands, an OTA client in light mode still gets a light bar and must still
  // get the dark orange on it.
  userInterfaceStyle: 'dark',
  owner: 'ginolee',
  updates: {
    url: 'https://u.expo.dev/129c7437-8d73-4224-bda5-74f69f85a523',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_DEV ? 'com.ginoswanepoel.mythique.dev' : 'com.ginoswanepoel.mythique',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    usesAppleSignIn: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#293c43',
    },
    package: IS_DEV ? 'com.ginoswanepoel.mythique.dev' : 'com.ginoswanepoel.mythique',
  },
  web: {
    bundler: 'metro',
    // 'static' (not 'single') so Expo renders our app/+html.tsx for the document
    // head. 'single' uses Expo's built-in template with a hardcoded viewport that
    // omits viewport-fit=cover, which iOS Safari needs in the INITIAL HTML for
    // edge-to-edge / safe-area-inset support.
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    './plugins/withAndroidIconPadding',
    'expo-sharing',
    [
      'expo-notifications',
      {
        // The Android status-bar icon must be a flat white-on-transparent
        // silhouette — Android masks it, so a full-colour logo renders as a
        // white blob. The mask mark is the one asset shaped for that.
        icon: './assets/notification-icon.png',
        color: '#E77333',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          // GoogleSignIn → AppCheckCore depends on GoogleUtilities and
          // RecaptchaInterop, which don't define modules. As static libraries
          // they need explicit module maps, or `pod install` fails. (The
          // `useModularHeaders` key isn't supported by expo-build-properties —
          // only per-pod modular_headers via extraPods.)
          extraPods: [
            { name: 'GoogleUtilities', modular_headers: true },
            { name: 'RecaptchaInterop', modular_headers: true },
          ],
        },
      },
    ],
    // The native Google Sign-In plugin requires iosUrlScheme. It's derived from
    // EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, which isn't present on the web build host
    // (Vercel) — and isn't needed there. Only register the plugin when available.
    ...(googleIosUrlScheme
      ? [
          ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }] as [
            string,
            Record<string, unknown>,
          ],
        ]
      : []),
    'expo-apple-authentication',
    'expo-router',
    'expo-image',
    'expo-status-bar',
    'expo-web-browser',
    [
      'expo-font',
      {
        fonts: ['./assets/fonts/FlameSans-Regular.ttf', './assets/fonts/Flame-Regular.ttf'],
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        backgroundColor: '#293c43',
        // The whole lockup — mark high, wordmark low — not just the mark. Its
        // width IS the composition's coordinate system: BootStage rebuilds the
        // same centred box from SPLASH_LOCKUP.w to take over without a jump, so
        // this number and `SPLASH_LOCKUP.w` in src/constants/logo.ts must agree.
        // Regenerate the asset with `yarn build:splash`.
        imageWidth: 300,
      },
    ],
    // Crash/error reporting. The config plugin wires native symbolication +
    // source-map upload at EAS build time (needs SENTRY_AUTH_TOKEN); at runtime
    // the SDK no-ops without EXPO_PUBLIC_SENTRY_DSN. See src/lib/sentry.ts.
    '@sentry/react-native/expo',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    comicvineApiKey: process.env.COMICVINE_API_KEY,
    tmdbApiKey: process.env.TMDB_API_KEY,
    eas: {
      projectId: '129c7437-8d73-4224-bda5-74f69f85a523',
    },
  },
};

export default config;
