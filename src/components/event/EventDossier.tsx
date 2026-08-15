// src/components/event/EventDossier.tsx
// The body of an event page, shared by both routes.
//
// Deliberately NOT a screen: it renders no scroll container of its own, because
// the web route must scroll the document (see the web-document-scroll rule) while
// the native one uses a ScrollView.
//
// Built on the house seam signature — an ink stage landing on a beige sheet with
// the warm hairline as that sheet's top edge (see ui/PaperSheet). The structure
// carries meaning
// rather than decorating: ink is the EVIDENCE (how we know this happened — a
// claim about our own instrument), paper is the RECORD (what it did to the
// catalogue). Measurement above the seam, dossier below it.
//
// Boldness is spent in one place: the detection curve, drawn full-bleed as the
// masthead's texture. Everything under the seam stays quiet so it keeps that job.
import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text } from '../ui/Text';
import { Image } from 'expo-image';
import { HeroFace } from './HeroFace';
import { CountUp } from './CountUp';
import { Section } from './EventSection';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SURFACE, INK_TEXT, PAPER_TEXT } from '../../constants/colors';
import { brandForEvent, fitMark } from '../../constants/eventBrands';
import { EVENT_STAGE, EVENT_PAPER } from '../../constants/eventGeometry';
import { EventCurve } from './EventCurve';
import { PAPER_SHEET_SURFACE, PAPER_SHEET_FOOT } from '../ui/PaperSheet';
import {
  groupAnnouncements,
  type EventDossier as Dossier,
  type EventTrailer,
  type TrailerCastFace,
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

/**
 * A set of cards that scrolls sideways on a phone and wraps on a desktop.
 *
 * The rail is the right pattern on touch: it bleeds to the physical screen edge
 * so the next card peeks, which is the cue that says "swipe". On a pointer
 * device the same component is a liability — there is no swipe, the horizontal
 * scrollbar is easy to miss, and inside a capped reading measure the last
 * visible card is sliced by the measure's edge rather than by the screen's, so
 * it reads as a clipping bug instead of an affordance. Wide widths have the room
 * to show the whole set, so they do.
 */
function RailOrWrap({
  wide,
  pad,
  railStyle,
  wrapStyle,
  children,
}: {
  wide: boolean;
  pad: number;
  railStyle: object;
  wrapStyle: object;
  children: React.ReactNode;
}) {
  if (wide) return <View style={wrapStyle}>{children}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -pad }}
      contentContainerStyle={[railStyle, { paddingHorizontal: pad }]}
    >
      {children}
    </ScrollView>
  );
}

/**
 * The catalogue's faces for one title, and how many more there are.
 *
 * This is the whole argument for the "What dropped" section looking like
 * Mythique rather than like every other film grid on the internet. The poster is
 * the studio's; the faces under it are ours, they are the reason a reader who
 * came for a trailer stays for a character, and they are six routes into the app
 * where the card previously offered one route out of it.
 */
function TrailerCast({
  cast,
  total,
  size,
  onHeroPress,
  onInk = false,
  interactive = true,
}: {
  cast: TrailerCastFace[];
  total: number;
  size: number;
  onHeroPress: (heroId: string) => void;
  onInk?: boolean;
  /** False inside a card that is ITSELF pressable.
   *
   *  react-native-web renders Pressable as <button>, and a button inside a
   *  button is invalid HTML — the browser reparents it, which broke the card's
   *  own click target and logged "<button> cannot contain a nested <button>"
   *  once per face. Where the strip can be a sibling of the card's button it
   *  stays interactive and is six routes into the catalogue; where it sits over
   *  the lead's artwork it is evidence, and the whole card goes to the title. */
  interactive?: boolean;
}) {
  if (cast.length === 0) return null;
  const more = Math.max(0, total - cast.length);
  return (
    <View style={s.castStrip}>
      {cast.map((c) =>
        interactive ? (
          <Pressable
            key={c.heroId}
            onPress={() => onHeroPress(c.heroId)}
            accessibilityRole="button"
            accessibilityLabel={c.name}
            // A 26pt face is a 26pt target. hitSlop is what carries it to the
            // 44pt minimum — (44-26)/2 = 9 — and it costs nothing visually
            // because the strip's own gap is only 3.
            hitSlop={9}
          >
            {/* The mapper drops faces without art, so the ?? '' is narrowing for
                the type checker rather than a real branch. */}
            <HeroFace uri={c.portraitUrl ?? ''} avatar={c.avatar} size={size} name={c.name} />
          </Pressable>
        ) : (
          <HeroFace
            key={c.heroId}
            uri={c.portraitUrl ?? ''}
            avatar={c.avatar}
            size={size}
            name={c.name}
          />
        ),
      )}
      {more > 0 && <Text style={[s.castMore, onInk ? s.castMoreInk : null]}>{`+${more}`}</Text>}
    </View>
  );
}

/**
 * The matchup the event just set up, offered as a matchup.
 *
 * The job has always been the same and is worth stating: this section is the
 * only place on an event page that hands the reader something to DO. Everything
 * else is read — a curve, a poster wall, a leaderboard — and then the page ends.
 * The Arena is a product Mythique already has, and a studio that just named five
 * characters in one breath has, for free, set up the argument about which of
 * them wins.
 *
 * As shipped it did that badly, in three ways:
 *
 *  - It took `revealed[0]` and `revealed[1]`, which is whatever order the RPC
 *    returned. "Storm vs Jean Grey" was not a pick, and it read like one that
 *    had been made carelessly. It now ranks by fame and offers the biggest pair
 *    first, with the rest one tap away — a reader who wants Cyclops vs Rogue can
 *    have it instead of being told what the matchup is.
 *  - It was a text pill. The Arena is a face-against-face product, and the pill
 *    was announcing it in words directly beneath five faces it declined to use.
 *  - It was 300pt of button alone in ~1,800pt of ink. On desktop it now sits
 *    beside the cast rather than under it, which is what the empty half of that
 *    row was for.
 */
function ArenaInvite({
  cast,
  accent,
  wide,
  onArenaPress,
}: {
  cast: {
    heroId: string;
    name: string;
    portraitUrl: string | null;
    avatar: boolean;
    fameScore: number | null;
  }[];
  accent: string;
  wide: boolean;
  onArenaPress: (a: string, b: string) => void;
}) {
  // Every pairing, best first. Capped at the six best-known faces: past that the
  // tail is pairs of characters nobody came to argue about, and 12 names would
  // make 66 of them.
  const pairs = useMemo(() => {
    const fame = (h: { fameScore: number | null }) => h.fameScore ?? 0;
    const pool = [...cast].sort((a, b) => fame(b) - fame(a)).slice(0, 6);
    const out: (typeof pool)[] = [];
    for (let i = 0; i < pool.length; i++)
      for (let j = i + 1; j < pool.length; j++) out.push([pool[i], pool[j]]);
    return out.sort((p, q) => fame(q[0]) + fame(q[1]) - (fame(p[0]) + fame(p[1])));
  }, [cast]);

  const [index, setIndex] = useState(0);
  if (pairs.length === 0) return null;
  const [a, b] = pairs[index % pairs.length];

  return (
    <View style={[s.arenaCol, wide ? s.arenaColWide : null]}>
      <Pressable
        style={[s.arenaCard, { borderColor: `${accent}55` }]}
        onPress={() => onArenaPress(a.heroId, b.heroId)}
        accessibilityRole="button"
        accessibilityLabel={`Put ${a.name} against ${b.name} in the Arena`}
      >
        <Text style={[s.arenaEyebrow, { color: accent }]}>Settle it in the Arena</Text>
        <View style={s.arenaFaces}>
          {/* The faces are the point. A name is a label on a face here, not a
              substitute for one — which is what the pill was. */}
          <View style={s.arenaSide}>
            {!!a.portraitUrl && (
              <HeroFace uri={a.portraitUrl} avatar={a.avatar} size={62} name={a.name} />
            )}
            <Text style={s.arenaName} numberOfLines={2}>
              {a.name}
            </Text>
          </View>
          <Text style={[s.arenaVs, { color: accent }]}>vs</Text>
          <View style={s.arenaSide}>
            {!!b.portraitUrl && (
              <HeroFace uri={b.portraitUrl} avatar={b.avatar} size={62} name={b.name} />
            )}
            <Text style={s.arenaName} numberOfLines={2}>
              {b.name}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* A sibling, never a child: react-native-web renders Pressable as
          <button>, and a button inside a button is invalid HTML — the browser
          reparents it and the card's own click target breaks. */}
      {pairs.length > 1 && (
        <Pressable
          style={s.arenaSwap}
          onPress={() => setIndex((i) => i + 1)}
          accessibilityRole="button"
          accessibilityLabel="Show a different matchup"
        >
          <Ionicons name="shuffle" size={13} color={INK_TEXT.faint} />
          <Text style={s.arenaSwapText}>Another matchup</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Whether this dossier's last band is ink rather than paper.
 *
 * The page's spine is ink → paper → ink: the measurement stage, the record, and
 * then the two "who" sections back on ink. So a dossier with a cast or any
 * movers ENDS dark — and the web end-cap, which exists to close a beige sheet
 * onto the ink floor, was drawing its rounded beige foot underneath it. That is
 * the 28pt strip of paper between "Who it moved" and the footer: not a gap, a
 * lip belonging to a sheet that had already closed.
 *
 * Exported rather than inlined at the call site because the condition is a fact
 * about this component's layout, and a route asserting it by hand is a route
 * that goes stale the next time a band moves.
 */
export function dossierEndsOnInk(dossier: Dossier): boolean {
  return dossier.revealed.length > 0 || dossier.surges.length > 0;
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
  // Posters are high-resolution and are the best images on the page, so a wide
  // measure buys FEWER, BIGGER ones rather than more small ones: at an ideal of
  // 150 a 1,100pt row produced six 170pt thumbnails, which is a contact sheet.
  const posterGrid = grid(16, wide ? 240 : 150);
  // Phone: wide enough that a 16:9 still reads, narrow enough that the next card
  // peeks — the cue that says the row scrolls.
  // Desktop: no peek to signal, because it is a grid. Cards divide the measure
  // exactly instead, using the same helper as the posters — a fixed 232 left a
  // 136pt ragged gutter at the end of every row.
  const newsGrid = grid(14, 250);
  const newsCardW = wide ? newsGrid.cell : Math.min(232, Math.round(avail * 0.62));

  // Never upscale a 480-wide YouTube still past roughly its native width.
  const LEAD_ART_MAX = 560;
  const leadArtW = Math.min(LEAD_ART_MAX, Math.round(avail * 0.52));
  // How many cards a section shows after its lead.
  //
  // Both image sections were unbounded, and D23 has 15 announcements and 10
  // trailers. On a phone they were rails, so the length was hidden behind a
  // scroll; widening them into grids put all 25 on screen at once and turned
  // two thirds of the page into a wall of identical rectangles — the exact
  // "changelog" failure the rail was introduced to avoid, reintroduced by
  // making the rail a grid. An editorial page runs the best few, large; the
  // full set belongs on the title pages these link to.
  const REST_CAP = wide ? 8 : 12;

  const [lead, ...allRest] = trailers;
  // Desktop shows the lead and ONE row beneath it. Posters are tall — a 240pt
  // ideal makes them ~390pt each — so two rows plus a full-measure lead turned
  // "What dropped" into 1,400pt, roughly a third of the page, for the section
  // that is the least specific to this event. One row is a shelf; two is a
  // warehouse.
  // Whole rows, always.
  //
  // On desktop the lead spans two columns, so the row is completed by
  // `cols - 2` posters and the section closes at exactly one row — about 455pt
  // against the 1,150 it occupied as a full-width banner over a four-poster row
  // with a ragged second row under it. Three titles rather than five is a real
  // cost on an archive page, and it is the right trade: this is the one section
  // whose content every competitor also has, the full slate is a click away on
  // each title, and the space it was taking belonged to the sections that are
  // actually Mythique's.
  //
  // A phone has two columns and a full-width lead, so it gets two clean rows.
  const rest = allRest.slice(0, wide ? posterGrid.cols - 2 : posterGrid.cols * 2);
  // One entry per thing announced, not per clip. See groupAnnouncements.
  const [leadNews, ...allRestNews] = groupAnnouncements(announcements);
  // Trimmed to whole rows on desktop: a grid whose final row holds two of four
  // reads as a set that ran out, not as an edit.
  const newsCap = wide
    ? Math.max(
        newsGrid.cols,
        Math.floor(Math.min(allRestNews.length, REST_CAP) / newsGrid.cols) * newsGrid.cols,
      )
    : REST_CAP;
  const restNews = allRestNews.slice(0, newsCap);
  // A backfilled edition is the readership record and little else: announcements
  // come from channel_videos, which only starts the day that pipeline shipped,
  // and movers cannot be reconstructed because heroes.views_daily is a rolling
  // window. Saying so beats a page that merely looks broken — and the curve
  // above IS the record, which is the honest thing to point at.
  const recordOnly = announcements.length === 0 && revealed.length === 0 && surges.length === 0;

  // Ordered by the multiple, descending.
  //
  // The stored order is pulse_face_weight — fame blended with spike — which was
  // right when this section was a gallery of faces: show the recognisable ones
  // first, because a wall of portraits is browsed, not read. As a ranked list it
  // is wrong, and visibly so. The multiple is now the largest thing on each row,
  // and a column reading 527, 51.1, 33.2, 33.8, 134 does not look like a
  // deliberate ordering by something else; it looks like a sort that failed.
  const rankedSurges = [...surges].sort((a, b) => (b.spike ?? 0) - (a.spike ?? 0));

  return (
    <View>
      {/* ── ink: the evidence ─────────────────────────────────────────────── */}
      {/* The stage is the page's hero. It gets there by setting its CONTENT at
          display scale — a 560pt mark, a 64pt figure — not by reserving height.
          A minHeight with the type pinned to the floor was tried and is exactly
          wrong: it opened 400pt of empty black above the mark, which reads as a
          rendering fault rather than as space. */}
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

          {/* Desktop splits the stage in two. A phone stacks identity over
              measurement because it has no choice; a 1440px window running the
              same stack leaves the right 45% of the masthead as empty navy with
              a curve behind it, which is the single clearest tell that a layout
              was designed for a phone and let out at the seams. Identity left,
              evidence right, both sitting on the same floor. */}
          <View
            style={
              wide
                ? [s.stageCols, { marginBottom: curveH * EVENT_STAGE.curveClearanceWide }]
                : undefined
            }
          >
            <View style={wide ? s.stageIdentity : undefined}>
              {brand ? (
                <View style={s.markBox}>
                  {/* 560/170 on desktop against 300/108 before. These marks are
                      single-path SVGs that paint in the event's own accent — the
                      best asset the page has — and they were being drawn at
                      roughly the size of a favicon on a 1,600pt screen. */}
                  <brand.mark
                    {...fitMark(brand, wide ? 560 : 200, wide ? 170 : 78)}
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

              {/* The recap, where there is one. On a frozen edition it outranks
                  everything else the masthead could say: how the window was
                  found is worth stating about an event still being measured,
                  but about 2019 the reader wants to know what happened.

                  Phone widths get a fixed box and the clamp to match, so the
                  skeleton can mirror a knowable height. */}
              {!!event.recap && (
                <Text
                  style={[
                    s.recap,
                    wide ? null : { height: EVENT_STAGE.methodLine * EVENT_STAGE.methodLines },
                  ]}
                  numberOfLines={wide ? undefined : EVENT_STAGE.methodLines}
                >
                  {event.recap}
                </Text>
              )}
            </View>

            {/* The measurements. On desktop they become the right-hand column
                and sit on the identity block's baseline; on a phone they stay
                where they were, under the sentence. */}
            {/* The clearance that reserves room for the curve lives on the ROW
                above, not here. It used to sit on this box, which was fine while
                the stats were the last thing in a stack — but inside a
                flex-end row a bottom margin lifts only THIS column, so the stats
                floated 84pt off the floor while the identity column ran to the
                container's edge and straight through the seam. */}
            <View
              style={[
                s.stats,
                wide
                  ? null
                  : {
                      marginTop: EVENT_STAGE.statsGap,
                      marginBottom: curveH * EVENT_STAGE.curveClearance,
                    },
              ]}
            >
              {/* The page's headline claim, and the one place the multiple is
                  worth stating as a number — this band exists to show how the
                  event was detected, so the instrument's own reading is the
                  subject rather than jargon leaking into a record.
                  Rounded: 146.03 implies a precision a Wikipedia pageview ratio
                  does not have, and a hundredth of a multiple has never changed
                  anyone's mind about anything. Below 10 keeps one decimal,
                  where the difference between 3.1 and 3 is most of the claim. */}
              {event.spikeRatio !== null && (
                <Stat
                  value={`${event.spikeRatio >= 10 ? Math.round(event.spikeRatio) : event.spikeRatio.toFixed(1)}×`}
                  label="more looked up than usual"
                  accent={accent}
                  big
                  wide={wide}
                />
              )}
              {!!event.peak && (
                <Stat value={event.peak.toLocaleString()} label="reads on the peak day" />
              )}
              {!!event.editsRecent && (
                <Stat value={String(event.editsRecent)} label="article edits" />
              )}
            </View>
          </View>
        </View>
      </View>

      {/* ── paper: the record ─────────────────────────────────────────────── */}
      {/* No seam element above this any more — the seam IS the sheet's top edge
          now (a warm border on the band itself), so it curves with the corners
          instead of running flat across a rounded thing. */}
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
              wide={wide}
            >
              {/* The lead gets the room — but only as much as the picture can
                  actually fill. These are YouTube `hqdefault` stills, which are
                  480x360. A phone asks for ~354 and gets a sharp image; a
                  desktop stack asked for the full 1,100pt measure and upscaled
                  the same file 2.3x, so the most prominent image on the page was
                  also the blurriest thing on it, and it ate the entire fold.

                  Capped at LEAD_ART_MAX and paired with its text beside it
                  rather than stacked above it. Two columns is also simply the
                  better editorial shape at this width: the headline sits at the
                  top of the image instead of a screen-height below it. */}
              <Pressable
                style={[s.newsLead, wide ? s.newsLeadWide : null]}
                onPress={() => onTitlePress(leadNews.titleId)}
                accessibilityRole="button"
                accessibilityLabel={`${leadNews.titleName}, announced at this event`}
              >
                {!!(leadNews.thumbnailUrl ?? leadNews.posterUrl) && (
                  <Image
                    source={{ uri: (leadNews.thumbnailUrl ?? leadNews.posterUrl) as string }}
                    style={[
                      s.newsLeadArt,
                      wide
                        ? { width: leadArtW, height: Math.round(leadArtW * 0.5625) }
                        : { width: '100%', height: Math.round(avail * 0.5625) },
                    ]}
                    contentFit="cover"
                    transition={160}
                  />
                )}
                <View style={[s.newsLeadBody, wide ? s.newsLeadBodyWide : null]}>
                  <Text style={s.newsLeadTitle} numberOfLines={2}>
                    {leadNews.titleName}
                  </Text>
                  <Text style={s.newsCaption} numberOfLines={wide ? 4 : 2}>
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
                <RailOrWrap wide={wide} pad={pad} railStyle={s.newsRail} wrapStyle={s.newsWrap}>
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
                </RailOrWrap>
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

          {trailers.length > 0 && (
            <Section title="What dropped" note="Trailers published inside the window" wide={wide}>
              {/* One grid, not a banner over a grid.
                  Measured at 1512: the lead was 1100x380 = 418,000 square
                  points against 415,540 for the entire four-poster row beneath
                  it. One trailer occupying as much of the page as all the
                  others put together is not a ranking, it is a billboard — and
                  it is spent on the least Mythique-specific content here, since
                  the artwork is the studio's and every competitor has it too.

                  On desktop the lead becomes a cell spanning TWO columns at the
                  poster row's own height, so it is still plainly the lead (twice
                  the area of its neighbours) while the section reads as a single
                  composed grid. A phone keeps the full-width hero: there is only
                  one column there, so spanning two is meaningless and the
                  backdrop is the only thing giving that section a focal point. */}
              <View style={[s.posterRow, { gap: posterGrid.gap }]}>
                <LeadTrailer
                  trailer={lead}
                  onPress={onTitlePress}
                  onHeroPress={onHeroPress}
                  accent={accent}
                  wide={wide}
                  width={wide ? posterGrid.cell * 2 + posterGrid.gap : undefined}
                  height={wide ? Math.round(posterGrid.cell * 1.5) : undefined}
                />
                {rest.length > 0 && (
                  <>
                    {rest.map((t) => (
                      // A plain View, with the poster+title as ONE button and the
                      // face strip as its SIBLING. The card used to be a single
                      // Pressable wrapping everything, which put the faces' own
                      // buttons inside it — invalid HTML on web, and the browser's
                      // reparenting broke the card's click target.
                      <View key={t.titleId} style={[s.posterCell, { width: posterGrid.cell }]}>
                        <Pressable
                          onPress={() => onTitlePress(t.titleId)}
                          accessibilityRole="button"
                          accessibilityLabel={`${t.title}, ${t.videoType ?? 'trailer'}`}
                          style={s.posterMain}
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
                        </Pressable>
                        {/* The faces replace the word "Trailer", which said
                          nothing a reader could not see. "Buzz Lightyear,
                          Woody, Jessie, Rex, +4" is specific, is ours, and is
                          four more ways into the app than a poster. The kind
                          survives only where there is no cast to show. */}
                        {t.cast.length > 0 ? (
                          <TrailerCast
                            cast={t.cast}
                            total={t.castCount}
                            size={30}
                            onHeroPress={onHeroPress}
                          />
                        ) : (
                          <Text style={s.posterMeta}>{t.videoType ?? 'Trailer'}</Text>
                        )}
                      </View>
                    ))}
                  </>
                )}
              </View>
            </Section>
          )}
        </View>
      </View>

      {/* ── ink: the catalogue, named ─────────────────────────────────────
          The page's one section that is neither attention data nor a marketing
          string: characters the rights holder itself put on a stage. "Marvel
          named Storm, Jean Grey, Cyclops, Emma Frost and Rogue" is the moment a
          fan came for, and it was a strip of small circles wedged between two
          walls of film stills, on the same beige as everything else.

          On ink, at 120pt, it is the beat between what was SAID and what it
          DID — and the Arena button under it is the only thing on the page that
          hands the reader something to do with what they just read. */}
      {/* ONE ink region, not two bands.
          "Who they named" and "Who it moved" each used to open with their own
          seam, which put two orange hairlines back to back on identical ink —
          the seam is the ink/paper boundary and there is no boundary there. It
          read as a stray rule, and it cut a pair that belongs together: what the
          rights holder SAID, then what the readership DID about it. That order
          is the argument, so they stay stacked; they just stop pretending to be
          separate grounds. Inside the band the section rules already draw the
          only edge either one needs. */}
      {(revealed.length > 0 || surges.length > 0) && (
        <>
          {/* No seam here either. Coming OFF paper is not the same event as
              cutting into it: the sheet's own rounded foot and the shadow it
              casts are what mark this edge, and a flat hairline drawn under a
              rounded corner would read as the rule we just removed from between
              the two "who" sections. */}
          <View style={s.whoBand}>
            {revealed.length > 0 && (
              <View style={[inner, { paddingHorizontal: pad }]}>
                <Section
                  title="Who they named"
                  note="Characters called out in what was announced"
                  onInk
                  wide={wide}
                >
                  {/* Faces left, the matchup right — on desktop. Five 104pt faces
                      use about 700 of the measure's 1,100 points, and the invite
                      used to sit UNDER them, which left the row's right third
                      empty and the invite alone in it. Side by side, the section
                      reads as one statement: here is who they named, and here are
                      two of them you can argue about. */}
                  <View style={wide ? s.castLayoutWide : undefined}>
                    {/* A rail on a phone, a wrapped row on desktop. A horizontal
                        scroller is a touch affordance — on a pointer device it hides
                        half its contents behind a gesture nobody makes, and here it
                        was also being clipped mid-face at the reading measure's edge.
                        Wide has the room to just show them all. */}
                    <View style={wide ? s.castFlex : undefined}>
                      <RailOrWrap
                        wide={wide}
                        pad={pad}
                        railStyle={s.castRail}
                        wrapStyle={s.castWrap}
                      >
                        {revealed.map((r) => (
                          <Pressable
                            key={r.heroId}
                            style={[s.castCell, wide ? s.castCellWide : null]}
                            onPress={() => onHeroPress(r.heroId)}
                            accessibilityRole="button"
                            accessibilityLabel={`${r.name}${r.titleName ? `, named in ${r.titleName}` : ''}`}
                          >
                            {!!r.portraitUrl && (
                              <HeroFace
                                uri={r.portraitUrl}
                                avatar={r.avatar}
                                size={wide ? 104 : 66}
                                name={r.name}
                              />
                            )}
                            <Text style={s.castName} numberOfLines={2}>
                              {r.name}
                            </Text>
                            <Text style={s.castTitle} numberOfLines={1}>
                              {r.titleName ?? r.publisher ?? ''}
                            </Text>
                          </Pressable>
                        ))}
                      </RailOrWrap>
                    </View>

                    {!!onArenaPress && revealed.length >= 2 && (
                      <ArenaInvite
                        cast={revealed}
                        accent={accent}
                        wide={wide}
                        onArenaPress={onArenaPress}
                      />
                    )}
                  </View>
                </Section>
              </View>
            )}

            {/* ── the same ink, second half: what it did to the catalogue ───
          The page's grammar is ink = measurement, paper = record, and this
          section is measurement — readership that broke out, in multiples of a
          character's own median. It sat on paper anyway, which cost it twice:
          it lost the only visual cue the page has for "this is a number, not an
          editor's choice", and it left the whole thing a single beige field
          roughly four thousand points long.

          Returning it to ink gives the page a spine — ink, paper, ink — and
          lets the multiples be set in the accent at display size, which is what
          they deserve. 146x is the most striking fact Mythique can state about
          a convention and it was 23pt grey. */}
            {surges.length > 0 && (
              <View style={[inner, { paddingHorizontal: pad }]}>
                {/* The note carries the unit, because the number cannot.
                    "3.1×" beside a face is the third distinct quantity this
                    page writes with an × — the event's own article, the year's
                    peak in the archive, and now one character against their own
                    normal week. Only the caption can say which, so it does. */}
                <Section
                  title="Who it moved"
                  note="Times more than these characters are usually read"
                  onInk
                  wide={wide}
                >
                  {/* A ranking, drawn as one.
                      It used to be a gallery of 132pt faces with the multiple
                      tucked into a pip badge in the corner — which inverted the
                      section: the spike IS the claim, and it was set smaller than
                      everything around it. A gallery also has to be full to look
                      right, so a window that moved one character rendered as a
                      single cell marooned in an empty row.
                      As rows, the figure leads, one entry is a normal-looking
                      thing, and the same component reads on a phone (one column)
                      and a desktop (two). */}
                  <View style={[s.moverGrid, wide ? s.moverGridWide : null]}>
                    {rankedSurges.map((sg, i) => (
                      <Pressable
                        key={sg.heroId}
                        style={[s.moverRow, wide ? s.moverRowWide : null]}
                        onPress={() => onHeroPress(sg.heroId)}
                        accessibilityRole="button"
                        accessibilityLabel={`${sg.name}, ${sg.spike}× reads`}
                      >
                        {/* HeroFace picks the shape from the KIND of picture the
                            RPC found: an avatar is a flat mark and is drawn flat, a
                            fallback portrait is a rectangular illustration and keeps
                            the circle it has always had. */}
                        {!!sg.portraitUrl && (
                          <HeroFace
                            uri={sg.portraitUrl}
                            avatar={sg.avatar}
                            size={54}
                            name={sg.name}
                          />
                        )}
                        <View style={s.moverText}>
                          <Text style={s.moverName} numberOfLines={1}>
                            {sg.name}
                          </Text>
                          {/* Temporal, never causal — the join proves sequence, not cause. */}
                          <Text style={s.moverCause} numberOfLines={1}>
                            {sg.causeLabel ? `after ${sg.causeLabel}` : (sg.publisher ?? '')}
                          </Text>
                        </View>
                        {sg.spike !== null && (
                          // Counts up the first time the band is scrolled into
                          // view, staggered down the list so it reads as a board
                          // filling in rather than twelve numbers twitching at
                          // once. Capped at eight steps — past that the last rows
                          // are still counting long after the eye has arrived.
                          <CountUp
                            value={sg.spike}
                            suffix="×"
                            delay={Math.min(i, 8) * 70}
                            style={[s.moverSpike, { color: accent }]}
                          />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </Section>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

function Stat({
  value,
  label,
  accent,
  big = false,
  wide = false,
}: {
  value: string;
  label: string;
  accent?: string;
  big?: boolean;
  /** Desktop lets the lead figure go to display scale. It is the page's headline
   *  claim — "this article was read 146 times its usual rate" — and at 40pt it
   *  was the same weight as a section heading. */
  wide?: boolean;
}) {
  return (
    <View style={s.stat}>
      <Text
        style={[
          big ? s.statBig : s.statValue,
          big && wide ? s.statHero : null,
          accent ? { color: accent } : null,
        ]}
      >
        {value}
      </Text>
      {/* One size for all three labels. Scaling the hero's label with its figure
          put an 11pt/2.0 label beside two 10pt/1.6 ones in the same rail, which
          reads as a mistake rather than as hierarchy — the hierarchy is already
          carried by 64 against 26 on the values. Measured, not eyeballed. */}
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function LeadTrailer({
  trailer,
  onPress,
  onHeroPress,
  accent,
  wide,
  width,
  height,
}: {
  trailer: EventTrailer;
  onPress: (id: string) => void;
  onHeroPress: (heroId: string) => void;
  accent: string;
  wide?: boolean;
  /** Set on desktop, where the lead is a two-column cell in the poster grid and
   *  must match its neighbours' height exactly. Unset on a phone, where it is a
   *  full-width hero and keeps its own aspect ratio. */
  width?: number;
  height?: number;
}) {
  const art = trailer.backdropUrl ?? trailer.posterUrl;
  return (
    <Pressable
      style={[s.lead, width && height ? { aspectRatio: undefined, width, height } : null]}
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
        {/* The faces themselves, over the gradient, with the count as their
            label. "9 characters in the catalogue" was the most Mythique-specific
            line in the section and it was set as a caption; showing WHO turns it
            from a statistic into the reason to keep reading. */}
        {trailer.cast.length > 0 ? (
          <View style={s.leadCast}>
            <TrailerCast
              cast={trailer.cast}
              total={trailer.castCount}
              size={34}
              onHeroPress={onHeroPress}
              onInk
              interactive={false}
            />
          </View>
        ) : (
          trailer.castCount > 0 && (
            <Text style={s.leadMeta}>{trailer.castCount} characters in the catalogue</Text>
          )
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

const s = StyleSheet.create({
  // ── ink ──
  // `justifyContent: flex-end` so the extra height a hero gains opens up ABOVE
  // the type rather than below it — the curve is pinned to the floor and the
  // masthead has to keep sitting on it.
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
  // Desktop stage: two columns on one floor. `flex-end` is what puts the stat
  // rail's baseline on the identity block's rather than at the top of the band.
  stageCols: { flexDirection: 'row', alignItems: 'flex-end', gap: 48 },
  stageIdentity: { flex: 1, minWidth: 0 },
  // The edition's recap, which replaces the method note in the masthead. Full
  // strength rather than INK_TEXT.faint: this is the page's headline claim, not
  // a footnote about the instrument.
  recap: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    lineHeight: EVENT_STAGE.methodLine,
    color: 'rgba(245,235,220,0.90)',
    maxWidth: 560,
    marginTop: EVENT_STAGE.methodGap,
  },
  // `flex-end`, so the three columns hang from a common floor and the LABELS
  // line up. Left to the default they top-aligned, which put the two 26pt
  // figures 17pt above the 40pt one and set their labels on a different line
  // from its — three stats, three baselines, no rail.
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 34 },
  stat: { gap: EVENT_STAGE.statInnerGap },
  statBig: { fontFamily: 'Flame-Regular', fontSize: 40, lineHeight: EVENT_STAGE.statBigLine },
  // Flame needs lineHeight >= 1.22x fontSize; 64 -> 78.
  statHero: { fontSize: 64, lineHeight: 78 },
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

  // ── the two ink bands under the record ──
  // One band for both "who" sections. As two it carried two sets of padding
  // either side of a boundary that was not there — 48 + 42 + 40 = 130pt of empty
  // ink between the Arena button and the next rule. The gap between them is now
  // just the section's own bottom margin, the same one every other pair of
  // sections on this page uses.
  whoBand: { backgroundColor: SURFACE.ink, paddingTop: 44, paddingBottom: 52 },

  // ── paper ──
  // The shared sheet — see src/components/ui/PaperSheet.tsx for why the seam is
  // this band's own curved top edge, why it overlaps the stage by exactly its
  // radius, and why the foot only appears when ink follows. Both are true here:
  // the dossier's spine is ink → paper → ink.
  paper: {
    ...PAPER_SHEET_SURFACE,
    ...PAPER_SHEET_FOOT,
    paddingTop: EVENT_PAPER.paddingTop,
    paddingBottom: EVENT_PAPER.paddingBottom,
  },
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
  leadCast: { marginTop: 8 },
  leadKicker: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 2 },
  leadTitle: { fontFamily: 'Flame-Regular', fontSize: 28, lineHeight: 35, color: COLORS.beige },
  leadMeta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12.5,
    color: 'rgba(245,235,220,0.68)',
  },

  posterRow: { flexDirection: 'row', flexWrap: 'wrap' },
  posterCell: { gap: 8 },
  posterMain: { gap: 8 },
  poster: { borderRadius: 9, backgroundColor: 'rgba(11,24,32,0.08)' },
  // The lead announcement, at the size the news deserves.
  newsLead: { gap: 0 },
  newsLeadWide: { flexDirection: 'row', alignItems: 'center', gap: 26 },
  // 16:9 — the shape YouTube returns. A square crop takes the title card out of
  // the middle of a trailer thumbnail.
  newsLeadArt: { borderRadius: 12, backgroundColor: '#00000010' },
  newsLeadBody: { gap: 4, paddingTop: 10 },
  newsLeadBodyWide: { flex: 1, minWidth: 0, paddingTop: 0 },
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
  newsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 20 },
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

  // No minHeight. It reserved two lines so a one-line title could not shorten
  // its cell and knock the next row out of alignment — but the cells are in a
  // wrapping row, not a fixed grid, so each row already aligns on its own
  // tallest cell. All the reservation did was open an empty line between every
  // one-line title and its "Trailer" label, which read as a broken gap under
  // four posters in a row.
  posterTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 14.5,
    lineHeight: 19,
    color: COLORS.deepNavy,
  },
  posterMeta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11.5,
    color: PAPER_TEXT.muted,
  },

  // The face strip on a trailer card.
  //
  // 5 rather than 3. hitSlop is honoured on native and is a no-op in
  // react-native-web, so on a touch browser the target really is the face — 30
  // square, which clears WCAG 2.5.8's 24 comfortably but sits close enough to
  // its neighbour that the gap has to do the rest of the work.
  castStrip: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  castMore: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: PAPER_TEXT.muted,
    marginLeft: 3,
  },
  castMoreInk: { color: 'rgba(245,235,220,0.72)' },

  castRail: { gap: 14, paddingTop: 20 },
  castWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, paddingTop: 22 },
  castCell: { width: 78, gap: 4, alignItems: 'center' },
  // Given room on desktop. This is the only section on the page where the
  // catalogue is named by the rights holder rather than inferred from a
  // measurement, and at 66pt in a thin strip it read as a footnote between two
  // walls of film stills.
  castCellWide: { width: 128 },
  castName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(245,235,220,0.94)',
    textAlign: 'center',
  },
  castTitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    lineHeight: 15,
    color: INK_TEXT.faint,
    textAlign: 'center',
  },

  // ── the arena invite ──
  // `alignItems: flex-start` so the faces keep their own height instead of the
  // card stretching to the full height of a two-row cast wrap beside it.
  castLayoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 36 },
  // minWidth 0 or a flex child refuses to shrink below its content and the card
  // gets pushed past the measure's right edge.
  castFlex: { flex: 1, minWidth: 0 },
  arenaCol: { marginTop: 20, gap: 10, alignItems: 'flex-start' },
  arenaColWide: { width: 300, marginTop: 22 },
  arenaCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 14,
    // A wash rather than a fill: the card has to read as a surface on ink
    // without becoming a second, lighter ground competing with the paper below.
    backgroundColor: 'rgba(245,235,220,0.04)',
  },
  arenaEyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  arenaFaces: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  arenaSide: { flex: 1, alignItems: 'center', gap: 8 },
  arenaVs: { fontFamily: 'Flame-Regular', fontSize: 23, lineHeight: 30 },
  arenaName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(245,235,220,0.94)',
    textAlign: 'center',
  },
  arenaSwap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  arenaSwapText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    // Stated rather than inherited: the band is ink, and an unset colour here
    // falls back to the paper default and vanishes into the ground.
    color: INK_TEXT.faint,
  },

  // ── who it moved ──
  moverGrid: { gap: 2, paddingTop: 20 },
  // 72, not 28. The two columns meet at their loudest point: the left column
  // ends on a 30pt display figure and the right one opens on a 54pt face, so a
  // gap sized for text put "9.2×" almost against Jarvis's head and the pair read
  // as one four-part row rather than as two rows in two columns. The gutter has
  // to clear the two biggest things on the line, not the average one.
  moverGridWide: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 72 },
  moverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    borderTopWidth: 1,
    // On ink now, so the rule is a light hairline rather than a dark one.
    borderTopColor: 'rgba(245,235,220,0.13)',
  },
  // Two columns on desktop. Basis-plus-grow rather than a guessed percentage:
  // both cells start under half, then share what the 72pt gutter leaves, so each
  // settles at exactly (measure - gutter) / 2 at any width instead of leaving a
  // ragged right edge. `width: '47%'` only looked right because the old gutter
  // was small enough to hide the error.
  moverRowWide: { flexBasis: '40%', flexGrow: 1, minWidth: 260 },
  moverText: { flex: 1, minWidth: 0, gap: 1 },
  moverName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14.5,
    lineHeight: 19,
    color: 'rgba(245,235,220,0.94)',
  },
  moverCause: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: INK_TEXT.faint,
  },
  // The claim, finally set like one. Flame 30 on ink: a character read 146x
  // their own median during a convention is the single most striking thing this
  // app can say, and it was 23pt grey on beige.
  moverSpike: { fontFamily: 'Flame-Regular', fontSize: 30, lineHeight: 38 },

  covers: { flexDirection: 'row', flexWrap: 'wrap' },
  cover: { borderRadius: 7, backgroundColor: 'rgba(11,24,32,0.08)' },
});
