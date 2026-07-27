// app/event/index.tsx
// Native index of every event with a page. Thin view over useEventIndex —
// expo-router resolves by platform extension and BOTH files must exist.
//
// Exists because the dossier page had exactly one route in: the live card in the
// Pulse rail, which disappears when the detection grace lapses. The pages are
// permanent; their only link was not.
import { View, StyleSheet, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/colors';
import { EventIndexList } from '../../src/components/event/EventIndexList';
import { useEventIndex } from '../../src/hooks/useEventDossier';

export default function EventIndexPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { index, loading } = useEventIndex();

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: 'Events' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
        {/* Bleed the ink stage under the status bar — the page opens on ink. */}
        <View style={{ height: insets.top, backgroundColor: COLORS.deepNavy }} />
        {loading && !index && (
          <View style={s.centre}>
            <ActivityIndicator color={COLORS.orange} />
          </View>
        )}
        {index && (
          <EventIndexList
            index={index}
            contentWidth={width}
            onEventPress={(slug) => router.push(`/event/${encodeURIComponent(slug)}`)}
          />
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.deepNavy },
  centre: { paddingTop: 80, alignItems: 'center' },
});
