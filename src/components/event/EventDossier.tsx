// src/components/event/EventDossier.tsx
// The body of an event page, shared by both routes.
//
// Deliberately NOT a screen: it renders no scroll container of its own, because
// the web route must scroll the document (see the web-document-scroll rule) while
// the native one uses a ScrollView.
//
// Built on the house seam signature — an ink stage landing on beige paper with
// the warm hairline between (SURFACE / SEAM_COLOR). The structure carries meaning
// rather than decorating: ink is the EVIDENCE (how we know this happened — a
// claim about our own instrument), paper is the RECORD (what it did to the
// catalogue). Measurement above the seam, dossier below it.
//
// Boldness is spent in one place: the detection curve, drawn full-bleed as the
// masthead's texture. Everything under the seam stays quiet so it keeps that job.
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SEAM_COLOR, SURFACE } from '../../constants/colors';
import { brandForEvent, fitMark } from '../../constants/eventBrands';
import { EventCurve } from './EventCurve';
import type { EventDossier as Dossier, EventTrailer } from '../../lib/db/events.dossier';

export interface EventDossierProps {
  dossier: Dossier;
  windowLabel: string | null;
  windowDays: number | null;
  wide?: boolean;
  /** Viewport width — the bands bleed to this. */
  contentWidth: number;
  /** Reading measure for content inside the bands. */
  maxContentWidth?: number;
  /** Viewport height, so a thin dossier still closes on paper. */
  viewportHeight?: number;
  onTitlePress: (titleId: string) => void;
  onHeroPress: (heroId: string) => void;
  onIssuePress: (issueId: string) => void;
  /** Back to the index. Optional so the component stays usable without it. */
  onIndexPress?: () => void;
}

export function EventDossier({
  dossier,
  windowLabel,
  windowDays,
  wide = false,
  contentWidth,
  maxContentWidth,
  viewportHeight,
  onTitlePress,
  onHeroPress,
  onIssuePress,
  onIndexPress,
}: EventDossierProps) {
  const { event, trailers, surges, issues } = dossier;
  const accent = event.accent ?? COLORS.goldAccent;
  const brand = brandForEvent(event.slug);
  const pad = wide ? 40 : 18;
  const measure = Math.min(maxContentWidth ?? contentWidth, contentWidth);
  const inner = { width: '100%' as const, maxWidth: measure, alignSelf: 'center' as const };
  const curveH = wide ? 190 : 150;

  // Fluid grids. Fixed-width cells left a ragged gutter — at 390 the faces
  // filled 284 of 354px and the row stopped dead two-thirds across. Columns are
  // derived from the space actually available, then the cells divide it exactly,
  // so every row reaches both edges at every width.
  const avail = Math.max(0, measure - pad * 2);
  const grid = (gap: number, ideal: number, min = 2) => {
    const cols = Math.max(min, Math.floor((avail + gap) / (ideal + gap)));
    return { cols, cell: Math.floor((avail - gap * (cols - 1)) / cols), gap };
  };
  const posterGrid = grid(14, 150);
  const faceGrid = grid(14, 132, 3);
  const coverGrid = grid(10, 104, 3);

  const [lead, ...rest] = trailers;

  return (
    <View>
      {/* ── ink: the evidence ─────────────────────────────────────────────── */}
      <View style={s.stage}>
        {/* Full-bleed curve as the stage's texture, pinned to the floor. */}
        <View style={[s.curveLayer, { height: curveH }]} pointerEvents="none">
          <EventCurve
            series={event.viewsDaily}
            from={event.liveFrom}
            to={event.liveTo}
            accent={accent}
            width={contentWidth}
            height={curveH}
          />
        </View>
        {/* Ink falls over the top of the curve so type never fights the plot. */}
        <LinearGradient
          colors={[SURFACE.ink, `${SURFACE.ink}cc`, 'transparent']}
          locations={[0, 0.38, 1]}
          style={[s.curveScrim, { height: curveH + 40 }]}
          pointerEvents="none"
        />

        <View style={[inner, { paddingHorizontal: pad, paddingTop: wide ? 44 : 28 }]}>
          {onIndexPress ? (
            <Pressable onPress={onIndexPress} accessibilityRole="link">
              <Text style={[s.eyebrow, { color: accent }]}>
                {(event.ongoing ? 'Happening now' : 'Detected event') + '  ·  All events'}
              </Text>
            </Pressable>
          ) : (
            <Text style={[s.eyebrow, { color: accent }]}>
              {event.ongoing ? 'Happening now' : 'Detected event'}
            </Text>
          )}

          {brand ? (
            <View style={s.markBox}>
              <brand.mark
                {...fitMark(brand, wide ? 300 : 200, wide ? 108 : 78)}
                color={accent}
                fill={accent}
              />
            </View>
          ) : (
            <Text style={[s.title, { color: accent }]}>{event.headline}</Text>
          )}

          {!!windowLabel && (
            <Text style={s.window}>
              {windowLabel}
              {windowDays ? ` · ${windowDays} day${windowDays === 1 ? '' : 's'}` : ''}
            </Text>
          )}

          <Text style={s.method}>
            No calendar told us this was on. The window is inferred from readership on the
            event&rsquo;s own Wikipedia article.
          </Text>

          {/* The measurements, given the weight they deserve. The multiplier is
              the claim; the other two are its supporting evidence. */}
          <View
            style={[
              s.stats,
              { marginTop: wide ? 26 : 20, marginBottom: curveH * (wide ? 0.44 : 0.6) },
            ]}
          >
            {event.spikeRatio !== null && (
              <Stat value={`${event.spikeRatio}×`} label="usual readership" accent={accent} big />
            )}
            {!!event.peak && <Stat value={event.peak.toLocaleString()} label="peak day" />}
            {!!event.editsRecent && (
              <Stat value={String(event.editsRecent)} label="article edits" />
            )}
          </View>
        </View>
      </View>

      <View style={s.seam} />

      {/* ── paper: the record ─────────────────────────────────────────────── */}
      <View style={[s.paper, viewportHeight ? { minHeight: viewportHeight * 0.6 } : null]}>
        <View style={[inner, { paddingHorizontal: pad }]}>
          {trailers.length > 0 && (
            <Section title="What dropped" note="Trailers published inside the window">
              {/* The lead gets its backdrop at size — these are the best images
                  on the page and a 52px thumbnail wasted them. */}
              <LeadTrailer trailer={lead} onPress={onTitlePress} accent={accent} />
              {rest.length > 0 && (
                <View style={[s.posterRow, { gap: posterGrid.gap }]}>
                  {rest.map((t) => (
                    <Pressable
                      key={t.titleId}
                      style={[s.posterCell, { width: posterGrid.cell }]}
                      onPress={() => onTitlePress(t.titleId)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.title}, ${t.videoType ?? 'trailer'}`}
                    >
                      {!!(t.posterUrl ?? t.backdropUrl) && (
                        <Image
                          source={{ uri: (t.posterUrl ?? t.backdropUrl) as string }}
                          style={[
                            s.poster,
                            { width: posterGrid.cell, height: posterGrid.cell * 1.5 },
                          ]}
                          contentFit="cover"
                          transition={160}
                        />
                      )}
                      <Text style={s.posterTitle} numberOfLines={2}>
                        {t.title}
                      </Text>
                      <Text style={s.posterMeta}>{t.videoType ?? 'Trailer'}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </Section>
          )}

          {surges.length > 0 && (
            <Section title="Who it moved" note="Readership that broke out during the window">
              <View style={[s.faceGrid, { gap: faceGrid.gap }]}>
                {surges.map((sg) => (
                  <Pressable
                    key={sg.heroId}
                    style={[s.faceCell, { width: faceGrid.cell }]}
                    onPress={() => onHeroPress(sg.heroId)}
                    accessibilityRole="button"
                    accessibilityLabel={`${sg.name}, ${sg.spike}× reads`}
                  >
                    <View style={[s.faceWrap, { width: faceGrid.cell, height: faceGrid.cell }]}>
                      {!!sg.portraitUrl && (
                        <Image
                          source={{ uri: sg.portraitUrl }}
                          style={[
                            s.face,
                            {
                              width: faceGrid.cell,
                              height: faceGrid.cell,
                              borderRadius: faceGrid.cell / 2,
                            },
                          ]}
                          contentFit="cover"
                          transition={160}
                        />
                      )}
                      {sg.spike !== null && (
                        <View style={[s.spikePip, { backgroundColor: accent }]}>
                          <Text style={s.spikePipText}>{sg.spike}×</Text>
                        </View>
                      )}
                    </View>
                    {/* Two lines: at three columns on a phone a longer name
                        ("William Leather") was being cut mid-word. */}
                    <Text style={s.faceName} numberOfLines={2}>
                      {sg.name}
                    </Text>
                    {/* Temporal, never causal — the join proves sequence, not cause. */}
                    <Text style={s.faceCause} numberOfLines={2}>
                      {sg.causeLabel ? `after ${sg.causeLabel}` : (sg.publisher ?? '')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Section>
          )}

          {issues.length > 0 && (
            <Section title="On shelves that week" note="Comics that shipped alongside it">
              <View style={[s.covers, { gap: coverGrid.gap }]}>
                {issues.map((i) => (
                  <Pressable
                    key={i.id}
                    onPress={() => onIssuePress(i.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${i.volumeName} ${i.issueNumber ?? ''}`}
                  >
                    {!!i.coverUrl && (
                      <Image
                        source={{ uri: i.coverUrl }}
                        style={[
                          s.cover,
                          { width: coverGrid.cell, height: Math.round(coverGrid.cell * 1.52) },
                        ]}
                        contentFit="cover"
                        transition={160}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            </Section>
          )}
        </View>
      </View>
    </View>
  );
}

function Stat({
  value,
  label,
  accent,
  big = false,
}: {
  value: string;
  label: string;
  accent?: string;
  big?: boolean;
}) {
  return (
    <View style={s.stat}>
      <Text style={[big ? s.statBig : s.statValue, accent ? { color: accent } : null]}>
        {value}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function LeadTrailer({
  trailer,
  onPress,
  accent,
}: {
  trailer: EventTrailer;
  onPress: (id: string) => void;
  accent: string;
}) {
  const art = trailer.backdropUrl ?? trailer.posterUrl;
  return (
    <Pressable
      style={s.lead}
      onPress={() => onPress(trailer.titleId)}
      accessibilityRole="button"
      accessibilityLabel={`${trailer.title}, ${trailer.videoType ?? 'trailer'}`}
    >
      {!!art && (
        <Image source={{ uri: art }} style={s.leadArt} contentFit="cover" transition={180} />
      )}
      <LinearGradient
        colors={['rgba(11,24,32,0)', 'rgba(11,24,32,0.55)', 'rgba(11,24,32,0.93)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.leadBody}>
        <Text style={[s.leadKicker, { color: accent }]}>
          {(trailer.videoType ?? 'Trailer').toUpperCase()}
        </Text>
        <Text style={s.leadTitle} numberOfLines={2}>
          {trailer.title}
        </Text>
        {trailer.castCount > 0 && (
          <Text style={s.leadMeta}>{trailer.castCount} characters in the catalogue</Text>
        )}
      </View>
    </Pressable>
  );
}

/** A heading plus the one line that says what the list is made of. Not
 *  decoration: each list has a different rule behind it and the reader has no
 *  other way to know that. */
function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.sectionNote}>{note}</Text>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  // ── ink ──
  stage: { backgroundColor: SURFACE.ink, overflow: 'hidden' },
  curveLayer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  curveScrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  markBox: { alignItems: 'flex-start', justifyContent: 'center', minHeight: 64 },
  // Flame needs lineHeight >= 1.22x fontSize.
  title: { fontFamily: 'Flame-Regular', fontSize: 34, lineHeight: 42 },
  window: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.84)',
    marginTop: 12,
  },
  method: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(245,235,220,0.54)',
    maxWidth: 520,
    marginTop: 8,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 30 },
  stat: { gap: 2 },
  statBig: { fontFamily: 'Flame-Regular', fontSize: 40, lineHeight: 49 },
  statValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    lineHeight: 32,
    color: 'rgba(245,235,220,0.9)',
  },
  statLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.42)',
  },
  seam: { height: 1, backgroundColor: SEAM_COLOR },

  // ── paper ──
  paper: { backgroundColor: SURFACE.paper, paddingTop: 34, paddingBottom: 64 },
  section: { marginBottom: 42 },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    lineHeight: 32,
    color: COLORS.deepNavy,
  },
  sectionNote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(11,24,32,0.5)',
    marginTop: 2,
  },
  sectionBody: { marginTop: 18, gap: 20 },

  lead: {
    width: '100%',
    aspectRatio: 16 / 8,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
  },
  leadArt: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  leadBody: { padding: 20, gap: 4 },
  leadKicker: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 2 },
  leadTitle: { fontFamily: 'Flame-Regular', fontSize: 28, lineHeight: 35, color: COLORS.beige },
  leadMeta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12.5,
    color: 'rgba(245,235,220,0.68)',
  },

  posterRow: { flexDirection: 'row', flexWrap: 'wrap' },
  posterCell: { gap: 6 },
  poster: { borderRadius: 9, backgroundColor: 'rgba(11,24,32,0.08)' },
  // Two lines' worth, always: a one-line title next to a two-line one used to
  // push the following row out of alignment.
  posterTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 14.5,
    lineHeight: 19,
    minHeight: 38,
    color: COLORS.deepNavy,
  },
  posterMeta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11.5,
    color: 'rgba(11,24,32,0.5)',
  },

  faceGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  faceCell: { gap: 7 },
  faceWrap: {},
  face: { backgroundColor: 'rgba(11,24,32,0.08)' },
  spikePip: {
    position: 'absolute',
    right: -2,
    bottom: 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9,
  },
  spikePipText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.deepNavy },
  faceName: { fontFamily: 'Flame-Regular', fontSize: 16, lineHeight: 20, color: COLORS.deepNavy },
  faceCause: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11.5,
    lineHeight: 15,
    color: 'rgba(11,24,32,0.55)',
  },

  covers: { flexDirection: 'row', flexWrap: 'wrap' },
  cover: { borderRadius: 7, backgroundColor: 'rgba(11,24,32,0.08)' },
});
