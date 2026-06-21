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
  useWindowDimensions,
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

// Desktop two-panel layout kicks in on wide web screens; the card grows and the
// stickers fan out with more room. Mobile web + all native keep the column.
const WIDE_BREAKPOINT = 960;
const CARD_W_WIDE = 240;
const CARD_H_WIDE = 320;

// Fixed slot per clue category, anchored to the card's left/right edge (with a
// little tuck-in via negative margins). Absolute, so each sticker peels into its
// own spot and never reflows the others; staggered tuck-in lets them overlap a
// touch for character.
const STICKER_SLOTS: Record<string, object> = {
  Publisher: { right: '100%', marginRight: -18, top: -6 },
  Alignment: { right: '100%', marginRight: -2, top: 58 },
  'Signature power': { right: '100%', marginRight: -18, top: 116 },
  'First appeared': { left: '100%', marginLeft: -14, top: 6 },
  Origin: { left: '100%', marginLeft: -6, top: 98 },
};
// Desktop variant — same five keys, retuned so the fan sits clear of the bigger
// card with more spread.
const STICKER_SLOTS_WIDE: Record<string, object> = {
  Publisher: { right: '100%', marginRight: -10, top: -10 },
  Alignment: { right: '100%', marginRight: 6, top: 96 },
  'Signature power': { right: '100%', marginRight: -10, top: 196 },
  'First appeared': { left: '100%', marginLeft: -6, top: 14 },
  Origin: { left: '100%', marginLeft: 2, top: 168 },
};
const STICKER_TILT: Record<string, number> = {
  Publisher: 0,
  'First appeared': 1,
  Alignment: 2,
  Origin: 3,
  'Signature power': 4,
};

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

  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= WIDE_BREAKPOINT;

  const topPad = (Platform.OS === 'web' ? WEB_NAV_CLEARANCE : insets.top) + 14;

  // The case file sits under the card while playing, and moves down next to the
  // result once finished (where the space opens up).
  const dossierBlock = dossier ? (
    <View style={styles.dossier}>
      <View style={styles.dossierTab}>
        <Ionicons name="document-text-outline" size={11} color="rgba(206,155,51,0.9)" />
        <Text style={styles.dossierKicker}>Case file</Text>
      </View>
      <Text style={styles.dossierText}>{dossier}</Text>
    </View>
  ) : null;

  // --- Shared render helpers (used by both the mobile column and the desktop
  // two-panel layout) so the card, pips, result and line-up aren't duplicated.

  const renderCard = (cardStyle?: object) =>
    hero ? (
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
        style={[styles.card, cardStyle, finished && (won ? styles.cardWon : styles.cardDone)]}
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
    ) : null;

  const pipsRow = (
    <View style={styles.pips}>
      {Array.from({ length: maxGuesses }).map((_, i) => {
        const g = guesses[i];
        const active = i === guesses.length;
        return (
          <View
            key={i}
            style={[styles.pip, g && !g.correct && styles.pipMiss, active && styles.pipActive]}
          />
        );
      })}
    </View>
  );

  const resultBlock = hero ? (
    <View style={styles.result}>
      <Text style={styles.resultTitle}>{won ? 'Solved it!' : 'Out of guesses'}</Text>
      <Text style={styles.resultSub}>
        {won
          ? `${hero.name} — in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}.`
          : `It was ${hero.name}.`}
      </Text>
      {percentile != null ? (
        <Text style={styles.percentile}>
          You beat <Text style={styles.percentileNum}>{percentile}%</Text> of players today.
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
    </View>
  ) : null;

  const lineupGrid = (optionExtraStyle?: object) => (
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
                optionExtraStyle,
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
  );

  const headerRow = (
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
  );

  const loadingOrError =
    status === 'loading' ? (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.orange} />
      </View>
    ) : (
      <Text style={styles.error}>
        Couldn&#39;t load today&#39;s puzzle. Please try again later.
      </Text>
    );

  const showError = status === 'loading' || status === 'error' || !hero;

  // Desktop: two panels — a scaled card theatre on the left, gameplay on the
  // right — inside a centred shell. Mobile web + native fall through to the
  // single-column stage below.
  const wideBody = (
    <View style={stylesWide.panels}>
      <View style={stylesWide.left}>
        <View style={stylesWide.cardWrapWide}>
          <View style={[styles.glow, stylesWide.glowWide, GLOW]} pointerEvents="none" />
          {renderCard(stylesWide.cardWide)}
          {clues.map((c) => (
            <View
              key={c.label}
              style={[styles.slot, STICKER_SLOTS_WIDE[c.label] ?? STICKER_SLOTS_WIDE.Publisher]}
              pointerEvents="none"
            >
              <ClueSticker clue={c} tilt={STICKER_TILT[c.label] ?? 0} />
            </View>
          ))}
        </View>
      </View>

      <View style={stylesWide.right}>
        {dossierBlock}
        {!finished ? pipsRow : resultBlock}
        {!finished ? <View style={stylesWide.lineup}>{lineupGrid(stylesWide.optionWide)}</View> : null}
      </View>
    </View>
  );

  // Single-column stage — the spotlit card flanked by clue stickers, case file
  // beneath, line-up in a thumb-reach footer.
  const narrowBody = (
    <>
      <View style={styles.stage}>
        <View style={styles.cardWrap}>
          <View style={[styles.glow, GLOW]} pointerEvents="none" />
          {renderCard()}
          {clues.map((c) => (
            <View
              key={c.label}
              style={[styles.slot, STICKER_SLOTS[c.label] ?? STICKER_SLOTS.Publisher]}
              pointerEvents="none"
            >
              <ClueSticker clue={c} tilt={STICKER_TILT[c.label] ?? 0} />
            </View>
          ))}
        </View>

        {dossierBlock}
        {!finished ? pipsRow : resultBlock}
      </View>

      {!finished ? <View style={styles.footer}>{lineupGrid()}</View> : null}
    </>
  );

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
          isWide && stylesWide.scroll,
          { paddingTop: topPad, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View style={isWide ? stylesWide.shell : undefined}>
          {headerRow}
          {showError ? loadingOrError : isWide ? wideBody : narrowBody}
        </View>
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
  // Top-down flow with consistent spacing (no flex centring) so the card and
  // case file hold the same position whether you're playing or finished.
  stage: { flexGrow: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 18 },
  result: { width: '100%', maxWidth: 380, alignItems: 'stretch', marginTop: 4 },
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
  // Fixed-size box: the card is always dead-centre of the stage. Sticker slots
  // are positioned relative to it (absolute) so they can't move it.
  cardWrap: { width: CARD_W, height: CARD_H, alignItems: 'center', justifyContent: 'center' },
  slot: { position: 'absolute', zIndex: 3 },

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
    marginBottom: 16,
    zIndex: 5,
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

// Desktop two-panel layout. Only used when isWide; the constituent pieces reuse
// the shared `styles` above for everything that doesn't change between layouts.
const stylesWide = StyleSheet.create({
  scroll: { paddingHorizontal: 0 },
  shell: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    paddingHorizontal: 32,
  },
  panels: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
    paddingVertical: 24,
  },
  left: { flexBasis: '46%', alignItems: 'center', justifyContent: 'center' },
  right: { flexBasis: '54%', maxWidth: 480, justifyContent: 'center' },
  cardWrapWide: {
    width: CARD_W_WIDE,
    height: CARD_H_WIDE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWide: { width: CARD_W_WIDE, height: CARD_H_WIDE },
  glowWide: { width: 480, height: 480, marginLeft: -240, marginTop: -240, borderRadius: 240 },
  lineup: { marginTop: 22 },
  optionWide: { flexBasis: '31%' },
});
