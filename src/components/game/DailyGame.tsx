// The daily "Guess the Hero" screen — a thin view over useDailyHero, rendered
// by both app/play.tsx (native) and app/play.web.tsx (web) via RNW.
//
// A dramatic dark "reveal stage" (arena language): the mystery hero is a
// spotlit holographic trading card, its art moderately blurred from the start
// so the silhouette + colours read — you're never guessing fully blind. One
// clue is free; each wrong guess pins a fresh clue "sticker" beside the card
// and sharpens the art. Tap a name from the line-up to guess. Fits one screen
// and bleeds edge-to-edge behind the floating nav, like Explore.
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
import { ClueSticker } from './ClueSticker';
import { StatsSheet } from './StatsSheet';
import { useDailyHero } from '../../hooks/useDailyHero';

// The floating web nav is 64px tall; the dark stage bleeds up under it, so the
// screen owns its own clearance below it (matching the other content routes).
const WEB_NAV_CLEARANCE = 64;
const CARD_W = 156;
const CARD_H = 208;

// Warm spotlight behind the card — a real radial on web, a soft disc on native.
const GLOW = Platform.select({
  web: {
    backgroundImage: 'radial-gradient(closest-side, rgba(231,115,51,0.32), rgba(231,115,51,0) 72%)',
  },
  default: { backgroundColor: 'rgba(231,115,51,0.12)' },
}) as object;

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
    dossier,
    streak,
    stats,
    percentile,
    finished,
    shareText,
    submitGuess,
  } = useDailyHero();

  const [copied, setCopied] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

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

  // Clues alternate sides so they flank the card like pinned evidence.
  const leftClues = clues.filter((_, i) => i % 2 === 0);
  const rightClues = clues.filter((_, i) => i % 2 === 1);
  const topPad = (Platform.OS === 'web' ? WEB_NAV_CLEARANCE : insets.top) + 14;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#16323d', '#0d2029', '#0b1820']}
        locations={[0, 0.55, 1]}
        style={styles.bg}
        pointerEvents="none"
      />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: insets.bottom + 20 },
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
            <Ionicons name="chevron-back" size={22} color={COLORS.beige} />
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
            {/* Stage — the spotlit card flanked by clue stickers */}
            <View style={styles.stage}>
              <View style={[styles.glow, GLOW]} pointerEvents="none" />
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
                  {/* holographic sheen — same trick as the arena cards */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.18)', 'transparent', 'rgba(206,155,51,0.20)']}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.fill}
                    pointerEvents="none"
                  />
                  {finished ? (
                    <LinearGradient
                      colors={['transparent', 'rgba(8,12,20,0.94)']}
                      locations={[0.45, 1]}
                      style={styles.fill}
                      pointerEvents="none"
                    >
                      <View style={styles.cardFooter}>
                        <Text style={styles.cardName} numberOfLines={1}>
                          {hero.name}
                        </Text>
                        <Text style={styles.cardLink}>View profile →</Text>
                      </View>
                    </LinearGradient>
                  ) : null}
                </Pressable>

                <View style={styles.colRight}>
                  {rightClues.map((c, i) => (
                    <ClueSticker key={c.label} clue={c} tilt={i * 2 + 1} />
                  ))}
                </View>
              </View>

              {/* Persistent "case file" anchor clue */}
              {dossier ? (
                <View style={styles.dossier}>
                  <View style={styles.dossierTab}>
                    <Ionicons name="document-text-outline" size={11} color="rgba(206,155,51,0.9)" />
                    <Text style={styles.dossierKicker}>Case file</Text>
                  </View>
                  <Text style={styles.dossierText}>{dossier}</Text>
                </View>
              ) : null}

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
                  <Text style={styles.resultTitle}>{won ? 'Solved it!' : 'Out of guesses'}</Text>
                  <Text style={styles.resultSub}>
                    {won
                      ? `${hero.name} — in ${guesses.length} ${
                          guesses.length === 1 ? 'guess' : 'guesses'
                        }.`
                      : `It was ${hero.name}.`}
                  </Text>
                  {percentile != null ? (
                    <Text style={styles.percentile}>
                      You beat <Text style={styles.percentileNum}>{percentile}%</Text> of players
                      today.
                    </Text>
                  ) : null}
                  <View style={styles.resultBtns}>
                    <Pressable onPress={() => setStatsOpen(true)} style={styles.statsBtn}>
                      <Ionicons name="stats-chart" size={16} color={COLORS.beige} />
                      <Text style={styles.statsLabel}>Stats</Text>
                    </Pressable>
                    <Pressable onPress={onShare} style={styles.shareBtn}>
                      <Ionicons name="share-social-outline" size={16} color="#fff" />
                      <Text style={styles.shareLabel}>{copied ? 'Copied!' : 'Share'}</Text>
                    </Pressable>
                  </View>
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
                          style={({ pressed }) => [
                            styles.option,
                            pressed && styles.optionPressed,
                            guessed && styles.optionEliminated,
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[styles.optionText, guessed && styles.optionTextEliminated]}
                          >
                            {o.name}
                          </Text>
                          {guessed ? (
                            <Ionicons name="close" size={15} color="rgba(245,235,220,0.5)" />
                          ) : null}
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

      <StatsSheet
        visible={statsOpen}
        onClose={() => setStatsOpen(false)}
        stats={stats}
        streak={streak}
        maxGuesses={maxGuesses}
        todayGuess={won ? guesses.length : null}
        percentile={percentile}
        copied={copied}
        onShare={onShare}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches the web document body (#0b1820) so the bleed behind the nav + the
  // home indicator reads as one continuous surface — no seam at the bottom.
  container: { flex: 1, backgroundColor: '#0b1820' },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.12)',
  },
  headerMid: { flex: 1, alignItems: 'center' },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  puzzleNo: { fontFamily: 'Flame-Regular', fontSize: 17, color: COLORS.beige, marginTop: 1 },
  streakPill: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 11,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,115,51,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.32)',
  },
  streakText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.orange },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.beige,
    textAlign: 'center',
    marginTop: 40,
  },

  // Stage takes the slack so the card sits optically centred above the footer.
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  glow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 340,
    height: 340,
    marginLeft: -170,
    marginTop: -170,
    borderRadius: 170,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  colLeft: { marginRight: -20, gap: 10, alignItems: 'flex-end', zIndex: 3 },
  colRight: { marginLeft: -20, gap: 10, alignItems: 'flex-start', zIndex: 3 },

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
    shadowOpacity: 0.6,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  cardDone: { borderColor: COLORS.goldAccent },
  cardWon: { borderColor: COLORS.green },
  cardFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12 },
  cardName: { fontFamily: 'Flame-Regular', fontSize: 21, color: COLORS.beige, lineHeight: 24 },
  cardLink: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange, marginTop: 1 },

  dossier: {
    width: '100%',
    maxWidth: 380,
    marginTop: 20,
    backgroundColor: 'rgba(245,235,220,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.1)',
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dossierTab: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  dossierKicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: 'rgba(206,155,51,0.9)',
  },
  dossierText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13.5,
    lineHeight: 19,
    color: 'rgba(245,235,220,0.84)',
  },
  pips: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 },
  pip: { width: 11, height: 11, borderRadius: 6, backgroundColor: 'rgba(245,235,220,0.18)' },
  pipActive: { backgroundColor: COLORS.orange },
  pipMiss: { backgroundColor: COLORS.red },
  pipWon: { backgroundColor: COLORS.green },

  footer: { marginTop: 10 },
  lineupHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  lineupTitle: { fontFamily: 'Flame-Regular', fontSize: 21, color: COLORS.beige },
  remaining: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: 'rgba(245,235,220,0.06)',
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.16)',
  },
  optionPressed: { backgroundColor: 'rgba(231,115,51,0.18)', borderColor: COLORS.orange },
  optionEliminated: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(245,235,220,0.07)',
  },
  optionText: { flexShrink: 1, fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.beige },
  optionTextEliminated: {
    color: 'rgba(245,235,220,0.4)',
    textDecorationLine: 'line-through',
  },

  resultTitle: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.beige },
  resultSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.7)',
    marginTop: 2,
  },
  percentile: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.7)',
    marginTop: 8,
  },
  percentileNum: { fontFamily: 'Nunito_700Bold', color: COLORS.orange },
  resultBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.16)',
    paddingVertical: 14,
  },
  statsLabel: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.beige },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.orange,
    borderRadius: 999,
    paddingVertical: 14,
  },
  shareLabel: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },
  tomorrow: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.5)',
    textAlign: 'center',
    marginTop: 14,
  },
});
