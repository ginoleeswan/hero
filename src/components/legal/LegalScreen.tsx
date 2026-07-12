// Shared renderer for the static legal documents (Privacy / Terms). Used by the
// native + web route files so the two platforms read identically (RNW). A dark
// stage header (back + title) landing on a scrollable beige document body.
import { View, Text, ScrollView, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SURFACE } from '../../constants/colors';
import { useScreenChrome } from '../../hooks/useScreenChrome';
import { StageHeader } from '../StageHeader';
import type { LegalDoc } from '../../lib/legal';

export function LegalScreen({ doc }: { doc: LegalDoc }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';

  // Ink canvas: iOS Safari tints its status-bar zone from the document
  // background, so the canvas must be dark for the top chrome to fuse with the
  // stage header. The beige body is painted by this screen's own container.
  // Web-only (document scroll also lets the page bleed under the iOS Safari
  // toolbar); no-op on native.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

  const header = (
    <StageHeader
      title={doc.title}
      subtitle={`Last updated ${doc.updated}`}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );

  const content = (
    <>
      <Text style={styles.intro}>{doc.intro}</Text>

      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          {section.body.map((para, i) => (
            <Text key={i} style={styles.para}>
              {para}
            </Text>
          ))}
        </View>
      ))}
    </>
  );

  // Web uses the document scroll set up in `app/_layout.web.tsx`; an inner
  // ScrollView would bound the page to 100dvh and break the bleed-under.
  if (isWeb) {
    return (
      <View style={styles.container}>
        {header}
        <View style={[styles.scroll, styles.bodyPad]}>{content}</View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
        {header}
        <View style={[styles.scroll, styles.bodyPad]}>{content}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Web: the painted root must GROW with the document-scrolled content (flex:1
  // clamps to the viewport inside fixed-height parents, cutting the beige off
  // and exposing the ink canvas). Native keeps flex:1 to bound the ScrollView.
  container: {
    backgroundColor: COLORS.beige,
    ...Platform.select({ web: { minHeight: '100dvh' } as object, default: { flex: 1 } }),
  } as object,
  scroll: { paddingHorizontal: 20, maxWidth: 720, width: '100%', alignSelf: 'center' },
  bodyPad: { paddingTop: 26, paddingBottom: 48 } as object,
  intro: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(41,60,67,0.85)',
  },
  section: { marginTop: 26 },
  heading: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.navy, marginBottom: 8 },
  para: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14.5,
    lineHeight: 22,
    color: 'rgba(41,60,67,0.82)',
    marginBottom: 10,
  },
});
