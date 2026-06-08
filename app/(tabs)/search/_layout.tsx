// app/(tabs)/search/_layout.tsx — native Stack for the Search tab. No header
// title (iOS 26 glasses any header item); the "Search" heading lives in the
// screen content. Transparency + filter menus are declared in index.tsx.
import { Stack } from 'expo-router';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: '',
      }}
    />
  );
}
