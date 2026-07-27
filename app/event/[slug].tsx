// app/event/[slug].tsx
// Native event page. Thin view over useEventDossier — expo-router resolves by
// platform extension and BOTH files must exist or it throws.
//
// The body is shared with the web route (src/components/event/EventDossier);
// only the scroll container differs, because web must scroll the document.
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/colors';
import { EventDossier } from '../../src/components/event/EventDossier';
import { useEventDossier } from '../../src/hooks/useEventDossier';

export default function EventPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { dossier, loading, notFound, windowLabel, windowDays } = useEventDossier(slug);

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: dossier?.event.headline ?? 'Event' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
        {/* Bleed the ink stage under the status bar — the page opens on ink. */}
        <View style={{ height: insets.top, backgroundColor: COLORS.deepNavy }} />
        {loading && (
          <View style={s.centre}>
            <ActivityIndicator color={COLORS.orange} />
          </View>
        )}
        {notFound && (
          // Only approved events have a page, so an unknown slug here is the
          // normal case for anything the detector hasn't had confirmed.
          <View style={s.centre}>
            <Text style={s.empty}>No page for this event yet.</Text>
          </View>
        )}
        {dossier && (
          <EventDossier
            dossier={dossier}
            windowLabel={windowLabel}
            windowDays={windowDays}
            contentWidth={width}
            onTitlePress={(id) => router.push(`/title/${encodeURIComponent(id)}`)}
            onHeroPress={(id) => router.push(`/character/${encodeURIComponent(id)}`)}
            onIssuePress={(id) => router.push(`/issue/${encodeURIComponent(id)}`)}
            onIndexPress={() => router.push('/event')}
          />
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.deepNavy },
  centre: { paddingTop: 80, alignItems: 'center' },
  empty: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: 'rgba(245,235,220,0.6)',
  },
});
