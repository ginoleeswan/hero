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
import { HeroFace } from './HeroFace';
import { Section } from './EventSection';
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
  // Read off the WINDOW, not the slug: an edition_slug is '2020-01' when a year
  // holds two shows, and a slug-shaped filter dropped those from the span.
  const years = hub.editions
    .map((e) => (e.liveFrom ?? e.editionSlug).slice(0, 4))
    .filter((y) => /^\d{4}$/.test(y));
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

      {/* ── paper: every edition caught ───────────────────────────────────── */}
      <EditionsArchive
        hub={hub}
        wide={wide}
        contentWidth={contentWidth}
        maxContentWidth={maxContentWidth}
        viewportHeight={viewportHeight}
        onEditionPress={onEditionPress}
      />
    </View>
  );
}

/**
 * The archive, as its own band: seam, paper, masthead, chart, list.
 *
 * It exists because three surfaces render this exact block — the hub, and both
 * halves of the live route — and all three had built it by hand. They had
 * already drifted: the native live page had no chart and never passed `wide`,
 * so a desktop reader on a live event got the phone rows while the same event's
 * hub got the desktop ones. The live pages also cut straight from the ink of
 * "Who it moved" into beige with no seam and a different, smaller heading, which
 * is what made the boundary read as weak — every other ink-to-paper edge in this
 * app is the orange hairline, and the section above it had already moved to the
 * rule-and-note masthead while this one was still a 23pt title with a caption
 * under it.
 *
 * Owning the seam here rather than in the callers is the point: the transition
 * belongs to the thing arriving, so it cannot be forgotten by the next surface
 * that renders an archive.
 */
export function EditionsArchive({
  hub,
  wide = false,
  contentWidth,
  maxContentWidth,
  viewportHeight,
  onEditionPress,
}: {
  hub: Hub;
  wide?: boolean;
  contentWidth: number;
  maxContentWidth?: number;
  viewportHeight?: number;
  onEditionPress: (editionSlug: string) => void;
}) {
  const accent = hub.accent ?? COLORS.goldAccent;
  const pad = wide ? EVENT_STAGE.padWide : EVENT_STAGE.pad;
  const measure = Math.min(maxContentWidth ?? contentWidth, contentWidth);
  const inner = { width: '100%' as const, maxWidth: measure, alignSelf: 'center' as const };

  return (
    <>
      <View style={s.seam} />
      <View style={[s.paper, viewportHeight ? { minHeight: viewportHeight * 0.5 } : null]}>
        <View style={[inner, { paddingHorizontal: pad }]}>
          <Section
            title="Editions"
            note={
              hub.editions.length === 1
                ? 'One edition on record'
                : `${hub.editions.length} editions on record`
            }
            wide={wide}
            topRule={false}
          >
            {hub.editions.length === 0 ? (
              // Not an error: a watched event that has not fired yet has nothing
              // to archive, and saying so beats an empty panel that reads as
              // broken.
              <Text style={s.empty}>
                Nothing archived yet. An edition is frozen the first time this event is detected as
                live.
              </Text>
            ) : (
              <EditionList
                editions={hub.editions}
                accent={accent}
                bestSpike={hub.bestSpike}
                wide={wide}
                onEditionPress={onEditionPress}
              />
            )}
          </Section>
        </View>
      </View>
    </>
  );
}

/**
 * Every edition on record, as a timeline.
 *
 * Exported because it appears in two places and must not be written twice: on the
 * hub (where it is the page) and beneath the LIVE dossier (where it is the way
 * back to previous years). Duplicating it is how the two would drift.
 *
 * It was a list of rows under a bar chart, and between them they drew the same
 * quantity three times — a bar in the chart, a bar under the row, and the
 * multiple written out in the meta line — while the thing a reader actually
 * wants from an archive, WHICH YEAR SHOULD I OPEN, was never stated. The chart
 * is gone and the arrangement now says what it is: a history, walked down a
 * spine, with the year as the anchor rather than a 23pt label sharing a line
 * with a date range.
 *
 * The spine is not decoration. Eight sibling rows in a stack read as search
 * results, where a marker on a line running through all of them reads as time
 * passing — which is exactly the claim the archive makes, and the reason the
 * years are worth putting next to each other at all.
 */
export function EditionList({
  editions,
  accent,
  bestSpike,
  wide = false,
  onEditionPress,
}: {
  editions: Hub['editions'];
  accent: string;
  /** The event's loudest edition. Marks one entry, rather than scaling all of
   *  them against a measure the page no longer prints. */
  bestSpike?: number | null;
  /** Desktop gives the year its own column beside the spine. A phone has no
   *  room for one, so the year leads the entry instead. */
  wide?: boolean;
  onEditionPress: (editionSlug: string) => void;
}) {
  return (
    <View style={s.timeline}>
      {editions.map((e, i) => {
        // The one year worth naming. A ranking phrase on every row is not a
        // ranking; on exactly one it is.
        const biggest = !!bestSpike && e.spikeRatio === bestSpike;
        const first = i === 0;
        const last = i === editions.length - 1;
        const year = e.editionSlug.slice(0, 4);

        // The YEAR, not the slug. An edition_slug carries a month when a year
        // holds two shows ('2020-01', '2020-07'), which the URL needs and a
        // reader does not: set as a display figure it reads as a hyphenated
        // number rather than a year. The window beside it tells the two apart,
        // and it does that better.
        const yearText = (
          <Text style={[s.year, wide ? s.yearWide : null, biggest ? { color: accent } : null]}>
            {year}
          </Text>
        );

        const faces = e.faces.length > 0 && (
          <View style={s.faces}>
            {e.faces.map((f) => (
              <HeroFace
                key={f.heroId}
                uri={f.portraitUrl}
                avatar={f.avatar}
                size={wide ? 38 : 34}
                name={f.name}
              />
            ))}
          </View>
        );

        return (
          <Pressable
            key={e.editionSlug}
            style={s.entry}
            onPress={() => onEditionPress(e.editionSlug)}
            accessibilityRole="button"
            accessibilityLabel={`${e.headline} ${year}${biggest ? ', the biggest year on record' : ''}`}
          >
            {/* Desktop: the year hangs in its own column, right-aligned against
                the spine, so eight of them make a readable column of dates down
                the page rather than eight sentences that happen to start with a
                number. */}
            {wide && <View style={s.yearCol}>{yearText}</View>}

            {/* The spine. Two segments and a marker rather than one absolutely
                positioned line, so the first entry has nothing above its dot and
                the last has nothing below it — a line that overshoots either end
                reads as a timeline that lost its data. */}
            <View style={s.spineCol}>
              {!first && <View style={s.spineUp} />}
              <View
                style={[s.dot, biggest ? { backgroundColor: accent, borderColor: accent } : null]}
              />
              {!last && <View style={s.spineDown} />}
            </View>

            <View style={s.entryBody}>
              <View style={s.entryHead}>
                {!wide && yearText}
                <Text style={s.entryWindow} numberOfLines={1}>
                  {formatWindow(e.liveFrom, e.liveTo) ?? '—'}
                </Text>
                {/* A phone puts the faces on the head line, where they belong to
                    the year. At 900+ that same pin strands them a quarter of the
                    page from the sentence they illustrate, so they move to the
                    right of the body instead. */}
                {!wide && <View style={s.headFaces}>{faces}</View>}
              </View>

              {/* The only line here that is not metadata, and the only one that
                  answers what the year WAS. "Marvel showed Fantastic Four" is
                  why a reader opens 2024. */}
              {!!e.recap && (
                <Text style={s.recap} numberOfLines={wide ? 2 : 3}>
                  {e.recap}
                </Text>
              )}

              {/* What HAPPENED, not what the instrument read. This line used to
                  open "146.03× readership", which is three problems in two
                  words: nobody outside this codebase knows what readership is a
                  multiple OF, the same × glyph meant a different quantity in
                  three other places on the page, and two decimals on an
                  attention proxy is a precision the number does not have — it
                  made a rough signal look like a laboratory result. */}
              <Text style={s.meta}>
                {[
                  biggest && e.spikeRatio !== null && e.spikeRatio > 1
                    ? 'Biggest year on record'
                    : null,
                  e.announcements > 0
                    ? `${e.announcements} announcement${e.announcements === 1 ? '' : 's'}`
                    : null,
                  e.movers > 0
                    ? `${e.movers} character${e.movers === 1 ? '' : 's'} broke out`
                    : null,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Text>
            </View>

            {wide && faces}
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

  // Section owns the masthead's own bottom margin, so the band's floor is the
  // only padding left to set here.
  paper: { backgroundColor: SURFACE.paper, paddingTop: 34, paddingBottom: 20 },
  empty: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: 20,
    color: PAPER_TEXT.muted,
    maxWidth: 460,
  },

  // ── the archive, as a timeline ──
  timeline: { marginTop: 8 },
  // `alignItems: stretch` (the default) is load-bearing: it is what gives the
  // spine column a definite height, which is what lets its lower segment flex to
  // fill the entry.
  entry: { flexDirection: 'row', paddingVertical: 18 },
  // Right-aligned against the spine, so eight years make one readable column of
  // dates down the page instead of eight sentences that start with a number.
  yearCol: { width: 104, alignItems: 'flex-end', paddingRight: 20 },
  year: { fontFamily: 'Flame-Regular', fontSize: 30, lineHeight: 37, color: PAPER_TEXT.muted },
  // Flame's ink spans ~119% of its em box, so a display figure needs 1.22x or
  // its descenders clip wherever a clamp is in play.
  yearWide: { fontSize: 38, lineHeight: 47, color: COLORS.deepNavy },

  spineCol: { width: 9, alignItems: 'center' },
  // 15pt: half of the narrow year's line box, so the marker lands on the middle
  // of the first line rather than at the top of the entry's padding.
  spineUp: { width: 1, height: 15, backgroundColor: 'rgba(11,24,32,0.16)' },
  spineDown: { flex: 1, width: 1, backgroundColor: 'rgba(11,24,32,0.16)', marginTop: 0 },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(11,24,32,0.28)',
    backgroundColor: SURFACE.paper,
  },

  entryBody: { flex: 1, minWidth: 0, gap: 4, paddingLeft: 20 },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  headFaces: { marginLeft: 'auto' },
  entryWindow: {
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
  recap: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: 19,
    color: COLORS.deepNavy,
    marginTop: 2,
    maxWidth: 560,
  },
  meta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: 17,
    color: PAPER_TEXT.muted,
  },
  // Spaced, not overlapped: flat avatar cut-outs with no edge merge into one
  // blob when they overlap, so the credits-strip look is off the table here.
  // flexShrink 0 keeps the set intact when the date beside it is long.
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    paddingLeft: 20,
  },
});
