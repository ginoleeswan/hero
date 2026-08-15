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
import { PAPER_SHEET_SURFACE } from '../ui/PaperSheet';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SURFACE, INK_TEXT, PAPER_TEXT } from '../../constants/colors';
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
  //
  // The edition currently running. Matched on the window rather than assumed to
  // be the newest row: the freeze job writes the live edition as it goes, and a
  // hub that sent a reader to the wrong year during the one event of the year it
  // matters would be the worst possible time to be approximately right.
  const liveEdition = hub.isLive
    ? (hub.editions.find((e) => !!hub.liveFrom && e.liveFrom === hub.liveFrom) ?? hub.editions[0])
    : null;

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

          {/* Live gets the current window and a route into the running edition.
              This button is what pays for the hub being permanent: the old
              arrangement made THIS url the live dossier so the Pulse rail landed
              on the news, at the cost of the same content living at two
              addresses. One filled control, above the fold, in the event's own
              accent is not a menu — it is the shortest possible path to the
              thing the rail is advertising, and it orients the reader on the way
              rather than dropping them into the middle of a dossier. */}
          {hub.isLive ? (
            <>
              <Text style={s.window}>
                {formatWindow(hub.liveFrom, hub.liveTo) ?? 'Running now'}
              </Text>
              {!!liveEdition && (
                <Pressable
                  style={[s.liveCta, { backgroundColor: accent }]}
                  onPress={() => onEditionPress(liveEdition.editionSlug)}
                  accessibilityRole="button"
                  accessibilityLabel={`See what is dropping at ${hub.headline} right now`}
                >
                  <Text style={s.liveCtaText}>See what’s dropping</Text>
                  <Ionicons name="arrow-forward" size={15} color={COLORS.deepNavy} />
                </Pressable>
              )}
            </>
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
 * The archive, as its own band: seam, paper, masthead, timeline.
 *
 * Three surfaces used to render this block and all three had built it by hand,
 * which is exactly how they drifted: the native live page had no chart and never
 * passed `wide`, so a desktop reader on a live event got the phone rows while
 * the same event's hub got the desktop ones, and both live pages cut straight
 * from the ink of "Who it moved" into beige with no seam and a heading two steps
 * smaller than the section above.
 *
 * There is one surface now — the hub — because that is where an archive belongs,
 * and the live route no longer exists to carry a second copy. It stays a
 * component rather than being inlined because it owns the SEAM, and the seam
 * belongs to the thing arriving: whatever renders an archive next cannot forget
 * the transition into it.
 */
function EditionsArchive({
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
      {/* No seam element — it is the sheet's own top edge now, so it curves with
          the corners instead of running flat across a rounded thing. */}
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
                liveFrom={hub.isLive ? hub.liveFrom : null}
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
  liveFrom = null,
  wide = false,
  onEditionPress,
}: {
  editions: Hub['editions'];
  accent: string;
  /** The event's loudest edition. Marks one entry, rather than scaling all of
   *  them against a measure the page no longer prints. */
  bestSpike?: number | null;
  /** The running edition's window, when one is running. The entry it matches is
   *  marked live rather than dated — during the one event of the year anybody is
   *  looking, "Happening now" is the only line on the page worth reading. */
  liveFrom?: string | null;
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
        const live = !!liveFrom && e.liveFrom === liveFrom;
        const first = i === 0;
        const last = i === editions.length - 1;
        const year = e.editionSlug.slice(0, 4);

        // The YEAR, not the slug. An edition_slug carries a month when a year
        // holds two shows ('2020-01', '2020-07'), which the URL needs and a
        // reader does not: set as a display figure it reads as a hyphenated
        // number rather than a year. The window beside it tells the two apart,
        // and it does that better.
        const yearText = (
          <Text
            style={[s.year, wide ? s.yearWide : null, live || biggest ? { color: accent } : null]}
          >
            {year}
          </Text>
        );

        const faces = e.faces.length > 0 && (
          <View style={[s.faces, wide ? null : s.facesUnder]}>
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
            accessibilityLabel={`${e.headline} ${year}${live ? ', happening now' : biggest ? ', the biggest year on record' : ''}`}
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
                style={[
                  s.dot,
                  live || biggest ? { backgroundColor: accent, borderColor: accent } : null,
                  // A ring around the running edition's marker, so the eye lands
                  // on it before it lands on the biggest year — one of these is
                  // news and the other is history.
                  live ? [s.dotLive, { shadowColor: accent }] : null,
                ]}
              />
              {!last && <View style={s.spineDown} />}
            </View>

            <View style={s.entryBody}>
              <View style={s.entryHead}>
                {!wide && yearText}
                <Text style={[s.entryWindow, live ? { color: accent } : null]} numberOfLines={1}>
                  {live ? 'Happening now' : (formatWindow(e.liveFrom, e.liveTo) ?? '—')}
                </Text>
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
                  live ? (formatWindow(e.liveFrom, e.liveTo) ?? null) : null,
                  !live && biggest && e.spikeRatio !== null && e.spikeRatio > 1
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

              {/* Desktop pins the faces to the right of the entry, where they
                  read against the whole block. A phone has no right-hand column,
                  and pinning them to the head line made the arrangement depend on
                  the length of the date beside them — "30 AUGUST – 1 SEPTEMBER
                  2025" wrapped them onto a line of their own while a shorter
                  window kept them inline, so no two entries matched. Under the
                  entry they land in the same place every time. */}
              {!wide && faces}
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

  // Filled, not outlined. Every other control on this stage is a hairline pill;
  // this one is the page's only action while an event is running, and it has to
  // win against a wordmark set 300pt wide directly above it.
  liveCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 16,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  liveCtaText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14.5,
    letterSpacing: 0.2,
    color: COLORS.deepNavy,
  },

  // The shared sheet — see src/components/ui/PaperSheet.tsx. No foot: this band
  // is the last thing on the hub, and PageEndCap already closes it with its own
  // rounded beige foot. Two feet stack into a beige lip on a beige lip.
  //
  // Section owns the masthead's own bottom margin, so the band's floor is the
  // only padding left to set here.
  paper: { ...PAPER_SHEET_SURFACE, paddingTop: 34, paddingBottom: 20 },
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
  // No animation. A pulsing marker is the most literal thing Reduce Motion
  // exists to suppress, and it would be a `withRepeat(-1)` on a page that is
  // otherwise still — a glow states the same thing and states it at rest.
  dotLive: {
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },

  entryBody: { flex: 1, minWidth: 0, gap: 4, paddingLeft: 20 },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
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
  // Under the entry on a phone, so it needs the gap above it that the desktop
  // arrangement gets from sitting in its own column.
  facesUnder: { paddingLeft: 0, marginTop: 8 },
});
