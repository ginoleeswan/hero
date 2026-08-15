// app/event/[slug]/index.web.tsx
// The series hub on web — /event/d23. Same hook and body as the native route;
// the difference is the scroll container, because web screens must scroll the
// DOCUMENT rather than a vertical RN ScrollView.
//
// ONE URL, ONE MEANING. This route used to be two pages: the live dossier while
// the detector called the event on, and the hub once it was over. That put the
// current edition's content at two addresses at the same time — here and at
// /event/d23/2026, which exists and is refrozen every 30 minutes while the show
// runs — and then silently changed what the URL meant when the event ended.
// A reader landing here mid-event was reading 2026 with a link to 2026 in the
// archive below it, and a search engine was ranking a page whose subject
// changed without the URL doing so.
//
// The hub is now permanent: what this event is, and every edition of it. The
// live one is the first entry and says so, and the stage carries a route
// straight into it.
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '../../../src/components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, INK_TEXT } from '../../../src/constants/colors';
import { EventHub } from '../../../src/components/event/EventHub';
import { useEventHub } from '../../../src/hooks/useEventEditions';
import { EventHubSkeleton } from '../../../src/components/skeletons/EventSkeleton';
import { PageEndCap } from '../../../src/components/web/PageEndCap';

export default function EventPageWeb() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { hub, loading, notFound, failed, retry } = useEventHub(slug);
  const wide = width >= 900;

  const goEdition = (edition: string) =>
    router.push(`/event/${encodeURIComponent(slug)}/${encodeURIComponent(edition)}`);

  return (
    <View style={s.screen as object}>
      <View style={s.column as object}>
        {loading && !hub && <EventHubSkeleton />}
        {notFound && <Text style={s.muted as object}>No page for this event yet.</Text>}
        {/* A failed fetch is not a dead link — the native twin offers a retry,
            so this does too rather than leaving an empty column. */}
        {failed && !hub && (
          <View style={s.failed as object}>
            <Text style={s.muted as object}>Couldn’t load this event.</Text>
            <Pressable onPress={retry} accessibilityRole="button" style={s.retry as object}>
              <Text style={s.retryText as object}>Try again</Text>
            </Pressable>
          </View>
        )}

        {hub && (
          <EventHub
            hub={hub}
            wide={wide}
            contentWidth={width}
            maxContentWidth={1180}
            topPad={14}
            viewportHeight={height}
            onEditionPress={goEdition}
            onIndexPress={() => router.push('/event')}
          />
        )}
      </View>
      {/* Closes the beige sheet onto the app's ink floor. Without it the page
          ended on raw beige, which in an iOS Safari tab puts a hard beige→navy
          cut right under the toolbar — the exact case PageEndCap documents. */}
      {!!hub && <PageEndCap />}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: COLORS.deepNavy, minHeight: '100%' } as object,
  // Exactly the fixed masthead's height (TOPBAR_HEIGHT). The stage supplies the
  // breathing gap via `topPad`; 84 here plus the stage's own 28-44 left ~120pt
  // of dead ink above every event page's first word.
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
});
