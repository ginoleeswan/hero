// app/event/[slug]/index.web.tsx
// Web event page. Same hooks and same bodies as the native route; the difference
// is the scroll container — web screens must scroll the DOCUMENT, never a vertical
// RN ScrollView, so this renders a plain View and lets the page grow.
//
// One route, two tenses — see the native twin for why the live dossier keeps this
// URL while the event is on, and the hub takes it over afterwards.
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '../../../src/components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, INK_TEXT, SURFACE, PAPER_TEXT } from '../../../src/constants/colors';
import { EventDossier } from '../../../src/components/event/EventDossier';
import { EventHub, EditionList } from '../../../src/components/event/EventHub';
import { useEventDossier } from '../../../src/hooks/useEventDossier';
import { useEventHub } from '../../../src/hooks/useEventEditions';
import { EventHubSkeleton } from '../../../src/components/skeletons/EventSkeleton';
import { PageEndCap } from '../../../src/components/web/PageEndCap';

export default function EventPageWeb() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { hub, loading: hubLoading } = useEventHub(slug);
  const { dossier, loading, notFound, failed, retry, windowLabel, windowDays } =
    useEventDossier(slug);
  const wide = width >= 900;

  const live = !!hub?.isLive && !!dossier;
  const accent = hub?.accent ?? dossier?.event.accent ?? COLORS.goldAccent;
  const goEdition = (edition: string) =>
    router.push(`/event/${encodeURIComponent(slug)}/${encodeURIComponent(edition)}`);

  return (
    <View style={s.screen as object}>
      <View style={s.column as object}>
        {/* The hub shape: liveness is unknown until the hub resolves, and 19 of
            20 events are not live. */}
        {(loading || hubLoading) && !hub && !dossier && <EventHubSkeleton />}
        {notFound && !hub && <Text style={s.muted as object}>No page for this event yet.</Text>}
        {/* A failed fetch is not a dead link — the native twin offers a retry,
            so this does too rather than leaving an empty column. */}
        {failed && !hub && !dossier && (
          <View style={s.failed as object}>
            <Text style={s.muted as object}>Couldn’t load this event.</Text>
            <Pressable onPress={retry} accessibilityRole="button" style={s.retry as object}>
              <Text style={s.retryText as object}>Try again</Text>
            </Pressable>
          </View>
        )}

        {live && dossier ? (
          <View>
            <EventDossier
              dossier={dossier}
              windowLabel={windowLabel}
              windowDays={windowDays}
              wide={wide}
              contentWidth={width}
              maxContentWidth={900}
              topPad={14}
              viewportHeight={height}
              onTitlePress={(id) => router.push(`/title/${encodeURIComponent(id)}`)}
              onHeroPress={(id) => router.push(`/character/${encodeURIComponent(id)}`)}
              onArenaPress={(a, b) =>
                router.push(`/compare/${encodeURIComponent(a)}/${encodeURIComponent(b)}`)
              }
              onIndexPress={() => router.push('/event')}
            />
            {!!hub && hub.editions.length > 0 && (
              <View style={s.editionsBlock as object}>
                <View style={s.editionsInner as object}>
                  <Text style={s.editionsTitle as object}>Editions</Text>
                  <Text style={s.editionsNote as object}>Every year of this event on record.</Text>
                  <EditionList
                    editions={hub.editions}
                    accent={accent}
                    bestSpike={hub.bestSpike}
                    onEditionPress={goEdition}
                  />
                </View>
              </View>
            )}
          </View>
        ) : hub ? (
          <EventHub
            hub={hub}
            wide={wide}
            contentWidth={width}
            maxContentWidth={900}
            topPad={14}
            viewportHeight={height}
            onEditionPress={goEdition}
            onIndexPress={() => router.push('/event')}
          />
        ) : null}
      </View>
      {/* Closes the beige sheet onto the app's ink floor. Without it the page
          ended on raw beige, which in an iOS Safari tab puts a hard beige→navy
          cut right under the toolbar — the exact case PageEndCap documents. */}
      {(hub || dossier) && <PageEndCap />}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: COLORS.deepNavy, minHeight: '100%' } as object,
  // The web masthead is fixed, so a page that starts at 0 renders underneath it.
  // 84 is the same offset the house page's scrollMarginTop uses.
  // Exactly the fixed masthead's height (TOPBAR_HEIGHT). The stage supplies
  // the breathing gap via `topPad`; 84 here plus the stage's own 28-44 left
  // ~120pt of dead ink above every event page's first word.
  column: { width: '100%', alignSelf: 'center', paddingTop: 64 } as object,
  failed: { alignItems: 'flex-start' },
  retry: {
    marginLeft: 32,
    marginBottom: 32,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.orange,
    cursor: 'pointer',
  } as object,
  retryText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
  muted: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: INK_TEXT.faint,
    padding: 32,
  } as object,
  editionsBlock: { backgroundColor: SURFACE.paper, paddingTop: 8, paddingBottom: 52 } as object,
  editionsInner: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: 32,
  } as object,
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
