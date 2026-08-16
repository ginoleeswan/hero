import { useEffect, useState, useCallback, useRef, useMemo, Fragment } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
  Share,
  LayoutAnimation,
  Platform,
  UIManager,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { MAX_TYPE_SCALE, Text } from '../../src/components/ui/Text';
import { Stack, useLocalSearchParams, useRouter, usePathname, Link } from 'expo-router';
import ReAnimated, {
  FadeIn,
  FadeOut,
  Easing,
  useSharedValue,
  useAnimatedProps,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, G } from 'react-native-svg';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { RadialBloom } from '../../src/components/ui/RadialBloom';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { NotFoundView, LoadErrorView } from '../../src/components/NotFoundView';
import { heroRowToCharacterData } from '../../src/lib/db/heroes';
import { loginHref } from '../../src/lib/loginRedirect';
import { characterShareLine, nativeShare, shareLink } from '../../src/lib/share';
import { FamilyCanvas } from '../../src/components/family/FamilyCanvas';
import { groupTitlesByMedia } from '../../src/lib/db/titles';
import { PortrayedBySection } from '../../src/components/PortrayedBySection';
import { HeroLinksRow, heroLinksHasContent } from '../../src/components/HeroLinksRow';
import { useHeroDetail } from '../../src/hooks/useHeroDetail';
import { useHeroHouses } from '../../src/hooks/useHeroHouses';
import { HouseLinks } from '../../src/components/family/HouseLinks';
import { useHeroTeams } from '../../src/hooks/useHeroTeams';
import { ContributeSheet } from '../../src/components/contribute/ContributeSheet';
import { ReportSheet } from '../../src/components/report/ReportSheet';
import type { ReportContext } from '../../src/lib/db/reports';
import { isBlankValue } from '../../src/lib/contribute/missingFields';
import {
  DOSSIER_GROUPS,
  SUMMARY_FIELD,
  POWERS_FIELD,
  STAT_FIELDS,
  type EditableFieldDef,
} from '../../src/lib/db/contributions';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS, ORANGE_INK, PAPER_TEXT } from '../../src/constants/colors';
import { deriveCharacterTheme } from '../../src/lib/accent';
import { isPresentableFact } from '../../src/lib/characterFacts';
import { ALIGNMENT_LABELS, ORIGIN_LABELS } from '../../src/lib/characterTaxonomy';
import { SocialWebPortal } from '../../src/components/character/SocialWebPortal';
import { CharacterSkeleton } from '../../src/components/skeletons/CharacterSkeleton';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../src/components/ui/SkeletonProvider';
import { AbilitiesSection } from '../../src/components/AbilitiesSection';
import { HeroEventMoments } from '../../src/components/event/HeroEventMoments';
import { TraitBand } from '../../src/components/character/TraitBand';
import { PullQuoteBio } from '../../src/components/character/PullQuoteBio';
import {
  SignaturePowerTiles,
  pickSignaturePowers,
} from '../../src/components/character/SignaturePowers';
import { DidYouKnowDeck } from '../../src/components/character/DidYouKnowDeck';
import { MovieStrip } from '../../src/components/MovieStrip';
import { FirstIssueModal } from '../../src/components/FirstIssueModal';
import { GalleryStrip } from '../../src/components/GalleryStrip';
import { ComicCoverRail } from '../../src/components/home/ComicCoverRail';
import { ImageLightbox } from '../../src/components/ImageLightbox';
import { RelatedHeroStrip } from '../../src/components/RelatedHeroStrip';
import { UniverseEyebrow } from '../../src/components/PublisherBadge';
import type { CharacterData } from '../../src/types';
import { heroBlock, sectionGutter, PROSE_MAX_WIDTH } from '../../src/constants/layout';
import { QuickFacts } from '../../src/components/character/QuickFacts';
import { PaperCard } from '../../src/components/ui/PaperCard';

// One tint for BOTH sides of the header bar. The back chevron takes it via
// `headerTintColor`; the share glyph has to be told explicitly, because a
// custom `headerRight` child does not inherit the header tint. Sharing the
// constant is what stops them drifting apart again.
//
// Beige, not orange. iOS renders the native back chevron in its own material
// colour inside the glass header rather than the tint we hand it, so an orange
// share glyph sat opposite a white chevron on the same bar — two accents where
// the bar has one job. The app's on-ink voice is beige everywhere else (the
// arena's header share already used it), and a nav-bar control is chrome, not
// an accent: colour here competes with the artwork it floats over.
const HEADER_TINT = COLORS.beige;
// The identity (name + vitals) sits ON the portrait over a dark scrim; the beige
// content sheet then rises over the hero with a rounded lip, overlapping this far.
const SHEET_OVERLAP = 28;
/** Web's stage backdrop is `filter: blur(55px)`. expo-image's blurRadius is in
 *  points and lands close at this value; the 1.3x scale on the same view keeps
 *  the blur's own soft edge outside the frame either way. */
const STAGE_BLUR = 55;

// Web's desktop measures, ported. 1180 is `stageInner`'s cap and 300 the
// sideCol; how far the portrait rides up into the band is a FORMULA rather
// than a measure — see `portraitOverlap` in the component.
const STAGE_MAX = 1180;
const SIDE_COL = 300;
/** `bodyInner`'s padding — shared with the sticky side column's travel maths,
 *  which has to know where the body's content box starts and ends. */
const BODY_PAD = 24;
/** `onLayout` reports the body's y 48pt above where it actually paints — see
 *  `portraitOverlap`, which is solved against the card's measured position. */
const BODY_LAYOUT_DELTA = 48;
/** Where the portrait's top should land under the nav bar. Web puts its card
 *  32pt below a 64pt bar; native's bar bottom is `insets.top + 44`. */
const PORTRAIT_TOP_INSET = 76;
// Sheet's top offset within the scroll content (hero spacer height − the lip),
// added to each section's local onLayout y so the quick-nav anchors stay correct.

const STAT_CONFIG: { key: string; label: string; tint: string }[] = [
  { key: 'intelligence', label: 'Intelligence', tint: COLORS.blue },
  { key: 'strength', label: 'Strength', tint: COLORS.red },
  { key: 'speed', label: 'Speed', tint: COLORS.yellow },
  { key: 'durability', label: 'Durability', tint: COLORS.green },
  { key: 'power', label: 'Power', tint: COLORS.orange },
  { key: 'combat', label: 'Combat', tint: COLORS.brown },
];

// Enable LayoutAnimation on Android (iOS/web are on by default / no-op).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// "Is this a real value?" lives in src/lib/characterFacts.ts so this half and
// the web half can't drift again — they already had, and native was showing
// literal "Unknown" / "No alter egos found." text that web hid.
const valid = isPresentableFact;

// "Created by" sits left of the alignment chips. Two names fill one line and a
// third wraps to a comfortable second (the identity block reserves room for it),
// so show up to three in full. Only genuinely long lists (4+) collapse the tail
// into "& N others" so the credit never runs past two lines.
const formatCreators = (creators: string[]) =>
  creators.length <= 3
    ? creators.join(' & ')
    : `${creators.slice(0, 2).join(' & ')} & ${creators.length - 2} others`;

// ── Power-stat dial ──────────────────────────────────────────────────────────
// Reanimated-driven arc, replacing react-native-circular-progress whose
// SVG-stroke fill could only animate on the JS thread (the reason the dials were
// gated behind a scroll-reveal hack). Here the arc's `d` is recomputed in a
// worklet from a shared value, so the sweep runs on the UI thread and can play
// freely during the entry transition. Geometry mirrors the old config exactly:
// size 72, 11/9 stroke widths, 250° sweep, -124° rotation, round caps.
const DIAL_SIZE = 72;
const DIAL_TINT_W = 11;
const DIAL_BG_W = 9;
const DIAL_SWEEP = 250;
const DIAL_ROTATION = -124;
const DIAL_RADIUS = DIAL_SIZE / 2 - DIAL_TINT_W / 2;
const DIAL_C = DIAL_SIZE / 2;

// Arc path from startAngle→endAngle (degrees), matching the library's geometry
// (0° at top, clockwise). Used both on the JS thread (static track) and inside
// a worklet (animated tint), so it carries the 'worklet' directive.
function dialArc(startAngle: number, endAngle: number): string {
  'worklet';
  const toXY = (angle: number) => {
    const a = ((angle - 90) * Math.PI) / 180;
    return { x: DIAL_C + DIAL_RADIUS * Math.cos(a), y: DIAL_C + DIAL_RADIUS * Math.sin(a) };
  };
  const start = toXY(endAngle * 0.9999999);
  const end = toXY(startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${DIAL_RADIUS} ${DIAL_RADIUS} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

const DIAL_TRACK = dialArc(0, DIAL_SWEEP);
const AnimatedPath = ReAnimated.createAnimatedComponent(Path);

function StatDial({ label, value, tint }: { label: string; value: string; tint: string }) {
  const numeric = parseInt(value, 10);
  const target = isNaN(numeric) ? 0 : numeric;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(target, { duration: 1800, easing: Easing.out(Easing.cubic) });
  }, [target, progress]);

  const arcProps = useAnimatedProps(() => {
    const angle = (DIAL_SWEEP * progress.value) / 100;
    return { d: angle < 0.1 ? '' : dialArc(0, angle) };
  });

  return (
    <View style={styles.dialWrap}>
      <View style={styles.dialGauge}>
        <Svg width={DIAL_SIZE} height={DIAL_SIZE} style={StyleSheet.absoluteFill}>
          <G rotation={DIAL_ROTATION} originX={DIAL_C} originY={DIAL_C}>
            <Path
              d={DIAL_TRACK}
              stroke="rgba(41,60,67,0.12)"
              strokeWidth={DIAL_BG_W}
              strokeLinecap="round"
              fill="none"
            />
            <AnimatedPath
              animatedProps={arcProps}
              stroke={tint}
              strokeWidth={DIAL_TINT_W}
              strokeLinecap="round"
              fill="none"
            />
          </G>
        </Svg>
        <Text style={styles.dialValue}>{target}</Text>
      </View>
      <Text style={styles.dialLabel}>{label}</Text>
    </View>
  );
}

// A subtle pencil that sits at the right of a section header, opening that
// section's edit. MaterialCommunityIcons "pencil" — turns orange while its
// section is being edited.
function SectionPencil({
  onPress,
  active,
  label = 'Edit',
}: {
  onPress: () => void;
  active?: boolean;
  label?: string;
}) {
  const tint = active ? COLORS.orange : 'rgba(41,60,67,0.4)';
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={10}
      style={styles.sectionPencil}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons name="pencil" size={16} color={tint} />
    </TouchableOpacity>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, styles.sectionTitleGrow]}>{title}</Text>
        {action ?? null}
      </View>
      <View style={styles.divider} />
      {children}
    </View>
  );
}

// Padded title + divider with no body padding — used for sections whose body is
// a full-bleed horizontal scroller (the scroller carries its own edge insets).
function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeaderPad}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, styles.sectionTitleGrow]}>{title}</Text>
        {action ?? null}
      </View>
      <View style={styles.divider} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!isPresentableFact(value)) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// These chips are text on INK, not text on paper — and the ramps they were
// reaching for say so in their own docstrings. ACCENT_INK's comment names these
// exact chips and measures every ratio "against beige"; PAPER_TEXT's ratios are
// beige too. But `identityNode` renders over a scrim on the character's own
// ARTWORK (phone, tablet portrait) or on the dark band (tablet landscape). Not
// beige, anywhere. Measured on an iPad on 2026-08-15, that put the HERO chip at
// **2.28:1** and the HUMAN chip at **1.29:1** — the second is not low-contrast,
// it is invisible, and `human` is the commonest origin in the catalogue.
//
// So the wash is composited over deepNavy and kept OPAQUE. Over artwork a
// translucent chip has no knowable ground, so no ratio can honestly be promised
// for it; an opaque one has exactly one ground, and the numbers below are
// measured against it. Text is the FILL hue — the same call the web page
// already makes on its own dark band (`alignmentColor`, `[id].web.tsx`) —
// lifted toward white for the four hues too dark to clear 4.5:1 on their own
// ground. Wording still comes from src/lib/characterTaxonomy.ts so it cannot
// drift from web again.
//
// `bg` is the hue at 16% over COLORS.deepNavy, flattened to an opaque hex.
const ALIGNMENT_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  /** 4.93:1 */
  good: { label: ALIGNMENT_LABELS.good, bg: '#192F24', color: COLORS.green },
  /** 4.53:1 — COLORS.red lifted; the fill hue is 2.69:1 on its own ground. */
  bad: { label: ALIGNMENT_LABELS.bad, bg: '#261C22', color: '#CA6A66' },
  /** 5.36:1 */
  neutral: { label: ALIGNMENT_LABELS.neutral, bg: '#232E34', color: COLORS.grey },
};

const ORIGIN_WASH: Record<string, { bg: string; color: string }> = {
  /** 4.54:1 — COLORS.purple lifted; the fill hue is 2.83:1 on its own ground. */
  mutant: { bg: '#1D1D41', color: '#9E6DF2' },
  /** 4.60:1 */
  alien: { bg: '#0D2E36', color: COLORS.blue },
  /** 5.36:1 */
  human: { bg: '#232E34', color: COLORS.grey },
  /** 7.18:1 */
  'god/eternal': { bg: '#313120', color: COLORS.yellow },
  /** 4.82:1 */
  radiation: { bg: '#2E2723', color: COLORS.orange },
  // COLORS.black is 1.27:1 on its own ground — a near-black chip label on a
  // near-black chip. Lifted to a steel grey, which is what "cyborg/robot" wants
  // to look like anyway.
  /** 4.73:1 */
  cyborg: { bg: '#101B22', color: '#858585' },
  /** 4.73:1 */
  robot: { bg: '#101B22', color: '#858585' },
  /** 4.73:1 — COLORS.brown lifted to a warm taupe; the fill hue is 1.33:1. */
  training: { bg: '#161A1E', color: '#9A7F77' },
  /** 4.60:1 */
  inhuman: { bg: '#0D2E36', color: COLORS.blue },
};

const ORIGIN_CONFIG: Record<string, { label: string; bg: string; color: string }> =
  Object.fromEntries(
    Object.entries(ORIGIN_WASH).map(([key, wash]) => [
      key,
      { label: ORIGIN_LABELS[key] ?? key, ...wash },
    ]),
  );

interface TaxoChip {
  key: string;
  label: string;
  bg: string;
  color: string;
}

// The identity block shows at most two taxonomy chips (alignment + origin),
// stacked on the right. Order them shortest label first so the stack forms a
// tidy top-down edge instead of a ragged one.
function resolveTaxoChips(
  alignment: string | null | undefined,
  origin: string | null | undefined,
): TaxoChip[] {
  const chips: TaxoChip[] = [];
  const a = alignment ? ALIGNMENT_CONFIG[alignment.toLowerCase().trim()] : undefined;
  if (a) chips.push({ key: 'alignment', ...a });
  const o = origin ? ORIGIN_CONFIG[origin.toLowerCase().trim()] : undefined;
  if (o) chips.push({ key: 'origin', ...o });
  return chips.sort((x, y) => x.label.length - y.label.length);
}

function AffiliationChips({ value }: { value: string | null | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  // Hooks must run unconditionally, so derive chips first (empty when blank) and
  // resolve team ids before any early return.
  const chips = (isPresentableFact(value) ? (value as string) : '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(isPresentableFact);
  const resolveTeamId = useHeroTeams(chips);
  if (chips.length === 0) return null;
  const visible = expanded ? chips : chips.slice(0, 8);
  const remainder = chips.length - 8;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>Affiliations:</Text>
      <View style={styles.chipsWrap}>
        {visible.map((chip, i) => {
          const teamId = resolveTeamId(chip);
          if (!teamId) {
            return (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{chip}</Text>
              </View>
            );
          }
          return (
            <TouchableOpacity
              key={i}
              onPress={() => router.push(`/team/${teamId}` as Parameters<typeof router.push>[0])}
              style={[styles.chip, styles.chipLink]}
            >
              <Text style={[styles.chipText, styles.chipLinkText]}>{chip}</Text>
            </TouchableOpacity>
          );
        })}
        {!expanded && remainder > 0 && (
          <TouchableOpacity onPress={() => setExpanded(true)} style={styles.chip}>
            <Text style={styles.chipText}>+{remainder} more</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// At-a-glance numbers under the name — gives the page a punchy "stat block" feel
// before the reader scrolls. Renders only the metrics that actually exist.
function VitalsStrip({
  powerTotal,
  issueCount,
  movieCount,
}: {
  powerTotal: number;
  issueCount: number | null | undefined;
  movieCount: number | null | undefined;
}) {
  const items: { value: string; label: string }[] = [];
  if (powerTotal > 0) items.push({ value: String(powerTotal), label: 'Power' });
  if ((issueCount ?? 0) > 0)
    items.push({ value: issueCount!.toLocaleString(), label: 'Appearances' });
  if ((movieCount ?? 0) > 0)
    items.push({ value: String(movieCount), label: movieCount === 1 ? 'Movie' : 'Movies' });
  if (items.length === 0) return null;
  return (
    <View style={styles.vitals}>
      {items.map((it, i) => (
        <Fragment key={it.label}>
          {i > 0 ? <View style={styles.vitalDivider} /> : null}
          <View style={styles.vitalItem}>
            <Text style={styles.vitalValue}>{it.value}</Text>
            <Text style={styles.vitalLabel}>{it.label}</Text>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

// Whether the Dossier has anything to show — mirrors the group checks inside
// <Dossier> so the quick-nav doesn't offer a chip that scrolls to nothing.
function hasDossierData(data: CharacterData, includeFirstAppearance: boolean): boolean {
  const { biography: bio, appearance: app, work, connections } = data.stats;
  const aliases = bio.aliases.filter((a) => valid(a));
  const affiliation = data.details.teams?.length
    ? data.details.teams.join(', ')
    : connections['group-affiliation'];
  const hasProfile =
    valid(bio['alter-egos']) ||
    valid(bio['place-of-birth']) ||
    (includeFirstAppearance && valid(bio['first-appearance'])) ||
    aliases.length > 0;
  const hasAppearance =
    valid(app.gender) ||
    valid(app.race) ||
    app.height.some(valid) ||
    app.weight.some(valid) ||
    valid(app['eye-color']) ||
    valid(app['hair-color']);
  const hasConnections = valid(work.occupation) || valid(work.base) || valid(affiliation);
  return hasProfile || hasAppearance || hasConnections;
}

// The dry label/value data (Profile + Appearance + Connections), folded into one
// collapsed-by-default card so it stops dominating the lower half of the screen.
function Dossier({
  data,
  includeFirstAppearance,
  eraSummary,
  editValues,
  onEditField,
}: {
  data: CharacterData;
  includeFirstAppearance: boolean;
  eraSummary?: string | null;
  editValues?: Record<string, string | null | undefined>;
  onEditField?: (field: EditableFieldDef | null, current: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const { biography: bio, appearance: app, work, connections } = data.stats;
  const aliases = bio.aliases.filter((a) => valid(a));
  const heightStr = app.height.filter(valid).join(' / ');
  const weightStr = app.weight.filter(valid).join(' / ');
  const affiliation = data.details.teams?.length
    ? data.details.teams.join(', ')
    : connections['group-affiliation'];

  const hasProfile =
    valid(bio['alter-egos']) ||
    valid(bio['place-of-birth']) ||
    (includeFirstAppearance && valid(bio['first-appearance'])) ||
    aliases.length > 0;
  const hasAppearance =
    valid(app.gender) ||
    valid(app.race) ||
    !!heightStr ||
    !!weightStr ||
    valid(app['eye-color']) ||
    valid(app['hair-color']);
  const hasConnections = valid(work.occupation) || valid(work.base) || valid(affiliation);

  const hasEra = !!eraSummary;
  const hasAny = hasProfile || hasAppearance || hasConnections || hasEra;
  // Reading mode stays pristine: an empty dossier shows nothing.
  if (!hasAny) return null;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
    Haptics.selectionAsync();
  };
  const toggleEdit = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditing((e) => !e);
    Haptics.selectionAsync();
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.7}
        disabled={editing}
        style={[styles.dossierBar, (open || editing) && styles.dossierBarOpen]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open || editing }}
        accessibilityLabel={open ? 'Collapse dossier' : 'Expand dossier'}
      >
        <View style={styles.dossierBarText}>
          <Text style={styles.dossierTitle}>Dossier</Text>
          {!open && !editing ? (
            <Text style={styles.dossierHint}>Appearance, affiliations, relatives & more</Text>
          ) : null}
        </View>
        <View style={styles.dossierToggle}>
          {!editing ? (
            <>
              <Text style={styles.dossierToggleText}>{open ? 'Hide' : 'View'}</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={COLORS.navy} />
            </>
          ) : (
            <Text style={styles.dossierToggleText}>Done</Text>
          )}
          <SectionPencil active={editing} onPress={toggleEdit} label="Edit dossier" />
        </View>
      </TouchableOpacity>
      {editing ? (
        <View style={styles.dossierBody}>
          {DOSSIER_GROUPS.map((group, gi) => (
            <Fragment key={group.key}>
              <Text style={[styles.dossierGroupLabel, gi > 0 && styles.dossierGroupSpacing]}>
                {group.label}
              </Text>
              {group.fields.map((f) => {
                const v = editValues?.[f.field];
                const filled = !isBlankValue(v);
                return (
                  <TouchableOpacity
                    key={f.field}
                    onPress={() => onEditField?.(f, filled ? (v ?? null) : null)}
                    style={styles.editRow}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.editRowLabel}>{f.label}</Text>
                    <View style={styles.editRowRight}>
                      <Text
                        style={filled ? styles.editRowValue : styles.editRowAdd}
                        numberOfLines={1}
                      >
                        {filled ? v : 'Add'}
                      </Text>
                      <Ionicons name={filled ? 'pencil' : 'add'} size={14} color={COLORS.orange} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Fragment>
          ))}
          <Text style={[styles.dossierGroupLabel, styles.dossierGroupSpacing]}>Trivia</Text>
          <TouchableOpacity
            onPress={() => onEditField?.(null, null)}
            style={styles.editRow}
            activeOpacity={0.7}
          >
            <Text style={styles.editRowLabel}>Did You Know fact</Text>
            <View style={styles.editRowRight}>
              <Text style={styles.editRowAdd}>Add</Text>
              <Ionicons name="bulb-outline" size={14} color={COLORS.orange} />
            </View>
          </TouchableOpacity>
        </View>
      ) : open ? (
        <View style={styles.dossierBody}>
          {hasEra ? (
            <>
              <Text style={styles.dossierGroupLabel}>Debut</Text>
              <Text style={styles.dossierEra}>{eraSummary}</Text>
            </>
          ) : null}
          {hasProfile ? (
            <>
              <Text style={[styles.dossierGroupLabel, hasEra && styles.dossierGroupSpacing]}>
                Profile
              </Text>
              <InfoRow label="Alter egos" value={bio['alter-egos']} />
              <InfoRow label="Place of birth" value={bio['place-of-birth']} />
              {includeFirstAppearance ? (
                <InfoRow label="First appearance" value={bio['first-appearance']} />
              ) : null}
              {aliases.length > 0 ? <InfoRow label="Aliases" value={aliases.join(', ')} /> : null}
            </>
          ) : null}
          {hasAppearance ? (
            <>
              <Text style={[styles.dossierGroupLabel, hasProfile && styles.dossierGroupSpacing]}>
                Appearance
              </Text>
              <InfoRow label="Gender" value={app.gender} />
              <InfoRow label="Race" value={app.race} />
              <InfoRow label="Height" value={heightStr} />
              <InfoRow label="Weight" value={weightStr} />
              <InfoRow label="Eyes" value={app['eye-color']} />
              <InfoRow label="Hair" value={app['hair-color']} />
            </>
          ) : null}
          {hasConnections ? (
            <>
              <Text
                style={[
                  styles.dossierGroupLabel,
                  (hasProfile || hasAppearance) && styles.dossierGroupSpacing,
                ]}
              >
                Connections
              </Text>
              <InfoRow label="Occupation" value={work.occupation} />
              <InfoRow label="Base" value={work.base} />
              <AffiliationChips value={affiliation} />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function CharacterScreen() {
  const {
    id,
    name: paramName,
    imageUri: paramImageUri,
  } = useLocalSearchParams<{
    id: string;
    name?: string;
    imageUri?: string;
  }>();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // Live, and derived from the SHARED aspect rather than from height*0.66
  // directly: the rail card this page morphs out of uses the same function, and
  // the Apple Zoom transition only fills edge to edge while the two agree. They
  // used to agree by both being frozen at launch; on an iPad that stops being
  // true the first time it rotates.
  const { width: winW, height: winH } = useWindowDimensions();
  // The hero's art block, and with it the whole page's structure.
  //
  // `wide` is a landscape tablet, and it is the case the old `winW * aspect`
  // could not survive: `heroImageAspect` floors at 1.1, so a full-bleed hero on
  // a 1376x1032 iPad asked for a **1514pt-tall** image — one and a half screens
  // of portrait before a word of content. Phone and tablet-portrait are
  // untouched; there the block still IS the window.
  const hero = heroBlock(winW, winH);
  const HERO_IMAGE_HEIGHT = hero.height;
  // In `wide` the art becomes a fixed left column and the sheet scrolls beside
  // it, so the identity moves out of the scroll flow and onto that column.
  // Web splits from 700pt and so does this: BOTH tablet shapes get the band +
  // two-column body, not just landscape. Portrait was left on the phone's
  // immersive layout, where the art block is `winW * heroImageAspect` — 1032 x
  // 1135 on an iPad, so 79% of the fold is one image and nothing on the page
  // says what the reader is looking at until they scroll. At 1032 with a 24pt
  // gutter the split is 644 + 300, which is the division web itself runs from
  // 700 up. The phone keeps the immersive design; `shape` is 'none' there.
  const split = hero.shape !== 'none';
  // Portrait's band is the same composition in a third of the width: 1032 - 24
  // - (300 + 48) leaves the inner column 660pt, against landscape's 1004. The
  // identity's two groups do not both fit on one row there — measured, the
  // trait pills wrapped to three ragged rows while the meta group beside them
  // sat under 60pt of empty band. So `tall` stacks them instead of splitting
  // the row, which puts every trait on one line and gives the meta its own.
  const tall = hero.shape === 'tall';
  const gutter = sectionGutter(winW, 20);
  const compareStripStyle = [styles.compareStrip, { paddingBottom: insets.bottom || 16 }];
  const {
    user,
    isAdmin,
    data,
    setData,
    narrative,
    eventMoments,
    family,
    comicVineLoading,
    notFound,
    loadError,
    favourited,
    favLoading,
    favCount,
    titles,
    portrayals,
    links,
    galleryImages,
    galleryLoading,
    newIssues,
    heroRow,
    heroRowQuery,
    powerTotal,
    percentile,
    hasFirstVisual,
    relatedHeroMap,
    enemyNames,
    allyNames,
    teammateNames,
    heroImageUrl,
    heroPortraitUrl,
    displayName,
    retryLoad,
    toggleFavourite,
  } = useHeroDetail({ id, paramName, paramImageUri });
  // Houses this character belongs to — the link out of the family section and
  // into the whole dynasty.
  const heroHouses = useHeroHouses(heroRow?.id ?? null);

  // Ambient per-character palette — blurhash average color → publisher → teal.
  const theme = useMemo(
    () =>
      deriveCharacterTheme({
        portrait_blurhash: heroRow?.portrait_blurhash,
        publisher: heroRow?.publisher ?? data?.stats.biography.publisher ?? null,
      }),
    [heroRow, data],
  );

  // View-only UI state (edit affordances, first-issue modal, image lightbox).
  const [statsEditing, setStatsEditing] = useState(false);
  const [contributeMenu, setContributeMenu] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    field: EditableFieldDef | null;
    current: string | null;
    report?: boolean;
  } | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; caption?: string | null }[]>(
    [],
  );
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [reportCtx, setReportCtx] = useState<{
    context: ReportContext;
    imageUrl?: string | null;
  } | null>(null);

  const [scrollY] = useState(() => new Animated.Value(0));
  const [compareScale] = useState(() => new Animated.Value(1));

  const springCompare = (toValue: number) =>
    Animated.spring(compareScale, {
      toValue,
      stiffness: 260,
      damping: 18,
      mass: 0.6,
      useNativeDriver: true,
    }).start();

  // Parallax: image drifts up at ~0.3x scroll speed as content covers it.
  // Overscroll stretch: the scale is centre-anchored, so pulling down by d
  // (scale 1 + d/H) grows the image d/2 up and d/2 down — while the content
  // below moves down by the full d, opening a beige gap under the identity.
  // Translating DOWN by d/2 pins the top edge to the screen top and the bottom
  // edge to the moving content: the art stretches to fill the pull exactly.
  const imageTranslateY = scrollY.interpolate({
    inputRange: [-HERO_IMAGE_HEIGHT, 0, HERO_IMAGE_HEIGHT],
    outputRange: [HERO_IMAGE_HEIGHT / 2, 0, -HERO_IMAGE_HEIGHT / 3],
    extrapolate: 'clamp',
  });

  // Scale up on overscroll (scrollY < 0). At scrollY = 0 → scale 1.
  const imageScale = scrollY.interpolate({
    inputRange: [-HERO_IMAGE_HEIGHT, 0],
    outputRange: [2, 1],
    extrapolateRight: 'clamp',
  });

  // Header name slides up + snaps in from large scale as the identity scrolls behind
  // the header. The opaque beige sheet covers the image as it rises, so the image no
  // longer needs an opacity fade.
  const HEADER_H = 100; // approx status bar + nav bar height
  const NAME_TOP = HERO_IMAGE_HEIGHT - 180; // the on-image name sits ~180px above the hero bottom
  const NAME_IN = NAME_TOP - HEADER_H - 30; // name approaching header bottom
  const NAME_OUT = NAME_TOP - HEADER_H + 20; // name fully behind header

  const headerNameOpacity = scrollY.interpolate({
    inputRange: [NAME_IN, NAME_OUT],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const headerNameScale = scrollY.interpolate({
    inputRange: [NAME_IN, NAME_OUT],
    outputRange: [1.3, 1],
    extrapolate: 'clamp',
  });
  const headerNameY = scrollY.interpolate({
    inputRange: [NAME_IN, NAME_OUT],
    outputRange: [10, 0],
    extrapolate: 'clamp',
  });

  // ── Section quick-nav ──────────────────────────────────────────────────────
  // A floating jump bar fades in once content covers the hero image. Each section
  // registers its scroll offset via onLayout; tapping a chip scrolls there. The
  // active chip is tracked from the scroll listener (refs avoid stale closures).
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const sectionOrder = useRef<string[]>([]);
  const activeRef = useRef<string>('');
  const [activeSection, setActiveSection] = useState('');
  const [navVisible, setNavVisible] = useState(false);

  // Clearance above a section title when jumping: native header + the nav bar.
  const NAV_CLEARANCE = HEADER_H + 52;

  // The scroll offset of whatever container holds the sections — the beige
  // sheet when stacked, the two-column body when split. This was the constant
  // `HERO_IMAGE_HEIGHT - SHEET_OVERLAP`, which is the sheet's offset in the
  // STACKED layout and a phantom in the split one: split renders no full-bleed
  // art at all (the portrait is a 300pt card inside the scroll), so every
  // quick-nav jump was landing hundreds of points past the section it named,
  // and the nav itself only faded in after half an art block that does not
  // exist. Measured instead, so the two layouts cannot disagree with it.
  const [sectionsBox, setSectionsBox] = useState({ y: 0, h: 0 });
  const onSectionsLayout = (e: LayoutChangeEvent) => {
    const y = Math.round(e.nativeEvent.layout.y);
    const h = Math.round(e.nativeEvent.layout.height);
    setSectionsBox((prev) => (prev.y === y && prev.h === h ? prev : { y, h }));
  };
  const anchorBase = sectionsBox.y;
  // Web's rule, ported: the portrait's TOP sits just under the header bar
  // whatever the band's height turns out to be, capped at 300 so a very tall
  // band cannot drag it off the top (`-Math.min(300, Math.max(0, stageHeight -
  // (TOPBAR_HEIGHT + 8)))`, `[id].web.tsx`). Native had a flat 132, which on a
  // portrait iPad started the card 244pt down and left the whole upper-right
  // of the band empty.
  //
  // Solved from the card's untranslated position rather than from the band's
  // height directly, because the two do not agree: measured on an iPad with
  // the overlap forced to 0, the card's top painted at 365.5 while
  // `onSectionsLayout` reported the body at 293.5 — a steady 48pt short, which
  // is BODY_LAYOUT_DELTA. Deriving from `anchorBase` alone under-pulled the
  // card by exactly that much.
  const portraitOverlap = Math.min(
    300,
    Math.max(0, anchorBase + BODY_PAD + BODY_LAYOUT_DELTA - (insets.top + PORTRAIT_TOP_INSET)),
  );
  // ── The side column travels ─────────────────────────────────────────────
  // Web's `sideCol` is `position: sticky`; RN has no sticky, so the column is
  // translated by the scroll instead and clamped to its own container. Without
  // it the split is only half web's layout: Quick Facts and Debut run out long
  // before the main column does, and the right third of the page is empty for
  // everything after them — measured at ~1200pt on a portrait iPad, which is
  // where the main column is longest and the void therefore worst.
  //
  // `travel` is how far the column can go before its bottom would leave the
  // body; zero (or negative, when the column is the taller of the two) parks it
  // and the interpolation below degenerates to a constant.
  const SIDE_STICKY_TOP = insets.top + 56;
  const [sideColH, setSideColH] = useState(0);
  const onSideColLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setSideColH((prev) => (prev === h ? prev : h));
  };
  const sideTravel = Math.max(0, sectionsBox.h - sideColH - BODY_PAD * 2);
  const sideStart = Math.max(0, sectionsBox.y + BODY_PAD - SIDE_STICKY_TOP);
  const sideTranslate = scrollY.interpolate({
    // A zero-width input range is invalid, so the parked case still spans a
    // point — it just maps both ends to no movement.
    inputRange: [sideStart, sideStart + Math.max(1, sideTravel)],
    outputRange: [0, sideTravel],
    extrapolate: 'clamp',
  });

  // Split's fold is the identity band, which is what `anchorBase` measures.
  const fold = split ? anchorBase || HERO_IMAGE_HEIGHT : HERO_IMAGE_HEIGHT;

  const navOpacity = scrollY.interpolate({
    inputRange: [fold * 0.45, fold * 0.62],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Section `onLayout` y is relative to its container, so the base is added at
  // read time rather than at layout time — the two arrive in either order, and
  // baking the base in would freeze whichever value happened to be first.
  const registerAnchor = useCallback(
    (key: string) => (e: LayoutChangeEvent) => {
      sectionOffsets.current[key] = e.nativeEvent.layout.y;
    },
    [],
  );

  const jumpTo = useCallback(
    (key: string) => {
      const y = sectionOffsets.current[key];
      if (y == null) return;
      Haptics.selectionAsync();
      scrollRef.current?.scrollTo({
        y: Math.max(0, anchorBase + y - NAV_CLEARANCE),
        animated: true,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchorBase],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      setNavVisible((prev) => {
        const next = y > fold * 0.5;
        return next === prev ? prev : next;
      });
      const probe = y + NAV_CLEARANCE + 12 - anchorBase;
      let current = '';
      for (const key of sectionOrder.current) {
        const off = sectionOffsets.current[key];
        if (off != null && off <= probe) current = key;
      }
      if (current !== activeRef.current) {
        activeRef.current = current;
        setActiveSection(current);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchorBase, fold],
  );

  // The sections that actually render, in scroll order — drives the quick-nav
  // chips and active-section tracking. Mirrors the render conditions below.
  const presentSections = useMemo<{ key: string; label: string }[]>(() => {
    if (!data) return [];
    const s: { key: string; label: string }[] = [];
    if (comicVineLoading || data.details.summary || data.details.hasBiography)
      s.push({ key: 'summary', label: 'Summary' });
    s.push({ key: 'stats', label: 'Stats' });
    if (comicVineLoading || data.details.powers?.length)
      s.push({ key: 'abilities', label: 'Abilities' });
    if (narrative && narrative.didYouKnow.length > 0) s.push({ key: 'narrative', label: 'Trivia' });
    // Dossier (the bio infobox) caps the intrinsic-character block, before the
    // relational/media sections below.
    if (hasDossierData(data, !hasFirstVisual)) s.push({ key: 'dossier', label: 'Dossier' });
    if (comicVineLoading || enemyNames.length || allyNames.length || teammateNames.length)
      s.push({ key: 'allies', label: 'Allies' });
    if (comicVineLoading || (titles && titles.length > 0))
      s.push({ key: 'screen', label: 'On Screen' });
    // In Print consolidates the debut feature + cover gallery into one section.
    if (
      newIssues.length > 0 ||
      hasFirstVisual ||
      (galleryImages === null && galleryLoading) ||
      (galleryImages && galleryImages.length > 0)
    )
      s.push({ key: 'print', label: 'In Print' });
    if (family.length > 0) s.push({ key: 'family', label: 'Family' });
    return s;
  }, [
    data,
    comicVineLoading,
    titles,
    galleryImages,
    galleryLoading,
    newIssues,
    hasFirstVisual,
    family,
    enemyNames,
    allyNames,
    teammateNames,
    narrative,
  ]);
  useEffect(() => {
    sectionOrder.current = presentSections.map((s) => s.key);
  }, [presentSections]);

  // The flagship page's share, and it used to send `Check out <name> on Hero`:
  // no link, so the character OG card that api/og already renders never had a
  // URL to hang off, and "Hero" is the repo slug rather than the product.
  const handleShare = useCallback(async () => {
    const name = data?.stats.name ?? heroRow?.name ?? paramName;
    if (!name || !id) return;
    Haptics.selectionAsync();
    const publisher = heroRow?.publisher ?? null;
    try {
      await Share.share(
        nativeShare(
          characterShareLine(name, publisher),
          shareLink.character(id),
          Platform.OS === 'ios',
        ),
      );
    } catch {
      // user dismissed the sheet or sharing is unavailable — nothing to do
    }
  }, [data, heroRow?.name, heroRow?.publisher, paramName, id]);

  // Header shared by both failure states: a back chevron over the beige canvas.
  const failureHeader = (
    <Stack.Screen
      options={{
        headerShown: true,
        headerTransparent: true,
        headerStyle: { backgroundColor: 'transparent' },
        headerShadowVisible: false,
        headerTintColor: COLORS.orange,
        headerBackButtonDisplayMode: 'minimal',
        headerTitle: '',
      }}
    />
  );

  // Genuine 404 — the hero id resolves to nothing. Wanted-poster treatment.
  if (notFound) {
    return (
      <View style={styles.container}>
        {failureHeader}
        <NotFoundView
          stamp="Missing"
          stampColor={COLORS.red}
          icon="person"
          headline="Whereabouts unknown"
          subline="No such character in the archive."
          actions={[
            { label: 'Back to Discover', primary: true, onPress: () => router.replace('/') },
            { label: 'Search characters', onPress: () => router.replace('/search') },
          ]}
        />
      </View>
    );
  }

  // Transient failure — the hero exists, the load just failed. Offer a retry.
  if (loadError) {
    return (
      <View style={styles.container}>
        {failureHeader}
        <LoadErrorView
          actions={[
            { label: 'Retry', primary: true, onPress: retryLoad },
            {
              label: 'Go back',
              onPress: () => (router.canGoBack() ? router.back() : router.replace('/explore')),
            },
          ]}
        />
      </View>
    );
  }

  // The identity block — eyebrow, name, alias, vitals, taxonomy chips.
  //
  // Hoisted out of the JSX because it now has two homes: stacked at the bottom
  // of the hero spacer (phone, tablet portrait) and pinned to the bottom of the
  // art column (tablet landscape). One definition, so the two can never drift.
  const identityNode = displayName ? (
    <View style={[styles.identity, split && styles.identitySplit, tall && styles.identityTall]}>
      {data ? (
        (() => {
          const alignment = data.stats.biography.alignment;
          const origin = data.details.origin;
          const taxoChips = resolveTaxoChips(alignment, origin);
          const hasBadges = taxoChips.length > 0;
          const fullName = data.stats.biography['full-name'];
          const hasAlias = isPresentableFact(fullName);
          const hasCreators = !!data.details.creators?.length;
          return (
            <>
              {/* The band's LEFT column. In `split` the identity is a row, so
                  these four have to be one child or they lay out horizontally
                  beside the meta instead of stacking under the name. */}
              <View style={split ? styles.stageTitleCol : undefined}>
                <UniverseEyebrow
                  publisher={data.stats.biography.publisher}
                  franchise={heroRow?.franchise}
                  textStyle={styles.eyebrow}
                />

                <Text style={styles.heroName}>{displayName}</Text>

                {hasAlias ? (
                  <Text style={styles.heroAlias} numberOfLines={1}>
                    {fullName}
                  </Text>
                ) : null}

                {/* Web carries the narrative trait in the BAND, directly under the
                  alias — its `stageTraits`. It has to sit INSIDE the identity
                  and before the stats row, not after it: rendered after, the
                  stats row's height opens a hole between the alias and the
                  chip and the chip reads as orphaned at the band's floor. */}
                {split && narrative && narrative.tags.length > 0 ? (
                  <View style={styles.stageTraits}>
                    <TraitBand tags={narrative.tags} />
                  </View>
                ) : null}
              </View>

              {/* Vitals + credit form a left column; the chip stack sits
                    in a right column against the whole block, so its height
                    never dictates the credit's spacing. */}
              <View
                style={[
                  styles.statsRow,
                  split && styles.statsRowSplit,
                  tall && styles.statsRowTall,
                ]}
              >
                <View
                  style={[
                    styles.statsCol,
                    split && styles.statsColSplit,
                    tall && styles.statsColTall,
                  ]}
                >
                  <VitalsStrip
                    powerTotal={powerTotal}
                    issueCount={data.details.issueCount}
                    movieCount={data.details.movieCount ?? data.details.movies?.length ?? null}
                  />
                  {hasCreators ? (
                    <Text style={styles.createdBy} numberOfLines={2}>
                      Created by {formatCreators(data.details.creators!)}
                    </Text>
                  ) : null}
                </View>
                {hasBadges ? (
                  <View style={[styles.chipRow, split && styles.chipRowSplit]}>
                    {taxoChips.map((c) => (
                      <View
                        key={c.key}
                        style={[styles.taxoBadge, { backgroundColor: c.bg, borderColor: c.color }]}
                      >
                        <Text style={[styles.taxoBadgeText, { color: c.color }]}>{c.label}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </>
          );
        })()
      ) : (
        <Text style={styles.heroName}>{displayName}</Text>
      )}
    </View>
  ) : null;

  // The lede and the power dials, hoisted so the two layouts can order them
  // differently without either owning a copy.
  // `data ? … : null` because these used to sit inside `sheetContent`'s
  // data-loaded branch and hoisting them out loses that narrowing. The guard is
  // the same one, just written explicitly.
  const summaryNode = data ? (
    <>
      {/* Summary — the lede; shows skeleton lines while ComicVine loads. A
    subtle pencil at the top-right edits it (the lede has no header). */}
      <View onLayout={registerAnchor('summary')}>
        {comicVineLoading ? (
          <SkeletonProvider>
            <View style={styles.summaryBlock}>
              <Skeleton width="100%" height={12} borderRadius={5} style={{ marginBottom: 7 }} />
              <Skeleton width="88%" height={12} borderRadius={5} style={{ marginBottom: 7 }} />
              <Skeleton width="65%" height={12} borderRadius={5} />
            </View>
          </SkeletonProvider>
        ) : data.details.summary || data.details.hasBiography ? (
          <View style={styles.summaryBlock}>
            <PullQuoteBio
              flat
              summary={data.details.summary ?? ''}
              accent={theme.accent}
              hasBiography={data.details.hasBiography}
              onReadMore={() => router.push(`/biography/${id}`)}
              onEdit={() =>
                setEditTarget({
                  field: SUMMARY_FIELD,
                  current: data.details.summary ?? null,
                })
              }
            />
          </View>
        ) : null}
      </View>
    </>
  ) : null;

  const statsNode = data ? (
    <>
      {/* Power Stats — circular dials, 3×2 grid + percentile hook. The
    admin pencil swaps the dials for an editable 0–100 list. */}
      <View onLayout={registerAnchor('stats')}>
        <Section
          title="Power Stats"
          action={
            isAdmin ? (
              <SectionPencil
                active={statsEditing}
                onPress={() => setStatsEditing((s) => !s)}
                label="Edit power stats"
              />
            ) : undefined
          }
        >
          {isAdmin && statsEditing ? (
            <View style={styles.statsCard}>
              {STAT_FIELDS.map((f) => {
                const cur = (data.stats.powerstats as Record<string, string>)[f.field] ?? '0';
                return (
                  <TouchableOpacity
                    key={f.field}
                    onPress={() => setEditTarget({ field: f, current: cur })}
                    style={styles.editRow}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.editRowLabel}>{f.label}</Text>
                    <View style={styles.editRowRight}>
                      <Text style={styles.editRowValue}>{cur}</Text>
                      <Ionicons name="pencil" size={14} color={COLORS.orange} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={[styles.statsCard, { borderColor: theme.accent + '2b' }] as object}>
              <View style={styles.statsGrid}>
                {STAT_CONFIG.map(({ key, label, tint }) => (
                  <StatDial
                    key={key}
                    label={label}
                    value={(data.stats.powerstats as Record<string, string>)[key] ?? '0'}
                    tint={tint}
                  />
                ))}
              </View>
              {powerTotal > 0 ? (
                <View style={styles.statTotalRow}>
                  <Text style={styles.statTotal}>Total {powerTotal} / 600</Text>
                  {percentile != null && percentile > 0 ? (
                    <View
                      style={
                        [
                          styles.statPercentileBadge,
                          {
                            backgroundColor: theme.accent + '14',
                            borderColor: theme.accent + '3d',
                          },
                        ] as object
                      }
                    >
                      <Ionicons name="flash" size={11} color={theme.accent} />
                      <Text
                        style={[styles.statPercentileBadgeText, { color: theme.accent }] as object}
                      >
                        Stronger than {percentile}%
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          )}
        </Section>
      </View>
    </>
  ) : null;

  // The dossier itself, hoisted so it has one definition and two homes: the
  // beige sheet on a phone and tablet portrait, and web's `mainCol` in the
  // landscape two-column body. 560 lines of JSX duplicated across a branch is
  // how the native and web character pages drifted in the first place.
  const sheetContent = (
    <>
      {!data ? (
        <ReAnimated.View exiting={FadeOut.duration(180)}>
          <CharacterSkeleton hideNameBlock />
        </ReAnimated.View>
      ) : (
        <ReAnimated.View entering={FadeIn.duration(320)}>
          {/* Theme trait band — colour-coded by vocab category; sits at the
          top of the sheet as a sibling to the identity header badges.
          In `split` it moves INTO the band, under the alias, where web's
          `stageTraits` puts it — see the stage below. */}
          {!split && narrative && narrative.tags.length > 0 ? (
            <View style={styles.traitBandWrap}>
              <TraitBand tags={narrative.tags} />
            </View>
          ) : null}

          {/* Web's desktop leads with Power Profile and puts the lede second;
          the phone leads with the lede, because on a phone the lede is the hook
          and the dials are a detail you scroll to. Both are right for their own
          shape, so the ORDER is the branch and the blocks themselves are
          shared — duplicating them per order is how the two pages drift. */}
          {split ? (
            <>
              {/* Web's main column is a stack of cards on beige. `plain` on a
                  phone keeps its rule-separated sections exactly as they were —
                  the card grammar is a tablet decision, which is why PaperCard
                  takes the flag rather than testing the width itself. */}
              <PaperCard plain={!split} style={styles.mainCard}>
                {statsNode}
              </PaperCard>
              <PaperCard plain={!split} style={styles.mainCard}>
                {summaryNode}
              </PaperCard>
            </>
          ) : (
            <>
              {summaryNode}
              {statsNode}
            </>
          )}

          {/* Abilities — signature tier headlines (blurb-backed powers) above
          the categorized grid; header pencil edits the whole list. */}
          {/* Abilities is the third card in web's main column. The bleed
              sections below it — allies, on-screen, in print — deliberately
              stay uncarded: each carries a horizontal rail, and a rail inside a
              padded card cannot reach the column's edge. */}
          <PaperCard plain={!split} style={styles.mainCard}>
            <View onLayout={registerAnchor('abilities')}>
              {!comicVineLoading &&
              pickSignaturePowers(data.details.powers, narrative?.powerExplainers ?? []).length >
                0 ? (
                <View style={styles.signatureWrap}>
                  <SignaturePowerTiles
                    powers={data.details.powers}
                    explainers={narrative?.powerExplainers ?? []}
                    accent={theme.accent}
                  />
                </View>
              ) : null}
              <AbilitiesSection
                powers={data.details.powers}
                loading={comicVineLoading}
                explainers={narrative?.powerExplainers ?? []}
                onEdit={() =>
                  setEditTarget({
                    field: POWERS_FIELD,
                    current: data.details.powers?.length ? data.details.powers.join('\n') : null,
                  })
                }
              />
            </View>
          </PaperCard>

          {/* The weeks the world was reading about them.
              The events archive is the most expensive data in this app and it
              lived on one surface almost nobody reaches. Pointed the other way
              it is a sourced, dated fact about the character, and a route into
              the archive from the page people actually open.

              Correlational by design — "read 12x more than usual DURING" — for
              the same reason the edition pages say it that way. */}
          {eventMoments.length > 0 && (
            <Section title="Read about during">
              <HeroEventMoments
                moments={eventMoments}
                onPress={(slug, edition) =>
                  router.push(`/event/${encodeURIComponent(slug)}/${encodeURIComponent(edition)}`)
                }
              />
            </Section>
          )}

          {/* Dossier — the bio infobox, collapsed by default.
          NOT in `split`: the landscape layout puts the same fields in the side
          column's Quick Facts card, and rendering both showed a reader the same
          data twice — once as an open grid and once as a bar promising it. Web
          has exactly one, in the sideCol. */}
          {split ? null : (
            <View onLayout={registerAnchor('dossier')}>
              <Dossier
                data={data}
                includeFirstAppearance={!hasFirstVisual}
                eraSummary={narrative?.eraSummary}
                editValues={{
                  // Profile
                  full_name: data.stats.biography['full-name'],
                  alter_egos: data.stats.biography['alter-egos'],
                  aliases: (data.stats.biography.aliases ?? []).filter(valid).join('\n'),
                  place_of_birth: data.stats.biography['place-of-birth'],
                  first_appearance: data.stats.biography['first-appearance'],
                  origin: data.details.origin,
                  // Appearance
                  gender: data.stats.appearance.gender,
                  race: data.stats.appearance.race,
                  height_imperial: data.stats.appearance.height?.[0],
                  weight_imperial: data.stats.appearance.weight?.[0],
                  eye_color: data.stats.appearance['eye-color'],
                  hair_color: data.stats.appearance['hair-color'],
                  // Connections
                  occupation: data.stats.work.occupation,
                  base: data.stats.work.base,
                  group_affiliation: data.stats.connections['group-affiliation'],
                }}
                onEditField={(field, current) => setEditTarget({ field, current })}
              />
            </View>
          )}

          {/* Enemies, Allies & Teams — full-bleed card strips off the
          relationship graph (same-universe, popularity-ranked). */}
          <View onLayout={registerAnchor('allies')} style={styles.bleedSection}>
            {comicVineLoading ? (
              <SkeletonProvider>
                <SectionHeader title="Enemies, Allies & Teams" />
                <View style={styles.bleedPad}>
                  <Skeleton width={50} height={9} borderRadius={4} style={{ marginBottom: 10 }} />
                </View>
                <ScrollView
                  horizontal
                  scrollEnabled={false}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.bleedRow}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} width={104} height={140} borderRadius={14} />
                  ))}
                </ScrollView>
              </SkeletonProvider>
            ) : enemyNames.length || allyNames.length || teammateNames.length ? (
              <>
                <SectionHeader title="Enemies, Allies & Teams" />
                {enemyNames.length ? (
                  <RelatedHeroStrip
                    label="Enemies"
                    names={enemyNames}
                    heroMap={relatedHeroMap}
                    kind="enemy"
                    edgeTint
                    monogramTiles
                    onPressHero={(h) =>
                      router.push(`/character/${h.id}?name=${encodeURIComponent(h.name)}`)
                    }
                  />
                ) : null}
                {allyNames.length ? (
                  <RelatedHeroStrip
                    label="Allies"
                    names={allyNames}
                    heroMap={relatedHeroMap}
                    kind="ally"
                    edgeTint
                    monogramTiles
                    onPressHero={(h) =>
                      router.push(`/character/${h.id}?name=${encodeURIComponent(h.name)}`)
                    }
                  />
                ) : null}
                {teammateNames.length ? (
                  <RelatedHeroStrip
                    label="Teammates"
                    names={teammateNames}
                    heroMap={relatedHeroMap}
                    kind="teammate"
                    edgeTint
                    monogramTiles
                    onPressHero={(h) =>
                      router.push(`/character/${h.id}?name=${encodeURIComponent(h.name)}`)
                    }
                  />
                ) : null}
              </>
            ) : null}
          </View>

          {/* The character's universe — constellation preview that taps
          through to the /social-web explorer. Web has had this doorway
          (SocialWebPreview) since launch; native was missing it. */}
          <SocialWebPortal
            heroId={id}
            accent={theme.accent}
            onExplore={() => router.push(`/social-web/${id}` as Parameters<typeof router.push>[0])}
          />

          {/* On Screen — full-bleed movie strip */}
          <View onLayout={registerAnchor('screen')} style={styles.bleedSection}>
            {comicVineLoading ? (
              <SkeletonProvider>
                <SectionHeader title="On Screen" />
                <ScrollView
                  horizontal
                  scrollEnabled={false}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.bleedRow}
                >
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                      <Skeleton width={80} height={120} borderRadius={8} />
                      <Skeleton width={60} height={10} borderRadius={4} />
                    </View>
                  ))}
                </ScrollView>
              </SkeletonProvider>
            ) : titles && titles.length > 0 ? (
              (() => {
                const groups = groupTitlesByMedia(titles);
                return (
                  <>
                    {groups.film.length > 0 ? (
                      <>
                        <SectionHeader title={`On Screen (${groups.film.length})`} />
                        <MovieStrip
                          titles={groups.film}
                          totalCount={groups.film.length}
                          contentInset={20}
                        />
                      </>
                    ) : null}
                    {groups.tv.length > 0 ? (
                      <View style={groups.film.length > 0 ? styles.onScreenSubsection : undefined}>
                        <SectionHeader title={`Television (${groups.tv.length})`} />
                        <MovieStrip
                          titles={groups.tv}
                          totalCount={groups.tv.length}
                          contentInset={20}
                        />
                      </View>
                    ) : null}
                  </>
                );
              })()
            ) : null}
          </View>

          {/* Portrayed By — performers + voice actors */}
          {portrayals && (portrayals.performers.length > 0 || portrayals.voiceActors.length > 0) ? (
            <View style={styles.section}>
              <SectionHeader title="Portrayed By" />
              <PortrayedBySection portrayals={portrayals} contentInset={0} />
            </View>
          ) : null}

          {/* Did You Know sits HERE, not after Abilities, because web nests it
          in `sec-legend` — the late block that gathers the trivia and the first
          appearance. Early, it interrupts the run from Abilities into
          Relations; here it is the pause before In Print. Full-bleed so the
          deck owns its own edge insets and peek. */}
          {narrative && narrative.didYouKnow.length > 0 ? (
            <View onLayout={registerAnchor('narrative')} style={styles.bleedSection}>
              <SectionHeader title="Did You Know" />
              <DidYouKnowDeck facts={narrative.didYouKnow} />
            </View>
          ) : null}

          {/* In Print — what's on shelves now, then the debut + the run that
          followed (mirrors the web character page). */}
          {newIssues.length > 0 ||
          hasFirstVisual ||
          (galleryImages && galleryImages.length > 0) ||
          (galleryImages === null && galleryLoading) ? (
            <View onLayout={registerAnchor('print')} style={styles.bleedSection}>
              <View style={styles.sectionHeaderPad}>
                <View style={styles.inPrintHeader}>
                  {data.firstIssue?.coverDate ? (
                    <Text style={styles.inPrintSince}>
                      Since {data.firstIssue.coverDate.slice(0, 4)}
                    </Text>
                  ) : (
                    <View />
                  )}
                  <Text style={styles.sectionTitle}>In Print</Text>
                </View>
                <View style={styles.divider} />
              </View>

              {/* On shelves now — recent issues featuring this character */}
              {newIssues.length > 0 ? (
                <ComicCoverRail
                  comics={newIssues}
                  onLight
                  onIssuePress={(issueId) =>
                    router.push(`/issue/${issueId}` as Parameters<typeof router.push>[0])
                  }
                />
              ) : null}

              {/* Debut — the first issue, given hero treatment */}
              {hasFirstVisual ? (
                <View style={styles.bleedPad}>
                  <TouchableOpacity
                    onPress={() =>
                      router.push(
                        `/issue/cvi:${data.firstIssue!.id}` as Parameters<typeof router.push>[0],
                      )
                    }
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="View first appearance issue"
                  >
                    <View
                      style={[styles.debutCard, { borderColor: theme.accent + '2b' }] as object}
                    >
                      <View style={styles.debutCover}>
                        <Image
                          source={{ uri: data.firstIssue!.imageUrl! }}
                          contentFit="cover"
                          contentPosition="top"
                          style={styles.debutCoverImg}
                          cachePolicy="memory-disk"
                          recyclingKey={`comic-${id}`}
                          transition={200}
                        />
                      </View>
                      <View style={styles.debutMeta}>
                        <View style={styles.debutBadgeRow}>
                          <Ionicons name="ribbon" size={12} color={COLORS.orange} />
                          <Text style={styles.debutBadgeText}>1st Appearance</Text>
                        </View>
                        <Text style={styles.debutTitle} numberOfLines={3}>
                          {data.firstIssue!.name
                            ? data.firstIssue!.name.split(';')[0].trim()
                            : 'First Appearance'}
                        </Text>
                        {data.firstIssue!.coverDate ? (
                          <Text style={styles.debutYear}>
                            {data.firstIssue!.issueNumber
                              ? `Issue #${data.firstIssue!.issueNumber} · `
                              : ''}
                            {data.firstIssue!.coverDate.slice(0, 4)}
                          </Text>
                        ) : null}
                        <View style={styles.debutCta}>
                          <Text style={styles.debutCtaText}>View issue</Text>
                          <Ionicons name="chevron-forward" size={14} color={COLORS.orange} />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Gallery — character art + covers (multi-source) */}
              {galleryImages === null && galleryLoading ? (
                <SkeletonProvider>
                  {hasFirstVisual ? <Text style={styles.inPrintGalleryLabel}>Gallery</Text> : null}
                  <ScrollView
                    horizontal
                    scrollEnabled={false}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.bleedRow}
                  >
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} width={80} height={110} borderRadius={8} />
                    ))}
                  </ScrollView>
                </SkeletonProvider>
              ) : galleryImages && galleryImages.length > 0 ? (
                <>
                  {hasFirstVisual ? (
                    <Text style={styles.inPrintGalleryLabel}>Gallery · {galleryImages.length}</Text>
                  ) : null}
                  <GalleryStrip
                    images={galleryImages.map((g) => ({ url: g.url, caption: g.caption }))}
                    onPress={(i) => {
                      const issueId = galleryImages[i]?.issueId;
                      if (issueId) {
                        router.push(`/issue/cvi:${issueId}` as Parameters<typeof router.push>[0]);
                        return;
                      }
                      setLightboxImages(
                        galleryImages.map((g) => ({ url: g.url, caption: g.caption })),
                      );
                      setLightboxIndex(i);
                    }}
                  />
                </>
              ) : null}
            </View>
          ) : null}

          {/* Family tree */}
          {family.length > 0 ? (
            <View onLayout={registerAnchor('family')} style={styles.section}>
              <FamilyCanvas
                heroName={data.stats.name}
                heroImage={data.stats.image.portraitUrl || data.stats.image.url || null}
                heroAvatar={heroRow?.avatar_url ?? null}
                heroId={heroRow?.id ?? null}
                members={family}
              />
              {/* The way out into the whole dynasty. Web has had this since
              the house pages shipped; native didn't, which left them
              unreachable on a phone. */}
              <HouseLinks houses={heroHouses} heroId={heroRow?.id ?? null} />
            </View>
          ) : null}

          {/* Open invitation to contribute — expands into a small menu of the
          contributions not tied to a section (a fact, or a report). */}
          <View style={styles.contributeFooter}>
            <TouchableOpacity
              style={styles.contributeBtn}
              activeOpacity={0.8}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setContributeMenu((o) => !o);
              }}
            >
              <Ionicons name="sparkles-outline" size={15} color={COLORS.orange} />
              <Text style={styles.contributeBtnText}>Contribute to this character</Text>
              <Ionicons
                name={contributeMenu ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={COLORS.orange}
              />
            </TouchableOpacity>
            {contributeMenu ? (
              <View style={styles.contributeMenu}>
                <TouchableOpacity
                  style={styles.contributeMenuItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setContributeMenu(false);
                    setEditTarget({ field: null, current: null });
                  }}
                >
                  <Ionicons name="bulb-outline" size={17} color={COLORS.navy} />
                  <Text style={styles.contributeMenuText}>Add a “Did You Know” fact</Text>
                </TouchableOpacity>
                <View style={styles.contributeMenuDivider} />
                <TouchableOpacity
                  style={styles.contributeMenuItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setContributeMenu(false);
                    setReportCtx({ context: 'page' });
                  }}
                >
                  <Ionicons name="flag-outline" size={17} color={COLORS.navy} />
                  <Text style={styles.contributeMenuText}>Report a problem</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </ReAnimated.View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      {/* Native header — transparent over image, fades to beige on scroll */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          // Chevron only — without this iOS labels the back button with the
          // previous route's name ("(tabs)").
          headerBackButtonDisplayMode: 'minimal',
          // Native back button, tinted to match the brand instead of a custom chip.
          // HEADER_TINT is shared with the headerRight glyphs below so the two
          // sides of the bar cannot drift apart — the share icon used to carry
          // its own hard-coded COLORS.black and read as a dark smudge inside
          // the glass chip iOS 26 draws around it.
          headerTintColor: HEADER_TINT,
          headerStyle: { backgroundColor: 'transparent' },
          // `headerTransparent` does not mean "no bar" on iOS 26 — the system
          // still draws a glass material, and left to itself it picks a LIGHT
          // one. Over the split layout's deep-navy band that read as a beige
          // wash across the top 90pt of the page (sampled: rgb(209,202,190)
          // fading to navy). Both layouts put dark content under this bar, so
          // it is told which material to use rather than left to guess.
          headerBlurEffect: 'dark',
          headerTitleAlign: 'center',
          headerTitle: () => (
            <Animated.Text
              maxFontSizeMultiplier={MAX_TYPE_SCALE}
              numberOfLines={1}
              style={[
                styles.headerTitle,
                {
                  opacity: headerNameOpacity,
                  transform: [{ scale: headerNameScale }, { translateY: headerNameY }],
                },
              ]}
            >
              {displayName}
            </Animated.Text>
          ),
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleShare}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Share character"
              >
                <SymbolView
                  name="square.and.arrow.up"
                  weight="bold"
                  tintColor={HEADER_TINT}
                  size={22}
                  resizeMode="scaleAspectFit"
                  style={styles.headerShareIcon}
                  fallback={<Ionicons name="share-outline" size={23} color={HEADER_TINT} />}
                />
              </TouchableOpacity>
              {user ? (
                <TouchableOpacity
                  onPress={toggleFavourite}
                  disabled={favLoading}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.headerBtn}
                  accessibilityRole="button"
                  accessibilityLabel={favourited ? 'Remove from favourites' : 'Add to favourites'}
                  accessibilityState={{ selected: favourited }}
                >
                  <Ionicons
                    name={favourited ? 'heart' : 'heart-outline'}
                    size={20}
                    color={favourited ? COLORS.red : COLORS.beige}
                  />
                  {favCount > 0 ? (
                    <Text style={styles.favCount}>
                      {favCount > 999 ? '999+' : String(favCount)}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ) : null}
            </View>
          ),
        }}
      />

      {/* Hero image — parallax + zoom-on-overscroll. The opaque beige sheet covers
          it on scroll, so no opacity fade is needed.

          Phone and tablet-portrait only. In landscape the art is web's floating
          portrait CARD, which lives in the side column inside the scroll — see
          the `split` branch below. Rendering both would put two Apple Zoom
          targets in the tree and the morph would pick the wrong one. */}
      {split ? null : (
        <Animated.View
          style={[
            styles.heroImageContainer,
            { height: HERO_IMAGE_HEIGHT },
            { transform: [{ translateY: imageTranslateY }, { scale: imageScale }] },
          ]}
        >
          {/* Apple Zoom target: marks the hero-image region as what the source
            card morphs into. Without it iOS falls back to a whole-view zoom from
            the card frame, which misaligns and reveals the card's navy bg. */}
          <Link.AppleZoomTarget>
            <HeroImage
              id={id ?? 'hero'}
              name={displayName}
              imageUrl={heroImageUrl}
              portraitUrl={heroPortraitUrl}
              contentFit="cover"
              contentPosition="top"
              style={styles.heroImage}
              recyclingKey={id ?? 'hero'}
            />
          </Link.AppleZoomTarget>
          {/* Top scrim — keeps the back / favourite controls legible on bright art */}
          <LinearGradient
            colors={['rgba(20,28,32,0.45)', 'transparent']}
            locations={[0, 1]}
            style={styles.topScrim}
          />
          {/* Bottom scrim — darkens the lower portrait so the identity reads on it */}
          <LinearGradient
            colors={['transparent', 'rgba(20,28,32,0.68)', 'rgba(20,28,32,0.94)']}
            locations={[0.3, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* Character accent bloom rising into the sheet seam — the hero's own
            colour washes up over the dark scrim where art meets the beige. */}
          <LinearGradient
            colors={['transparent', theme.accentDeep + '00', theme.accentDeep + '66']}
            locations={[0.55, 0.78, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </Animated.View>
      )}

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        // Idiomatic RN Animated.event: useNativeDriver wires the scroll offset
        // into scrollY natively (no value read during render). handleScroll only
        // touches section refs at scroll time. Safe; the compiler can't model it.
        // eslint-disable-next-line react-hooks/refs
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
          listener: handleScroll,
        })}
      >
        {/* Hero spacer — transparent over the parallaxing image; the identity sits
            at its bottom, on the dark scrim. Name paints instantly from params.
            In `wide` the art is a column beside this scroll rather than behind
            it, so there is nothing to reserve and the identity has already been
            drawn on that column. */}
        {split ? (
          /* ── Landscape tablet: web's desktop layout. ────────────────────────
             A dark identity BAND across the top, a floating portrait card in
             the side column overlapping it, and a two-column beige body below.

             This is a port of `app/character/[id].web.tsx`, not a third design.
             Three earlier attempts invented one — art as a full-height column,
             then native sections relocated into it — and each read as neither
             the phone's design nor web's. The band is what gives the two
             columns a shared origin; without it they are two unrelated
             scrolls that happen to sit side by side. ─────────────────────── */
          <>
            <View style={[styles.stage, { paddingTop: insets.top + 52 }]}>
              {/* Web's band is four layers deep and native's was one flat navy
                  rectangle. Ported from `[id].web.tsx`'s stage: the character's
                  own art blurred behind everything, a scrim for legibility, and
                  the accent blooms that let the character's colour own the band
                  instead of every hero getting the same slab. */}
              {heroImageUrl || heroPortraitUrl ? (
                <HeroImage
                  id={id ?? 'hero'}
                  name={displayName}
                  imageUrl={heroImageUrl}
                  portraitUrl={heroPortraitUrl}
                  contentFit="cover"
                  contentPosition="top"
                  blurRadius={STAGE_BLUR}
                  style={[StyleSheet.absoluteFill, styles.stageBackdrop] as object}
                  recyclingKey={id ?? 'hero'}
                />
              ) : null}
              <LinearGradient
                // Web's `stageScrim`, stop for stop.
                colors={['rgba(11,24,32,0.55)', 'rgba(11,24,32,0.32)', 'rgba(11,24,32,0.82)']}
                locations={[0, 0.38, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              {/* Web's name-side bloom sits at 16% across — the same side as the
                  name, so the colour lands under the type rather than beside it. */}
              <RadialBloom
                color={theme.accent}
                size={520}
                opacity={0.34}
                style={styles.bloomName}
              />
              <RadialBloom color={COLORS.orange} size={300} opacity={0.1} style={styles.bloomFar} />
              <View style={styles.stageInner}>{identityNode}</View>
            </View>
            <View style={styles.body} onLayout={onSectionsLayout}>
              <View style={styles.bodyInner}>
                <View style={styles.mainCol}>{sheetContent}</View>
                <Animated.View
                  style={[styles.sideCol, { transform: [{ translateY: sideTranslate }] }]}
                  onLayout={onSideColLayout}
                >
                  {/* The portrait, as a card that hangs up into the band. The
                      negative margin is the overlap web calls `portraitOverlap`
                      — it is what stitches the band to the body instead of
                      leaving a hard seam between two colours. */}
                  <View style={[styles.portraitCard, { marginTop: -portraitOverlap }]}>
                    {/* absoluteFill on the zoom target, not just on the image.
                        The target is a plain View with no intrinsic size, so an
                        image set to 100%/100% inside it resolves against an
                        auto-sized parent and lands smaller than the card — the
                        navy backing then shows as a frame around the art. */}
                    <Link.AppleZoomTarget>
                      <HeroImage
                        id={id ?? 'hero'}
                        name={displayName}
                        imageUrl={heroImageUrl}
                        portraitUrl={heroPortraitUrl}
                        contentFit="cover"
                        contentPosition="top"
                        // absoluteFill, not 100%/100%. AppleZoomTarget takes no
                        // style and has no intrinsic size, so a percentage
                        // resolves against an auto-sized parent and the image
                        // lands smaller than the card — the navy backing then
                        // shows as a frame around the art. Absolute positioning
                        // escapes it and fills the card itself.
                        style={StyleSheet.absoluteFill as object}
                        recyclingKey={id ?? 'hero'}
                      />
                    </Link.AppleZoomTarget>
                  </View>
                  {data ? (
                    <QuickFacts
                      data={data}
                      includeFirstAppearance={!hasFirstVisual}
                      accent={theme.accentWash}
                    />
                  ) : null}
                  {/* Web's third sideCol item, and it is called "Elsewhere"
                      there — the debut year plus the outbound links. It failed
                      here once as a bare `SectionHeader` over a rule, which is
                      a device built for a full-width sheet; in a 300pt column
                      it needs the card the rest of the column has. */}
                  {heroLinksHasContent(links) ? (
                    <PaperCard>
                      <Text style={styles.sideCardTitle}>Elsewhere</Text>
                      <HeroLinksRow links={links!} contentInset={0} />
                    </PaperCard>
                  ) : null}
                </Animated.View>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.heroSpacer, { minHeight: HERO_IMAGE_HEIGHT }]}>
              {identityNode}
            </View>

            {/* Beige content sheet — opaque, rounded top; rises over the hero on
                scroll. The shell (hero image + skeleton) paints instantly so the
                navigation transition is always cheap; the real content then
                cross-dissolves in as it resolves (Apple TV / Disney+ pattern)
                instead of hard-popping. */}
            <View
              style={[styles.sheet, { minHeight: Math.round(winH * 0.6) }]}
              onLayout={onSectionsLayout}
            >
              {/* The tablet gutter, applied once here rather than to each of the
                  eight section styles that hard-code 20. `gutter - 20` because
                  every section already pads itself by 20 — the delta lands them
                  all on the gutter, and on a phone the delta is zero. */}
              <View style={[styles.sheetColumn, { paddingHorizontal: gutter - 20 }]}>
                {sheetContent}
              </View>
            </View>
          </>
        )}
      </Animated.ScrollView>

      {/* Section quick-nav — floating jump bar that fades in once the content
          covers the hero image. pointerEvents follows visibility so the hidden
          bar never swallows taps meant for the portrait. */}
      {data && presentSections.length > 1 ? (
        <Animated.View
          style={[styles.quickNav, { top: insets.top + 44, opacity: navOpacity }]}
          pointerEvents={navVisible ? 'auto' : 'none'}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickNavContent}
          >
            {presentSections.map((s) => {
              const active = activeSection === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => jumpTo(s.key)}
                  style={[styles.navChip, active && styles.navChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.navChipText, active && styles.navChipTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      ) : null}

      {showIssueModal && data?.firstIssue ? (
        <FirstIssueModal firstIssue={data.firstIssue} onClose={() => setShowIssueModal(false)} />
      ) : null}

      {lightboxImages.length > 0 ? (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxImages([])}
          onReport={(img) => setReportCtx({ context: 'image', imageUrl: img.url })}
        />
      ) : null}

      {data ? (
        <ContributeSheet
          visible={editTarget !== null}
          onClose={() => setEditTarget(null)}
          heroId={data.stats.id}
          heroName={data.stats.name}
          field={editTarget?.field ?? null}
          report={editTarget?.report ?? false}
          currentValue={editTarget?.current ?? null}
          user={user}
          isAdmin={isAdmin}
          priorCount={0}
          onRequestSignIn={() => router.push(loginHref(pathname))}
          onSubmitted={async () => {
            // Admin edits apply immediately — pull the fresh row so the change
            // shows on the page without a manual reload.
            if (!isAdmin) return;
            const { data: fresh } = await heroRowQuery.refetch();
            if (fresh) setData(heroRowToCharacterData(fresh));
          }}
        />
      ) : null}
      {data ? (
        <ReportSheet
          visible={reportCtx !== null}
          onClose={() => setReportCtx(null)}
          heroId={data.stats.id}
          heroName={data.stats.name}
          context={reportCtx?.context ?? 'page'}
          imageUrl={reportCtx?.imageUrl ?? null}
          portraitUrl={heroPortraitUrl}
          user={user}
          onRequestSignIn={() => router.push(loginHref(pathname))}
        />
      ) : null}

      {/* Floating Compare pill — hovers above the safe area; content scrolls
          under it (box-none lets touches pass through the transparent margins). */}
      {data && (
        <View style={compareStripStyle} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() =>
              router.push(`/compare/${id}/pick?name=${encodeURIComponent(data.stats.name)}`)
            }
            onPressIn={() => springCompare(0.96)}
            onPressOut={() => springCompare(1)}
            activeOpacity={1}
          >
            <Animated.View style={[styles.compareBtn, { transform: [{ scale: compareScale }] }]}>
              <Ionicons name="swap-horizontal" size={20} color="#fff" />
              <Text style={styles.compareBtnText}>Compare {data.stats.name}</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  center: { alignItems: 'center', justifyContent: 'center' },
  heroImageContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: '100%' },
  // Carries the tablet gutter and nothing else — deliberately NOT capped and
  // centred. Centring it would put the sheet's left edge at 78pt while the
  // identity above sits at 20pt, which is the two-left-edges fault. The cap
  // goes on the prose and on the button instead, where it costs no alignment.
  sheetColumn: { width: '100%' },
  // `wide` only: the identity, pinned to the bottom of the art column. Kept
  // outside the zoom target's container — that view must hold exactly one
  // full-size child or the Apple Zoom morph measures the wrong frame.
  // `top: 0` + an explicit height, NOT `bottom: 0`. The art column is only as
  // tall as the art; anchoring to the screen's bottom drops the identity onto
  // the beige below it, where text coloured for a dark scrim is beige on beige
  // and effectively invisible. The height is passed at the call site because it
  // is the art's, not the window's.
  // ── Landscape tablet: web's desktop composition ──────────────────────────
  // The identity BAND. Web's `stage`: deep navy, full bleed, its content capped
  // and centred at 1180 so the name does not drift to the bezel on a 13".
  // `overflow: hidden` because the backdrop is scaled past the frame and the
  // blooms hang off its edges — web's stage clips for the same reason.
  stage: { backgroundColor: COLORS.deepNavy, paddingBottom: 34, overflow: 'hidden' },
  // Web: blur(55px), scale 1.3, opacity 0.4. The scale is what keeps the blur's
  // own soft edges outside the frame.
  stageBackdrop: { opacity: 0.4, transform: [{ scale: 1.3 }] },
  bloomName: { position: 'absolute', top: -140, left: '4%' },
  bloomFar: { position: 'absolute', top: 30, right: '8%' },
  stageInner: {
    maxWidth: STAGE_MAX,
    width: '100%',
    alignSelf: 'center',
    // 24 — the same as `bodyInner`, so the name and the CARD EDGES below it are
    // flush. Measured on web: "Hulk" and the Power Profile card both start at
    // x=175. This was 44 for a while, aligning the name with the card's inner
    // TEXT instead, which put a 17pt step between the name and every card on
    // the page. Text inside a card is meant to be inset from the card; the
    // heading above it is not.
    paddingLeft: 24,
    // Reserve the portrait's column, exactly as web's `identityColDesktop` does.
    // Without it the alignment chip and the vitals run under the floating card:
    // the identity fills the band, and the band is wider than the identity's
    // usable half.
    paddingRight: SIDE_COL + 48,
  },
  body: { backgroundColor: COLORS.beige, flex: 1 },
  bodyInner: {
    maxWidth: STAGE_MAX,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
    paddingHorizontal: BODY_PAD,
    paddingTop: BODY_PAD,
  },
  // NO `gap` here. `sheetContent` is a fragment and the split branch nests
  // another inside it, so the cards are not the direct children a column `gap`
  // applies to — it silently did nothing and the panels sat edge to edge,
  // separated only by a 1px hairline that is invisible white-on-white. Sampling
  // the rendered pixels down the column showed beige above the first card and
  // then never again. The margin is on the CARD, where nothing can flatten it.
  mainCol: { flex: 1, minWidth: 0 },
  // No horizontal inset. `TraitBand` pads its PILLS, not its container — the
  // 20pt gutter belongs to `traitBandWrap`, which the sheet uses and the band
  // does not. Correcting for padding that is not there pushed the chip 20pt
  // left of the name above it, which is the two-left-edges fault in miniature.
  stageTraits: { marginTop: 10 },
  // HORIZONTAL zero is right: the sections already pad themselves by 20, and
  // doubling it costs the dials a column. VERTICAL zero was not — at 6pt the
  // stats panel sat 3.5pt off its own card's bottom edge, so two separate white
  // slabs 14pt apart read as one interrupted surface rather than two panels.
  // A card needs to breathe more than its neighbours are apart.
  mainCard: { padding: 0, paddingVertical: 14, marginBottom: 20 },
  // Matches QuickFacts' own heading so the side column has one voice.
  sideCardTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: PAPER_TEXT.faint,
    marginBottom: 12,
  },
  sideCol: { width: SIDE_COL, flexShrink: 0, gap: 16 },
  // Hangs up into the band. The negative margin is web's `portraitOverlap`: it
  // stitches the two colours together instead of leaving a hard seam, and it is
  // why the portrait reads as floating rather than as the top of a column.
  portraitCard: {
    width: SIDE_COL,
    // 1.4, measured off web at 1440: the card is 300 x 420. It is NOT the rail
    // card's ratio and does not need to be — this is a framed print, not the
    // full-bleed art the morph grows out of on a phone.
    height: Math.round(SIDE_COL * 1.4),
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    boxShadow: '0px 24px 52px rgba(11,24,32,0.30)',
  },
  // Share + favourite sit side by side at the header's right edge.
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Fixed frame so the SF Symbol's intrinsic box (the up-arrow adds height)
  // doesn't push it out of line with the native back chevron.
  headerShareIcon: { width: 22, height: 22 },
  // Scrim chip so the control reads on any hero image (no blur dep needed).
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(41,60,67,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favCount: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 9,
    color: 'rgba(245,235,220,0.85)',
    textAlign: 'center',
    lineHeight: 10,
  },
  headerTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.navy,
  },
  scroll: { flex: 1 },

  // Top scrim over the portrait — keeps the back / favourite controls legible.
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 160 },

  // Immersive hero: the spacer reserves the image height and pins the identity to
  // the bottom of the portrait (over the dark scrim); the sheet rises over it.
  // minHeight, not height: at large OS text sizes the identity block grows, and a
  // fixed box would push it up off-screen under the header instead of expanding.
  heroSpacer: { justifyContent: 'flex-end' },
  identity: { paddingHorizontal: 20, paddingBottom: SHEET_OVERLAP + 14, gap: 8 },
  // In the band the stage owns the gutter and the bottom rhythm. The stacked
  // layout's own padding exists because the beige sheet rides up over it —
  // there is no sheet here, so it is 68pt of dead navy under the credit line.
  // A ROW in the band: title stack left, meta right, sharing a baseline.
  // As a column the meta group fell BELOW the title stack, which left the two
  // halves staggered and ~105pt of navy under the left one. `flex-end` is what
  // puts the trait chip and the vitals on the same line.
  identitySplit: {
    paddingHorizontal: 0,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
  },
  // Tablet PORTRAIT: the same two groups, stacked. `flex-end` on the meta row
  // keeps it against the band's right edge, so the credit and the numbers still
  // read as the header's secondary column rather than as a second left edge.
  // 14 is web's `identityRowStack` gap, not a rounded guess.
  identityTall: { flexDirection: 'column', alignItems: 'flex-start', gap: 14 },
  // Stacked, the meta is its own row — and web LEFT-aligns it there. Its
  // `metaBlockStack` / `metaRowStack` pair (`[id].web.tsx`, under the
  // `stageWide = width >= 1100` gate) flips both block and row to flex-start,
  // with the note "the title takes the band's full width and the meta drops
  // beneath it". This was flex-end for a while, which is the LANDSCAPE
  // behaviour: stacked, it left a wedge of empty band under the trait pills
  // with the credit and the numbers stranded across from nothing.
  // `justifyContent: 'flex-end'` looks backwards and is not: `statsRowSplit`
  // sets `row-reverse` so the alignment chip leads and the vitals follow —
  // web's order — and under row-reverse it is flex-END that packs the group
  // against the LEFT edge. `flex-start` (the landscape value, which this
  // inherited) packs it right, which is why the credit and the numbers still
  // sat across the band from the name after the block itself was left-aligned.
  statsRowTall: { alignSelf: 'flex-start', justifyContent: 'flex-end' },
  // …and the credit inside it left-aligns too; `statsColSplit` ends flex-end
  // for the landscape band, where the whole group hangs off the right margin.
  statsColTall: { alignItems: 'flex-start' },
  stageTitleCol: { gap: 8, flexShrink: 1, minWidth: 0 },
  // A vertical chip stack is right on a portrait, where the column is narrow.
  // In the band there is a whole row, and stacking pushes the second chip below
  // the credit line where it reads as a stray.
  chipRowSplit: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  sheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
    marginTop: -SHEET_OVERLAP,
    paddingTop: 10,
    // 60% of the window, applied at the call site — a beige sheet shorter than
    // this leaves navy under a short page.
  },

  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
    // Sits highest on the portrait where the scrim is lightest — shadow keeps it
    // legible over bright art.
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroName: {
    fontFamily: 'Flame-Regular',
    fontSize: 36,
    color: COLORS.beige,
    lineHeight: 40,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  heroAlias: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: 'rgba(245,235,220,0.82)',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  // Vitals + "created by" stacked on the left; the chip stack as a sibling column
  // on the right. The credit's spacing comes from this column (gap below), not the
  // chip stack — so the chips can be any height without padding the credit.
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  statsCol: {
    flex: 1,
    gap: 8,
  },
  // In the band the vitals and the credit belong on the RIGHT, beside the
  // alignment chip — web's arrangement. Left where the phone has them, the
  // band's right-hand 376pt held two small chips and nothing else, which read
  // as an unfinished half rather than a composition.
  //
  // `row-reverse` with the children in DOM order (stats, chips) renders
  // chips-then-stats, which is web's left-to-right order in that pill row:
  // alignment first, then the numbers.
  statsRowSplit: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    gap: 20,
  },
  // `column-reverse` puts the CREDIT above the numbers, which is web's order
  // and not a cosmetic preference: web's header is ranked by weight. The name
  // is the subject, so it is large and left. The right side is secondary, so it
  // is small and right-aligned — and inside it the creators line is the
  // quietest element, so it caps the group, while the stats anchor the bottom
  // level with the taxonomy chip opposite. Native had the numbers on top and
  // the credit beneath, which reads as two competing headlines.
  statsColSplit: { flex: 0, alignItems: 'flex-end', flexDirection: 'column-reverse' },
  // Stacked on the right (shortest label on top), so "Created by" reclaims the
  // full-width horizontal room instead of sharing the line with two side-by-side
  // pills. align-end keeps the stack flush to the right edge.
  chipRow: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 9,
    flexShrink: 0,
  },
  // Soft colour-tinted chip + coloured border/label — vivid, not a grey block.
  taxoBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  taxoBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // At-a-glance vitals strip — big numbers + tiny labels, divider-separated.
  vitals: { flexDirection: 'row', alignItems: 'center' },
  vitalItem: { alignItems: 'flex-start' },
  vitalValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.beige,
    lineHeight: 26,
  },
  vitalLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.6)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  vitalDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(245,235,220,0.22)',
    marginHorizontal: 18,
  },
  createdBy: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.6)',
    flexShrink: 1,
  },

  // A subtle section-header pencil (no background; orange when its section edits)
  sectionPencil: { paddingVertical: 2, paddingLeft: 6 },

  // Bottom "Contribute to this character" CTA
  contributeFooter: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    alignItems: 'center',
  },
  contributeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.4)',
    backgroundColor: 'rgba(231,115,51,0.06)',
  },
  contributeBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: ORANGE_INK,
    letterSpacing: 0.2,
  },
  contributeMenu: {
    marginTop: 12,
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.1)',
    overflow: 'hidden',
  },
  contributeMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  contributeMenuText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.navy },
  contributeMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(41,60,67,0.08)',
    marginHorizontal: 16,
  },

  // Summary — gutter only. PullQuoteBio renders flat here (no card, no accent
  // bar): the white card was the single surface on this page that didn't use
  // the page's own card language, so it read as a foreign box on the beige.
  summaryBlock: { paddingHorizontal: 20, paddingVertical: 8, maxWidth: PROSE_MAX_WIDTH + 40 },
  // Signature-power tiles above the abilities grid — same 20px section gutter.
  signatureWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  traitBandWrap: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitleGrow: { flex: 1 },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
    textAlign: 'right',
    paddingVertical: 5,
  },
  divider: { height: 1, backgroundColor: COLORS.navy, borderRadius: 30, marginBottom: 16 },

  // Full-bleed sections — padded header, edge-to-edge horizontal body.
  sectionHeaderPad: { paddingHorizontal: 20, paddingTop: 20 },
  bleedSection: { paddingBottom: 12 },
  onScreenSubsection: { marginTop: 20 },
  bleedPad: { paddingHorizontal: 20 },
  bleedRow: { flexDirection: 'row', gap: 10, paddingLeft: 20, paddingRight: 20 },

  // Dossier — collapsible label/value card
  // Collapsible Dossier — a clearly tappable card (surface + View/Hide pill) so
  // the expand affordance reads at a glance.
  dossierBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dossierBarOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dossierBarText: { flex: 1 },
  dossierTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.navy,
  },
  dossierHint: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: '#54606A',
    marginTop: 3,
  },
  dossierToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(41,60,67,0.08)',
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 9,
    paddingVertical: 7,
  },
  dossierToggleText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
  },
  dossierBody: {
    backgroundColor: 'rgba(41,60,67,0.035)',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  // Dossier edit mode
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(41,60,67,0.1)',
  },
  editRowLabel: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.navy },
  editRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    maxWidth: '60%',
  },
  editRowValue: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: PAPER_TEXT.faint },
  editRowAdd: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: ORANGE_INK },
  dossierGroupLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: ORANGE_INK,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  dossierGroupSpacing: { marginTop: 18 },
  dossierEra: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: 22,
    color: COLORS.navy,
  },

  // Circular stat dials
  statsCard: {
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
  },
  dialWrap: { alignItems: 'center', justifyContent: 'center', padding: 6 },
  dialGauge: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialValue: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.navy, left: 1 },
  dialLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.navy,
    marginTop: -8,
    opacity: 0.75,
  },
  statTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  statTotal: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: PAPER_TEXT.faint,
    letterSpacing: 0.3,
  },
  statPercentileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statPercentileBadgeText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12 },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 9,
  },
  infoLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: PAPER_TEXT.faint,
    textTransform: 'capitalize',
  },
  infoValue: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
    textTransform: 'capitalize',
    flex: 1,
    textAlign: 'right',
  },

  // Affiliation chips
  chipsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
  },
  chip: {
    backgroundColor: 'rgba(41,60,67,0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.14)',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  chipText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.navy,
    letterSpacing: 0.2,
  },
  // Team-linked affiliation chip — warm tint signals it's a doorway into the
  // team roster (/team/[id]); unmatched affiliations stay flat text chips.
  chipLink: {
    backgroundColor: 'rgba(231,115,51,0.12)',
    borderColor: 'rgba(231,115,51,0.32)',
  },
  chipLinkText: { color: '#9a4a1f' },

  // First issue
  // First Appearance — horizontal editorial card (cover + issue meta).
  debutCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 12,
  },
  debutCover: {
    width: 92,
    height: 138,
    borderRadius: 8,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    boxShadow: '0px 4px 12px rgba(41,60,67,0.28)',
  },
  debutCoverImg: { width: 92, height: 138 },
  debutMeta: { flex: 1, justifyContent: 'center', gap: 6 },
  debutTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    lineHeight: 21,
    color: COLORS.navy,
  },
  debutYear: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: '#54606A',
    letterSpacing: 0.3,
  },
  debutCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  debutCtaText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: ORANGE_INK,
  },
  // In Print — consolidated header (debut "Since" + title) and gallery label.
  inPrintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  inPrintSince: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: '#54606A',
    letterSpacing: 0.3,
    paddingBottom: 7,
  },
  inPrintGalleryLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#54606A',
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 12,
  },
  debutBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  debutBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: ORANGE_INK,
  },
  // Floating section quick-nav — transparent bar under the header; the chips
  // themselves carry the only fill, so the page reads continuously behind it.
  quickNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingTop: 4,
    zIndex: 5,
  },
  // Vertical padding inside the scroll content leaves room for each pill's drop
  // shadow — without it the horizontal scroll viewport clips the shadow's tail.
  quickNavContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
  },
  // Self-contained floating pills — the bar is transparent, so each chip needs
  // its own legible fill + hairline border + soft lift to read over any content.
  navChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(250,244,235,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.14)',
    boxShadow: '0px 2px 6px rgba(41,60,67,0.16)',
  },
  navChipActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  navChipText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  navChipTextActive: { color: COLORS.beige },

  // Floating Compare pill — transparent container, no slab, so the beige page
  // reads to the bottom edge and the pill simply hovers over it.
  compareStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // Deeper "burnt" orange (≈4.6:1 with white) — passes WCAG AA, unlike the
    // lighter brand orange which was ~3:1 against white.
    backgroundColor: '#C2551B',
    borderRadius: 30,
    borderCurve: 'continuous',
    paddingVertical: 16,
    boxShadow: '0px 8px 20px rgba(41,60,67,0.28)',
    // A pill is a target, not a band. Unbounded it is 1336pt wide on a landscape
    // iPad — the same "iPhone app on an iPad" tell PageColumn was written for.
    // Left-aligned with the sheet's gutter rather than centred, so it keeps the
    // page's one left edge.
    maxWidth: 420,
  },
  compareBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
