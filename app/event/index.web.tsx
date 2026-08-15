// app/event/index.web.tsx
// Web index. Same hook and body as the native route; the difference is the
// scroll container — web screens must scroll the DOCUMENT, never a vertical RN
// ScrollView.
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../src/constants/colors';
import { EventIndexList } from '../../src/components/event/EventIndexList';
import { EventIndexSkeleton } from '../../src/components/skeletons/EventSkeleton';
import { PageEndCap } from '../../src/components/web/PageEndCap';
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
        {/* A skeleton, not the word "Loading". Every native event route has had
            one; the web routes — the ones actually being looked at — rendered a
            grey string on an empty page. */}
        {loading && !index && <EventIndexSkeleton />}
        {index && (
          <EventIndexList
            index={index}
            wide={wide}
            contentWidth={width}
            maxContentWidth={1180}
            topPad={14}
            viewportHeight={height}
            onEventPress={(slug) => router.push(`/event/${encodeURIComponent(slug)}`)}
          />
        )}
      </View>
      {!!index && <PageEndCap />}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: COLORS.deepNavy, minHeight: '100%' } as object,
  // Exactly the fixed masthead's height (TOPBAR_HEIGHT). The stage supplies
  // the breathing gap via `topPad`; 84 here plus the stage's own 28-44 left
  // ~120pt of dead ink above every event page's first word.
  column: { width: '100%', alignSelf: 'center', paddingTop: 64 } as object,
  muted: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: 'rgba(245,235,220,0.6)',
    padding: 32,
  } as object,
});
