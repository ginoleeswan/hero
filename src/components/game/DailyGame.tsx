// The daily "Guess the Hero" screen — a thin view over useDailyHero, rendered
// by both app/play.tsx (native) and app/play.web.tsx (web) via RNW.
//
// A dramatic dark "reveal stage" (arena language): the mystery hero is a
// spotlit holographic trading card, its art moderately blurred from the start
// so the silhouette + colours read — you're never guessing fully blind. One
// clue is free; each wrong guess pins a fresh clue "sticker" beside the card
// and sharpens the art. Tap a name from the line-up to guess. Fits one screen
// and bleeds edge-to-edge behind the floating nav, like Explore.
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  Share,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Text } from '../ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SURFACE, INK_TEXT, STAGE_INK } from '../../constants/colors';
import { useScreenChrome } from '../../hooks/useScreenChrome';
import { MysteryPortrait } from './MysteryPortrait';
import { ClueSticker } from './ClueSticker';
import { StatsSheet } from './StatsSheet';
import { NotificationOptIn } from '../notifications/NotificationOptIn';
import { useNotificationOptIn, useStreakReminderSync } from '../../hooks/useNotificationOptIn';
import { useReviewPrompt } from '../../hooks/useReviewPrompt';
import { useDailyHero } from '../../hooks/useDailyHero';

// The floating web nav is 64px tall; the dark stage bleeds up under it, so the
// screen owns its own clearance below it (matching the other content routes).
const WEB_NAV_CLEARANCE = 64;
const CARD_W = 156;
const CARD_H = 208;

// Desktop two-panel layout kicks in on wide web screens; the card grows and the
// stickers fan out with more room. Mobile web + all native keep the column.
const WIDE_BREAKPOINT = 960;
const CARD_W_WIDE = 288;
const CARD_H_WIDE = 384;

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
  Publisher: { right: '100%', marginRight: -6, top: -14 },
  Alignment: { right: '100%', marginRight: 10, top: 118 },
  'Signature power': { right: '100%', marginRight: -6, top: 248 },
  'First appeared': { left: '100%', marginLeft: -2, top: 18 },
  Origin: { left: '100%', marginLeft: 6, top: 210 },
};
/**
 * Extra overlap onto the card for a narrow screen, applied to whichever edge the
 * sticker is anchored to. Left-anchored slots use marginRight, right-anchored
 * ones marginLeft, and more negative means further over the card.
 */
function tuckIn(label: string, amount: number): object {
  const slot = STICKER_SLOTS[label] ?? STICKER_SLOTS.Publisher;
  const anchoredLeft = 'right' in (slot as Record<string, unknown>);
  const base = anchoredLeft
    ? ((slot as { marginRight?: number }).marginRight ?? 0)
    : ((slot as { marginLeft?: number }).marginLeft ?? 0);
  return anchoredLeft ? { marginRight: base - amount } : { marginLeft: base - amount };
}

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

// Desktop stage atmosphere (web-only — the wide layout is gated on web). These
// turn the empty left half into a lit theatre: a spotlight beam down onto the
// card, a warm pool at its base, a reflection on the floor and a vignette that
// frames the whole scene. Cast as object to satisfy RN's style types, matching
// the GLOW escape hatch above.
const STAGE_BEAM = {
  backgroundImage:
    'linear-gradient(180deg, rgba(245,235,220,0.26), rgba(231,115,51,0.11) 48%, rgba(231,115,51,0) 80%)',
  clipPath: 'polygon(44% 0%, 56% 0%, 100% 100%, 0% 100%)',
  filter: 'blur(8px)',
} as object;
const STAGE_POOL = {
  backgroundImage: 'radial-gradient(closest-side, rgba(231,115,51,0.5), rgba(231,115,51,0) 72%)',
  filter: 'blur(7px)',
} as object;
const STAGE_REFLECT = {
  opacity: 0.26,
  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0) 60%)',
  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0) 60%)',
  filter: 'blur(1px)',
} as object;
const STAGE_VIGNETTE = {
  backgroundImage:
    'radial-gradient(ellipse 80% 72% at 38% 46%, rgba(5,9,13,0) 0%, rgba(5,9,13,0) 48%, rgba(5,9,13,0.6) 100%)',
} as object;

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

  // Notifications. The offer is raised at the one moment that earns it — a
  // daily just won, with a streak on screen — and the reminder is kept in step
  // with play state on every change so it is cancelled as eagerly as it is set.
  const optIn = useNotificationOptIn();
  useStreakReminderSync({ streak: streak.current, playedToday: finished });
  useEffect(() => {
    if (won) void optIn.considerAfterWin(streak.current);
  }, [won, streak.current, optIn]);

  // The rating ask rides the same win, but a streak of five rather than one, so
  // it lands days after the notification prompt. `blocked` covers the overlap
  // anyway: two modal asks stacked on one screen reads as an app that wants
  // things rather than one that gives them.
  const review = useReviewPrompt();
  useEffect(() => {
    if (won) void review.considerAfterStreak(streak.current, optIn.offering);
  }, [won, streak.current, optIn.offering, review]);
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

  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWide = isWeb && width >= WIDE_BREAKPOINT;

  const topPad = (isWeb ? WEB_NAV_CLEARANCE : insets.top) + 14;

  // The glow and the clue stickers both bleed outward from a centred 156px
  // card. That's the whole look — but decorative bleed must not widen the
  // document, and on a 320px phone both ran past the viewport edge.
  //
  // The glow simply shrinks to whatever fits. The stickers can't shrink without
  // losing a publisher logo, so instead they tuck further over the card: the
  // extra overlap is exactly the amount by which they'd otherwise hang off.
  const glowSize = Math.min(340, Math.max(180, width - 24));
  const glowStyle = {
    width: glowSize,
    height: glowSize,
    marginLeft: -glowSize / 2,
    marginTop: -glowSize / 2,
    borderRadius: glowSize / 2,
  };
  // Space beside the card at this width, vs. the widest sticker (~125px).
  const sideRoom = Math.max(0, (width - CARD_W) / 2);
  const extraTuck = Math.max(0, 125 - sideRoom);

  // Web: document scroll so the dark stage bleeds under the iOS Safari toolbar
  // (the body already matches #0b1820). No-op on native.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

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
          <Ionicons name="share-outline" size={16} color="#fff" />
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
              {guessed ? <Ionicons name="close" size={15} color="rgba(245,235,220,0.5)" /> : null}
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
          <Ionicons name="flame" size={13} color={COLORS.orange} />
          <Text style={styles.streakText}>{streak.current}</Text>
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
      {/* Left — the reveal stage: a spotlight beam, a colossal ghosted puzzle
          number, the spotlit card with its clue fan, and a floor reflection. */}
      <View style={stylesWide.stage}>
        <View style={[stylesWide.beam, STAGE_BEAM]} pointerEvents="none" />

        <View style={stylesWide.cardArea}>
          <View style={[stylesWide.pool, STAGE_POOL]} pointerEvents="none" />
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

          {/* Floor reflection — a flipped, masked echo of the card. */}
          {hero ? (
            <View style={[stylesWide.reflection, STAGE_REFLECT]} pointerEvents="none">
              <View style={[styles.card, stylesWide.cardWide, stylesWide.cardFlip]}>
                <MysteryPortrait
                  id={hero.id}
                  name={hero.name}
                  imageUrl={hero.imageUrl}
                  portraitUrl={hero.portraitUrl}
                  blur={blur}
                />
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {/* Right — the dossier, kept quiet and disciplined. */}
      <View style={stylesWide.right}>
        {dossierBlock}
        {!finished ? pipsRow : resultBlock}
        {!finished ? (
          <View style={stylesWide.lineup}>{lineupGrid(stylesWide.optionWide)}</View>
        ) : null}
      </View>
    </View>
  );

  // Single-column stage — the spotlit card flanked by clue stickers, case file
  // beneath, line-up in a thumb-reach footer.
  const narrowBody = (
    <>
      <View style={styles.stage}>
        <View style={styles.cardWrap}>
          <View style={[styles.glow, GLOW, glowStyle]} pointerEvents="none" />
          {renderCard()}
          {clues.map((c) => (
            <View
              key={c.label}
              style={
                [
                  styles.slot,
                  STICKER_SLOTS[c.label] ?? STICKER_SLOTS.Publisher,
                  extraTuck > 0 ? tuckIn(c.label, extraTuck) : null,
                ] as object
              }
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
        colors={[...STAGE_INK]}
        locations={[0, 0.55, 1]}
        style={styles.bg}
        pointerEvents="none"
      />
      {isWide ? (
        // Desktop: a fixed, full-height frame — the stage fits the viewport and
        // never scrolls.
        <View style={[styles.scroll, stylesWide.frame, { height, paddingTop: topPad }]}>
          <View style={stylesWide.shell}>
            {headerRow}
            {showError ? loadingOrError : wideBody}
          </View>
        </View>
      ) : isWeb ? (
        // Mobile web: document scroll (no inner ScrollView) so the stage bleeds
        // under the iOS Safari toolbar — matches the rest of the web app.
        <View style={[styles.scroll, { paddingTop: topPad, paddingBottom: 20 }]}>
          {headerRow}
          {showError ? loadingOrError : narrowBody}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topPad, paddingBottom: insets.bottom + 20 },
          ]}
        >
          {headerRow}
          {showError ? loadingOrError : narrowBody}
        </ScrollView>
      )}

      {/* Cinematic vignette over the wide stage — frames the scene, clicks pass
          through. */}
      {isWide ? (
        <View style={[StyleSheet.absoluteFill, STAGE_VIGNETTE]} pointerEvents="none" />
      ) : null}

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

      <NotificationOptIn
        visible={optIn.offering}
        streak={streak.current}
        onAllow={() => void optIn.allow()}
        onDismiss={() => void optIn.dismiss()}
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
    flexDirection: 'row',
    gap: 3,
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
  cardName: { fontFamily: 'Flame-Regular', fontSize: 21, color: COLORS.beige, lineHeight: 26 },
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
    color: INK_TEXT.faint,
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
    color: INK_TEXT.faint,
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
    color: INK_TEXT.faint,
    textAlign: 'center',
    marginTop: 14,
  },
});

// Desktop two-panel layout. Only used when isWide; the constituent pieces reuse
// the shared `styles` above for everything that doesn't change between layouts.
const stylesWide = StyleSheet.create({
  frame: { overflow: 'hidden', paddingHorizontal: 0 },
  shell: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 32,
  },
  panels: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    paddingVertical: 24,
  },

  // Left — the lit stage. Full-height, relative so the beam, ghost number and
  // reflection can be positioned around the centred card.
  stage: {
    flexBasis: '54%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    position: 'relative',
  },
  beam: {
    position: 'absolute',
    top: -24,
    left: '50%',
    width: 560,
    height: 620,
    marginLeft: -280,
    zIndex: 0,
  },
  // The card and its satellites share a fixed-size box, dead-centre of the stage.
  cardArea: {
    width: CARD_W_WIDE,
    height: CARD_H_WIDE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  cardWrapWide: {
    width: CARD_W_WIDE,
    height: CARD_H_WIDE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWide: { width: CARD_W_WIDE, height: CARD_H_WIDE },
  glowWide: { width: 560, height: 560, marginLeft: -280, marginTop: -280, borderRadius: 280 },
  pool: {
    position: 'absolute',
    bottom: -54,
    left: '50%',
    width: 460,
    height: 150,
    marginLeft: -230,
    zIndex: 0,
  },
  reflection: {
    position: 'absolute',
    top: '100%',
    marginTop: 6,
    width: CARD_W_WIDE,
    height: CARD_H_WIDE,
  },
  cardFlip: {
    borderWidth: 0,
    transform: [{ scaleY: -1 }],
  },

  // Right — the dossier. Quiet by design; the stage carries the drama.
  right: { flexBasis: '46%', maxWidth: 470, justifyContent: 'center' },
  lineup: { marginTop: 22 },
  optionWide: { flexBasis: '31%' },
});
