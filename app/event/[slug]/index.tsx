// app/event/[slug]/index.tsx
// Native event page. Thin view over useEventHub + useEventDossier — expo-router
// resolves by platform extension and BOTH files must exist or it throws.
//
// One route, two tenses. While the detector calls the event live this renders the
// live dossier, because that is what the Pulse rail links to and a reader mid-D23
// wants the news, not a table of contents. Once it is over the same URL becomes
// the series hub: what this event is, and every edition on record.
//
// The alternative — a permanent hub with the live page one click deeper — was
// rejected because it puts a menu between the rail and the thing the rail is
// advertising, on the one day of the year anybody is looking.
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { Text } from '../../../src/components/ui/Text';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SURFACE, PAPER_TEXT } from '../../../src/constants/colors';
import { EventDossier } from '../../../src/components/event/EventDossier';
import { EventHub, EditionList } from '../../../src/components/event/EventHub';
import { useEventDossier } from '../../../src/hooks/useEventDossier';
import { useEventHub } from '../../../src/hooks/useEventEditions';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import {
  EventDossierSkeleton,
  EventHubSkeleton,
} from '../../../src/components/skeletons/EventSkeleton';
import { FadeOutSkeleton } from '../../../src/components/ui/FadeOutSkeleton';
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
  const { hub, loading: hubLoading } = useEventHub(slug);
  const { dossier, loading, notFound, failed, retry, windowLabel, windowDays } =
    useEventDossier(slug);
  // pre → bare ink page, so a cached dossier never blinks a skeleton.
  const phase = useSkeletonTransition(loading || hubLoading);

  const live = !!hub?.isLive && !!dossier;
  const accent = hub?.accent ?? dossier?.event.accent ?? COLORS.goldAccent;
  const headline = hub?.headline ?? dossier?.event.headline;
  const goEdition = (edition: string) =>
    router.push(`/event/${encodeURIComponent(slug)}/${encodeURIComponent(edition)}`);

  return (
    <View style={s.screen}>
      <Stack.Screen
        options={{
          ...headerOptions,
          title: headline ?? 'Event',
          // Only once there is something to read: a share button that sends a
          // link to a page still loading is a link to nothing worth reading.
          headerRight:
            hub || dossier
              ? () => (
                  <ShareHeaderButton
                    message={eventShareLine(headline ?? 'Event', !!hub?.isLive)}
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
        {/* The hub shape while loading: liveness is unknown until the hub
            resolves, and 19 of 20 events are not live. */}
        {(loading || hubLoading) && phase === 'skeleton' && <EventHubSkeleton />}

        {notFound && !hub && (
          <EmptyState
            icon="calendar-outline"
            title="No page for this event yet."
            body="An event gets a page once its readership is detected as moving."
          />
        )}
        {failed && !hub && !dossier && (
          // The event may well exist — this is a failed fetch, not a dead link,
          // so it offers a retry rather than the "no page yet" copy.
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn’t load this event"
            body="Check your connection and try again."
            action={{ label: 'Try again', onPress: retry }}
          />
        )}

        {live && dossier ? (
          <View>
            <EventDossier
              dossier={dossier}
              windowLabel={windowLabel}
              windowDays={windowDays}
              contentWidth={width}
              viewportHeight={height}
              onTitlePress={(id) => router.push(`/title/${encodeURIComponent(id)}`)}
              onHeroPress={(id) => router.push(`/character/${encodeURIComponent(id)}`)}
              onArenaPress={(a, b) =>
                router.push(`/compare/${encodeURIComponent(a)}/${encodeURIComponent(b)}`)
              }
              onIndexPress={() => router.push('/event')}
            />
            {/* Past years, under the live page. The current edition is being
                frozen every 30 minutes as this runs, so it appears here too — it
                is the archive catching up in real time, not a duplicate. */}
            {!!hub && hub.editions.length > 0 && (
              <View style={s.editionsBlock}>
                <Text style={s.editionsTitle}>Editions</Text>
                <Text style={s.editionsNote}>Every year of this event on record.</Text>
                <EditionList editions={hub.editions} accent={accent} onEditionPress={goEdition} />
              </View>
            )}
          </View>
        ) : hub ? (
          <View>
            <EventHub
              hub={hub}
              contentWidth={width}
              viewportHeight={height}
              onEditionPress={goEdition}
              onIndexPress={() => router.push('/event')}
            />
            {phase === 'crossfade' ? (
              <FadeOutSkeleton>
                <EventDossierSkeleton />
              </FadeOutSkeleton>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.deepNavy },
  editionsBlock: {
    backgroundColor: SURFACE.paper,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  editionsTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 23,
    lineHeight: 30,
    color: COLORS.deepNavy,
  },
  editionsNote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: PAPER_TEXT.muted,
    marginTop: 4,
  },
});
