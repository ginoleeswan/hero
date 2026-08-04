// app/event/[slug].web.tsx
// Web event page. Same hook and same body as the native route; the difference is
// the scroll container — web screens must scroll the DOCUMENT, never a vertical
// RN ScrollView, so this renders a plain View and lets the page grow.
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, INK_TEXT } from '../../src/constants/colors';
import { EventDossier } from '../../src/components/event/EventDossier';
import { useEventDossier } from '../../src/hooks/useEventDossier';

export default function EventPageWeb() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { dossier, loading, notFound, failed, retry, windowLabel, windowDays } =
    useEventDossier(slug);
  const wide = width >= 900;

  return (
    <View style={s.screen as object}>
      <View style={s.column as object}>
        {loading && <Text style={s.muted as object}>Loading…</Text>}
        {notFound && <Text style={s.muted as object}>No page for this event yet.</Text>}
        {/* A failed fetch is not a dead link — the native twin offers a retry,
            so this does too rather than leaving an empty column. */}
        {failed && (
          <View style={s.failed as object}>
            <Text style={s.muted as object}>Couldn’t load this event.</Text>
            <Pressable onPress={retry} accessibilityRole="button" style={s.retry as object}>
              <Text style={s.retryText as object}>Try again</Text>
            </Pressable>
          </View>
        )}
        {dossier && (
          <EventDossier
            dossier={dossier}
            windowLabel={windowLabel}
            windowDays={windowDays}
            wide={wide}
            contentWidth={width}
            maxContentWidth={900}
            viewportHeight={height}
            onTitlePress={(id) => router.push(`/title/${encodeURIComponent(id)}`)}
            onHeroPress={(id) => router.push(`/character/${encodeURIComponent(id)}`)}
            onIssuePress={(id) => router.push(`/issue/${encodeURIComponent(id)}`)}
            onIndexPress={() => router.push('/event')}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: COLORS.deepNavy, minHeight: '100%' } as object,
  // The web masthead is fixed, so a page that starts at 0 renders underneath it —
  // the event mark was colliding with the wordmark. 84 is the same offset the
  // house page's scrollMarginTop uses.
  column: { width: '100%', alignSelf: 'center', paddingTop: 84 } as object,
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
