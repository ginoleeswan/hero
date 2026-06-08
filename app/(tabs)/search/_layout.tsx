// app/(tabs)/search/_layout.tsx — native Stack for the Search tab. The large
// collapsing title lives here (no declarative Stack.Title in this expo-router
// version); transparency + blur + the native search bar are declared in
// index.tsx via Stack.Header / Stack.SearchBar.
import { Stack } from 'expo-router';
import { COLORS } from '../../../src/constants/colors';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTitle: 'Search',
        headerLargeTitleStyle: { color: COLORS.beige },
        headerTitleStyle: { color: COLORS.beige },
        headerTintColor: COLORS.orange,
        headerShadowVisible: false,
      }}
    />
  );
}
