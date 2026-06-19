// The daily "Guess the Hero" screen — a thin view over useDailyHero, rendered
// by both app/play.tsx (native) and app/play.web.tsx (web) via RNW. Search to
// guess; each guess reveals a comparison grid; solve it (or run out) to reveal
// the hero, your streak, and a shareable result.
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Share,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { GuessRow } from './GuessRow';
import { useDailyHero } from '../../hooks/useDailyHero';
import { useHeroSearch } from '../../hooks/useHeroSearch';

export function DailyGame() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    status,
    puzzleNumber,
    guesses,
    maxGuesses,
    remaining,
    streak,
    answer,
    submitting,
    error,
    shareText,
    submitGuess,
  } = useDailyHero();

  const [query, setQuery] = useState('');
  const { results } = useHeroSearch(query, 'All', 12);
  const [copied, setCopied] = useState(false);

  const finished = status === 'won' || status === 'lost';
  const guessedIds = new Set(guesses.map((g) => g.id));

  const pick = useCallback(
    (id: string) => {
      setQuery('');
      submitGuess(id);
    },
    [submitGuess],
  );

  const onShare = useCallback(async () => {
    if (!shareText) return;
    if (Platform.OS === 'web') {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(shareText);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }
      } catch {
        /* clipboard unavailable */
      }
    } else {
      try {
        await Share.share({ message: shareText });
      } catch {
        /* user dismissed */
      }
    }
  }, [shareText]);

  const suggestions = results.filter((r) => !guessedIds.has(r.id)).slice(0, 8);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 48,
          paddingHorizontal: 18,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={10}
            style={styles.backBtn}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.navy} />
          </Pressable>
          {streak.current > 0 ? (
            <View style={styles.streakPill}>
              <Text style={styles.streakText}>🔥 {streak.current}</Text>
            </View>
          ) : null}
        </View>

        {/* Title */}
        <Text style={styles.kicker}>
          Daily Challenge{puzzleNumber ? ` · #${puzzleNumber}` : ''}
        </Text>
        <Text style={styles.title}>Guess the Hero</Text>
        <Text style={styles.subtitle}>
          Find the mystery hero in {maxGuesses} guesses. Each guess shows how close you are —
          publisher, alignment, debut year, power and more.
        </Text>

        {status === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.orange} />
          </View>
        ) : status === 'error' ? (
          <Text style={styles.error}>
            Couldn&#39;t load today&#39;s puzzle. Please try again later.
          </Text>
        ) : (
          <>
            {/* Result banner */}
            {finished ? (
              <View
                style={[styles.banner, status === 'won' ? styles.bannerWon : styles.bannerLost]}
              >
                <Text style={styles.bannerTitle}>
                  {status === 'won' ? 'Solved it!' : 'Out of guesses'}
                </Text>
                <Text style={styles.bannerSub}>
                  {status === 'won'
                    ? `In ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}.`
                    : 'Better luck tomorrow.'}
                </Text>
              </View>
            ) : null}

            {/* Answer reveal */}
            {finished && answer ? (
              <Pressable
                style={styles.answer}
                onPress={() =>
                  router.push({
                    pathname: '/character/[id]',
                    params: {
                      id: answer.id,
                      imageUri: answer.portraitUrl ?? answer.imageUrl ?? undefined,
                    },
                  })
                }
              >
                <View style={styles.answerThumb}>
                  <HeroImage
                    id={answer.id}
                    name={answer.name}
                    imageUrl={answer.imageUrl}
                    portraitUrl={answer.portraitUrl}
                    contentFit="cover"
                    contentPosition="top"
                    style={StyleSheet.absoluteFill}
                    recyclingKey={answer.id}
                  />
                </View>
                <View style={styles.answerText}>
                  <Text style={styles.answerLabel}>Today&#39;s hero</Text>
                  <Text style={styles.answerName} numberOfLines={1}>
                    {answer.name}
                  </Text>
                  <Text style={styles.answerLink}>View profile →</Text>
                </View>
              </Pressable>
            ) : null}

            {/* Share */}
            {finished ? (
              <Pressable onPress={onShare} style={styles.shareBtn}>
                <Ionicons name="share-social-outline" size={16} color="#fff" />
                <Text style={styles.shareText}>{copied ? 'Copied!' : 'Share result'}</Text>
              </Pressable>
            ) : null}

            {/* Guess input */}
            {!finished ? (
              <View style={styles.searchWrap}>
                <Text style={styles.remaining}>
                  Guess {Math.min(guesses.length + 1, maxGuesses)} of {maxGuesses}
                  {remaining <= 2 ? ` · ${remaining} left` : ''}
                </Text>
                <View style={styles.inputRow}>
                  <Ionicons name="search" size={18} color={COLORS.grey} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Type a hero's name…"
                    placeholderTextColor={COLORS.grey}
                    style={styles.input}
                    autoCorrect={false}
                    editable={!submitting}
                    returnKeyType="search"
                  />
                  {submitting ? <ActivityIndicator size="small" color={COLORS.orange} /> : null}
                </View>
                {query.trim().length >= 2 && suggestions.length > 0 ? (
                  <View style={styles.suggestions}>
                    {suggestions.map((r) => (
                      <Pressable key={r.id} style={styles.suggestion} onPress={() => pick(r.id)}>
                        <View style={styles.sThumb}>
                          <HeroImage
                            id={r.id}
                            name={r.name}
                            imageUrl={r.image_url}
                            portraitUrl={r.portrait_url}
                            grid
                            contentFit="cover"
                            contentPosition="top"
                            style={StyleSheet.absoluteFill}
                            recyclingKey={r.id}
                          />
                        </View>
                        <Text style={styles.sName} numberOfLines={1}>
                          {r.name}
                        </Text>
                        {r.publisher ? (
                          <Text style={styles.sPublisher} numberOfLines={1}>
                            {r.publisher}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {!!error && <Text style={styles.error}>{error}</Text>}
              </View>
            ) : null}

            {/* Guess history (newest last) */}
            <View style={styles.guessList}>
              {guesses.map((g, i) => (
                <GuessRow key={`${g.id}-${i}`} clue={g} />
              ))}
            </View>

            {finished ? <Text style={styles.tomorrow}>A new hero drops tomorrow.</Text> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(41,60,67,0.06)',
  },
  streakPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(231,115,51,0.12)',
  },
  streakText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.orange },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginTop: 10,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 34, color: COLORS.navy, lineHeight: 38 },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(41,60,67,0.7)',
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 18,
    maxWidth: 560,
  },
  center: { paddingVertical: 48, alignItems: 'center' },
  error: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.red, marginTop: 10 },

  banner: { borderRadius: 14, padding: 16, marginBottom: 14 },
  bannerWon: { backgroundColor: 'rgba(99,169,54,0.16)' },
  bannerLost: { backgroundColor: 'rgba(41,60,67,0.08)' },
  bannerTitle: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.navy },
  bannerSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(41,60,67,0.7)',
    marginTop: 2,
  },

  answer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  answerThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
  },
  answerText: { flex: 1 },
  answerLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.6)',
  },
  answerName: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige, lineHeight: 26 },
  answerLink: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.orange, marginTop: 2 },

  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.orange,
    borderRadius: 999,
    paddingVertical: 13,
    marginBottom: 18,
  },
  shareText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },

  searchWrap: { marginBottom: 16, zIndex: 5 },
  remaining: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.grey,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.black },
  suggestions: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.1)',
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(41,60,67,0.08)',
  },
  sThumb: {
    width: 30,
    height: 30,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
  },
  sName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.navy },
  sPublisher: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },

  guessList: { gap: 10 },
  tomorrow: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textAlign: 'center',
    marginTop: 18,
  },
});
