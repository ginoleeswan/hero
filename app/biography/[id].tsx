import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  InteractionManager,
  useWindowDimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import RenderHTML, { type MixedStyleDeclaration } from 'react-native-render-html';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../src/components/ui/SkeletonProvider';
import { FadeOutSkeleton } from '../../src/components/ui/FadeOutSkeleton';
import { useSkeletonTransition } from '../../src/hooks/useSkeletonTransition';
import {
  useBiography,
  resolveBioLink,
  MIN_SECTIONS_FOR_CONTENTS,
} from '../../src/hooks/useBiography';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS, PAPER_TEXT, INK_TEXT, ORANGE_INK, SEAM_COLOR } from '../../src/constants/colors';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FloatingBackButton } from '../../src/components/ui/FloatingBackButton';
import { BiographyContents } from '../../src/components/biography/BiographyContents';
import {
  BIOGRAPHY_RENDERERS,
  SectionAnchorProvider,
} from '../../src/components/biography/SectionAnchor';

const ORANGE_FAINT = 'rgba(231,115,51,0.3)';
const ORANGE_RULE = 'rgba(231,115,51,0.45)';

const BASE_STYLE: MixedStyleDeclaration = {
  fontFamily: 'FlameSans-Regular',
  fontSize: 15,
  color: COLORS.navy,
  lineHeight: 26,
};

// The opening paragraph is set one step larger and looser than the body — the
// same lead treatment the web prose uses, and the reason the drop cap has room
// to sit against three lines instead of two.
const LEAD_STYLE: MixedStyleDeclaration = {
  ...BASE_STYLE,
  fontSize: 16.5,
  lineHeight: 29,
};

// Editorial typography ported from the web biography: orange-underlined h2s,
// orange left-border h3s, styled blockquotes, lists, rules and images.
const TAG_STYLES: Record<string, MixedStyleDeclaration> = {
  p: { marginTop: 0, marginBottom: 14 },
  h2: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    fontWeight: 'normal',
    color: COLORS.navy,
    marginTop: 32,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: ORANGE_FAINT,
  },
  h3: {
    fontFamily: 'Flame-Regular',
    fontSize: 17,
    fontWeight: 'normal',
    color: COLORS.navy,
    marginTop: 22,
    marginBottom: 6,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: ORANGE_RULE,
  },
  h4: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: PAPER_TEXT.faint,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 4,
  },
  // ORANGE_INK, not COLORS.orange: prose links sit on the beige body, where the
  // brand orange measures 2.58:1. The underline carries the affordance so the
  // link is not colour-only.
  a: { color: ORANGE_INK, textDecorationLine: 'underline' },
  b: { fontFamily: 'Flame-Regular' },
  strong: { fontFamily: 'Flame-Regular' },
  em: { fontStyle: 'italic' },
  ul: { marginTop: 0, marginBottom: 14, paddingLeft: 6 },
  ol: { marginTop: 0, marginBottom: 14, paddingLeft: 6 },
  li: { marginBottom: 5 },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.orange,
    backgroundColor: 'rgba(231,115,51,0.06)',
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginVertical: 18,
    fontStyle: 'italic',
  },
  hr: {
    height: 1,
    backgroundColor: 'rgba(41,60,67,0.12)',
    marginVertical: 26,
  },
  figure: { marginVertical: 14, marginHorizontal: 0 },
  img: { borderRadius: 8, marginVertical: 16 },
  figcaption: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: PAPER_TEXT.faint,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 16,
  },
};

const SYSTEM_FONTS = ['FlameSans-Regular', 'Flame-Regular'];

// Floor for the identity stage, so a hero with a short name and no summary
// still gets a stage with presence instead of collapsing onto its portrait.
const STAGE_MIN_H = 210;

// The "read line" — how far down the viewport a heading has to travel before it
// counts as the section you're in. Roughly a third of a phone screen: high
// enough that a heading scrolling into view flips the pill as it settles, not
// the instant its first pixel appears.
const READ_LINE = 220;

// Jumps land the heading just below the transparent header rather than flush
// against it, so the section title has air above it.
const JUMP_CLEARANCE = 84;

// How much of the document mounts on the first frame. Two sections is enough to
// fill a phone screen and give the reader something to start on; the rest
// arrives in idle batches. Batches are small on purpose — the point is that no
// single commit is ever large enough to drop frames.
const FIRST_PAINT_SECTIONS = 2;
const SECTIONS_PER_BATCH = 2;

export default function BiographyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { hero, lead, toc, sections, hasBiography, failed, retry } = useBiography(id);
  const reduceMotion = useReducedMotion();

  const contentWidth = width - 40;

  // ── Reading position ────────────────────────────────────────────────────
  // Only `activeIndex` and the two quantised values ever cross to JS: the
  // scroll handler runs on the UI thread and gates every runOnJS behind an
  // actual change, so a full read of a long biography costs a few dozen
  // renders rather than one per frame.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const contentRef = useRef<View | null>(null);
  const offsets = useRef<Record<number, number>>({});
  const offsetsSV = useSharedValue<number[]>([]);
  const lastY = useSharedValue(0);
  const hiddenSV = useSharedValue(0);
  const activeSV = useSharedValue(-1);
  const progressSV = useSharedValue(-1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [pillHidden, setPillHidden] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);

  // ── Progressive mount ───────────────────────────────────────────────────
  // How much of the document is on screen. Everything eventually mounts —
  // this is deliberately not windowing, because the contents rail jumps to
  // measured offsets and a section that never mounted has none. It only moves
  // the cost off the first frame and spreads the rest across idle time.
  const [mountedSections, setMountedSections] = useState(FIRST_PAINT_SECTIONS);

  // A different hero (or the row arriving) restarts the staging.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting on a new document is the point
    setMountedSections(FIRST_PAINT_SECTIONS);
  }, [sections]);

  useEffect(() => {
    if (mountedSections >= sections.length) return;
    // runAfterInteractions, so a batch never lands mid-scroll or mid-transition.
    const task = InteractionManager.runAfterInteractions(() => {
      setMountedSections((n) => Math.min(sections.length, n + SECTIONS_PER_BATCH));
    });
    return () => task.cancel();
  }, [mountedSections, sections.length]);

  // Republish the measured offsets in heading order. Images above a heading
  // load async and shift everything below them, so this runs on every measure
  // and again on content-size change rather than once at mount.
  const publishOffsets = useCallback(() => {
    const next: number[] = [];
    for (let i = 0; i < toc.length; i++) {
      const y = offsets.current[i];
      // A heading not yet measured must not read as offset 0, or every section
      // above it would look "current" the moment the page opens.
      next.push(y ?? Number.POSITIVE_INFINITY);
    }
    offsetsSV.value = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values are stable refs
  }, [toc.length]);

  const anchorDeps = useMemo(
    () => ({ contentRef, offsets, onMeasured: publishOffsets }),
    [publishOffsets],
  );

  // Single JS-side commit point. Both values are gated here as well as on the
  // UI thread, so a repeated runOnJS can never turn into a repeated render.
  const commit = useCallback((idx: number, pct: number) => {
    setActiveIndex((prev) => (prev === idx ? prev : idx));
    setProgress((prev) => (prev === pct ? prev : pct));
  }, []);

  const onScroll = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        const y = e.contentOffset.y;
        const span = e.contentSize.height - e.layoutMeasurement.height;
        // Quantised to whole percent — the hairline cannot show finer than
        // that, and it caps the crossings at 100 for an entire document.
        const pct = span > 0 ? Math.min(100, Math.max(0, Math.round((y / span) * 100))) : 0;

        // Active section = the last heading whose top has passed the read line.
        // Unmeasured headings sit at Infinity, so they never claim to be current.
        const arr = offsetsSV.value;
        let idx = 0;
        for (let i = 0; i < arr.length; i++) {
          if (y + READ_LINE >= arr[i]) idx = i;
        }
        if (idx !== activeSV.value || pct !== progressSV.value) {
          activeSV.value = idx;
          progressSV.value = pct;
          runOnJS(commit)(idx, pct);
        }

        // Step out of the way going down, return on any upward move. The floor
        // keeps the pill present while the reader is still in the stage.
        const down = y > lastY.value + 4;
        const up = y < lastY.value - 4;
        if (down && hiddenSV.value === 0 && y > 220) {
          hiddenSV.value = 1;
          runOnJS(setPillHidden)(true);
        } else if (up && hiddenSV.value === 1) {
          hiddenSV.value = 0;
          runOnJS(setPillHidden)(false);
        }
        lastY.value = y;
      },
    },
    [commit],
  );

  // A contents affordance below three sections is noise; the reader can just
  // scroll. Same threshold the component enforces, hoisted so the scroll
  // padding can reserve the pill's room only when there'll be a pill.
  const showContents = hasBiography && toc.length >= MIN_SECTIONS_FOR_CONTENTS;

  const jumpTo = useCallback(
    (index: number) => {
      const y = offsets.current[index];
      if (y == null) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - JUMP_CLEARANCE), animated: !reduceMotion });
    },
    [scrollRef, reduceMotion],
  );

  // The hero row is usually already cached from the character page, so pre →
  // render nothing rather than blink placeholders; a real wait dissolves out.
  const phase = useSkeletonTransition(!hero);
  const nameSkeleton = (
    <SkeletonProvider>
      <Skeleton width="80%" height={26} borderRadius={6} style={{ marginVertical: 4 }} />
    </SkeletonProvider>
  );
  const bodySkeleton = (
    <SkeletonProvider>
      <Skeleton width="100%" height={13} borderRadius={4} style={{ marginBottom: 10 }} />
      <Skeleton width="95%" height={13} borderRadius={4} style={{ marginBottom: 10 }} />
      <Skeleton width="88%" height={13} borderRadius={4} style={{ marginBottom: 10 }} />
      <Skeleton width="92%" height={13} borderRadius={4} style={{ marginBottom: 28 }} />
      <Skeleton width="38%" height={20} borderRadius={5} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={13} borderRadius={4} style={{ marginBottom: 10 }} />
      <Skeleton width="90%" height={13} borderRadius={4} style={{ marginBottom: 10 }} />
      <Skeleton width="75%" height={13} borderRadius={4} style={{ marginBottom: 28 }} />
      <Skeleton width="100%" height={200} borderRadius={10} style={{ marginBottom: 24 }} />
      <Skeleton width="96%" height={13} borderRadius={4} style={{ marginBottom: 10 }} />
      <Skeleton width="84%" height={13} borderRadius={4} />
    </SkeletonProvider>
  );

  // Link resolution is shared (useBiography); only the *acting* differs by
  // platform, so this is the whole platform-specific half.
  const renderersProps = useMemo(
    () => ({
      a: {
        onPress: (_e: unknown, href: string) => {
          resolveBioLink(href)
            .then((action) => {
              if (action.kind === 'hero') router.push(`/character/${action.heroId}`);
              else if (action.kind === 'external') Linking.openURL(action.url);
            })
            .catch(() => {});
        },
      },
    }),
    [router],
  );

  const prose = hasBiography ? (
    <View>
      {lead.cap ? (
        <View style={styles.leadBlock}>
          {/* The drop cap. Web gets this from `::first-letter`, which
              react-native-render-html has no equivalent for, so the lead is
              split in the shared hook and the letter is a real sibling here —
              absolutely positioned so the paragraph's own text can flow past
              it, since RN has no float. */}
          <Text style={styles.dropCap} allowFontScaling={false}>
            {lead.cap}
          </Text>
          <RenderHTML
            contentWidth={contentWidth}
            source={{ html: `<p>${lead.rest}</p>` }}
            baseStyle={LEAD_STYLE}
            tagsStyles={{ ...TAG_STYLES, p: { ...TAG_STYLES.p, ...styles.leadPara } }}
            systemFonts={SYSTEM_FONTS}
            renderersProps={renderersProps}
            enableExperimentalMarginCollapsing
          />
        </View>
      ) : null}
      {/* One RenderHTML per section, mounted a couple at a time. Rendering the
          whole body in a single instance is what made a big biography stall on
          open: RNRH parses, builds a render tree and mounts every node in one
          synchronous commit, and the longest documents belong to the most-opened
          characters (Batman is 398 KB with ~242 images). Splitting the mount
          also staggers the image requests, which used to fire all at once. */}
      {sections.slice(0, mountedSections).map((html, i) => (
        <View
          key={i}
          // Vertical margins only collapse within one RenderHTML instance, so
          // splitting the document would otherwise add the paragraph's bottom
          // margin to the following heading's top margin and open up a visible
          // extra gap before every section. Every chunk after the first begins
          // with an <h2>, so pulling back by exactly that paragraph margin
          // restores the original spacing.
          style={i > 0 ? styles.sectionChunk : undefined}
        >
          <RenderHTML
            contentWidth={contentWidth}
            source={{ html }}
            baseStyle={BASE_STYLE}
            tagsStyles={TAG_STYLES}
            systemFonts={SYSTEM_FONTS}
            renderers={BIOGRAPHY_RENDERERS}
            renderersProps={renderersProps}
            enableExperimentalMarginCollapsing
          />
        </View>
      ))}
      <View style={styles.colophon}>
        <View style={styles.colophonRule} />
        <Text style={styles.colophonMark}>❖</Text>
        <Text style={styles.colophonText}>Biography sourced from ComicVine</Text>
      </View>
    </View>
  ) : failed ? (
    // The hero row itself failed. Saying "no biography yet" here would be a lie
    // about the data rather than a report about the network.
    <EmptyState
      icon="cloud-offline-outline"
      title="Couldn’t load this biography"
      body="Check your connection and try again."
      action={{ label: 'Try again', onPress: retry }}
      tone="light"
      compact
    />
  ) : (
    <EmptyState
      icon="document-text-outline"
      title="No biography yet"
      body="We don’t have a written history for this character yet."
      tone="light"
      compact
    />
  );

  return (
    <SectionAnchorProvider value={anchorDeps}>
      <View style={styles.container}>
        {/* Transparent native header — content flows under it (the identity stage
          fills behind the bar + status bar). Mirrors the character screen's
          header exactly; note we never set headerBackground, since on
          native-stack that forces a translucent backdrop that reads as a
          gradient over dark content. */}
        {/* No native header. iOS 26 gives every screen with a header a
            UIScrollEdgeEffect over its content ScrollView — a light blur band
            under the header items, on by default (`automatic`). Over this
            page's flat deep-ink stage it read as a grey scrim across the
            status bar, and it is redundant: the stage already paints solid
            deep-ink up through the status bar, which is the exact job the
            effect is doing.
            `scrollEdgeEffects: { top: 'hidden' }` would be the surgical fix,
            but it is not reachable through expo-router's Stack options — only
            via react-native-screens' raw <Screen> or its gamma
            <ScrollViewMarker>, and the latter is a Fabric native component
            that would render an empty view on any build that predates it. No
            header means no header-anchored effect, and the stage was designed
            around a floating control anyway. */}
        <Stack.Screen options={{ headerShown: false }} />
        <Animated.ScrollView
          ref={scrollRef}
          style={styles.scroll}
          // Room for the docked pill so it never covers the colophon.
          contentContainerStyle={{ paddingBottom: insets.bottom + (showContents ? 104 : 48) }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          // Images load in above headings and shift every offset below them, so
          // re-measure whenever the document's height changes.
          onContentSizeChange={publishOffsets}
        >
          <View ref={contentRef} collapsable={false}>
            {/* Identity stage — the native counterpart of the web page's cinematic
            header. Four layers, back to front: a heavily blurred portrait for
            atmosphere, a vertical scrim that guarantees the title's contrast, a
            deep-ink cap that fuses the top into the status bar, and the seam. */}
            <View style={[styles.stage, { paddingTop: insets.top + 52 }]}>
              {hero ? (
                <HeroImage
                  id={String(id ?? '')}
                  name={hero.name}
                  imageUrl={hero.image_url}
                  portraitUrl={hero.portrait_url}
                  style={styles.backdrop}
                  contentFit="cover"
                  contentPosition="top"
                  blurRadius={38}
                  recyclingKey={id}
                />
              ) : null}
              {/* Guarantees the title block's contrast whatever the portrait is. */}
              <LinearGradient
                colors={['rgba(11,24,32,0.55)', 'rgba(11,24,32,0.34)', 'rgba(11,24,32,0.9)']}
                locations={[0, 0.42, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              {/* Deep-ink cap: solid through the status-bar zone so the stage's top
              is the SAME pixel value as the chrome, then easing off so the
              portrait blooms in below the floating chevron rather than being
              sliced by it. */}
              <LinearGradient
                colors={[COLORS.deepNavy, COLORS.deepNavy, 'rgba(11,24,32,0)']}
                locations={[0, 0.45, 1]}
                style={[styles.topCap, { height: insets.top + 96 }]}
                pointerEvents="none"
              />

              <View style={styles.stageInner}>
                <HeroImage
                  id={String(id ?? '')}
                  name={hero?.name ?? ''}
                  imageUrl={hero?.image_url}
                  portraitUrl={hero?.portrait_url}
                  style={styles.portrait}
                  contentFit="cover"
                  contentPosition="top"
                  recyclingKey={id}
                />
                <View style={styles.titleBlock}>
                  <Text style={styles.eyebrow}>Biography</Text>
                  {hero ? (
                    <View>
                      <Text style={styles.heroName} numberOfLines={3}>
                        {hero.name}
                      </Text>
                      {phase === 'crossfade' ? (
                        <FadeOutSkeleton>{nameSkeleton}</FadeOutSkeleton>
                      ) : null}
                    </View>
                  ) : phase === 'skeleton' ? (
                    nameSkeleton
                  ) : null}
                  {hero?.summary ? (
                    <Text style={styles.deck} numberOfLines={3}>
                      {hero.summary}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* The seam — the house hairline where a dark band meets beige. */}
              <View style={styles.seam} pointerEvents="none" />
            </View>

            {/* Body */}
            <View style={styles.body}>
              {hero || failed ? (
                <View>
                  {prose}
                  {/* The prose sits settled underneath; only this layer animates. */}
                  {phase === 'crossfade' ? <FadeOutSkeleton>{bodySkeleton}</FadeOutSkeleton> : null}
                </View>
              ) : phase === 'skeleton' ? (
                bodySkeleton
              ) : null}
            </View>
          </View>
        </Animated.ScrollView>

        <FloatingBackButton />

        {showContents ? (
          <View
            style={[styles.contentsDock, { bottom: insets.bottom + 14 }]}
            pointerEvents="box-none"
          >
            <BiographyContents
              toc={toc}
              activeIndex={activeIndex}
              progress={progress / 100}
              hidden={pillHidden && !contentsOpen}
              open={contentsOpen}
              onOpenChange={setContentsOpen}
              onJump={jumpTo}
            />
          </View>
        ) : null}
      </View>
    </SectionAnchorProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flex: 1 },

  // ── Identity stage ──
  stage: {
    backgroundColor: COLORS.deepNavy,
    paddingBottom: 26,
    minHeight: STAGE_MIN_H,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  // Scaled past the bounds so the blur's soft edges never reach the frame.
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    transform: [{ scale: 1.25 }],
    opacity: 0.45,
  },
  topCap: { position: 'absolute', top: 0, left: 0, right: 0 },
  stageInner: { flexDirection: 'row', gap: 16, paddingHorizontal: 20 },
  portrait: {
    width: 92,
    height: 122,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(245,235,220,0.08)',
    // A hairline lip so the portrait separates from the blurred version of
    // itself sitting directly behind it.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,235,220,0.22)',
  },
  titleBlock: { flex: 1, justifyContent: 'flex-end' },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: 5,
  },
  heroName: {
    fontFamily: 'Flame-Regular',
    fontSize: 32,
    lineHeight: 39,
    color: COLORS.beige,
  },
  deck: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: INK_TEXT.muted,
    marginTop: 8,
  },
  seam: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: COLORS.orange,
  },

  // ── Body ──
  body: { paddingHorizontal: 20, paddingTop: 26 },

  // box-none so only the pill itself takes touches — the prose stays scrollable
  // through the dock's full-width band.
  contentsDock: { position: 'absolute', left: 0, right: 0 },

  // The drop cap sits in the paragraph's top-left corner; the lead paragraph
  // indents its first lines around it. Flame's ink runs tall, so the cap is
  // nudged up to sit on the lead's first baseline rather than above it.
  leadBlock: { position: 'relative' },
  // Derived from the paragraph margin rather than typed as a number, so the two
  // can't drift apart: this cancels exactly the margin that no longer collapses
  // now that each section is its own RenderHTML root.
  sectionChunk: { marginTop: -(TAG_STYLES.p.marginBottom as number) },
  dropCap: {
    position: 'absolute',
    left: 0,
    top: -6,
    fontFamily: 'Flame-Regular',
    fontSize: 58,
    lineHeight: 58,
    color: ORANGE_INK,
    zIndex: 1,
  },
  // Three lines of clearance for the cap. RN has no float, so the indent is
  // paid by the whole paragraph — at 16.5/29 the cap spans two lines and the
  // third recovers most of the measure.
  leadPara: { paddingLeft: 46, marginBottom: 18 },

  // ── Colophon ──
  colophon: { alignItems: 'center', marginTop: 34, gap: 8 },
  colophonRule: { width: 44, height: 1, backgroundColor: SEAM_COLOR },
  colophonMark: { fontSize: 13, color: ORANGE_INK },
  colophonText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: PAPER_TEXT.faint,
  },
});
