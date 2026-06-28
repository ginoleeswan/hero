import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getIssueById, type NewComic } from '../../src/lib/db/comics';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS, SURFACE } from '../../src/constants/colors';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { NotFoundView } from '../../src/components/NotFoundView';

function onSaleLabel(storeDate: string | null): string | null {
  if (!storeDate) return null;
  const d = new Date(storeDate);
  if (Number.isNaN(d.getTime())) return null;
  return `On sale ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function IssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const [issue, setIssue] = useState<NewComic | null | undefined>(undefined); // undefined = loading

  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });

  useEffect(() => {
    if (!id) {
      setIssue(null);
      return;
    }
    let active = true;
    getIssueById(id).then((i) => {
      if (active) setIssue(i);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (issue === undefined) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={COLORS.navy} />
      </View>
    );
  }

  if (issue === null) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <NotFoundView
          stamp="Missing"
          stampColor={COLORS.red}
          icon="book-outline"
          headline="Issue not found"
          subline="We don't have this issue in the archive yet."
          actions={[{ label: 'Go back', primary: true, onPress: () => router.back() }]}
        />
      </View>
    );
  }

  const title = `${issue.volumeName ?? 'Untitled'}${issue.issueNumber ? ` #${issue.issueNumber}` : ''}`;
  const meta = [onSaleLabel(issue.storeDate), issue.publisher].filter(Boolean).join('  ·  ');

  const body = (
    <View style={styles.body}>
      {issue.coverUrl ? (
        <Image source={{ uri: issue.coverUrl }} contentFit="cover" style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverFallback]} />
      )}
      <Text style={styles.kicker}>New This Week</Text>
      <Text style={styles.title}>{title}</Text>
      {!!meta && <Text style={styles.meta}>{meta}</Text>}

      {issue.characters.length > 0 && (
        <View style={styles.chars}>
          <Text style={styles.charsLabel}>Featuring</Text>
          <View style={styles.chips}>
            {issue.characters.map((c) => (
              <Pressable
                key={c.id}
                style={styles.chip}
                onPress={() => router.push(`/character/${c.id}`)}
              >
                <View style={styles.avatar}>
                  <HeroImage
                    id={c.id}
                    name={c.name}
                    imageUrl={c.image_url}
                    portraitUrl={c.portrait_url}
                    grid
                    contentFit="cover"
                    contentPosition={{ top: '20%', left: '50%' }}
                    style={StyleSheet.absoluteFill as object}
                    recyclingKey={c.id}
                  />
                </View>
                <Text style={styles.chipName} numberOfLines={1}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  if (isWeb) {
    return (
      <View style={styles.webPage}>
        <Stack.Screen options={{ headerShown: false }} />
        {body}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  webPage: { width: '100%', backgroundColor: COLORS.beige, paddingBottom: 40 },
  loading: { flex: 1, backgroundColor: COLORS.beige, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { alignItems: 'center' },
  body: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 20, gap: 8 },
  cover: {
    width: 200,
    height: 304, // ~2:3 comic cover
    borderRadius: 12,
    borderCurve: 'continuous',
    alignSelf: 'center',
    marginBottom: 14,
    backgroundColor: COLORS.navy,
  },
  coverFallback: { backgroundColor: COLORS.navy },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
    textAlign: 'center',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.navy, textAlign: 'center', lineHeight: 30 },
  meta: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: COLORS.grey, textAlign: 'center', marginTop: 2 },
  chars: { marginTop: 22 },
  charsLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  chip: { width: 64, alignItems: 'center', gap: 5 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e8ddd0',
    backgroundColor: COLORS.navy,
  },
  chipName: { fontFamily: 'FlameSans-Regular', fontSize: 11, color: COLORS.navy, textAlign: 'center' },
});
