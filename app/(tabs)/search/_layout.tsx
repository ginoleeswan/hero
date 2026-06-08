// app/(tabs)/search/_layout.tsx — native Stack for the Search tab. Only the
// large-title toggle + title text/colour live here (no declarative Stack.Title
// in this expo-router version). Transparency, blur, shadow and the search bar
// are declared in index.tsx via Stack.Header / Stack.SearchBar.
import { Stack } from 'expo-router';
import { COLORS } from '../../../src/constants/colors';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTitle: 'Search',
        headerLargeTitleStyle: { color: COLORS.beige },
      }}
    />
  );
}
