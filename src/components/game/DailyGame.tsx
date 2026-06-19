// The daily "Guess the Hero" screen — a thin view over useDailyHero, rendered
// by both app/play.tsx (native) and app/play.web.tsx (web) via RNW.
//
// Design language borrows from the arena (holographic trading card, gold
// accents, deep navy) and the character pages. The mystery hero is a small
// blurred card; each wrong guess pins a clue "sticker" beside it and sharpens
// the art. Tap a name from the line-up to guess. The whole thing fits one
// screen — no scrolling in the common case.
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
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
import { MysteryPortrait } from './MysteryPortrait';
import { useDailyHero } from '../../hooks/useDailyHero';
import type { Clue } from '../../lib/game/reveal';

const CARD_W = 152;
const CARD_H = 204;
const STICKER_W = 90;

// A clue pinned beside the card, each stuck on at a slightly different angle.
const TILTS = [
  { transform: [{ rotate: '-5deg' }] },
  { transform: [{ rotate: '4deg' }] },
  { transform: [{ rotate: '-3deg' }] },
  { transform: [{ rotate: '5deg' }] },
  { transform: [{ rotate: '-4deg' }] },
];

function ClueSticker({ clue, tilt }: { clue: Clue; tilt: number }) {
  return (
    <View style={[styles.sticker, TILTS[tilt % TILTS.length]]}>
      <View style={styles.stickerPin} />
      <Text style={styles.stickerLabel} numberOfLines={1}>
        {clue.label}
      </Text>
      <Text style={styles.stickerValue} numberOfLines={1}>
        {clue.value}
      </Text>
    </View>
  );
}

export function DailyGame() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    status,
    puzzleNumber,
    hero,
    options,
    guesses,
    maxGuesses,
    remaining,
    blur,
    clues,
    streak,
    finished,
    shareText,
    submitGuess,
  } = useDailyHero();

  const [copied, setCopied] = useState(false);

  const won = status === 'won';
  const guessedIds = new Set(guesses.map((g) => g.id));

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

  // Lightweight frosted veil so the reveal reads even where blur is subtle.
  const veil = Math.min(blur / 80, 0.46);
  // Clues alternate sides so they flank the card like pinned evidence.
  const leftClues = clues.filter((_, i) => i % 2 === 0);
  const rightClues = clues.filter((_, i) => i % 2 === 1);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={10}
            style={styles.iconBtn}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.navy} />
          </Pressable>
          <View style={styles.headerMid}>
            <Text style={styles.kicker}>Daily Challenge</Text>
            {puzzleNumber ? <Text style={styles.puzzleNo}>No. {puzzleNumber}</Text> : null}
          </View>
          {streak.current > 0 ? (
            <View style={styles.streakPill}>
              <Text style={styles.streakText}>🔥 {streak.current}</Text>
            </View>
          ) : (
            <View style={styles.iconBtn} />
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
            {/* Stage — the card flanked by clue stickers, on a soft pedestal */}
            <View style={styles.stage}>
              <View style={styles.cardRow}>
                <View style={styles.colLeft}>
                  {leftClues.map((c, i) => (
                    <ClueSticker key={c.label} clue={c} tilt={i * 2} />
                  ))}
                </View>

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
                  style={[styles.card, finished && (won ? styles.cardWon : styles.cardDone)]}
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
                      style={[styles.veil, { backgroundColor: `rgba(11,24,32,${veil})` }]}
                    />
                  ) : null}
                  {/* holographic sheen — same trick as the arena cards */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.16)', 'transparent', 'rgba(206,155,51,0.18)']}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.veil}
                    pointerEvents="none"
                  />
                  {!finished ? (
                    <View pointerEvents="none" style={styles.seal}>
                      <Text style={styles.sealMark}>?</Text>
                    </View>
                  ) : (
                    <LinearGradient
                      colors={['transparent', 'rgba(8,12,20,0.94)']}
                      locations={[0.45, 1]}
                      style={styles.veil}
                      pointerEvents="none"
                    >
                      <View style={styles.cardFooter}>
                        <Text style={styles.cardName} numberOfLines={1}>
                          {hero.name}
                        </Text>
                        <Text style={styles.cardLink}>View profile →</Text>
                      </View>
                    </LinearGradient>
                  )}
                </Pressable>

                <View style={styles.colRight}>
                  {rightClues.map((c, i) => (
                    <ClueSticker key={c.label} clue={c} tilt={i * 2 + 1} />
                  ))}
                </View>
              </View>

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
            </View>

            {/* Footer — line-up while playing, result + share once finished */}
            <View style={styles.footer}>
              {finished ? (
                <>
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
                  <Pressable onPress={onShare} style={styles.shareBtn}>
                    <Ionicons name="share-social-outline" size={16} color="#fff" />
                    <Text style={styles.shareLabel}>{copied ? 'Copied!' : 'Share result'}</Text>
                  </Pressable>
                  <Text style={styles.tomorrow}>A new hero drops tomorrow.</Text>
                </>
              ) : (
                <>
                  <View style={styles.lineupHead}>
                    <Text style={styles.lineupTitle}>Who is it?</Text>
                    <Text style={styles.remaining}>
                      {remaining} {remaining === 1 ? 'guess' : 'guesses'} left
                    </Text>
                  </View>
                  <View style={styles.grid}>
                    {options.map((o) => {
                      const guessed = guessedIds.has(o.id);
                      return (
                        <Pressable
                          key={o.id}
                          disabled={guessed}
                          onPress={() => submitGuess(o.id, o.name)}
                          style={[styles.option, guessed && styles.optionEliminated]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[styles.optionText, guessed && styles.optionTextEliminated]}
                          >
                            {o.name}
                          </Text>
                          {guessed ? <Ionicons name="close" size={15} color={COLORS.red} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flexGrow: 1, paddingHorizontal: 18 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(41,60,67,0.06)',
  },
  headerMid: { flex: 1, alignItems: 'center' },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  puzzleNo: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.navy, marginTop: 1 },
  streakPill: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 11,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,115,51,0.12)',
  },
  streakText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.orange },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.red, marginTop: 16 },

  // Stage takes the slack so the card sits optically centred above the footer.
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  colLeft: {
    width: STICKER_W,
    marginRight: -14,
    gap: 12,
    alignItems: 'flex-end',
    zIndex: 3,
  },
  colRight: {
    width: STICKER_W,
    marginLeft: -14,
    gap: 12,
    alignItems: 'flex-start',
    zIndex: 3,
  },

  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
    borderWidth: 1.5,
    borderColor: 'rgba(206,155,51,0.55)',
    zIndex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  cardDone: { borderColor: COLORS.goldAccent },
  cardWon: { borderColor: COLORS.green },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  seal: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 56,
    height: 56,
    marginLeft: -28,
    marginTop: -28,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,24,32,0.5)',
    borderWidth: 1.5,
    borderColor: 'rgba(206,155,51,0.7)',
  },
  sealMark: { fontFamily: 'Flame-Regular', fontSize: 30, color: COLORS.goldAccent },
  cardFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12 },
  cardName: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.beige, lineHeight: 23 },
  cardLink: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange, marginTop: 1 },

  sticker: {
    width: STICKER_W,
    backgroundColor: '#fffdf8',
    borderRadius: 11,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 3,
  },
  stickerPin: {
    position: 'absolute',
    top: -4,
    alignSelf: 'center',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.orange,
    opacity: 0.9,
  },
  stickerLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  stickerValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.navy,
    lineHeight: 17,
    marginTop: 1,
  },

  pips: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20 },
  pip: { width: 11, height: 11, borderRadius: 6, backgroundColor: 'rgba(41,60,67,0.14)' },
  pipActive: { backgroundColor: 'rgba(231,115,51,0.45)' },
  pipMiss: { backgroundColor: COLORS.red },
  pipWon: { backgroundColor: COLORS.green },

  footer: { marginTop: 8 },
  lineupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  lineupTitle: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.navy },
  remaining: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.1)',
  },
  optionEliminated: { backgroundColor: 'transparent', borderColor: 'rgba(41,60,67,0.08)' },
  optionText: { flexShrink: 1, fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.navy },
  optionTextEliminated: { color: COLORS.grey, textDecorationLine: 'line-through' },

  banner: { borderRadius: 14, borderCurve: 'continuous', padding: 14, marginBottom: 12 },
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
  },
  shareLabel: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },
  tomorrow: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textAlign: 'center',
    marginTop: 12,
  },
});
