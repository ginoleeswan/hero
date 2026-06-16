// Tracked counterpart to the gitignored, Expo-generated `expo-env.d.ts`.
//
// `expo-env.d.ts` contains `/// <reference types="expo/types" />`, which loads
// Expo's ambient types — including react-native-web's style augmentations that
// permit web-only CSS in styles (e.g. `position: 'fixed'`, `backgroundImage`)
// used by the web/admin components. Because Expo gitignores `expo-env.d.ts`, a
// clean CI checkout doesn't have it, so `yarn typecheck` would reject those
// web-only styles even though they pass locally. Tracking this reference keeps
// CI and local in sync.
/// <reference types="expo/types" />
