import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, EYEBROW, INK_TEXT } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
import { useSkeletonAnim, SkeletonBlock } from '../Skeleton';
import { statSplit, statLead, type MatchupSide } from '../../../lib/home/matchupVote';
import { type MatchupTally } from '../../../lib/db/matchupVotes';
import { useMatchupVote } from '../../../hooks/useMatchupVote';
import type { TodaysMatchup as Matchup } from '../../../lib/matchup';

interface TodaysMatchupProps {
  matchup: Matchup;
  onOpen: (path: string) => void;
}

// Sword-cross "Today's Battle" kicker — the same mark as the top bar's
// versus tab (the bare emoji rendered as tofu in the web font stack).
function Eyebrow() {
  return (
    <View style={m.eyebrowRow as object}>
      <MaterialCommunityIcons name="sword-cross" size={12} color={COLORS.orange} />
      <Text style={m.eyebrow as object}>Today&apos;s Battle</Text>
    </View>
  );
}

function Fighter({
  hero,
  side,
  size = PORTRAIT,
  overlap = false,
  picked,
  dimmed,
  onVote,
}: {
  hero: Matchup['heroA'];
  side: 'a' | 'b';
  size?: number;
  overlap?: boolean;
  picked: boolean;
  dimmed: boolean;
  onVote: () => void;
}) {
  return (
    <Pressable
      onPress={onVote}
      style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
        [
          m.portrait,
          { width: size, height: size },
          overlap && side === 'b' && (m.portraitB as object),
          picked && (m.portraitPicked as object),
          dimmed && (m.portraitDimmed as object),
          hovered && !picked && !dimmed && (m.portraitHover as object),
        ] as object
      }
    >
      <HeroImage
        id={hero.id}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        contentFit="cover"
        // Anchor below the top so the face is framed, not the very top of the
        // head/headroom.
        contentPosition={{ top: '26%', left: '50%' }}
        style={[StyleSheet.absoluteFill, side === 'b' && (m.faceInward as object)]}
        recyclingKey={hero.id}
      />
      {picked && (
        <View style={m.pickedTag as object}>
          <Text style={m.pickedTagText as object}>Your pick</Text>
        </View>
      )}
    </Pressable>
  );
}

// Desktop fighter: a full-bleed face owning one flank of the poster card,
// edge-to-edge and facing inward; a scrim fades it into the card body so the
// centre column reads cleanly. Tapping the face votes. The losing side (after
// reveal) dims and desaturates.
function FighterFace({
  hero,
  side,
  picked,
  dimmed,
  onVote,
}: {
  hero: Matchup['heroA'];
  side: 'a' | 'b';
  picked: boolean;
  dimmed: boolean;
  onVote: () => void;
}) {
  return (
    <Pressable
      onPress={onVote}
      accessibilityRole="button"
      accessibilityLabel={`Vote for ${hero.name}`}
      style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
        [
          m.face,
          side === 'a' ? m.faceLeft : m.faceRight,
          dimmed && (m.faceDimmed as object),
          hovered && !dimmed && (m.faceHover as object),
        ] as object
      }
    >
      <HeroImage
        id={hero.id}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        contentFit="cover"
        contentPosition={{ top: '20%', left: '50%' }}
        style={[StyleSheet.absoluteFill, side === 'b' && (m.faceInward as object)]}
        recyclingKey={hero.id}
      />
      <View style={(side === 'a' ? m.faceScrimA : m.faceScrimB) as object} />
      {picked && (
        <View style={m.facePickedTag as object}>
          <Text style={m.pickedTagText as object}>Your pick</Text>
        </View>
      )}
    </Pressable>
  );
}

// One-shot impact pulse — a ring blooms out from the tally bar the moment a
// fresh vote lands (comic-impact energy, no literal "POW"). Keyframes injected
// once; skipped under prefers-reduced-motion.
const IMPACT_KEYFRAMES_ID = 'mythique-impact-keyframes';
function ensureImpactKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(IMPACT_KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = IMPACT_KEYFRAMES_ID;
  style.textContent =
    '@keyframes mythique-impact { 0% { transform: scale(0.35); opacity: 0.9; } 100% { transform: scale(2.4); opacity: 0; } }';
  document.head.appendChild(style);
}

function ImpactRing() {
  const ref = useRef<View>(null);
  useEffect(() => {
    ensureImpactKeyframes();
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.style.animation = 'mythique-impact 550ms cubic-bezier(0.16, 1, 0.3, 1) forwards';
  }, []);
  return <View ref={ref} style={m.impactRing as object} pointerEvents="none" />;
}

// The post-vote reveal: crowd split bar (falls back to the stat scorecard until
// anyone has voted) + caption + AI verdict + link to the full breakdown.
// `animate` (fresh vote this session) springs the bar from an even split to the
// real tally and fires the impact ring.
function Result({
  matchup,
  tally,
  onOpen,
  centered,
  animate,
}: {
  matchup: Matchup;
  tally: MatchupTally | null;
  onOpen: (path: string) => void;
  centered?: boolean;
  animate?: boolean;
}) {
  const { heroA, heroB, winsA, winsB } = matchup;
  const usingVotes = !!tally && tally.total > 0;
  const { pctA, pctB } = usingVotes
    ? statSplit(tally!.votesA, tally!.votesB)
    : statSplit(winsA, winsB);
  const caption = usingVotes
    ? `${tally!.total} ${tally!.total === 1 ? 'fan' : 'fans'} voted`
    : statLead(winsA, winsB, heroA.name, heroB.name);
  const [grown, setGrown] = useState(
    () =>
      !animate ||
      (typeof window !== 'undefined' &&
        !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  );
  useEffect(() => {
    if (grown) return;
    // Let the even split paint one frame before springing to the real tally.
    const t = setTimeout(() => setGrown(true), 40);
    return () => clearTimeout(t);
  }, [grown]);
  return (
    <>
      <View style={m.barWrap as object}>
        <View style={m.barTrack as object}>
          <View style={[m.barFillA, { flex: grown ? Math.max(pctA, 1) : 50 }] as object} />
          <View style={[m.barFillB, { flex: grown ? Math.max(pctB, 1) : 50 }] as object} />
        </View>
        {animate && <ImpactRing />}
      </View>
      <View style={m.barLabels as object}>
        <Text style={[m.barPct, { color: COLORS.orange }] as object}>{pctA}%</Text>
        <Text style={m.lead as object}>{caption}</Text>
        <Text style={[m.barPct, { color: COLORS.blue }] as object}>{pctB}%</Text>
      </View>
      <Text style={[m.verdict, centered && (m.textCenter as object)] as object} numberOfLines={3}>
        “{matchup.verdict}”
      </Text>
      <Pressable
        onPress={() => onOpen(`/compare/${heroA.id}/${heroB.id}`)}
        style={[m.linkRow, centered && (m.linkRowCentered as object)] as object}
      >
        <Text style={m.link}>See full breakdown →</Text>
      </Pressable>
    </>
  );
}

function VotePrompt({
  heroA,
  heroB,
  onVote,
  centered,
}: {
  heroA: Matchup['heroA'];
  heroB: Matchup['heroB'];
  onVote: (side: MatchupSide) => void;
  centered?: boolean;
}) {
  return (
    <>
      <Text style={[m.prompt, centered && (m.promptCentered as object)] as object}>
        Who would win? Cast your vote.
      </Text>
      <View style={m.voteRow as object}>
        <Pressable
          onPress={() => onVote('a')}
          style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
            [m.voteBtn, m.voteBtnA, (hovered || pressed) && (m.voteBtnHoverA as object)] as object
          }
        >
          <Text style={m.voteBtnText} numberOfLines={1}>
            {heroA.name}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onVote('b')}
          style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
            [m.voteBtn, m.voteBtnB, (hovered || pressed) && (m.voteBtnHoverB as object)] as object
          }
        >
          <Text style={m.voteBtnText} numberOfLines={1}>
            {heroB.name}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

export function TodaysMatchup({ matchup, onOpen }: TodaysMatchupProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { heroA, heroB } = matchup;

  const { pickedId, tally, loaded, revealed, castVote } = useMatchupVote(heroA.id, heroB.id);

  // True only for a vote cast this session — drives the tally spring + impact
  // ring (a returning already-voted visitor gets the static reveal).
  const [justVoted, setJustVoted] = useState(false);
  const vote = useCallback(
    (side: MatchupSide) => {
      setJustVoted(true);
      castVote(side);
    },
    [castVote],
  );

  // ── Mobile: a centred "fight poster" — face-off portraits, then vote / reveal ──
  if (!isDesktop) {
    return (
      <View style={[m.card, m.cardMobile] as object}>
        <Eyebrow />
        <View style={m.fightersMobile as object}>
          <Fighter
            hero={heroA}
            side="a"
            size={92}
            overlap
            picked={pickedId === heroA.id}
            dimmed={revealed && pickedId !== heroA.id}
            onVote={() => vote('a')}
          />
          <View style={m.vsBadge as object}>
            <Text style={m.vsText}>VS</Text>
          </View>
          <Fighter
            hero={heroB}
            side="b"
            size={92}
            overlap
            picked={pickedId === heroB.id}
            dimmed={revealed && pickedId !== heroB.id}
            onVote={() => vote('b')}
          />
        </View>
        <Text style={[m.title, m.textCenter] as object} numberOfLines={1}>
          {heroA.name} vs {heroB.name}
        </Text>
        {!loaded ? null : revealed ? (
          <Result matchup={matchup} tally={tally} onOpen={onOpen} centered animate={justVoted} />
        ) : (
          <VotePrompt heroA={heroA} heroB={heroB} onVote={vote} centered />
        )}
      </View>
    );
  }

  // ── Desktop: a full-bleed fight poster — the fighters own the card's flanks
  // edge-to-edge, facing inward (same language as the FeaturedRivalry banner),
  // and the centre column floats over the seam between them. ──
  return (
    <View style={[m.card, m.cardDesktop] as object}>
      <FighterFace
        hero={heroA}
        side="a"
        picked={pickedId === heroA.id}
        dimmed={revealed && pickedId !== heroA.id}
        onVote={() => vote('a')}
      />
      <FighterFace
        hero={heroB}
        side="b"
        picked={pickedId === heroB.id}
        dimmed={revealed && pickedId !== heroB.id}
        onVote={() => vote('b')}
      />

      <View style={m.infoCenter as object}>
        <Eyebrow />
        <View style={m.titleRow as object}>
          <Text style={[m.title, m.titleDesktop] as object} numberOfLines={1}>
            {heroA.name}
          </Text>
          <View style={m.vsBadgeInline as object}>
            <Text style={m.vsText}>VS</Text>
          </View>
          <Text style={[m.title, m.titleDesktop] as object} numberOfLines={1}>
            {heroB.name}
          </Text>
        </View>
        {!loaded ? null : revealed ? (
          <Result matchup={matchup} tally={tally} onOpen={onOpen} centered animate={justVoted} />
        ) : (
          <VotePrompt heroA={heroA} heroB={heroB} onVote={vote} centered />
        )}
      </View>
    </View>
  );
}

/**
 * Placeholder that reserves the matchup slot while the (multi-hop + AI verdict)
 * query resolves, so the card fills in without shoving the page below it down.
 * Reuses the real card's container/portrait styles so its height matches.
 */
export function TodaysMatchupSkeleton() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const opacity = useSkeletonAnim();

  if (!isDesktop) {
    return (
      <View style={[m.card, m.cardMobile] as object}>
        <SkeletonBlock opacity={opacity} dark width={110} height={9} />
        <View style={m.fightersMobile as object}>
          <SkeletonBlock opacity={opacity} dark width={92} height={92} borderRadius={14} />
          <View style={[m.vsBadge, { backgroundColor: 'rgba(245,235,220,0.15)' }] as object} />
          <SkeletonBlock opacity={opacity} dark width={92} height={92} borderRadius={14} />
        </View>
        <SkeletonBlock opacity={opacity} dark width={200} height={20} />
        <SkeletonBlock opacity={opacity} dark width={260} height={14} />
        <View style={m.footerMobile as object}>
          <SkeletonBlock opacity={opacity} dark width={90} height={10} />
          <SkeletonBlock opacity={opacity} dark width={120} height={10} />
        </View>
      </View>
    );
  }

  return (
    <View style={[m.card, m.cardDesktop] as object}>
      {/* Dim flank blocks where the fighter faces will land. */}
      <View style={[m.face, m.faceLeft, { backgroundColor: 'rgba(245,235,220,0.05)' }] as object} />
      <View
        style={[m.face, m.faceRight, { backgroundColor: 'rgba(245,235,220,0.05)' }] as object}
      />
      <View style={m.infoCenter as object}>
        <SkeletonBlock opacity={opacity} dark width={110} height={9} style={{ marginBottom: 10 }} />
        <SkeletonBlock
          opacity={opacity}
          dark
          width={300}
          height={24}
          style={{ marginBottom: 14 }}
        />
        <SkeletonBlock
          opacity={opacity}
          dark
          width="100%"
          height={10}
          borderRadius={5}
          style={{ marginBottom: 12 }}
        />
        <SkeletonBlock opacity={opacity} dark width="70%" height={14} />
      </View>
    </View>
  );
}

const PORTRAIT = 76;

const m = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 16,
    padding: 18,
    marginTop: 12,
  } as object,
  cardDesktop: {
    // No outer margin — the explore "engage row" owns the horizontal padding and
    // pairs this card with the daily game beside it. Solid body (not glass) so
    // the fighter-face scrims can fade into it seamlessly; the faces are
    // absolutely positioned, so the flex row only lays out the centre column.
    marginTop: 0,
    justifyContent: 'center',
    gap: 0,
    paddingVertical: 30,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#131f27',
    minHeight: 250,
  } as object,

  // ── Desktop fighter faces — full-bleed flanks of the poster ────────────────
  face: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '27%',
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'opacity 250ms ease, filter 250ms ease',
  } as object,
  faceLeft: { left: 0 } as object,
  faceRight: { right: 0 } as object,
  faceScrimA: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundImage:
      'linear-gradient(to right, rgba(19,31,39,0) 0%, rgba(19,31,39,0.45) 60%, #131f27 100%)',
  } as object,
  faceScrimB: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundImage:
      'linear-gradient(to left, rgba(19,31,39,0) 0%, rgba(19,31,39,0.45) 60%, #131f27 100%)',
  } as object,
  faceHover: { opacity: 0.92 } as object,
  // Post-reveal losing side: dim + drain the colour.
  faceDimmed: { opacity: 0.45, filter: 'grayscale(0.6)' } as object,
  facePickedTag: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: COLORS.orange,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 6,
  } as object,
  cardMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 22,
    marginHorizontal: 16,
  } as object,

  fightersMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  } as object,
  textCenter: { textAlign: 'center', marginBottom: 0 } as object,
  footerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 4,
  } as object,
  portrait: {
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    borderWidth: 2,
    borderColor: 'rgba(11,24,32,0.9)',
    cursor: 'pointer',
    boxShadow: '0 10px 28px rgba(0,0,0,0.4)',
    transition: 'opacity 150ms ease, border-color 150ms ease, transform 150ms ease',
  } as object,
  portraitB: { marginLeft: -16 } as object,
  // Mirror the right fighter so they face inward, toward the left fighter.
  faceInward: { transform: [{ scaleX: -1 }] } as object,
  portraitHover: {
    transform: [{ translateY: -4 }],
    borderColor: 'rgba(245,235,220,0.35)',
  } as object,
  portraitPicked: { borderColor: COLORS.orange } as object,
  portraitDimmed: { opacity: 0.5 } as object,
  pickedTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.orange,
    paddingVertical: 2,
    alignItems: 'center',
  } as object,
  pickedTagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as object,
  vsBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginHorizontal: -12,
    zIndex: 2,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0b1820',
  } as object,
  vsText: { fontFamily: 'Flame-Regular', fontSize: 12, color: '#fff' },

  // Desktop centre column — grows to fill the space between the flanking
  // portraits but caps its width so the vote bar reads as a deliberate element
  // rather than a hairline stretched across the full page.
  infoCenter: {
    flex: 1,
    minWidth: 0,
    maxWidth: 460,
    alignItems: 'center',
    zIndex: 2,
  } as object,
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    gap: 12,
    alignSelf: 'stretch',
    marginBottom: 12,
  } as object,
  vsBadgeInline: {
    width: 30,
    height: 30,
    borderRadius: 15,
    flexShrink: 0,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0b1820',
  } as object,
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 7,
  } as object,
  eyebrow: { ...EYEBROW } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.beige,
    lineHeight: 27,
    marginBottom: 8,
  },
  titleDesktop: {
    fontSize: 26,
    lineHeight: 30,
    marginBottom: 0,
    flexShrink: 1,
    textAlign: 'center',
  } as object,
  prompt: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.7)',
    marginBottom: 10,
  } as object,
  // Centred layouts have no parent row-gap, so the prompt owns its breathing
  // room above the vote buttons (textCenter would otherwise zero the margin).
  promptCentered: { textAlign: 'center', marginBottom: 16 } as object,
  voteRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' } as object,
  voteBtn: {
    flex: 1,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 150ms ease, border-color 150ms ease',
  } as object,
  // Each button carries its fighter's corner colour — a whisper at rest,
  // committed on hover (the same orange/blue the tally bar resolves to).
  voteBtnA: { borderColor: 'rgba(231,115,51,0.35)' } as object,
  voteBtnB: { borderColor: 'rgba(21,161,171,0.4)' } as object,
  voteBtnHoverA: {
    backgroundColor: 'rgba(231,115,51,0.22)',
    borderColor: 'rgba(231,115,51,0.6)',
  } as object,
  voteBtnHoverB: {
    backgroundColor: 'rgba(21,161,171,0.22)',
    borderColor: 'rgba(21,161,171,0.6)',
  } as object,
  voteBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.beige },

  barWrap: { alignSelf: 'stretch', position: 'relative', marginBottom: 8 } as object,
  barTrack: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,235,220,0.1)',
  } as object,
  // Springy overshoot as the tally lands.
  barFillA: {
    backgroundColor: COLORS.orange,
    transition: 'flex-grow 650ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  } as object,
  barFillB: {
    backgroundColor: COLORS.blue,
    transition: 'flex-grow 650ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  } as object,
  impactRing: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 64,
    height: 64,
    marginLeft: -32,
    marginTop: -32,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: COLORS.orange,
    opacity: 0,
  } as object,
  barLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    gap: 8,
    marginBottom: 10,
  } as object,
  barPct: { fontFamily: 'Flame-Regular', fontSize: 15 } as object,
  verdict: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(245,235,220,0.7)',
    lineHeight: 19,
    marginBottom: 10,
  },
  lead: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
  } as object,
  linkRow: { alignSelf: 'flex-start', cursor: 'pointer' } as object,
  linkRowCentered: { alignSelf: 'center' } as object,
  link: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    letterSpacing: 0.3,
  },
});
