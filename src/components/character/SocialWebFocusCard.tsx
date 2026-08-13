import { useMemo, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, PanResponder, useWindowDimensions } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT, SURFACE } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { deriveCharacterTheme, accentButtonColors } from '../../lib/accent';
import { alignmentLabel as taxoAlignment } from '../../lib/characterTaxonomy';
import { describeRelationship } from '../../lib/graph/relationshipReason';
import { matchupVerdict } from '../../lib/graph/statEdge';
import { UniverseVote } from './UniverseVote';
import { SharedTitlesStrip } from './SharedTitlesStrip';
import { sharedTitlesCaption, type SharedTitles } from '../../lib/db/heroes/sharedTitles';
import type { NeighborKind, NeighborNode } from '../../lib/db/heroes/neighborhood';

const KIND_LABEL: Record<string, string> = {
  enemy: 'Enemy',
  ally: 'Ally',
  teammate: 'Teammate',
  family: 'Family',
};
const KIND_COLOR: Record<string, string> = {
  enemy: COLORS.red,
  ally: COLORS.green,
  teammate: COLORS.blue,
  family: COLORS.purple,
};

// Colour stays local (it keys off this card's palette); the word comes from
// src/lib/characterTaxonomy.ts so every surface agrees.
const ALIGNMENT_COLOR: Record<string, string> = {
  good: COLORS.blue,
  bad: COLORS.red,
  neutral: COLORS.orange,
};

function alignmentLabel(a: string | null): { label: string; color: string } | null {
  const v = (a ?? '').toLowerCase().trim();
  const label = taxoAlignment(v);
  if (!label) return null;
  return { label, color: ALIGNMENT_COLOR[v] };
}

/**
 * The dossier that opens when a node is focused.
 *
 * Three deliberate choices:
 *
 * It leads with the full painterly portrait, not the flat icon. The icon exists
 * to read at 40px in the graph; this is the one moment the character gets room
 * to actually look like themselves.
 *
 * It is themed by THAT character's own accent, pulled from their portrait's
 * blurhash, so opening Joker and opening Superman feel like different events
 * rather than the same panel with the name swapped.
 *
 * And it answers three questions in the order people ask them: who is this, why
 * are they in this web, and could they take the subject in a fight. The last one
 * is the whole point of the app, so it ends in the Arena rather than a dead end.
 */
export function SocialWebFocusCard({
  node,
  subject,
  subjectName,
  subjectTeams,
  kind,
  relation,
  blurb,
  shared,
  degree,
  accent,
  onView,
  onCompare,
  onClose,
}: {
  node: NeighborNode;
  /** The centre character, for the head-to-head. */
  subject?: NeighborNode | null;
  subjectName: string;
  subjectTeams?: string[] | null;
  kind: NeighborKind | null;
  /** For kin: the named role ("Cousin"), when hero_relatives states one. */
  relation?: string | null;
  /** A hand-written note on this pair, when one exists. Outranks the rest. */
  blurb?: string | null;
  /** Films and shows both characters appear in — the evidence section. */
  shared?: SharedTitles | null;
  degree: number;
  /** Page accent — the fallback when this character has no usable colour. */
  accent: string;
  onView: () => void;
  onCompare?: () => void;
  onClose: () => void;
}) {
  const { width: vw } = useWindowDimensions();
  const narrow = vw < 760;
  // Four columns need real room; below this the posters step aside.
  const roomy = vw >= 1180;
  const chipCap = narrow ? 2 : 3;
  const align = alignmentLabel(node.alignment);
  const kindColor = kind ? KIND_COLOR[kind] : accent;

  // The character's own colour, not the page's — this is what makes each card
  // feel like a different moment instead of one reused panel.
  const theme = useMemo(
    () =>
      deriveCharacterTheme({
        portrait_blurhash: node.portrait_blurhash,
        publisher: node.publisher,
      }),
    [node.portrait_blurhash, node.publisher],
  );
  const tint = theme.accent || accent;
  // The filled button paints a per-character colour, so its label can't assume a
  // fixed ink. This nudges the fill's lightness (hue and saturation untouched)
  // until the chosen ink clears WCAG AA — some mid tones fail against BOTH black
  // and beige, so swapping the text colour alone would not be enough.
  const button = useMemo(() => accentButtonColors(tint), [tint]);

  const hasShared = (shared?.titles.length ?? 0) > 0;
  const sharedCaption = shared ? sharedTitlesCaption(shared) : null;

  // Peek by default on a phone; the vote and the verdict are one drag away.
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Only claim the gesture once it is clearly a vertical drag, so a tap
        // on the grabber still reaches the Pressable underneath.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6,
        onPanResponderRelease: (_e, g) => {
          if (g.dy < -40) return setExpanded(true);
          // Down collapses first and only dismisses from the peek, so a drag
          // can never skip a step and close the sheet unexpectedly.
          if (g.dy > 40) return expandedRef.current ? setExpanded(false) : onClose();
        },
      }),
    [onClose],
  );
  const { sharedTeams, summary } = describeRelationship(
    kind,
    subjectName,
    subjectTeams ?? null,
    node.teams ?? null,
    degree,
    relation ?? null,
  );

  const verdict = matchupVerdict(
    subject?.powerstats_total ?? null,
    node.powerstats_total ?? null,
    node.name,
    subjectName,
  );

  const relationLine = blurb ?? summary;

  /**
   * Desktop: a lower third, not a card.
   *
   * The floating panel was the most conventional container available — a
   * rounded rectangle in a corner, which every graph tool ships — and it was
   * disembodied: the head it described sat hundreds of pixels away with
   * nothing connecting them, while the panel itself covered a quarter of the
   * stage and rendered the best portrait art in the app at 76px.
   *
   * The constellation is a centred ellipse, so the strip along the bottom of
   * the screen is space it never occupies. Putting the dossier there costs the
   * scene nothing, and buys a horizontal composition: the portrait can run
   * large, and the written note gets set as a pull quote rather than as body
   * copy in a box.
   *
   * No border and no radius, deliberately. It rises out of the ink scrim
   * already at the foot of the page, which is the whole difference between a
   * panel floating over a canvas and a page that looks composed.
   */
  if (!narrow) {
    return (
      <View style={styles.band} pointerEvents="box-none">
        <View
          style={
            [
              StyleSheet.absoluteFill,
              {
                backgroundImage: `linear-gradient(to top, ${SURFACE.ink} 0%, ${SURFACE.ink}f0 46%, transparent 100%)`,
              },
            ] as object
          }
          pointerEvents="none"
        />
        {/* The character's own colour, as a glow off the floor rather than a
            wash across a box — identity without a border doing the talking. */}
        <View
          style={
            [
              StyleSheet.absoluteFill,
              { backgroundImage: `linear-gradient(to top, ${tint}30, transparent 58%)` },
            ] as object
          }
          pointerEvents="none"
        />

        <View style={styles.bandInner}>
          <View style={styles.bigPortrait}>
            <HeroImage
              id={node.id}
              name={node.name}
              imageUrl={node.image_url}
              portraitUrl={node.portrait_url}
              imageMdUrl={node.image_md_url}
              blurhash={node.portrait_blurhash}
              grid
              contentFit="cover"
              contentPosition={{ top: '18%', left: '50%' }}
              style={StyleSheet.absoluteFill}
              recyclingKey={node.id}
            />
          </View>

          <View style={styles.bandMain}>
            <View style={styles.meta}>
              {kind ? (
                <View style={[styles.kindPill, { backgroundColor: kindColor + '26' }] as object}>
                  <Text style={[styles.kindText, { color: kindColor }] as object}>
                    {(kind === 'family' && relation) || KIND_LABEL[kind]}
                  </Text>
                </View>
              ) : null}
              {align ? (
                <View style={[styles.badge, { borderColor: align.color + '80' }] as object}>
                  <Text style={[styles.badgeText, { color: align.color }] as object}>
                    {align.label}
                  </Text>
                </View>
              ) : null}
              {node.publisher ? (
                <Text style={styles.publisher} numberOfLines={1}>
                  {node.publisher}
                </Text>
              ) : null}
            </View>

            <Text style={styles.bandName} numberOfLines={1}>
              {node.name}
            </Text>

            {relationLine ? (
              <Text style={styles.quote} numberOfLines={3}>
                {relationLine}
              </Text>
            ) : null}

            <View style={styles.bandActions}>
              <Pressable
                onPress={onView}
                style={[styles.primary, { backgroundColor: button.background }] as object}
              >
                <Text style={[styles.primaryText, { color: button.ink }] as object}>
                  View dossier
                </Text>
                <Ionicons name="chevron-forward" size={13} color={button.ink} />
              </Pressable>
              {verdict && onCompare ? (
                <Pressable onPress={onCompare} style={styles.verdictRow}>
                  <Ionicons name="flash" size={12} color={INK_TEXT.faint} />
                  <Text style={styles.verdictText} numberOfLines={1}>
                    {verdict}
                  </Text>
                  <Ionicons name="chevron-forward" size={11} color={INK_TEXT.faint} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* The evidence column is the first thing to go when the window is
              too narrow to hold four columns without crushing the quote. */}
          {roomy && shared ? (
            <View style={styles.evidenceCol}>
              <SharedTitlesStrip shared={shared} />
            </View>
          ) : null}

          {subject && subject.id !== node.id ? (
            <View style={styles.voteCol}>
              <UniverseVote subject={subject} node={node} subjectName={subjectName} />
            </View>
          ) : null}

          {/* Last item in the row rather than absolutely positioned: floating
              it over the open canvas above the band left it reading as a stray
              mark belonging to nothing. Top-aligned, so it sits on the same
              line as the name it dismisses. */}
          <Pressable
            onPress={onClose}
            style={styles.bandClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={17} color={INK_TEXT.muted} />
          </Pressable>
        </View>
      </View>
    );
  }

  /**
   * Mobile: a peek sheet.
   *
   * At full height this covered the lower half of the viewport — and the ring
   * is centred there, so the subject and whole clusters ended up hidden behind
   * the panel describing them. You could read "Served alongside Batman" with
   * Batman nowhere on screen.
   *
   * Two fixes, together: the scene lifts (see UniverseScene's `lift`), and the
   * sheet opens at a peek showing only who this is and what they are to the
   * subject. The rest is one drag away rather than imposed.
   */
  return (
    <View style={[styles.card, styles.cardNarrow] as object}>
      {/* On a phone the sheet rises out of the ink exactly as the desktop band
          does. Either way the character's own colour carries the identity,
          with no border doing the talking. */}
      <View
        style={
          [
            StyleSheet.absoluteFill,
            {
              backgroundImage: `linear-gradient(to top, ${SURFACE.ink} 0%, ${SURFACE.ink}f2 52%, transparent 100%)`,
            },
          ] as object
        }
        pointerEvents="none"
      />
      <View
        style={
          [
            StyleSheet.absoluteFill,
            { backgroundImage: `linear-gradient(to top, ${tint}2e, transparent 55%)` },
          ] as object
        }
        pointerEvents="none"
      />

      {/* The grabber is both the affordance and the target: tap to toggle, drag
          up to expand, drag down to collapse and then dismiss — so the sheet
          can be closed by the thumb already on it, rather than only by a 24px
          glyph in the far corner. */}
      <View {...pan.panHandlers} style={styles.grabWrap}>
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          hitSlop={12}
          accessibilityLabel={expanded ? 'Collapse details' : 'Expand details'}
        >
          <View style={styles.grabber} />
        </Pressable>
      </View>

      <View style={styles.head}>
        <View style={[styles.portrait, styles.portraitNarrow] as object}>
          <HeroImage
            id={node.id}
            name={node.name}
            imageUrl={node.image_url}
            portraitUrl={node.portrait_url}
            imageMdUrl={node.image_md_url}
            blurhash={node.portrait_blurhash}
            grid
            contentFit="cover"
            contentPosition={{ top: '20%', left: '50%' }}
            style={StyleSheet.absoluteFill}
            recyclingKey={node.id}
          />
        </View>

        <View style={styles.identity}>
          <Text style={[styles.name, styles.nameNarrow] as object} numberOfLines={2}>
            {node.name}
          </Text>
          <View style={styles.meta}>
            {kind ? (
              <View style={[styles.kindPill, { backgroundColor: kindColor + '26' }] as object}>
                <Text style={[styles.kindText, { color: kindColor }] as object}>
                  {(kind === 'family' && relation) || KIND_LABEL[kind]}
                </Text>
              </View>
            ) : null}
            {align ? (
              <View style={[styles.badge, { borderColor: align.color + '80' }] as object}>
                <Text style={[styles.badgeText, { color: align.color }] as object}>
                  {align.label}
                </Text>
              </View>
            ) : null}
          </View>
          {node.publisher ? (
            <Text style={styles.publisher} numberOfLines={1}>
              {node.publisher}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={onClose}
          style={styles.close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={16} color={INK_TEXT.muted} />
        </Pressable>
      </View>

      {relationLine ? (
        <Text
          style={[styles.reason, styles.reasonNarrow] as object}
          numberOfLines={expanded ? 8 : 4}
        >
          {relationLine}
        </Text>
      ) : null}

      {/* The poster strip is a desktop luxury — there's a column to spare
          there. Here its caption carries most of the value in one line rather
          than ninety pixels. */}
      {sharedCaption ? <Text style={styles.evidenceLine}>{sharedCaption}</Text> : null}

      {sharedTeams.length > 0 && !blurb && !hasShared ? (
        <View style={styles.chips}>
          {sharedTeams.slice(0, chipCap).map((t) => (
            <View key={t} style={styles.chip}>
              <Ionicons name="people" size={10} color={INK_TEXT.muted} />
              <Text style={styles.chipText} numberOfLines={1}>
                {t}
              </Text>
            </View>
          ))}
          {sharedTeams.length > chipCap ? (
            <Text style={styles.chipMore}>+{sharedTeams.length - chipCap}</Text>
          ) : null}
        </View>
      ) : null}

      {expanded && subject && subject.id !== node.id ? (
        <UniverseVote subject={subject} node={node} subjectName={subjectName} />
      ) : null}

      {expanded && verdict && onCompare ? (
        <Pressable onPress={onCompare} style={styles.verdictRow}>
          <Ionicons name="flash" size={12} color={INK_TEXT.faint} />
          <Text style={styles.verdictText} numberOfLines={1}>
            {verdict}
          </Text>
          <Ionicons name="chevron-forward" size={11} color={INK_TEXT.faint} />
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onView}
          style={
            [styles.primary, styles.primaryWide, { backgroundColor: button.background }] as object
          }
        >
          <Text style={[styles.primaryText, { color: button.ink }] as object}>View dossier</Text>
          <Ionicons name="chevron-forward" size={13} color={button.ink} />
        </Pressable>
        {expanded ? null : (
          <Pressable onPress={() => setExpanded(true)} style={styles.moreRow} hitSlop={8}>
            <Text style={styles.moreText}>More</Text>
            <Ionicons name="chevron-up" size={12} color={INK_TEXT.faint} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    bottom: 56,
    width: 340,
    maxWidth: '90%',
    gap: 11,
    padding: 15,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(11,24,32,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
    backdropFilter: 'blur(14px)',
    // A ceiling, not a scroll plan. The card reached 68% of a large desktop
    // viewport by accretion — nine blocks answering six questions with equal
    // weight — and would have been taller than a laptop window. Sections were
    // cut until it fits; this is the tripwire that catches the next one added
    // without asking what it displaces.
    // dvh, not vh: on iOS Safari `vh` is the LARGE viewport (browser chrome
    // collapsed), so a vh ceiling let the card run down behind the toolbar and
    // its action row was unreachable. dvh tracks the viewport you can see.
    maxHeight: '62dvh',
    overflowY: 'auto',
  } as object,
  // Full-bleed on a phone, and lifted clear of the floating browser toolbar
  // that would otherwise cut the action row in half.
  // A phone can't hold the desktop band's four columns, but it takes the same
  // language: no border, no radius, full-bleed, rising out of the ink rather
  // than floating on top of it as a panel. The ring is width-bound on a narrow
  // screen and leaves the lower half of the viewport empty, so this covers
  // nothing either.
  cardNarrow: {
    left: 0,
    right: 0,
    width: 'auto',
    maxWidth: 'none',
    bottom: 0,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 'calc(18px + env(safe-area-inset-bottom))',
    gap: 10,
    // It was eating ~half the viewport and burying the scene it describes.
    // Capped and scrollable, so a dense dossier costs the graph nothing.
    maxHeight: '58dvh',
    overflowY: 'auto',
  } as object,
  // Was 60x74 — a thumbnail of the best art in the app. Given room to be seen.
  portraitNarrow: { width: 86, height: 112 } as object,
  nameNarrow: { fontSize: 24, lineHeight: 30 } as object,
  reasonNarrow: { fontSize: 15, lineHeight: 23, opacity: 1 } as object,
  head: { flexDirection: 'row', gap: 13, alignItems: 'center' },
  portrait: {
    width: 76,
    height: 94,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  } as object,
  identity: { flex: 1, gap: 5, paddingRight: 18 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    lineHeight: 25,
    color: INK_TEXT.primary,
  } as object,
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  kindPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  kindText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  badgeText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  publisher: { fontFamily: 'FlameSans-Regular', fontSize: 11, color: INK_TEXT.muted },
  reason: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: INK_TEXT.primary,
    opacity: 0.9,
  } as object,
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(245,235,220,0.08)',
  } as object,
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: INK_TEXT.muted, flexShrink: 1 },
  chipMore: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: INK_TEXT.muted },

  sectionLabel: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: INK_TEXT.muted,
  },
  stats: { gap: 5 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: INK_TEXT.primary,
    width: 74,
  } as object,
  bar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,235,220,0.10)',
  } as object,
  barFill: { height: '100%', borderRadius: 3 } as object,
  statDelta: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10,
    width: 30,
    textAlign: 'right',
  } as object,

  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 62,
    // The portrait is the tallest thing in the band and sits on this floor, so
    // it needs real clearance — at 22 it read as falling off the screen.
    paddingBottom: 34,
    paddingHorizontal: 40,
  } as object,
  bandInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 28,
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
  } as object,
  bigPortrait: {
    width: 128,
    height: 168,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  } as object,
  // minWidth:0 or the flex item refuses to shrink past its actions row's
  // intrinsic width, and at tablet widths the band overflowed — the verdict
  // line ran underneath the vote column.
  bandMain: { flex: 1, minWidth: 0, maxWidth: 620, gap: 7 } as object,
  bandName: {
    fontFamily: 'Flame-Regular',
    fontSize: 32,
    // Flame's ink spans ~119% of its em box, and this line is clamped.
    lineHeight: 40,
    color: INK_TEXT.primary,
  } as object,
  // The best writing in the app, set as a pull quote rather than body copy.
  quote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 16.5,
    lineHeight: 26,
    color: INK_TEXT.primary,
  },
  bandActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    paddingTop: 4,
  },
  evidenceCol: { width: 210 },
  voteCol: { width: 236, flexShrink: 0 },
  // Given a chip of its own: as a bare glyph on open canvas it read as a
  // stray mark rather than as this band's control.
  bandClose: {
    alignSelf: 'flex-start',
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,24,32,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
  } as object,
  grabWrap: { alignItems: 'center', paddingBottom: 4, marginTop: -6 },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(245,235,220,0.28)',
    marginVertical: 6,
  },
  evidenceLine: { fontFamily: 'FlameSans-Regular', fontSize: 12.5, color: INK_TEXT.muted },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  moreText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    color: INK_TEXT.faint,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    flexShrink: 1,
    gap: 6,
    paddingTop: 2,
  },
  verdictText: {
    flexShrink: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    color: INK_TEXT.faint,
  },
  faces: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  face: { borderRadius: 14, overflow: 'hidden' },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  // On a phone the main exit should be a thumb-sized target that owns its row,
  // not a small pill with dead space beside it.
  primaryWide: { flex: 1, justifyContent: 'center', paddingVertical: 10 },
  primaryText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12 },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.20)',
  },
  secondaryText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: INK_TEXT.primary },
  close: { position: 'absolute', top: 0, right: 0, padding: 2 } as object,
});
