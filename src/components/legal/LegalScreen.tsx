// Shared renderer for the static legal documents (Privacy / Terms). Used by the
// native + web route files so the two platforms read identically (RNW). A plain
// scrollable beige document with a back button.
import { View, Text, Pressable, ScrollView, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SURFACE } from '../../constants/colors';
import { useScreenChrome } from '../../hooks/useScreenChrome';
import type { LegalDoc } from '../../lib/legal';

// The floating web nav is 64px tall; this beige page clears it itself.
const WEB_NAV_CLEARANCE = 64;

export function LegalScreen({ doc }: { doc: LegalDoc }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const topPad = (isWeb ? WEB_NAV_CLEARANCE : insets.top) + 12;

  // Top edge is deep-navy (matching every other page) so the iOS Safari
  // status-bar strip and the web nav read dark — never a beige status bar that
  // blends into the system UI. The canvas stays beige: the body content is
  // unchanged and scrolling to the bottom shows beige, never a dark peek-through.
  // Web-only (document scroll also lets the page bleed under the iOS Safari
  // toolbar); no-op on native.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });

  const content = (
    <>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={10}
        style={styles.backBtn}
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={22} color={COLORS.navy} />
      </Pressable>

      <Text style={styles.title}>{doc.title}</Text>
      <Text style={styles.updated}>Last updated {doc.updated}</Text>
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
        <View style={[styles.scroll, { paddingTop: topPad, paddingBottom: 48 }]}>{content}</View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: insets.bottom + 48 },
        ]}
      >
        {content}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { paddingHorizontal: 20, maxWidth: 720, width: '100%', alignSelf: 'center' },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(41,60,67,0.06)',
    marginBottom: 16,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 32, color: COLORS.navy, lineHeight: 36 },
  updated: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.grey,
    marginTop: 6,
    marginBottom: 16,
  },
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
