// src/components/event/EventHub.tsx
// The permanent page for an event SERIES, shared by both routes.
//
// Same ink-over-paper seam as EventDossier, and the same division of meaning:
// ink is the claim (what this event is, whether it is on right now), paper is the
// record (every edition we have caught). It renders no scroll container, because
// the web route must scroll the document.
//
// Why a hub separate from the dossier at all: watched_events holds one row per
// series and is overwritten every 30 minutes, so /event/d23 could only ever mean
// "D23, currently". A reader in October wants the 2026 edition, and a search
// engine can only rank a URL whose meaning does not silently become next year's
// event. The hub is the thing that accrues; the editions are what it accrues.
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SEAM_COLOR, SURFACE, INK_TEXT, PAPER_TEXT } from '../../constants/colors';
import { brandForEvent, fitMark } from '../../constants/eventBrands';
import { EVENT_STAGE } from '../../constants/eventGeometry';
import { formatWindow } from '../../hooks/useEventDossier';
import type { EventHub as Hub } from '../../lib/db/events.editions';

export interface EventHubProps {
  hub: Hub;
  wide?: boolean;
  contentWidth: number;
  maxContentWidth?: number;
  viewportHeight?: number;
  onEditionPress: (editionSlug: string) => void;
  onIndexPress?: () => void;
}

export function EventHub({
  hub,
  wide = false,
  contentWidth,
  maxContentWidth,
  viewportHeight,
  onEditionPress,
  onIndexPress,
}: EventHubProps) {
  const accent = hub.accent ?? COLORS.goldAccent;
  const brand = brandForEvent(hub.slug);
  const pad = wide ? EVENT_STAGE.padWide : EVENT_STAGE.pad;
  const measure = Math.min(maxContentWidth ?? contentWidth, contentWidth);
  const inner = { width: '100%' as const, maxWidth: measure, alignSelf: 'center' as const };

  return (
    <View>
      {/* ── ink: what this is ─────────────────────────────────────────────── */}
      <View style={s.stage}>
        <View
          style={[
            inner,
            {
              paddingHorizontal: pad,
              paddingTop: wide ? EVENT_STAGE.paddingTopWide : EVENT_STAGE.paddingTop,
            },
          ]}
        >
          {/* See EventDossier: status and navigation are different things and
              must not share one label. */}
          <View style={s.eyebrowRow}>
            <Text style={[s.eyebrow, { color: accent }]}>
              {hub.isLive ? 'Happening now' : 'Watched event'}
            </Text>
            {!!onIndexPress && (
              <Pressable
                onPress={onIndexPress}
                style={[s.indexLink, { borderColor: `${accent}55` }]}
                accessibilityRole="link"
                accessibilityLabel="All events"
                hitSlop={8}
              >
                <Text style={[s.indexLinkText, { color: accent }]}>All events</Text>
                <Ionicons name="chevron-forward" size={12} color={accent} />
              </Pressable>
            )}
          </View>

          {brand ? (
            <View style={s.markBox}>
              <brand.mark
                {...fitMark(brand, wide ? 300 : 200, wide ? 108 : 78)}
                color={accent}
                fill={accent}
              />
            </View>
          ) : (
            <Text style={[s.title, { color: accent }]}>{hub.headline}</Text>
          )}

          {/* Live gets the current window and a route into the live page; the
              rest of the time the hub is a table of contents and says so. */}
          {hub.isLive ? (
            <Text style={s.window}>{formatWindow(hub.liveFrom, hub.liveTo) ?? 'Running now'}</Text>
          ) : null}

          <Text style={s.method} numberOfLines={wide ? undefined : 3}>
            {hub.blurb ??
              'No calendar told us about this. Each edition below was detected from readership on the event’s own Wikipedia article, then frozen before the next one overwrote it.'}
          </Text>
        </View>
      </View>

      <View style={s.seam} />

      {/* ── paper: every edition caught ───────────────────────────────────── */}
      <View style={[s.paper, viewportHeight ? { minHeight: viewportHeight * 0.5 } : null]}>
        <View style={[inner, { paddingHorizontal: pad }]}>
          <Text style={s.sectionTitle}>Editions</Text>
          <Text style={s.sectionNote}>
            {hub.editions.length === 1
              ? 'One edition on record so far.'
              : `${hub.editions.length} editions on record.`}
          </Text>

          {hub.editions.length === 0 ? (
            // Not an error: a watched event that has not fired yet has nothing to
            // archive, and saying so beats an empty panel that reads as broken.
            <Text style={s.empty}>
              Nothing archived yet. An edition is frozen the first time this event is detected as
              live.
            </Text>
          ) : (
            <EditionList editions={hub.editions} accent={accent} onEditionPress={onEditionPress} />
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * The list of editions on record.
 *
 * Exported because it appears in two places and must not be written twice: on the
 * hub (where it is the page) and beneath the LIVE dossier (where it is the way
 * back to previous years). Duplicating it is how the two would drift.
 */
export function EditionList({
  editions,
  accent,
  onEditionPress,
}: {
  editions: Hub['editions'];
  accent: string;
  onEditionPress: (editionSlug: string) => void;
}) {
  return (
    <View style={s.list}>
      {editions.map((e) => (
        <Pressable
          key={e.editionSlug}
          style={s.row}
          onPress={() => onEditionPress(e.editionSlug)}
          accessibilityRole="button"
          accessibilityLabel={`${e.headline} ${e.editionSlug}`}
        >
          <View style={s.rowMain}>
            <Text style={[s.year, { color: accent }]}>{e.editionSlug}</Text>
            <Text style={s.rowWindow}>{formatWindow(e.liveFrom, e.liveTo) ?? '—'}</Text>
          </View>
          <Text style={s.rowMeta}>
            {/* Counts rather than adjectives: they are what tells a reader which
                year is worth opening. */}
            {[
              // Only when it is actually a rise. A frozen edition can hold a
              // ratio BELOW 1 — SDCC 2026 was detected at 3.35x and its stored
              // figure is 0.82, because the spike rolled out of the rolling
              // 27-day curve before the edition was captured. "0.82x readership"
              // on a page about an event reads as a broken number, and it is
              // not a fact worth leading a row with either way.
              e.spikeRatio !== null && e.spikeRatio > 1 ? `${e.spikeRatio}× readership` : null,
              e.announcements > 0
                ? `${e.announcements} announcement${e.announcements === 1 ? '' : 's'}`
                : null,
              e.movers > 0 ? `${e.movers} moved` : null,
            ]
              .filter(Boolean)
              .join('  ·  ')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  stage: { backgroundColor: SURFACE.ink, overflow: 'hidden', paddingBottom: 34 },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  indexLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: EVENT_STAGE.eyebrowGap,
  },
  indexLinkText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    lineHeight: EVENT_STAGE.eyebrowLine,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: EVENT_STAGE.eyebrowGap,
  },
  markBox: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: EVENT_STAGE.markMinHeight,
  },
  // Flame needs lineHeight >= 1.22x fontSize.
  title: { fontFamily: 'Flame-Regular', fontSize: 30, lineHeight: EVENT_STAGE.titleLine },
  window: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    lineHeight: EVENT_STAGE.windowLine,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.84)',
    marginTop: EVENT_STAGE.windowGap,
  },
  method: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: EVENT_STAGE.methodLine,
    color: INK_TEXT.faint,
    maxWidth: 560,
    marginTop: EVENT_STAGE.methodGap,
  },

  seam: { height: 1, backgroundColor: SEAM_COLOR },

  paper: { backgroundColor: SURFACE.paper, paddingTop: 30, paddingBottom: 48 },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 23,
    lineHeight: 30,
    color: COLORS.deepNavy,
  },
  sectionNote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: PAPER_TEXT.muted,
    marginTop: 4,
  },
  empty: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: 20,
    color: PAPER_TEXT.muted,
    marginTop: 18,
    maxWidth: 460,
  },

  list: { marginTop: 20, gap: 2 },
  row: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(11,24,32,0.10)', gap: 4 },
  rowMain: { flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  year: { fontFamily: 'Flame-Regular', fontSize: 23, lineHeight: 30 },
  rowWindow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: PAPER_TEXT.muted,
  },
  rowMeta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: 17,
    color: PAPER_TEXT.muted,
  },
});
