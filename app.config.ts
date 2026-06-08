import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';

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
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#293c43',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_DEV ? 'com.ginoswanepoel.mythique.dev' : 'com.ginoswanepoel.mythique',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
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
    output: 'single',
    favicon: './assets/favicon.png',
  },
  plugins: [
    './plugins/withAndroidIconPadding',
    '@react-native-google-signin/google-signin',
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
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    superheroApiKey: process.env.SUPERHERO_API_KEY,
    comicvineApiKey: process.env.COMICVINE_API_KEY,
    eas: {
      projectId: '129c7437-8d73-4224-bda5-74f69f85a523',
    },
  },
};

export default config;
