import { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import RenderHTML, { type MixedStyleDeclaration } from 'react-native-render-html';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../src/components/ui/SkeletonProvider';
import { getHeroById, getHeroByComicvineId } from '../../src/lib/db/heroes';
import { heroImageSource } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';
import type { Tables } from '../../src/types/database.generated';

type HeroRow = Tables<'heroes'>;

// ComicVine biography HTML ships with lazy-load placeholders and <noscript>
// fallbacks that render as broken/blank images. Swap the real source in and
// strip the cruft so images actually paint on native.
function preprocessHtml(html: string): string {
  return html
    .replace(/<noscript>[\s\S]*?<\/noscript>/gi, '')
    .replace(/\ssrc="data:image\/gif;base64,[^"]*"/gi, '')
    .replace(/\sdata-src="/gi, ' src="')
    .replace(/\sdata-srcset="/gi, ' srcset="')
    .replace(/\ssizes="[^"]*"/gi, '');
}

const ORANGE_FAINT = 'rgba(231,115,51,0.3)';
const ORANGE_RULE = 'rgba(231,115,51,0.45)';

const BASE_STYLE: MixedStyleDeclaration = {
  fontFamily: 'FlameSans-Regular',
  fontSize: 15,
  color: COLORS.navy,
  lineHeight: 26,
};

// Editorial typography ported from the web biography: orange-underlined h2s,
// orange left-border h3s, styled blockquotes, lists, rules and images.
const TAG_STYLES: Record<string, MixedStyleDeclaration> = {
  p: { marginTop: 0, marginBottom: 14 },
  h2: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    fontWeight: 'normal',
    color: COLORS.navy,
    marginTop: 32,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: ORANGE_FAINT,
  },
  h3: {
    fontFamily: 'Flame-Regular',
    fontSize: 17,
    fontWeight: 'normal',
    color: COLORS.navy,
    marginTop: 22,
    marginBottom: 6,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: ORANGE_RULE,
  },
  h4: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.navy,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 4,
  },
  a: { color: COLORS.orange, textDecorationLine: 'none' },
  b: { fontFamily: 'Flame-Regular' },
  strong: { fontFamily: 'Flame-Regular' },
  em: { fontStyle: 'italic' },
  ul: { marginTop: 0, marginBottom: 14, paddingLeft: 6 },
  ol: { marginTop: 0, marginBottom: 14, paddingLeft: 6 },
  li: { marginBottom: 5 },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.orange,
    backgroundColor: 'rgba(231,115,51,0.06)',
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginVertical: 18,
    fontStyle: 'italic',
  },
  hr: {
    height: 1,
    backgroundColor: 'rgba(41,60,67,0.12)',
    marginVertical: 26,
  },
  figure: { marginVertical: 14, marginHorizontal: 0 },
  img: { borderRadius: 8, marginVertical: 16 },
  figcaption: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.navy,
    opacity: 0.55,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 16,
  },
};

const SYSTEM_FONTS = ['FlameSans-Regular', 'Flame-Regular'];
// Tables render as unstyled stacked text on native — skip them.
const IGNORED_TAGS = ['table', 'thead', 'tbody', 'tr', 'td', 'th'];

export default function BiographyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [hero, setHero] = useState<HeroRow | null>(null);

  useEffect(() => {
    if (!id) return;
    getHeroById(id)
      .then(setHero)
      .catch(() => {});
  }, [id]);

  const html = useMemo(
    () => (hero?.description ? preprocessHtml(hero.description) : null),
    [hero?.description],
  );

  const heroImage = id ? heroImageSource(String(id), hero?.image_url, hero?.portrait_url) : null;
  const contentWidth = width - 40;

  // Intercept ComicVine character links (/slug/4005-{cvId}/) → resolve to a hero
  // in our DB and navigate in-app; everything else opens in the browser.
  const renderersProps = useMemo(
    () => ({
      a: {
        onPress: (_e: unknown, href: string) => {
          const match = href.match(/\/slug\/4005-(\d+)\//);
          if (match) {
            getHeroByComicvineId(match[1])
              .then((found) => {
                if (found) router.push(`/character/${found.id}`);
                else Linking.openURL(`https://comicvine.gamespot.com${href}`);
              })
              .catch(() => {});
            return;
          }
          if (href.startsWith('/slug/')) {
            Linking.openURL(`https://comicvine.gamespot.com${href}`);
          } else if (href.startsWith('http')) {
            Linking.openURL(href);
          }
        },
      },
    }),
    [router],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          // Chevron only — hides the previous route name ("character/[id]").
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: 'transparent' },
          // Orange reads on both the navy banner (top) and the beige body (scrolled).
          headerTintColor: COLORS.orange,
          headerTitle: '',
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Navy header banner — full-bleed behind the transparent nav + status bar */}
        <View style={[styles.banner, { paddingTop: insets.top + 52 }]}>
          {heroImage ? (
            <Image
              source={heroImage}
              style={styles.portrait}
              contentFit="cover"
              contentPosition="top"
              cachePolicy="memory-disk"
              recyclingKey={id}
              transition={200}
            />
          ) : (
            <View style={[styles.portrait, styles.portraitFallback]} />
          )}
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>Biography</Text>
            {hero ? (
              <Text style={styles.heroName} numberOfLines={3}>
                {hero.name}
              </Text>
            ) : (
              <SkeletonProvider>
                <Skeleton width="80%" height={26} borderRadius={6} style={{ marginVertical: 4 }} />
              </SkeletonProvider>
            )}
            {hero?.summary ? (
              <Text style={styles.deck} numberOfLines={4}>
                {hero.summary}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {hero ? (
            html ? (
              <RenderHTML
                contentWidth={contentWidth}
                source={{ html }}
                baseStyle={BASE_STYLE}
                tagsStyles={TAG_STYLES}
                systemFonts={SYSTEM_FONTS}
                ignoredDomTags={IGNORED_TAGS}
                renderersProps={renderersProps}
                enableExperimentalMarginCollapsing
              />
            ) : (
              <Text style={styles.empty}>No biography available for this character yet.</Text>
            )
          ) : (
            <SkeletonProvider>
              <Skeleton width="100%" height={13} borderRadius={4} style={{ marginBottom: 10 }} />
              <Skeleton width="95%" height={13} borderRadius={4} style={{ marginBottom: 10 }} />
              <Skeleton width="88%" height={13} borderRadius={4} style={{ marginBottom: 10 }} />
              <Skeleton width="92%" height={13} borderRadius={4} style={{ marginBottom: 28 }} />
              <Skeleton width="38%" height={20} borderRadius={5} style={{ marginBottom: 16 }} />
              <Skeleton width="100%" height={13} borderRadius={4} style={{ marginBottom: 10 }} />
              <Skeleton width="90%" height={13} borderRadius={4} style={{ marginBottom: 10 }} />
              <Skeleton width="75%" height={13} borderRadius={4} style={{ marginBottom: 28 }} />
              <Skeleton width="100%" height={200} borderRadius={10} style={{ marginBottom: 24 }} />
              <Skeleton width="96%" height={13} borderRadius={4} style={{ marginBottom: 10 }} />
              <Skeleton width="84%" height={13} borderRadius={4} />
            </SkeletonProvider>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flex: 1 },

  // Navy header banner: portrait + title, runs full-bleed behind the
  // transparent nav bar + status bar (hence the inset-aware top padding).
  banner: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  portrait: {
    width: 86,
    height: 115,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(245,235,220,0.08)',
  },
  portraitFallback: { opacity: 0.5 },
  titleBlock: { flex: 1, justifyContent: 'flex-end' },
  eyebrow: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.beige,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  heroName: {
    fontFamily: 'Flame-Regular',
    fontSize: 28,
    lineHeight: 32,
    color: COLORS.beige,
  },
  deck: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.beige,
    opacity: 0.6,
    marginTop: 8,
  },

  // Body
  body: { paddingHorizontal: 20, paddingTop: 24 },
  empty: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.navy,
    opacity: 0.45,
  },
});
