// app/(tabs)/search/_layout.tsx — native Stack for the Search tab. No large
// title (it reserves an awkward empty row above the search bar). Just a compact
// "Search" title; transparency, blur and the search bar are declared in
// index.tsx via Stack.Header / Stack.SearchBar.
import { Stack } from 'expo-router';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        // Stack.SearchBar forces the header to stay shown, so we can't hide it.
        // Keep the title empty (no "index"/"Search" text); the bar gets filled
        // purposefully by the in-header filter row.
        headerTitle: '',
      }}
    />
  );
}
