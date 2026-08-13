// app/event/index.web.tsx
// Web index. Same hook and body as the native route; the difference is the
// scroll container — web screens must scroll the DOCUMENT, never a vertical RN
// ScrollView.
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '../../src/components/ui/Text';
import { useRouter } from 'expo-router';
import { COLORS } from '../../src/constants/colors';
import { EventIndexList } from '../../src/components/event/EventIndexList';
import { useEventIndex } from '../../src/hooks/useEventDossier';

export default function EventIndexPageWeb() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { index, loading } = useEventIndex();
  const wide = width >= 900;

  return (
    <View style={s.screen as object}>
      {/* The web masthead is fixed, so a page starting at 0 renders underneath it. */}
      <View style={s.column as object}>
        {loading && !index && <Text style={s.muted as object}>Loading…</Text>}
        {index && (
          <EventIndexList
            index={index}
            wide={wide}
            contentWidth={width}
            maxContentWidth={900}
            viewportHeight={height}
            onEventPress={(slug) => router.push(`/event/${encodeURIComponent(slug)}`)}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: COLORS.deepNavy, minHeight: '100%' } as object,
  column: { width: '100%', alignSelf: 'center', paddingTop: 84 } as object,
  muted: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: 'rgba(245,235,220,0.6)',
    padding: 32,
  } as object,
});
