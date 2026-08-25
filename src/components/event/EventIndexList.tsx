// src/components/event/EventIndexList.tsx
// Every event with a page, newest first. Shared body for both index routes —
// no scroll container of its own, same reason as EventDossier.
//
// Same seam grammar as the dossier: ink masthead, warm hairline, paper record.
// Each row carries its own detection curve as a thumbnail, so the list reads as
// a set of measurements rather than a menu — the shape of the spike IS the
// difference between one event and another.
import { View, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../ui/Text';
import { brandForEvent, fitMark } from '../../constants/eventBrands';
import { COLORS, SURFACE, INK_TEXT, PAPER_TEXT } from '../../constants/colors';
import { PAPER_SHEET_SURFACE } from '../ui/PaperSheet';
import { EventCurve } from './EventCurve';
import { EVENT_STAGE, EVENT_INDEX } from '../../constants/eventGeometry';
import { formatWindow } from '../../hooks/useEventDossier';
import type { EventIndex, EventIndexEntry } from '../../lib/db/events.dossier';

export interface EventIndexListProps {
  index: EventIndex;
  wide?: boolean;
  contentWidth: number;
  maxContentWidth?: number;
  /** Viewport height, so a short record still closes on paper rather than
   *  stopping mid-screen and reverting to ink. */
  viewportHeight?: number;
  /** Override the stage's top padding. The web routes pass a smaller value:
   *  a 64pt fixed masthead already occupies that zone, so the default —
   *  which is sized for a native screen with a nav header — stacked on top
   *  of the route's own offset and left ~120pt of dead ink above the fold. */
  topPad?: number;
  onEventPress: (slug: string) => void;
}

/**
 * One event, carried by its own mark.
 *
 * Twenty stacked detection curves was a scroll through abstraction: the shape of
 * a 2019 spike is not what makes anyone open a 2019 page, and a wall of
 * identical charts reads as one undifferentiated thing. Every watched event
 * already has a single-path mark that paints with currentColor, so each tile
 * takes the event's own accent as a wash — which is what makes twenty different
 * logos read as one designed set rather than a sponsor wall.
 */
function EventTile({
  e,
  cell,
  onPress,
}: {
  e: EventIndexEntry;
  cell: number;
  onPress: (slug: string) => void;
}) {
  const accent = e.accent ?? COLORS.goldAccent;
  const brand = brandForEvent(e.slug);
  const artH = Math.round(cell * 0.62);
  const span =
    e.editions > 1 && e.firstYear && e.lastYear
      ? `${e.editions} editions · ${e.firstYear}–${e.lastYear}`
      : e.editions === 1 && e.lastYear
        ? `One edition · ${e.lastYear}`
        : null;

  return (
    <Pressable
      style={[s.tile, { width: cell }]}
      onPress={() => onPress(e.slug)}
      accessibilityRole="button"
      accessibilityLabel={`${e.headline}${span ? `, ${span}` : ''}`}
    >
      {/* A pale wash of the event's own accent, NOT ink. Judged side by side on
          device: dark tiles read as holes punched in a warm page, where the wash
          sits with the paper and lets twenty different logos look like one set.
          The marks are legible at this size — the earlier "they wash out" call
          was made from a small crop with a browser toolbar over it. */}
      <View style={[s.tileArt, { height: artH, borderColor: `${accent}33` }]}>
        <LinearGradient
          colors={[`${accent}2b`, `${accent}0a`]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {brand ? (
          <brand.mark {...fitMark(brand, cell - 30, artH - 28)} color={accent} fill={accent} />
        ) : (
          // A row can land in watched_events before its mark does; the name is
          // the fallback, not a gap.
          <Text style={[s.tileFallback, { color: accent }]} numberOfLines={2}>
            {e.headline}
          </Text>
        )}
      </View>
      <Text style={s.tileName} numberOfLines={1}>
        {e.headline}
      </Text>
      {/* Two lines. "10 editions · 2015–2025 · best 3.4×" does not fit one line
          in a 171pt tile, and clamping it to one truncated the multiple mid-digit
          ("best 3…") on every tile in the phone grid. */}
      <Text style={s.tileMeta} numberOfLines={2}>
        {[span, e.bestSpike && e.bestSpike > 1 ? `best ${e.bestSpike}×` : null]
          .filter(Boolean)
          .join('  ·  ')}
      </Text>
    </Pressable>
  );
}

export function EventIndexList({
  index,
  wide = false,
  contentWidth,
  maxContentWidth,
  viewportHeight,
  topPad,
  onEventPress,
}: EventIndexListProps) {
  const pad = wide ? EVENT_STAGE.padWide : EVENT_STAGE.pad;
  const measure = Math.min(maxContentWidth ?? contentWidth, contentWidth);
  const inner = { width: '100%' as const, maxWidth: measure, alignSelf: 'center' as const };
  const { events, watching } = index;
  // Two up on a phone, more as the measure grows. Derived rather than fixed, so
  // every row reaches both edges at every width — the same rule the dossier's
  // grids use.
  const avail = Math.max(0, measure - pad * 2);
  const tileGap = 12;
  const tileCols = Math.max(2, Math.floor((avail + tileGap) / (168 + tileGap)));
  // Floored at zero: with no measured width yet, (0 - gap) / cols is negative,
  // and a negative cell propagates into every child that sizes from it.
  const tileCell = Math.max(0, Math.floor((avail - tileGap * (tileCols - 1)) / tileCols));
  const live = events.filter((e) => e.isLive);
  const rest = events.filter((e) => !e.isLive);
  // The fan year. With 128 frozen windows the season is a derived fact, and it
  // is the most interesting thing this page can say: eight of twenty events land
  // in July-September and three in April-June. An A-to-Z grid hides that; a
  // calendar states it. Quarters rather than months because a month view is
  // mostly empty rows, and rather than named seasons because "summer" is a
  // hemisphere's opinion where a month range is a fact.
  const QUARTERS: { label: string; note: string; months: number[] }[] = [
    { label: 'January – March', note: 'The quiet start', months: [1, 2, 3] },
    { label: 'April – June', note: 'The showcases begin', months: [4, 5, 6] },
    { label: 'July – September', note: 'Peak season', months: [7, 8, 9] },
    { label: 'October – December', note: 'The long tail', months: [10, 11, 12] },
  ];
  const quarters = QUARTERS.map((q) => ({
    ...q,
    events: rest.filter((e) => e.typicalMonth !== null && q.months.includes(e.typicalMonth)),
  })).filter((q) => q.events.length > 0);
  // An event with no window yet belongs to no month; it still belongs on the
  // page rather than being silently dropped.
  const undated = rest.filter((e) => e.typicalMonth === null);
  const spotlight = live[0] ?? null;
  const spotAccent = spotlight?.accent ?? COLORS.goldAccent;
  const spotBrand = spotlight ? brandForEvent(spotlight.slug) : undefined;
  const spotWindow = spotlight ? formatWindow(spotlight.statedFrom, spotlight.statedTo) : null;
  const totalEditions = events.reduce((n, e) => n + e.editions, 0);
  const earliestYear = events.reduce<string | null>(
    (y, e) => (e.firstYear && (!y || e.firstYear < y) ? e.firstYear : y),
    null,
  );

  return (
    <View>
      <View style={s.stage}>
        {/* The live event's curve, drawn full-bleed as the stage's texture and
            pinned to its floor — the dossier does exactly this, and it is what
            stops the masthead being a block of type. */}
        {spotlight && spotlight.viewsDaily.length > 0 && (
          <>
            <View style={[s.stageCurve, { height: EVENT_INDEX.rowCurveH }]} pointerEvents="none">
              <EventCurve
                series={spotlight.viewsDaily}
                from={spotlight.liveFrom}
                to={spotlight.liveTo}
                accent={spotAccent}
                width={contentWidth}
                height={EVENT_INDEX.rowCurveH}
              />
            </View>
            <LinearGradient
              colors={[SURFACE.ink, `${SURFACE.ink}cc`, 'transparent']}
              locations={[0, 0.42, 1]}
              style={[s.stageScrim, { height: EVENT_INDEX.rowCurveH + 36 }]}
              pointerEvents="none"
            />
          </>
        )}
        <View
          style={[
            inner,
            {
              paddingHorizontal: pad,
              paddingTop: topPad ?? (wide ? EVENT_STAGE.paddingTopWide : EVENT_STAGE.paddingTop),
            },
          ]}
        >
          <Text style={s.eyebrow}>The record</Text>
          <Text style={s.title}>Events we caught</Text>
          {/* The page's own scale, stated. It holds 128 editions going back to
              2018 and used to open by describing its method instead — a reader
              cannot tell a rich archive from an empty one without being told
              which it is. */}
          {totalEditions > 0 && (
            <Text style={s.scale}>
              <Text style={s.scaleNum}>{events.length}</Text> events ·{' '}
              <Text style={s.scaleNum}>{totalEditions}</Text> editions
              {earliestYear ? ` · back to ${earliestYear}` : ''}
            </Text>
          )}

          {/* No method paragraph here any more.
              It read "No calendar tells us a convention has started. Each one is
              watched through its own Wikipedia article, and appears here when
              the readership says so." — three lines explaining our instrument
              to a reader who came to see conventions, in the most valuable
              position on the page, directly under a headline and a count that
              already say what this is. It reassured the builder, not the fan.
              The scale line above carries the meaning that mattered. */}

          {/* The spotlight. It belongs on INK, not as the first row of the
              archive: this page's grammar is ink = the claim, paper = the
              record, and an event that is happening right now is a claim. On
              paper it was a row that happened to be first; here it is what the
              page opens on, in the event's own mark and its own accent — the
              same treatment the dossier masthead and the Pulse card give it. */}
          {spotlight && (
            <Pressable
              style={s.spot}
              onPress={() => onEventPress(spotlight.slug)}
              accessibilityRole="button"
              accessibilityLabel={`${spotlight.headline}, on now`}
            >
              <View style={s.spotRule} />
              <View style={s.spotRow}>
                <View style={[s.spotPip, { backgroundColor: spotAccent }]} />
                <Text style={[s.spotNow, { color: spotAccent }]}>On now</Text>
                {!!spotWindow && <Text style={s.spotWindow}>{spotWindow}</Text>}
              </View>
              {spotBrand ? (
                <View style={s.spotMark}>
                  <spotBrand.mark
                    {...fitMark(spotBrand, wide ? 260 : 196, wide ? 84 : 64)}
                    color={spotAccent}
                    fill={spotAccent}
                  />
                </View>
              ) : (
                <Text style={[s.spotName, { color: spotAccent }]}>{spotlight.headline}</Text>
              )}
              {spotlight.spikeRatio !== null && spotlight.spikeRatio > 1 && (
                <Text style={s.spotStat}>
                  <Text style={[s.spotStatNum, { color: spotAccent }]}>
                    {spotlight.spikeRatio}×
                  </Text>{' '}
                  usual readership
                  {spotlight.peak ? ` · peak ${spotlight.peak.toLocaleString()} a day` : ''}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>

      {/* No seam element — it is the sheet's own top edge now, so it curves with
          the corners instead of running flat across a rounded thing. */}
      <View style={[s.paper, viewportHeight ? { minHeight: viewportHeight * 0.72 } : null]}>
        <View style={[inner, { paddingHorizontal: pad }]}>
          {events.length === 0 ? (
            // An empty screen is an invitation, not an apology — and here it is
            // also the honest state: nothing has been confirmed yet.
            <Text style={s.empty}>
              Nothing confirmed yet. The next convention to move its own Wikipedia article will show
              up here.
            </Text>
          ) : (
            <>
              {(quarters.length > 0 || undated.length > 0) && (
                <>
                  {quarters.map((q) => (
                    <View key={q.label}>
                      <View style={s.seasonHead}>
                        <Text style={s.seasonLabel}>{q.label}</Text>
                        <View style={s.seasonRule} />
                        <Text style={s.seasonNote}>{q.note}</Text>
                      </View>
                      <View style={[s.tileGrid, { gap: tileGap }]}>
                        {q.events.map((e) => (
                          <EventTile key={e.slug} e={e} cell={tileCell} onPress={onEventPress} />
                        ))}
                      </View>
                    </View>
                  ))}
                  {undated.length > 0 && (
                    <View>
                      <View style={s.seasonHead}>
                        <Text style={s.seasonLabel}>No window yet</Text>
                        <View style={s.seasonRule} />
                      </View>
                      <View style={[s.tileGrid, { gap: tileGap }]}>
                        {undated.map((e) => (
                          <EventTile key={e.slug} e={e} cell={tileCell} onPress={onEventPress} />
                        ))}
                      </View>
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {watching.length > 0 && (
            <View style={s.watching}>
              <Text style={s.watchingTitle}>Also watching</Text>
              <Text style={s.watchingNote}>
                {watching.length} more, polled twice an hour. They move up when their own readership
                breaks out.
              </Text>
              <View style={s.chips}>
                {watching.map((w) => (
                  <View key={w.slug} style={s.chip}>
                    <Text style={s.chipText}>{w.headline}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Explicit line boxes throughout — see EVENT_INDEX. Left to the font's own
  // metrics they were unknowable to the placeholder that has to mirror them.
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    lineHeight: EVENT_INDEX.eyebrowLine,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: EVENT_INDEX.eyebrowGap,
  },
  // Flame needs lineHeight >= 1.22x fontSize.
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 36,
    lineHeight: EVENT_INDEX.titleLine,
    color: COLORS.beige,
  },
  method: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    lineHeight: EVENT_INDEX.methodLine,
    color: INK_TEXT.faint,
    maxWidth: 520,
    marginTop: EVENT_INDEX.methodGap,
  },
  // The shared sheet — see src/components/ui/PaperSheet.tsx. No foot: this band
  // is the last thing on the index, and PageEndCap closes it.
  paper: {
    ...PAPER_SHEET_SURFACE,
    paddingTop: EVENT_INDEX.paperPaddingTop,
    paddingBottom: EVENT_INDEX.paperPaddingBottom,
  },
  empty: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    lineHeight: 23,
    color: PAPER_TEXT.muted,
    maxWidth: 460,
  },
  row: {
    paddingVertical: EVENT_INDEX.rowPaddingVertical,
    borderBottomWidth: EVENT_INDEX.rowBorder,
    borderBottomColor: 'rgba(11,24,32,0.10)',
    gap: EVENT_INDEX.rowGap,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 24,
    lineHeight: EVENT_INDEX.rowTitleLine,
    color: COLORS.deepNavy,
  },
  livePip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  livePipText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.deepNavy,
  },
  rowWindow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    lineHeight: EVENT_INDEX.rowWindowLine,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: PAPER_TEXT.muted,
  },
  rowCurve: { marginTop: EVENT_INDEX.rowCurveGap, marginBottom: EVENT_INDEX.rowCurveGap },

  // The stage owns the curve, so it must clip and stack.
  stage: { backgroundColor: SURFACE.ink, paddingBottom: 28, overflow: 'hidden' },
  stageCurve: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  stageScrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  // Bottom clearance is deliberate: the curve is pinned to the stage floor at
  // 76pt, so without it the stat line sits on top of the plot. The dossier
  // solves the same collision with EVENT_STAGE.curveClearance.
  spot: { marginTop: 22, marginBottom: EVENT_INDEX.rowCurveH * 0.5 },
  // A hairline rather than a card. The spotlight is part of the masthead, not a
  // panel sitting on it — a boxed card here would read as an advert.
  spotRule: { height: 1, backgroundColor: 'rgba(245,235,220,0.16)', marginBottom: 16 },
  spotRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 },
  spotPip: { width: 7, height: 7, borderRadius: 4 },
  spotNow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  spotWindow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.6)',
  },
  spotMark: { alignItems: 'flex-start', justifyContent: 'center', minHeight: 64 },
  spotName: { fontFamily: 'Flame-Regular', fontSize: 38, lineHeight: 46 },
  spotStat: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: 21,
    color: 'rgba(245,235,220,0.72)',
    marginTop: 12,
  },
  spotStatNum: { fontFamily: 'Nunito_700Bold', fontSize: 18 },

  scale: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: 21,
    color: INK_TEXT.faint,
    marginTop: 12,
  },
  scaleNum: { fontFamily: 'Nunito_700Bold', color: COLORS.beige },
  liveMark: { justifyContent: 'center', minHeight: 56 },

  seasonHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 30,
    marginBottom: 14,
  },
  seasonLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.deepNavy,
  },
  // The rule does the separating so the label can stay quiet — a calendar
  // heading should not compete with the marks underneath it.
  seasonRule: { flex: 1, height: 1, backgroundColor: 'rgba(11,24,32,0.12)' },
  seasonNote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: PAPER_TEXT.muted,
  },
  gridHead: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: PAPER_TEXT.muted,
    marginTop: 26,
    marginBottom: 14,
  },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { gap: 7 },
  // The mark sits on a wash of the event's own accent rather than on bare
  // paper: a single-path silhouette on beige reads as a stain, and the wash is
  // what makes twenty different logos look like one designed set.
  tileArt: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileFallback: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  tileName: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.deepNavy,
  },
  tileMeta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    lineHeight: 15,
    color: PAPER_TEXT.muted,
  },

  rowStat: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: EVENT_INDEX.rowStatLine,
    color: PAPER_TEXT.muted,
  },
  rowStatNum: { fontFamily: 'Nunito_700Bold' },

  // The roster of everything not yet caught. Quiet by construction: it is
  // context, not a menu, and nothing here is tappable because there is nothing
  // to show yet.
  watching: { marginTop: 34 },
  watchingTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 21,
    lineHeight: 26,
    color: 'rgba(11,24,32,0.72)',
  },
  watchingNote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: PAPER_TEXT.muted,
    marginTop: 2,
    maxWidth: 460,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(11,24,32,0.14)',
  },
  chipText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12.5,
    color: PAPER_TEXT.muted,
  },
});
