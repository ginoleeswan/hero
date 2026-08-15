// src/components/event/EventIndexList.tsx
// Every event with a page, newest first. Shared body for both index routes —
// no scroll container of its own, same reason as EventDossier.
//
// Same seam grammar as the dossier: ink masthead, warm hairline, paper record.
// Each row carries its own detection curve as a thumbnail, so the list reads as
// a set of measurements rather than a menu — the shape of the spike IS the
// difference between one event and another.
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '../ui/Text';
import { COLORS, SEAM_COLOR, SURFACE, INK_TEXT, PAPER_TEXT } from '../../constants/colors';
import { EventCurve } from './EventCurve';
import { EVENT_STAGE, EVENT_INDEX } from '../../constants/eventGeometry';
import { formatWindow } from '../../hooks/useEventDossier';
import type { EventIndex } from '../../lib/db/events.dossier';

export interface EventIndexListProps {
  index: EventIndex;
  wide?: boolean;
  contentWidth: number;
  maxContentWidth?: number;
  /** Viewport height, so a short record still closes on paper rather than
   *  stopping mid-screen and reverting to ink. */
  viewportHeight?: number;
  onEventPress: (slug: string) => void;
}

export function EventIndexList({
  index,
  wide = false,
  contentWidth,
  maxContentWidth,
  viewportHeight,
  onEventPress,
}: EventIndexListProps) {
  const pad = wide ? EVENT_STAGE.padWide : EVENT_STAGE.pad;
  const measure = Math.min(maxContentWidth ?? contentWidth, contentWidth);
  const inner = { width: '100%' as const, maxWidth: measure, alignSelf: 'center' as const };
  // The curve bleeds to the band's edges rather than sitting inset. Boxed inside
  // the gutter it read as a floating rectangle; edge to edge it reads as a
  // measurement the row is made of — and on a phone the band edge IS the screen
  // edge, which is where the drama is.
  const bleed = Math.max(0, measure);
  const { events, watching } = index;

  return (
    <View>
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
          <Text style={s.eyebrow}>The record</Text>
          <Text style={s.title}>Events we caught</Text>
          {/* Fixed three-line box on phone, so the placeholder can mirror it
              exactly rather than approximate the font's own wrapping. */}
          <Text
            style={[
              s.method,
              wide ? null : { height: EVENT_INDEX.methodLine * EVENT_INDEX.methodLines },
            ]}
            numberOfLines={wide ? undefined : EVENT_INDEX.methodLines}
          >
            No calendar tells us a convention has started. Each one is watched through its own
            Wikipedia article, and appears here when the readership says so.
          </Text>
        </View>
      </View>

      <View style={s.seam} />

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
            events.map((e) => {
              const accent = e.accent ?? COLORS.goldAccent;
              const win = formatWindow(e.liveFrom, e.liveTo);
              return (
                <Pressable
                  key={e.slug}
                  style={s.row}
                  onPress={() => onEventPress(e.slug)}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.headline}${win ? `, ${win}` : ''}`}
                >
                  <View style={s.rowHead}>
                    {/* The name, not the mark. A boxed logo like SDCC's renders
                        as a muddy dark stamp at row height — the fine "SAN DIEGO
                        / INTERNATIONAL" rules mush — and a list wants to be
                        scannable. The mark belongs to the destination. */}
                    <Text style={s.rowTitle}>{e.headline}</Text>
                    {e.isLive && (
                      <View style={[s.livePip, { backgroundColor: accent }]}>
                        <Text style={s.livePipText}>On now</Text>
                      </View>
                    )}
                  </View>

                  {!!win && <Text style={s.rowWindow}>{win}</Text>}

                  {/* The measurement, at a glance. Two events differ by the shape
                      of their spike more than by their name. */}
                  <View style={[s.rowCurve, { marginHorizontal: -pad }]}>
                    <EventCurve
                      series={e.viewsDaily}
                      from={e.liveFrom}
                      to={e.liveTo}
                      accent={accent}
                      width={bleed}
                      height={wide ? EVENT_INDEX.rowCurveHWide : EVENT_INDEX.rowCurveH}
                    />
                  </View>

                  {/* Only when it is a rise. A caught event can carry a ratio
                      BELOW 1 — SDCC 2026 was detected at 3.35x and its row read
                      "0.82x usual readership", because the spike rolled out of
                      the rolling curve after detection. A sub-1 multiple on a
                      page about an event reads as a broken number. The peak is
                      still worth stating on its own: it is a fact either way. */}
                  {e.spikeRatio !== null && e.spikeRatio > 1 ? (
                    <Text style={s.rowStat}>
                      <Text style={[s.rowStatNum, { color: COLORS.deepNavy }]}>
                        {e.spikeRatio}×
                      </Text>{' '}
                      usual readership
                      {e.peak ? ` · peak ${e.peak.toLocaleString()} a day` : ''}
                    </Text>
                  ) : e.peak ? (
                    <Text style={s.rowStat}>
                      <Text style={[s.rowStatNum, { color: COLORS.deepNavy }]}>
                        {e.peak.toLocaleString()}
                      </Text>{' '}
                      readers on its busiest day
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
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
  stage: { backgroundColor: SURFACE.ink, paddingBottom: EVENT_INDEX.stagePaddingBottom },
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
  seam: { height: 1, backgroundColor: SEAM_COLOR },
  paper: {
    backgroundColor: SURFACE.paper,
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
