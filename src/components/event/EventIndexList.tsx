// src/components/event/EventIndexList.tsx
// Every event with a page, newest first. Shared body for both index routes —
// no scroll container of its own, same reason as EventDossier.
//
// Same seam grammar as the dossier: ink masthead, warm hairline, paper record.
// Each row carries its own detection curve as a thumbnail, so the list reads as
// a set of measurements rather than a menu — the shape of the spike IS the
// difference between one event and another.
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { COLORS, SEAM_COLOR, SURFACE } from '../../constants/colors';
import { brandForEvent, fitMark } from '../../constants/eventBrands';
import { EventCurve } from './EventCurve';
import { formatWindow } from '../../hooks/useEventDossier';
import type { EventIndex } from '../../lib/db/events.dossier';

export interface EventIndexListProps {
  index: EventIndex;
  wide?: boolean;
  contentWidth: number;
  maxContentWidth?: number;
  onEventPress: (slug: string) => void;
}

export function EventIndexList({
  index,
  wide = false,
  contentWidth,
  maxContentWidth,
  onEventPress,
}: EventIndexListProps) {
  const pad = wide ? 40 : 18;
  const measure = Math.min(maxContentWidth ?? contentWidth, contentWidth);
  const inner = { width: '100%' as const, maxWidth: measure, alignSelf: 'center' as const };
  const { events, watched } = index;

  return (
    <View>
      <View style={s.stage}>
        <View style={[inner, { paddingHorizontal: pad, paddingTop: wide ? 44 : 28 }]}>
          <Text style={s.eyebrow}>The record</Text>
          <Text style={s.title}>Events we caught</Text>
          <Text style={s.method}>
            {watched > 0
              ? `${watched} conventions and showcases are checked twice an hour. ` +
                'They only appear here once their own readership says they started.'
              : 'Events appear here once their own readership says they started.'}
          </Text>
        </View>
      </View>

      <View style={s.seam} />

      <View style={s.paper}>
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
              const brand = brandForEvent(e.slug);
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
                    {brand ? (
                      <brand.mark
                        {...fitMark(brand, 150, 46)}
                        color={COLORS.deepNavy}
                        fill={COLORS.deepNavy}
                      />
                    ) : (
                      <Text style={s.rowTitle}>{e.headline}</Text>
                    )}
                    {e.isLive && (
                      <View style={[s.livePip, { backgroundColor: accent }]}>
                        <Text style={s.livePipText}>On now</Text>
                      </View>
                    )}
                  </View>

                  {!!win && <Text style={s.rowWindow}>{win}</Text>}

                  {/* The measurement, at a glance. Two events differ by the shape
                      of their spike more than by their name. */}
                  <View style={s.rowCurve}>
                    <EventCurve
                      series={e.viewsDaily}
                      from={e.liveFrom}
                      to={e.liveTo}
                      accent={accent}
                      width={Math.min(measure - pad * 2, 420)}
                      height={54}
                    />
                  </View>

                  {e.spikeRatio !== null && (
                    <Text style={s.rowStat}>
                      <Text style={[s.rowStatNum, { color: COLORS.deepNavy }]}>
                        {e.spikeRatio}×
                      </Text>{' '}
                      usual readership
                      {e.peak ? ` · peak ${e.peak.toLocaleString()} a day` : ''}
                    </Text>
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  stage: { backgroundColor: SURFACE.ink, paddingBottom: 28 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 10,
  },
  // Flame needs lineHeight >= 1.22x fontSize.
  title: { fontFamily: 'Flame-Regular', fontSize: 36, lineHeight: 45, color: COLORS.beige },
  method: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(245,235,220,0.54)',
    maxWidth: 520,
    marginTop: 10,
  },
  seam: { height: 1, backgroundColor: SEAM_COLOR },
  paper: { backgroundColor: SURFACE.paper, paddingTop: 30, paddingBottom: 64 },
  empty: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(11,24,32,0.6)',
    maxWidth: 460,
  },
  row: {
    paddingVertical: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(11,24,32,0.10)',
    gap: 8,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontFamily: 'Flame-Regular', fontSize: 24, lineHeight: 30, color: COLORS.deepNavy },
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
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: 'rgba(11,24,32,0.55)',
  },
  rowCurve: { marginTop: 4 },
  rowStat: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(11,24,32,0.6)',
  },
  rowStatNum: { fontFamily: 'Nunito_700Bold' },
});
