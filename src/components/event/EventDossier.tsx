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
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text } from '../ui/Text';
import { Image } from 'expo-image';
import { HeroFace } from './HeroFace';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SEAM_COLOR, SURFACE, INK_TEXT, PAPER_TEXT } from '../../constants/colors';
import { brandForEvent, fitMark } from '../../constants/eventBrands';
import { EVENT_STAGE, EVENT_PAPER } from '../../constants/eventGeometry';
import { EventCurve } from './EventCurve';
import {
  groupAnnouncements,
  type EventDossier as Dossier,
  type EventTrailer,
  type AnnouncementGroup,
} from '../../lib/db/events.dossier';

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
  /** Override the stage's top padding. The web routes pass a smaller value:
   *  a 64pt fixed masthead already occupies that zone, so the default —
   *  which is sized for a native screen with a nav header — stacked on top
   *  of the route's own offset and left ~120pt of dead ink above the fold. */
  topPad?: number;
  onTitlePress: (titleId: string) => void;
  onHeroPress: (heroId: string) => void;
  /** Two revealed characters → the Arena. Optional: the section renders without
   *  it, minus the call to action. */
  onArenaPress?: (heroA: string, heroB: string) => void;
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
  topPad,
  onTitlePress,
  onHeroPress,
  onArenaPress,
  onIndexPress,
}: EventDossierProps) {
  const { event, announcements, revealed, trailers, surges } = dossier;
  const accent = event.accent ?? COLORS.goldAccent;
  const brand = brandForEvent(event.slug);
  const pad = wide ? EVENT_STAGE.padWide : EVENT_STAGE.pad;
  const measure = Math.min(maxContentWidth ?? contentWidth, contentWidth);
  const inner = { width: '100%' as const, maxWidth: measure, alignSelf: 'center' as const };
  const curveH = wide ? EVENT_STAGE.curveHWide : EVENT_STAGE.curveH;

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

  const [lead, ...rest] = trailers;
  // One entry per thing announced, not per clip. See groupAnnouncements.
  const [leadNews, ...restNews] = groupAnnouncements(announcements);
  // Wide enough that a 16:9 still reads, narrow enough that the next card
  // peeks — the cue that says the row scrolls.
  const newsCardW = Math.min(232, Math.round(avail * 0.62));
  // A backfilled edition is the readership record and little else: announcements
  // come from channel_videos, which only starts the day that pipeline shipped,
  // and movers cannot be reconstructed because heroes.views_daily is a rolling
  // window. Saying so beats a page that merely looks broken — and the curve
  // above IS the record, which is the honest thing to point at.
  const recordOnly = announcements.length === 0 && revealed.length === 0 && surges.length === 0;

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

        <View
          style={[
            inner,
            {
              paddingHorizontal: pad,
              paddingTop: topPad ?? (wide ? EVENT_STAGE.paddingTopWide : EVENT_STAGE.paddingTop),
            },
          ]}
        >
          {/* Status and navigation were one concatenated string — "HAPPENING NOW
              · ALL EVENTS" reads as a single label, so the half of it that was a
              link did not look like one. They are different things and now look
              different: a status word, and a bordered affordance with a chevron
              at the opposite edge, where a reader looks for a way out. */}
          <View style={s.eyebrowRow}>
            <Text style={[s.eyebrow, { color: accent }]}>
              {event.ongoing ? 'Happening now' : 'Detected event'}
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
            <Text style={[s.title, { color: accent }]}>{event.headline}</Text>
          )}

          {!!windowLabel && (
            <Text style={s.window}>
              {windowLabel}
              {windowDays ? ` · ${windowDays} day${windowDays === 1 ? '' : 's'}` : ''}
            </Text>
          )}

          {/* Phone widths get a fixed three-line box, and the clamp to match.
              The sentence is a constant, so its height is knowable — but only
              if it is stated rather than left to font metrics, which is what
              the skeleton has to mirror. Wide widths have room for the measure
              to breathe and no skeleton to keep in step with. */}
          <Text
            style={[
              s.method,
              wide ? null : { height: EVENT_STAGE.methodLine * EVENT_STAGE.methodLines },
            ]}
            numberOfLines={wide ? undefined : EVENT_STAGE.methodLines}
          >
            {/* On a frozen edition the recap outranks the method note. How the
                window was found is worth saying about an event we are still
                measuring; about 2019 the reader wants to know what happened,
                and the method has already been said on the hub above. Falls
                back where no recap could be written honestly. */}
            {event.recap ??
              'No calendar told us this was on. The window is inferred from readership on the event’s own Wikipedia article.'}
          </Text>

          {/* The measurements, given the weight they deserve. The multiplier is
              the claim; the other two are its supporting evidence. */}
          <View
            style={[
              s.stats,
              {
                marginTop: wide ? EVENT_STAGE.statsGapWide : EVENT_STAGE.statsGap,
                marginBottom:
                  curveH * (wide ? EVENT_STAGE.curveClearanceWide : EVENT_STAGE.curveClearance),
              },
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
          {/* First, because it is the only section that says what was actually
              SAID. Everything below it is derived from attention — a spike, a
              curve, whose readership moved — which records that something
              happened and never what it was. */}
          {recordOnly && (
            <View style={s.recordOnly}>
              <Text style={s.recordOnlyText}>
                {trailers.length > 0
                  ? 'The readership record for this edition, and what dropped inside its window. Mythique began capturing studio announcements in August 2026, so earlier years are measurement only.'
                  : 'The readership record for this edition. Mythique began capturing studio announcements in August 2026, so earlier years are measurement only — the curve above is what was observed.'}
              </Text>
            </View>
          )}

          {leadNews && (
            <Section
              title="What was announced"
              note="From the studios' own channels, during the window"
            >
              {/* The lead gets the room. This is the section a reader came for,
                  and it was rendering as the smallest thing on the page. */}
              <Pressable
                style={s.newsLead}
                onPress={() => onTitlePress(leadNews.titleId)}
                accessibilityRole="button"
                accessibilityLabel={`${leadNews.titleName}, announced at this event`}
              >
                {!!(leadNews.thumbnailUrl ?? leadNews.posterUrl) && (
                  <Image
                    source={{ uri: (leadNews.thumbnailUrl ?? leadNews.posterUrl) as string }}
                    style={[s.newsLeadArt, { height: Math.round(avail * 0.5625) }]}
                    contentFit="cover"
                    transition={160}
                  />
                )}
                <View style={s.newsLeadBody}>
                  <Text style={s.newsLeadTitle} numberOfLines={2}>
                    {leadNews.titleName}
                  </Text>
                  <Text style={s.newsCaption} numberOfLines={2}>
                    {leadNews.caption}
                  </Text>
                  <Text style={s.newsMeta}>{sourceLine(leadNews)}</Text>
                </View>
              </Pressable>

              {/* The rest as a rail, not a list. A stack of thumbnail rows made
                  thirteen announcements read as a changelog — uniform, ordered,
                  and inviting nobody to look past the third. Horizontally they
                  are cards you browse, which is what a reveal deserves and what
                  every other Mythique surface already does with a set of things.
                  Escapes the parent's gutter so cards run to the physical screen
                  edge while the first still lines up with the page inset. */}
              {restNews.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -pad }}
                  contentContainerStyle={[s.newsRail, { paddingHorizontal: pad }]}
                >
                  {restNews.map((a) => (
                    <Pressable
                      key={a.titleId}
                      style={[s.newsCard, { width: newsCardW }]}
                      onPress={() => onTitlePress(a.titleId)}
                      accessibilityRole="button"
                      accessibilityLabel={`${a.titleName}, announced at this event`}
                    >
                      {!!(a.thumbnailUrl ?? a.posterUrl) && (
                        <Image
                          source={{ uri: (a.thumbnailUrl ?? a.posterUrl) as string }}
                          style={[
                            s.newsCardArt,
                            { width: newsCardW, height: Math.round(newsCardW * 0.5625) },
                          ]}
                          contentFit="cover"
                          transition={160}
                        />
                      )}
                      <Text style={s.newsCardTitle} numberOfLines={2}>
                        {a.titleName}
                      </Text>
                      <Text style={s.newsMeta} numberOfLines={1}>
                        {sourceLine(a)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </Section>
          )}

          {/* The one section that is neither attention data nor a marketing
              string: the rights holder naming characters, matched against the
              catalogue. "Storm, Jean Grey, Cyclops, Emma Frost, Rogue" is what
              a reader means by "what happened at D23", and no measurement can
              produce it. Sits directly under the announcements because it is
              read out of them.

              Placed before the trailers and the readership on purpose — a
              studio SAYING a name outranks a curve that moved afterwards. */}
          {revealed.length > 0 && (
            <Section title="Who they named" note="Characters called out in what was announced">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -pad }}
                contentContainerStyle={[s.castRail, { paddingHorizontal: pad }]}
              >
                {revealed.map((r) => (
                  <Pressable
                    key={r.heroId}
                    style={s.castCell}
                    onPress={() => onHeroPress(r.heroId)}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.name}${r.titleName ? `, named in ${r.titleName}` : ''}`}
                  >
                    {!!r.portraitUrl && (
                      <HeroFace uri={r.portraitUrl} avatar={r.avatar} size={66} name={r.name} />
                    )}
                    <Text style={s.castName} numberOfLines={2}>
                      {r.name}
                    </Text>
                    <Text style={s.castTitle} numberOfLines={1}>
                      {r.titleName ?? r.publisher ?? ''}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Two named characters is a matchup the app can already run, and
                  this is the only place on an event page that hands the reader
                  something to DO with what they just read. */}
              {!!onArenaPress && revealed.length >= 2 && (
                <Pressable
                  style={[s.arenaCta, { borderColor: `${accent}66` }]}
                  onPress={() => onArenaPress(revealed[0].heroId, revealed[1].heroId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Put ${revealed[0].name} against ${revealed[1].name} in the Arena`}
                >
                  <Text style={s.arenaCtaText}>
                    {revealed[0].name} vs {revealed[1].name}
                  </Text>
                  <Text style={s.arenaCtaHint}>Settle it in the Arena</Text>
                </Pressable>
              )}
            </Section>
          )}

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
                      {/* HeroFace picks the shape from the KIND of picture the
                          RPC found: an avatar is a flat mark and is drawn flat,
                          a fallback portrait is a rectangular illustration and
                          keeps the circle it has always had. */}
                      {!!sg.portraitUrl && (
                        <HeroFace
                          uri={sg.portraitUrl}
                          avatar={sg.avatar}
                          size={faceGrid.cell}
                          name={sg.name}
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

/**
 * "Marvel Entertainment · 3 clips", or "IGN · reported".
 *
 * The channel is the attribution and it carries real weight: a studio ANNOUNCED
 * this, a press channel reported it. The clip count is the only honest proxy the
 * page has for how big an announcement was — how many times a studio went back
 * to the same thing during its own event.
 */
function sourceLine(a: AnnouncementGroup): string {
  const who = a.official ? a.channel : `${a.channel} · reported`;
  return a.clips > 1 ? `${who}  ·  ${a.clips} clips` : who;
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
  // Every line box below carries an explicit lineHeight. Left implicit, the
  // height came from whatever the font's own metrics happened to be, which the
  // skeleton could only approximate — and a placeholder that approximates its
  // own page's geometry is the thing EVENT_STAGE exists to stop.
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
  title: { fontFamily: 'Flame-Regular', fontSize: 34, lineHeight: EVENT_STAGE.titleLine },
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
    fontSize: 14,
    lineHeight: EVENT_STAGE.methodLine,
    color: INK_TEXT.faint,
    maxWidth: 520,
    marginTop: EVENT_STAGE.methodGap,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 30 },
  stat: { gap: EVENT_STAGE.statInnerGap },
  statBig: { fontFamily: 'Flame-Regular', fontSize: 40, lineHeight: EVENT_STAGE.statBigLine },
  statValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    lineHeight: EVENT_STAGE.statValueLine,
    color: 'rgba(245,235,220,0.9)',
  },
  statLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    lineHeight: EVENT_STAGE.statLabelLine,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
  },
  seam: { height: 1, backgroundColor: SEAM_COLOR },

  // ── paper ──
  paper: {
    backgroundColor: SURFACE.paper,
    paddingTop: EVENT_PAPER.paddingTop,
    paddingBottom: EVENT_PAPER.paddingBottom,
  },
  section: { marginBottom: EVENT_PAPER.sectionMarginBottom },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    lineHeight: EVENT_PAPER.sectionTitleLine,
    color: COLORS.deepNavy,
  },
  sectionNote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    lineHeight: EVENT_PAPER.sectionNoteLine,
    color: PAPER_TEXT.muted,
    marginTop: EVENT_PAPER.sectionNoteGap,
  },
  sectionBody: { marginTop: EVENT_PAPER.sectionBodyGap, gap: 20 },

  lead: {
    width: '100%',
    aspectRatio: EVENT_PAPER.leadAspect,
    borderRadius: EVENT_PAPER.leadRadius,
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
  // The lead announcement, at the size the news deserves.
  newsLead: { gap: 0 },
  // 16:9 — the shape YouTube returns. A square crop takes the title card out of
  // the middle of a trailer thumbnail.
  newsLeadArt: { width: '100%', borderRadius: 12, backgroundColor: '#00000010' },
  newsLeadBody: { gap: 4, paddingTop: 10 },
  newsLeadTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 23,
    // Clamped Flame needs >= 1.22x fontSize or numberOfLines shears the
    // descenders on web, where it becomes -webkit-line-clamp + overflow hidden.
    lineHeight: 30,
    color: COLORS.deepNavy,
  },
  newsCaption: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: 20,
    color: PAPER_TEXT.muted,
  },

  recordOnly: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(11,24,32,0.14)',
    paddingLeft: 14,
    marginBottom: 26,
  },
  recordOnlyText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: 21,
    color: PAPER_TEXT.muted,
    maxWidth: 520,
  },

  newsRail: { gap: 12, paddingTop: 20 },
  newsCard: { gap: 7 },
  newsCardArt: { borderRadius: 12, backgroundColor: '#00000010' },
  newsCardTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    // Clamped Flame needs >= 1.22x fontSize.
    lineHeight: 20,
    color: COLORS.deepNavy,
  },
  newsMeta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11.5,
    lineHeight: 15,
    color: PAPER_TEXT.muted,
  },

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
    color: PAPER_TEXT.muted,
  },

  castRail: { gap: 14, paddingTop: 20 },
  castCell: { width: 78, gap: 4, alignItems: 'center' },
  castName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.deepNavy,
    textAlign: 'center',
  },
  castTitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    lineHeight: 15,
    color: PAPER_TEXT.muted,
    textAlign: 'center',
  },

  arenaCta: {
    marginTop: 18,
    alignSelf: 'flex-start',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    gap: 2,
  },
  arenaCtaText: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    lineHeight: 23,
    color: COLORS.deepNavy,
  },
  arenaCtaHint: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  faceGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  faceCell: { gap: 7 },
  faceWrap: {},
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
    color: PAPER_TEXT.muted,
  },

  covers: { flexDirection: 'row', flexWrap: 'wrap' },
  cover: { borderRadius: 7, backgroundColor: 'rgba(11,24,32,0.08)' },
});
