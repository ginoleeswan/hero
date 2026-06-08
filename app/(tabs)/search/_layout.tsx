// app/(tabs)/search/_layout.tsx — native Stack for the Search tab. No title text
// in the header — just the native search bar (declared in index.tsx via
// Stack.SearchBar, which keeps the header shown). Transparency + blur are set
// there too via Stack.Header.
import { Stack } from 'expo-router';
import { COLORS } from '../../../src/constants/colors';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerLargeTitle: false,
        headerTintColor: COLORS.orange,
        headerShadowVisible: false,
      }}
    />
  );
}
