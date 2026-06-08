// app/(tabs)/search/_layout.tsx — native Stack so the Search screen can host the
// real iOS UISearchController (headerSearchBarOptions). The header is transparent
// with a native dark blur, so the large title + pinned search bar float over the
// navy canvas and content blurs under them on scroll (matches the arena + the
// Apple Games search aesthetic). No solid bar colour → one continuous surface.
import { Stack } from 'expo-router';
import { COLORS } from '../../../src/constants/colors';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerLargeTitle: true,
        headerTitle: 'Search',
        headerTransparent: true,
        headerBlurEffect: 'systemChromeMaterialDark',
        headerShadowVisible: false,
        headerTintColor: COLORS.orange,
        headerTitleStyle: { color: COLORS.beige },
        headerLargeTitleStyle: { color: COLORS.beige },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
