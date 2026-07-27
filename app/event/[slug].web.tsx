// app/event/[slug].web.tsx
// Web event page. Same hook and same body as the native route; the difference is
// the scroll container — web screens must scroll the DOCUMENT, never a vertical
// RN ScrollView, so this renders a plain View and lets the page grow.
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../../src/constants/colors';
import { EventDossier } from '../../src/components/event/EventDossier';
import { useEventDossier } from '../../src/hooks/useEventDossier';

export default function EventPageWeb() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { dossier, loading, notFound, windowLabel, windowDays } = useEventDossier(slug);
  const wide = width >= 900;

  return (
    <View style={s.screen as object}>
      <View style={s.column as object}>
        {loading && <Text style={s.muted as object}>Loading…</Text>}
        {notFound && <Text style={s.muted as object}>No page for this event yet.</Text>}
        {dossier && (
          <EventDossier
            dossier={dossier}
            windowLabel={windowLabel}
            windowDays={windowDays}
            wide={wide}
            contentWidth={width}
            maxContentWidth={900}
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
  muted: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: 'rgba(245,235,220,0.6)',
    padding: 32,
  } as object,
});
