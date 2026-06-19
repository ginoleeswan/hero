// The daily "Guess the Hero" screen — a thin view over useDailyHero, rendered
// by both app/play.tsx (native) and app/play.web.tsx (web) via RNW. A mystery
// portrait starts blurred and sharpens with each wrong guess; a fresh clue is
// uncovered every miss. Solve it (or run out) to reveal the hero, your streak,
// and a shareable result.
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { MysteryPortrait } from './MysteryPortrait';
import { useDailyHero } from '../../hooks/useDailyHero';
import { useHeroSearch } from '../../hooks/useHeroSearch';

export function DailyGame() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    status,
    puzzleNumber,
    hero,
    guesses,
    maxGuesses,
    remaining,
    blur,
    clues,
    streak,
    finished,
    answer,
    error,
    shareText,
    submitGuess,
  } = useDailyHero();

  const [query, setQuery] = useState('');
  const { results } = useHeroSearch(query, 'All', 12);
  const [copied, setCopied] = useState(false);

  const won = status === 'won';
  const guessedIds = new Set(guesses.map((g) => g.id));

  const pick = useCallback(
    (id: string, name: string) => {
      setQuery('');
      submitGuess(id, name);
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
  // Lightweight frosted veil so the reveal reads even where blur is subtle.
  const veil = Math.min(blur / 80, 0.46);

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
          <Text style={styles.kicker}>
            Daily Challenge{puzzleNumber ? ` · #${puzzleNumber}` : ''}
          </Text>
          {streak.current > 0 ? (
            <View style={styles.streakPill}>
              <Text style={styles.streakText}>🔥 {streak.current}</Text>
            </View>
          ) : (
            <View style={styles.backBtn} />
          )}
        </View>

        {status === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.orange} />
          </View>
        ) : status === 'error' || !hero ? (
          <Text style={styles.error}>
            Couldn&#39;t load today&#39;s puzzle. Please try again later.
          </Text>
        ) : (
          <>
            {/* Mystery portrait */}
            <Pressable
              disabled={!finished}
              onPress={() =>
                finished &&
                router.push({
                  pathname: '/character/[id]',
                  params: {
                    id: hero.id,
                    imageUri: hero.portraitUrl ?? hero.imageUrl ?? undefined,
                  },
                })
              }
              style={styles.portrait}
            >
              <MysteryPortrait
                id={hero.id}
                name={hero.name}
                imageUrl={hero.imageUrl}
                portraitUrl={hero.portraitUrl}
                blur={blur}
              />
              {veil > 0 ? (
                <View
                  pointerEvents="none"
                  style={[styles.veil, { backgroundColor: `rgba(41,60,67,${veil})` }]}
                />
              ) : null}
              {!finished ? (
                <View pointerEvents="none" style={styles.mysteryBadge}>
                  <Ionicons name="help" size={28} color="rgba(245,235,220,0.85)" />
                </View>
              ) : (
                <LinearGradient
                  colors={['transparent', 'rgba(20,30,34,0.9)']}
                  style={styles.portraitFooter}
                  pointerEvents="none"
                >
                  <Text style={styles.portraitName} numberOfLines={1}>
                    {hero.name}
                  </Text>
                  <Text style={styles.portraitLink}>View profile →</Text>
                </LinearGradient>
              )}
            </Pressable>

            {/* Guess pips */}
            <View style={styles.pips}>
              {Array.from({ length: maxGuesses }).map((_, i) => {
                const g = guesses[i];
                const active = !finished && i === guesses.length;
                return (
                  <View
                    key={i}
                    style={[
                      styles.pip,
                      g?.correct && styles.pipWon,
                      g && !g.correct && styles.pipMiss,
                      active && styles.pipActive,
                    ]}
                  />
                );
              })}
            </View>

            {/* Result banner */}
            {finished ? (
              <View style={[styles.banner, won ? styles.bannerWon : styles.bannerLost]}>
                <Text style={styles.bannerTitle}>{won ? 'Solved it!' : 'Out of guesses'}</Text>
                <Text style={styles.bannerSub}>
                  {won
                    ? `It's ${hero.name} — in ${guesses.length} ${
                        guesses.length === 1 ? 'guess' : 'guesses'
                      }.`
                    : `It was ${hero.name}.`}
                </Text>
              </View>
            ) : null}

            {/* Share */}
            {finished ? (
              <Pressable onPress={onShare} style={styles.shareBtn}>
                <Ionicons name="share-social-outline" size={16} color="#fff" />
                <Text style={styles.shareLabel}>{copied ? 'Copied!' : 'Share result'}</Text>
              </Pressable>
            ) : null}

            {/* Guess input */}
            {!finished ? (
              <View style={styles.searchWrap}>
                <Text style={styles.remaining}>
                  {remaining} {remaining === 1 ? 'guess' : 'guesses'} left
                </Text>
                <View style={styles.inputRow}>
                  <Ionicons name="search" size={18} color={COLORS.grey} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Name the hero…"
                    placeholderTextColor={COLORS.grey}
                    style={styles.input}
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                </View>
                {query.trim().length >= 2 && suggestions.length > 0 ? (
                  <View style={styles.suggestions}>
                    {suggestions.map((r) => (
                      <Pressable
                        key={r.id}
                        style={styles.suggestion}
                        onPress={() => pick(r.id, r.name)}
                      >
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

            {/* Clues — one uncovered per miss */}
            <View style={styles.clues}>
              <Text style={styles.cluesHeading}>Clues</Text>
              {clues.length === 0 ? (
                <Text style={styles.cluesEmpty}>Each wrong guess reveals a clue.</Text>
              ) : (
                clues.map((c) => (
                  <View key={c.label} style={styles.clueRow}>
                    <Text style={styles.clueLabel}>{c.label}</Text>
                    <Text style={styles.clueValue}>{c.value}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Wrong guesses */}
            {guesses.some((g) => !g.correct) ? (
              <View style={styles.wrongList}>
                {guesses
                  .filter((g) => !g.correct)
                  .map((g) => (
                    <View key={g.id} style={styles.wrong}>
                      <Ionicons name="close" size={14} color={COLORS.red} />
                      <Text style={styles.wrongName} numberOfLines={1}>
                        {g.name}
                      </Text>
                    </View>
                  ))}
              </View>
            ) : null}

            {finished ? <Text style={styles.tomorrow}>A new hero drops tomorrow.</Text> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const PORTRAIT_RADIUS = 20;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(41,60,67,0.06)',
  },
  kicker: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  streakPill: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,115,51,0.12)',
  },
  streakText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.orange },
  center: { paddingVertical: 64, alignItems: 'center' },
  error: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.red, marginTop: 16 },

  portrait: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    aspectRatio: 4 / 5,
    borderRadius: PORTRAIT_RADIUS,
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
    marginTop: 14,
  },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  mysteryBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,30,34,0.45)',
  },
  portraitFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 14,
  },
  portraitName: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.beige, lineHeight: 30 },
  portraitLink: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.orange, marginTop: 2 },

  pips: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 18,
  },
  pip: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(41,60,67,0.12)',
  },
  pipActive: { backgroundColor: 'rgba(231,115,51,0.4)' },
  pipMiss: { backgroundColor: COLORS.red },
  pipWon: { backgroundColor: COLORS.green },

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
  shareLabel: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },

  searchWrap: { marginBottom: 18, zIndex: 5 },
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

  clues: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cluesHeading: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginBottom: 8,
  },
  cluesEmpty: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.grey },
  clueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(41,60,67,0.08)',
  },
  clueLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.grey,
  },
  clueValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: 'Flame-Regular',
    fontSize: 17,
    color: COLORS.navy,
  },

  wrongList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  wrong: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(217,75,61,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  wrongName: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy, maxWidth: 160 },

  tomorrow: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textAlign: 'center',
    marginTop: 18,
  },
});
