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
  userInterfaceStyle: 'automatic',
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
        image: './assets/splash.png',
        backgroundColor: '#293c43',
        imageWidth: 200,
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
