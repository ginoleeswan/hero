// app/(tabs)/search/_layout.tsx — native Stack for the Search tab. No large
// title (it reserves an awkward empty row above the search bar). Just a compact
// "Search" title; transparency, blur and the search bar are declared in
// index.tsx via Stack.Header / Stack.SearchBar.
import { Stack } from 'expo-router';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        // No title — the tab already says "Search" and the field lives in the
        // tab bar (role="search"), so a header title is dead weight.
        headerTitle: '',
      }}
    />
  );
}
