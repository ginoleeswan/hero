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
  // 'default' means "whatever each platform's Info.plist says", which is the
  // only way to let the iPad rotate while the phone stays locked — the
  // top-level key applies to both. The two orientation lists live in
  // ios.infoPlist below.
  orientation: 'default',
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
    // App Review runs an iPad build whether or not we claim to support one, and
    // an iPhone app letterboxed on an iPad is one of the things they reject
    // for. Claiming the target means the layout has to actually hold up at
    // tablet widths — see src/constants/layout.ts, which is what makes it.
    supportsTablet: true,
    bundleIdentifier: IS_DEV ? 'com.ginoswanepoel.mythique.dev' : 'com.ginoswanepoel.mythique',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // Also set by the expo-image-picker plugin below, deliberately. A
      // plugin's Info.plist mod only materialises during prebuild, so
      // `expo config` cannot show it and the string is unverifiable until a
      // build has already been spent. Declared here it is checkable before
      // pushing a build, and the value is identical either way. Keep the two
      // in sync; the picker is a hard CRASH without it, not a warning.
      NSPhotoLibraryUsageDescription:
        'Mythique needs access to your photos so you can set your profile picture and cover image.',
      // The phone stays portrait: every phone layout is tuned for one column
      // and a landscape phone gains nothing but a shorter fold.
      UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
      // The iPad rotates freely. A tablet that refuses to turn reads as broken
      // — it is held either way and often docked to a keyboard — and all four
      // are also the precondition for Split View and Slide Over, which we opt
      // into by leaving requireFullScreen unset.
      'UISupportedInterfaceOrientations~ipad': [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationPortraitUpsideDown',
        'UIInterfaceOrientationLandscapeLeft',
        'UIInterfaceOrientationLandscapeRight',
      ],
    },
    usesAppleSignIn: true,
    // Universal Links. Without this every mythique.app link the app SHARES
    // opens in Safari — including for people who already have the app — so the
    // share loop hands its own traffic to the website. The association document
    // is served from api/aasa.ts; the paths it claims are listed there.
    //
    // `applinks:` alone is enough for link handling; `webcredentials:` lets
    // Passwords offer a saved mythique.app login inside the app's sign-in form,
    // and both key off the same document.
    associatedDomains: ['applinks:mythique.app', 'webcredentials:mythique.app'],
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#293c43',
    },
    package: IS_DEV ? 'com.ginoswanepoel.mythique.dev' : 'com.ginoswanepoel.mythique',
    // Android's half of the same job. autoVerify makes these open the app
    // directly rather than showing a disambiguation sheet, which requires
    // /.well-known/assetlinks.json to list the app's signing fingerprint —
    // see the note in api/aasa.ts.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'mythique.app' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
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
      // NOT optional, and not merely a review requirement: iOS TERMINATES an
      // app that opens the photo library without a purpose string. The picker
      // is reachable from four live buttons on Profile (avatar and cover, in
      // both the native and web trees) via useProfile's pickAndUploadAvatar /
      // pickAndUploadCover, so shipping without this is a crash on a tap any
      // reviewer would make.
      //
      // The library permission only. There is no camera path here — both call
      // sites are launchImageLibraryAsync — so the plugin's camera and
      // microphone strings are disabled rather than left to their defaults;
      // asking for a permission the app never uses is its own rejection.
      'expo-image-picker',
      {
        photosPermission:
          'Mythique needs access to your photos so you can set your profile picture and cover image.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
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
        // The whole lockup — mark high, wordmark low — not just the mark.
        //
        // THIS IS THE LOCKUP'S HEIGHT, NOT ITS WIDTH, AND THAT IS NOT A TYPO.
        // expo-splash-screen treats `imageWidth` as the side of a SQUARE box
        // and the storyboard fits the image into it with `scaleAspectFit`. Our
        // lockup is portrait (300 × 560), so the fit is height-constrained: at
        // `imageWidth: 300` it scaled by 300/560 = 0.536 and the OS drew a
        // 161pt lockup with an 86pt mark, while BootStage rebuilt it at the
        // declared 300/160 — so the handoff jumped 1.87× and the wordmark
        // leapt down the screen. At 560 the fit scale is exactly 1 and the
        // lockup lands at its true 300 × 560.
        //
        // So this must equal `SPLASH_LOCKUP.h` in src/constants/logo.ts, and
        // the composition's coordinate system is still SPLASH_LOCKUP.w — the
        // box is square, the art inside it is not.
        //
        // Hardcoded rather than imported: Expo transpiles this file to CommonJS
        // and `require`s it from Node, which cannot resolve a `.ts` module —
        // importing SPLASH_LOCKUP here fails prebuild outright. The agreement is
        // enforced by __tests__/constants/splashLockup.test.ts instead, because
        // the comment that used to assert it is exactly what went stale.
        // Regenerate the asset with `yarn build:splash`.
        imageWidth: 560,
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
