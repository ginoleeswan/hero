// app/event/[slug]/[edition].tsx
// One frozen edition — /event/d23/2026. Native; the .web twin must exist or
// expo-router throws on resolution.
//
// Renders EventDossier rather than a page of its own, because an edition IS the
// dossier in the past tense: same masthead, same curve, same sections. The only
// differences live in the data — `ongoing` is false, and the surge list comes
// from the frozen snapshot instead of the live rolling one. A separate component
// would be a near-identical twin destined to drift.
//
// Why this URL exists at all: watched_events is overwritten every 30 minutes, so
// /event/d23 can only ever mean "D23, currently". Nothing can rank for "d23 2026"
// on a URL whose content silently becomes 2027 next August.
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../src/constants/colors';
import { EventDossier } from '../../../src/components/event/EventDossier';
import { useEventEdition } from '../../../src/hooks/useEventEditions';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { EventDossierSkeleton } from '../../../src/components/skeletons/EventSkeleton';
import { FadeOutSkeleton } from '../../../src/components/ui/FadeOutSkeleton';
import { useSkeletonTransition } from '../../../src/hooks/useSkeletonTransition';
import { ShareHeaderButton } from '../../../src/components/ui/ShareHeaderButton';
import { shareLink } from '../../../src/lib/share';

const headerOptions = {
  headerShown: true,
  headerTitle: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerTintColor: COLORS.beige,
  headerBackButtonDisplayMode: 'minimal',
} as const;

export default function EventEditionPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { slug, edition } = useLocalSearchParams<{ slug: string; edition: string }>();
  const { dossier, loading, notFound, failed, retry, windowLabel, windowDays } = useEventEdition(
    slug,
    edition,
  );
  const phase = useSkeletonTransition(loading);

  const title = dossier ? `${dossier.event.headline} ${edition}` : 'Event';

  return (
    <View style={s.screen}>
      <Stack.Screen
        options={{
          ...headerOptions,
          title,
          headerRight: dossier
            ? () => (
                <ShareHeaderButton
                  // Past tense, always: an archived edition is never "on now",
                  // and eventShareLine's live phrasing would be a false claim.
                  message={`${dossier.event.headline} ${edition} on Mythique`}
                  url={`${shareLink.event(slug)}/${encodeURIComponent(edition)}`}
                  label="Share this edition"
                />
              )
            : undefined,
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
        <View style={{ height: insets.top, backgroundColor: COLORS.deepNavy }} />
        {loading && phase === 'skeleton' && <EventDossierSkeleton />}
        {notFound && (
          <EmptyState
            icon="calendar-outline"
            title="No record of that edition."
            body="Editions are frozen as they happen, so years before Mythique started watching have none."
            action={{ label: 'All editions', onPress: () => router.push(`/event/${slug}`) }}
          />
        )}
        {failed && (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn’t load this edition"
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
              // Back to the series, not the global index: from an edition the
              // useful neighbours are the other years of the same event.
              onArenaPress={(a, b) =>
                router.push(`/compare/${encodeURIComponent(a)}/${encodeURIComponent(b)}`)
              }
              onIndexPress={() => router.push(`/event/${encodeURIComponent(slug)}`)}
            />
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
