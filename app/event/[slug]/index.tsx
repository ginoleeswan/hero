// app/event/[slug]/index.tsx
// The series hub — /event/d23. Thin view over useEventHub; expo-router resolves
// by platform extension and BOTH files must exist or it throws.
//
// ONE URL, ONE MEANING. This route used to be two pages: the live dossier while
// the detector called the event on, and the hub once it was over. That put the
// current edition's content at two addresses at the same time — here and at
// /event/d23/2026, which exists and is refrozen every 30 minutes while the show
// runs — and then silently changed what the URL meant when the event ended.
// A reader landing here mid-event was reading 2026 with a link to 2026 in the
// archive below it, and a search engine was ranking a page whose subject changed
// without the URL doing so.
//
// The old arrangement was chosen to keep the Pulse rail one tap from the news on
// the one day of the year anybody is looking. That cost is now paid by the stage
// instead: while an event is live the hub opens on a route straight into the
// running edition, which orients a reader rather than dropping them mid-dossier.
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../src/constants/colors';
import { EventHub } from '../../../src/components/event/EventHub';
import { useEventHub } from '../../../src/hooks/useEventEditions';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { EventHubSkeleton } from '../../../src/components/skeletons/EventSkeleton';
import { useSkeletonTransition } from '../../../src/hooks/useSkeletonTransition';
import { ShareHeaderButton } from '../../../src/components/ui/ShareHeaderButton';
import { eventShareLine, shareLink } from '../../../src/lib/share';

// The root stack hides headers globally — `title` alone renders nothing, and
// event pages are shared/deep-linked, so they need a visible back affordance.
const headerOptions = {
  headerShown: true,
  headerTitle: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerTintColor: COLORS.beige,
  headerBackButtonDisplayMode: 'minimal',
} as const;

export default function EventPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { hub, loading, notFound, failed, retry } = useEventHub(slug);
  // pre → bare ink page, so a cached hub never blinks a skeleton.
  const phase = useSkeletonTransition(loading);

  const goEdition = (edition: string) =>
    router.push(`/event/${encodeURIComponent(slug)}/${encodeURIComponent(edition)}`);

  return (
    <View style={s.screen}>
      <Stack.Screen
        options={{
          ...headerOptions,
          title: hub?.headline ?? 'Event',
          // Only once there is something to read: a share button that sends a
          // link to a page still loading is a link to nothing worth reading.
          headerRight: hub
            ? () => (
                <ShareHeaderButton
                  message={eventShareLine(hub.headline, hub.isLive)}
                  url={shareLink.event(slug)}
                  label="Share this event"
                />
              )
            : undefined,
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
        {/* Bleed the ink stage under the status bar — the page opens on ink. */}
        <View style={{ height: insets.top, backgroundColor: COLORS.deepNavy }} />
        {loading && phase === 'skeleton' && <EventHubSkeleton />}

        {notFound && (
          <EmptyState
            icon="calendar-outline"
            title="No page for this event yet."
            body="An event gets a page once its readership is detected as moving."
          />
        )}
        {failed && !hub && (
          // The event may well exist — this is a failed fetch, not a dead link,
          // so it offers a retry rather than the "no page yet" copy.
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn’t load this event"
            body="Check your connection and try again."
            action={{ label: 'Try again', onPress: retry }}
          />
        )}

        {hub && (
          <EventHub
            hub={hub}
            contentWidth={width}
            viewportHeight={height}
            onEditionPress={goEdition}
            onIndexPress={() => router.push('/event')}
          />
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.deepNavy },
});
