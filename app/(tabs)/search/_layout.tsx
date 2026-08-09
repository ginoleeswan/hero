// app/(tabs)/search/_layout.tsx — native Stack for the Search tab. No header
// title (iOS 26 glasses any header item); the "Search" heading lives in the
// screen content. Transparency + filter menus are declared in index.tsx.
import { Stack } from 'expo-router';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        // Kill the iOS 26 UIScrollEdgeEffect. This screen HAS a header (the
        // search bar and filter menus live in it), so unlike biography or the
        // house page it cannot simply drop the header to avoid the effect —
        // and the effect's light blur reads as a grey scrim in the wrong
        // colour across the top of the dark navy stage.
        //
        // Reachable straight from Stack options; see the scroll-edge section
        // of docs/features/platform-and-motion.md.
        scrollEdgeEffects: { top: 'hidden' },
      }}
    />
  );
}
