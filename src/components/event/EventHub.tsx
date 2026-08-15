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
import { Image } from 'expo-image';
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
  /** Override the stage's top padding. The web routes pass a smaller value:
   *  a 64pt fixed masthead already occupies that zone, so the default —
   *  which is sized for a native screen with a nav header — stacked on top
   *  of the route's own offset and left ~120pt of dead ink above the fold. */
  topPad?: number;
  onEditionPress: (editionSlug: string) => void;
  onIndexPress?: () => void;
}

export function EventHub({
  hub,
  wide = false,
  contentWidth,
  maxContentWidth,
  viewportHeight,
  topPad,
  onEditionPress,
  onIndexPress,
}: EventHubProps) {
  const accent = hub.accent ?? COLORS.goldAccent;
  const brand = brandForEvent(hub.slug);
  const pad = wide ? EVENT_STAGE.padWide : EVENT_STAGE.pad;
  const measure = Math.min(maxContentWidth ?? contentWidth, contentWidth);
  const inner = { width: '100%' as const, maxWidth: measure, alignSelf: 'center' as const };

  // Size the mark's box to the mark. `markMinHeight` is a 64pt reservation sized
  // for the tallest wordmark in the set, and a shorter one — Nintendo Direct
  // fits to 35 — was being centred inside it, which put ~15pt of nothing above
  // and below a logo that already had a 12pt gap on one side and 8 on the other.
  // That stack is the "awkward gap": four small paddings that read as one big
  // one. fitMark already returns the height, so the box can just be it.
  const markFit = brand ? fitMark(brand, wide ? 300 : 200, wide ? 108 : 78) : null;

  // The span the record covers. When the event is not live this is what the left
  // of the eyebrow row says — without it the row is a lone right-aligned pill
  // floating over an empty line, which is why the pill read as unmoored.
  const years = hub.editions.map((e) => e.editionSlug).filter((y) => /^\d{4}$/.test(y));
  const span =
    years.length > 1
      ? `${years[years.length - 1]}–${years[0]}`
      : years.length === 1
        ? years[0]
        : null;

  return (
    <View>
      {/* ── ink: what this is ─────────────────────────────────────────────── */}
      <View style={s.stage}>
        <View
          style={[
            inner,
            {
              paddingHorizontal: pad,
              paddingTop: topPad ?? (wide ? EVENT_STAGE.paddingTopWide : EVENT_STAGE.paddingTop),
            },
          ]}
        >
          {/* No "WATCHED EVENT" label. It named the page in a way the mark
              directly below already does, and cost a whole line at the top of
              every hub. The live state is worth saying because it changes what
              the page IS; "watched event" is not. */}
          <View style={s.eyebrowRow}>
            {hub.isLive ? (
              <Text style={[s.eyebrow, { color: accent }]}>Happening now</Text>
            ) : span ? (
              <Text style={s.eyebrowQuiet}>{`On record ${span}`}</Text>
            ) : (
              <View />
            )}
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

          {brand && markFit ? (
            <View style={[s.markBox, { height: markFit.height }]}>
              <brand.mark {...markFit} color={accent} fill={accent} />
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
            <EditionList
              editions={hub.editions}
              accent={accent}
              bestSpike={hub.bestSpike}
              onEditionPress={onEditionPress}
            />
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
  bestSpike,
  onEditionPress,
}: {
  editions: Hub['editions'];
  accent: string;
  /** The event's loudest edition, for drawing each row in proportion. */
  bestSpike?: number | null;
  onEditionPress: (editionSlug: string) => void;
}) {
  return (
    <View style={s.list}>
      {editions.map((e) => {
        // Drawn in proportion to this event's own loudest year, so the reader
        // can see which editions mattered without reading two decimals off
        // eight near-identical lines. Floored at 6% so a quiet year is still a
        // mark rather than nothing.
        const share =
          bestSpike && e.spikeRatio ? Math.max(0.06, Math.min(1, e.spikeRatio / bestSpike)) : 0;
        return (
          <Pressable
            key={e.editionSlug}
            style={s.row}
            onPress={() => onEditionPress(e.editionSlug)}
            accessibilityRole="button"
            accessibilityLabel={`${e.headline} ${e.editionSlug}`}
          >
            <View style={s.rowTop}>
              <View style={s.rowMain}>
                <Text style={[s.year, { color: accent }]}>{e.editionSlug}</Text>
                <Text style={s.rowWindow}>{formatWindow(e.liveFrom, e.liveTo) ?? '—'}</Text>
              </View>
              {/* The faces say what the year was about. Eight lines of
                  multiples do not, and this is the hub's only route into a
                  character page. `contain`, not `cover`: an avatar is a whole
                  mark and cropping it to a square box clips the silhouette. */}
              {e.faces.length > 0 && (
                <View style={s.faces}>
                  {e.faces.map((f) => (
                    <Image
                      key={f.heroId}
                      source={{ uri: f.portraitUrl }}
                      style={s.face}
                      contentFit="contain"
                      transition={160}
                      accessibilityLabel={f.name}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* The one line on this row that is not a measurement, and the only
                one that answers what the year was. It leads the metadata rather
                than following it: "Elden Ring won Game of the Year" is why a
                reader opens 2022, and "96.64× readership" is the evidence. */}
            {!!e.recap && (
              <Text style={s.rowRecap} numberOfLines={2}>
                {e.recap}
              </Text>
            )}

            <Text style={s.rowMeta}>
              {[
                e.spikeRatio !== null && e.spikeRatio > 1 ? `${e.spikeRatio}× readership` : null,
                e.announcements > 0
                  ? `${e.announcements} announcement${e.announcements === 1 ? '' : 's'}`
                  : null,
                e.movers > 0 ? `${e.movers} moved` : null,
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </Text>

            {share > 0 && (
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${share * 100}%`, backgroundColor: accent }]} />
              </View>
            )}
          </Pressable>
        );
      })}
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
  // The non-live counterpart. Deliberately not the accent: "happening now" is
  // the only state that has earned colour on this page.
  eyebrowQuiet: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    lineHeight: EVENT_STAGE.eyebrowLine,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
    marginBottom: EVENT_STAGE.eyebrowGap,
  },
  // No minHeight — the height is passed in from fitMark so the box is the mark.
  markBox: { alignItems: 'flex-start', justifyContent: 'center', marginBottom: 6 },
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
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  // Overlapped, like a credits strip — three separate circles read as three
  // things, an overlapped set reads as "the cast of that year".
  // The RPC serves heroes.avatar_url first — a flat head-icon on a transparent
  // ground, which is what survives being 30pt wide. Avatars are drawn to sit
  // FLAT on the page: no disc, no ring, no tint behind them. A circular crop
  // would cut the silhouette they were designed to keep, and a fill behind a
  // transparent PNG turns a mark into a sticker.
  //
  // That rules out the overlapped credits strip — flat cut-outs with no edge
  // merge into one blob — so the faces are spaced instead.
  faces: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  face: { width: 34, height: 34 },
  barTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(11,24,32,0.07)',
    marginTop: 10,
    overflow: 'hidden',
  },
  barFill: { height: 3, borderRadius: 999, opacity: 0.75 },

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
  // FlameSans and full-strength ink: this is editorial prose, and the numbers
  // under it are the apparatus. Clamped, so it needs 1.22x — but FlameSans, not
  // Flame, so 19/14.5 is comfortably clear of it.
  rowRecap: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: 19,
    color: COLORS.deepNavy,
    marginTop: 2,
    maxWidth: 520,
  },
  rowMeta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: 17,
    color: PAPER_TEXT.muted,
  },
});
