import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { deriveCharacterTheme, accentButtonColors } from '../../lib/accent';
import { describeRelationship } from '../../lib/graph/relationshipReason';
import { matchupVerdict } from '../../lib/graph/statEdge';
import { UniverseVote } from './UniverseVote';
import { SharedTitlesStrip } from './SharedTitlesStrip';
import type { SharedTitles } from '../../lib/db/heroes/sharedTitles';
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

function alignmentLabel(a: string | null): { label: string; color: string } | null {
  const v = (a ?? '').toLowerCase();
  if (v === 'good') return { label: 'Hero', color: COLORS.blue };
  if (v === 'bad') return { label: 'Villain', color: COLORS.red };
  if (v === 'neutral') return { label: 'Anti-Hero', color: COLORS.orange };
  return null;
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
  const narrow = useWindowDimensions().width < 760;
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

  return (
    <View style={[styles.card, narrow && styles.cardNarrow] as object}>
      {/* The character's colour as a soft wash from the top, so the card takes on
          their identity without a border or a stripe doing the talking. */}
      <View
        style={
          [
            StyleSheet.absoluteFill,
            { backgroundImage: `linear-gradient(160deg, ${tint}2e, transparent 62%)` },
          ] as object
        }
        pointerEvents="none"
      />

      <View style={styles.head}>
        <View style={[styles.portrait, narrow && styles.portraitNarrow] as object}>
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
          <Text style={styles.name} numberOfLines={2}>
            {node.name}
          </Text>
          <View style={styles.meta}>
            {kind ? (
              <View style={[styles.kindPill, { backgroundColor: kindColor + '26' }] as object}>
                <Text style={[styles.kindText, { color: kindColor }] as object}>
                  {/* "Cousin" beats "Family" wherever the data actually says
                      which relative this is. */}
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

        <Pressable onPress={onClose} style={styles.close} hitSlop={8}>
          <Ionicons name="close" size={16} color={INK_TEXT.muted} />
        </Pressable>
      </View>

      {/* A written note beats anything derived. The inferred line ("both
          serving in the Justice League") only appears where nobody has said
          something better. */}
      {blurb ? (
        <Text style={styles.reason}>{blurb}</Text>
      ) : summary ? (
        <Text style={styles.reason}>{summary}</Text>
      ) : null}

      {shared ? <SharedTitlesStrip shared={shared} /> : null}

      {/* Rosters are EVIDENCE, so they only appear when there is nothing
          better. With a written note above and posters beside it, they were a
          third proof of a point already made twice. */}
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

      {/* The single interaction on the card, and the app's engine. The verdict
          it carries is the four-word version of the stat bars this replaced. */}
      {subject && subject.id !== node.id ? (
        <UniverseVote subject={subject} node={node} subjectName={subjectName} />
      ) : null}

      {verdict && onCompare ? (
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
          style={[styles.primary, { backgroundColor: button.background }] as object}
        >
          <Text style={[styles.primaryText, { color: button.ink }] as object}>View dossier</Text>
          <Ionicons name="chevron-forward" size={13} color={button.ink} />
        </Pressable>
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
    maxHeight: '62vh',
    overflowY: 'auto',
  } as object,
  // Full-bleed on a phone, and lifted clear of the floating browser toolbar
  // that would otherwise cut the action row in half.
  cardNarrow: {
    left: 12,
    right: 12,
    width: 'auto',
    maxWidth: 'none',
    bottom: 'calc(16px + env(safe-area-inset-bottom))',
    padding: 12,
    gap: 8,
    // It was eating ~half the viewport and burying the scene it describes.
    // Capped and scrollable, so a dense dossier costs the graph nothing.
    maxHeight: '58vh',
    overflowY: 'auto',
  } as object,
  portraitNarrow: { width: 60, height: 74 } as object,
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
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

  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  verdictText: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: INK_TEXT.faint },
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
