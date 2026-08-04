// app/event/index.tsx
// Native index of every event with a page. Thin view over useEventIndex —
// expo-router resolves by platform extension and BOTH files must exist.
//
// Exists because the dossier page had exactly one route in: the live card in the
// Pulse rail, which disappears when the detection grace lapses. The pages are
// permanent; their only link was not.
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/colors';
import { EventIndexList } from '../../src/components/event/EventIndexList';
import { useEventIndex } from '../../src/hooks/useEventDossier';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { EventIndexSkeleton } from '../../src/components/skeletons/EventSkeleton';

// The root stack hides headers globally — `title` alone renders nothing, and
// this page is reachable by deep link, so it needs a visible back affordance.
const headerOptions = {
  headerShown: true,
  headerTitle: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerTintColor: COLORS.beige,
  headerBackButtonDisplayMode: 'minimal',
} as const;

export default function EventIndexPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { index, loading } = useEventIndex();

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ ...headerOptions, title: 'Events' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
        {/* Bleed the ink stage under the status bar — the page opens on ink. */}
        <View style={{ height: insets.top, backgroundColor: COLORS.deepNavy }} />
        {loading && !index && <EventIndexSkeleton />}
        {!loading && !index && (
          // Fetch failed or the index is empty — never leave a blank ink page.
          <EmptyState
            icon="calendar-outline"
            title="No events right now"
            body="Check back soon — the next one shows up here when its readership moves."
          />
        )}
        {index && (
          <EventIndexList
            index={index}
            contentWidth={width}
            viewportHeight={height}
            onEventPress={(slug) => router.push(`/event/${encodeURIComponent(slug)}`)}
          />
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.deepNavy },
});
