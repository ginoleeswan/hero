import { Stack, useRouter } from 'expo-router';
import { NotFoundView } from '../src/components/NotFoundView';
import { COLORS } from '../src/constants/colors';

// Catch-all for any unmatched route (bad deep link, stale URL, typo'd path).
// Shares the wanted-poster treatment with the hero-not-found state, swapping the
// "MISSING" stamp for "404" and pointing the user home.
export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Not found' }} />
      <NotFoundView
        stamp="404"
        stampColor={COLORS.navy}
        icon="map-outline"
        headline="Off the grid"
        subline="This page doesn't exist."
        actions={[{ label: 'Take me home', primary: true, onPress: () => router.replace('/') }]}
      />
    </>
  );
}
