// app/event/[slug]/[edition].web.tsx
// One frozen edition on web — /event/d23/2026. Same hook and body as the native
// twin; the difference is the scroll container, because web screens must scroll
// the DOCUMENT rather than a vertical RN ScrollView.
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '../../../src/components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, INK_TEXT } from '../../../src/constants/colors';
import { EventDossier } from '../../../src/components/event/EventDossier';
import { useEventEdition } from '../../../src/hooks/useEventEditions';
import { EventDossierSkeleton } from '../../../src/components/skeletons/EventSkeleton';
import { PageEndCap } from '../../../src/components/web/PageEndCap';

export default function EventEditionPageWeb() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { slug, edition } = useLocalSearchParams<{ slug: string; edition: string }>();
  const { dossier, loading, notFound, failed, retry, windowLabel, windowDays } = useEventEdition(
    slug,
    edition,
  );
  const wide = width >= 900;

  return (
    <View style={s.screen as object}>
      <View style={s.column as object}>
        {loading && <EventDossierSkeleton />}
        {notFound && (
          <View style={s.failed as object}>
            <Text style={s.muted as object}>No record of that edition.</Text>
            <Pressable
              onPress={() => router.push(`/event/${encodeURIComponent(slug)}`)}
              accessibilityRole="button"
              style={s.retry as object}
            >
              <Text style={s.retryText as object}>All editions</Text>
            </Pressable>
          </View>
        )}
        {failed && (
          <View style={s.failed as object}>
            <Text style={s.muted as object}>Couldn’t load this edition.</Text>
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
            maxContentWidth={1180}
            topPad={14}
            viewportHeight={height}
            onTitlePress={(id) => router.push(`/title/${encodeURIComponent(id)}`)}
            onHeroPress={(id) => router.push(`/character/${encodeURIComponent(id)}`)}
            onArenaPress={(a, b) =>
              router.push(`/compare/${encodeURIComponent(a)}/${encodeURIComponent(b)}`)
            }
            onIndexPress={() => router.push(`/event/${encodeURIComponent(slug)}`)}
          />
        )}
      </View>
      {!!dossier && <PageEndCap />}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: COLORS.deepNavy, minHeight: '100%' } as object,
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
});
