// app/event/[slug].tsx
// Native event page. Thin view over useEventDossier — expo-router resolves by
// platform extension and BOTH files must exist or it throws.
//
// The body is shared with the web route (src/components/event/EventDossier);
// only the scroll container differs, because web must scroll the document.
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/colors';
import { EventDossier } from '../../src/components/event/EventDossier';
import { useEventDossier } from '../../src/hooks/useEventDossier';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { EventDossierSkeleton } from '../../src/components/skeletons/EventSkeleton';
import { FadeOutSkeleton } from '../../src/components/ui/FadeOutSkeleton';
import { useSkeletonTransition } from '../../src/hooks/useSkeletonTransition';

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
  const { dossier, loading, notFound, failed, retry, windowLabel, windowDays } =
    useEventDossier(slug);
  // pre → bare ink page, so a cached dossier never blinks a skeleton.
  const phase = useSkeletonTransition(loading);

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ ...headerOptions, title: dossier?.event.headline ?? 'Event' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
        {/* Bleed the ink stage under the status bar — the page opens on ink. */}
        <View style={{ height: insets.top, backgroundColor: COLORS.deepNavy }} />
        {loading && phase === 'skeleton' && <EventDossierSkeleton />}
        {notFound && (
          // Only approved events have a page, so an unknown slug here is the
          // normal case for anything the detector hasn't had confirmed.
          <EmptyState
            icon="calendar-outline"
            title="No page for this event yet."
            body="An event gets a page once its detection is confirmed."
          />
        )}
        {failed && (
          // The event may well exist — this is a failed fetch, not a dead link,
          // so it offers a retry rather than the "no page yet" copy. This branch
          // used to be unreachable: `notFound` was true for outages too.
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn’t load this event"
            body="Check your connection and try again."
            action={{ label: 'Try again', onPress: retry }}
          />
        )}
        {dossier && (
          <View>
            <EventDossier
              dossier={dossier}
              windowLabel={windowLabel}
              windowDays={windowDays}
              contentWidth={width}
              viewportHeight={height}
              onTitlePress={(id) => router.push(`/title/${encodeURIComponent(id)}`)}
              onHeroPress={(id) => router.push(`/character/${encodeURIComponent(id)}`)}
              onIssuePress={(id) => router.push(`/issue/${encodeURIComponent(id)}`)}
              onIndexPress={() => router.push('/event')}
            />
            {/* The dossier sits settled underneath; only this layer animates. */}
            {phase === 'crossfade' ? (
              <FadeOutSkeleton>
                <EventDossierSkeleton />
              </FadeOutSkeleton>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.deepNavy },
});
