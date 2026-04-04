import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

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
    output: 'single-page-application',
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
