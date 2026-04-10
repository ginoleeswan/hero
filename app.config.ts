import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';

const config: ExpoConfig = {
  name: IS_DEV ? 'hero (dev)' : 'hero',
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
    bundleIdentifier: IS_DEV ? 'com.ginoswanepoel.hero.dev' : 'com.ginoswanepoel.hero',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#293c43',
    },
    package: IS_DEV ? 'com.ginoswanepoel.hero.dev' : 'com.ginoswanepoel.hero',
  },
  web: {
    bundler: 'metro',
    output: 'single-page-application',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-image',
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
    superheroApiKey: process.env.SUPERHERO_API_KEY,
    comicvineApiKey: process.env.COMICVINE_API_KEY,
  },
};

export default config;
