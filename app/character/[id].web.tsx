import { useCallback, useEffect, useMemo, useState, Fragment, type ComponentProps } from 'react';
import { flushSync } from 'react-dom';
import { View, Pressable, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { Text } from '../../src/components/ui/Text';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import { useLocalSearchParams, useRouter, usePathname } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NotFoundView, LoadErrorView } from '../../src/components/NotFoundView';
import { getHeroById, heroRowToCharacterData } from '../../src/lib/db/heroes';
import { loginHref } from '../../src/lib/loginRedirect';
import { FamilyCanvas } from '../../src/components/family/FamilyCanvas.web';
import { useHeroHouses } from '../../src/hooks/useHeroHouses';
import { groupPowers } from '../../src/constants/powerIcons';
import { useHeroDetail } from '../../src/hooks/useHeroDetail';
import { useHeroTeams } from '../../src/hooks/useHeroTeams';
import { useSkeletonTransition } from '../../src/hooks/useSkeletonTransition';
import { FadeOutSkeleton } from '../../src/components/ui/FadeOutSkeleton';
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
import { heroImageSource, heroGridImageSource } from '../../src/constants/heroImages';
import { HeroImage } from '../../src/components/HeroImage';
import {
  COLORS,
  ACCENT_INK,
  SURFACE,
  INK_TEXT,
  PAPER_TEXT,
  ORANGE_INK,
} from '../../src/constants/colors';
import { deriveCharacterTheme } from '../../src/lib/accent';
import { isPresentableFact, cleanFact } from '../../src/lib/characterFacts';
import {
  alignmentLabel as taxoAlignment,
  originLabel as taxoOrigin,
} from '../../src/lib/characterTaxonomy';
import { MOTION, prefersReducedMotion } from '../../src/lib/motion';
import {
  VT_PORTRAIT,
  consumeMorphArrival,
  beginMorphReturn,
  endMorphReturn,
  withViewTransition,
} from '../../src/lib/viewTransition';
import { HeartPop } from '../../src/components/web/HeartPop';
import { PRESS_TRANSITION, pressTransform } from '../../src/components/web/pressStyles';
import { PullQuoteBio } from '../../src/components/character/PullQuoteBio';
import { LegendBand } from '../../src/components/web/character/LegendBand';
import { PowerStatCell, statDisplayValue } from '../../src/components/web/character/PowerStatCell';
import { Reveal } from '../../src/components/web/Reveal';
import {
  SectionDotRail,
  type RailSection,
} from '../../src/components/web/character/SectionDotRail';
import {
  SignaturePowerTiles,
  pickSignaturePowers,
} from '../../src/components/character/SignaturePowers';
import { SocialWebPreview } from '../../src/components/web/character/SocialWebPreview';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { MovieStrip } from '../../src/components/MovieStrip';
import { groupTitlesByMedia } from '../../src/lib/db/titles';
import { HeroLinksRow, heroLinksHasContent } from '../../src/components/HeroLinksRow';
import { AbilitiesSection } from '../../src/components/AbilitiesSection';
import { TraitBand } from '../../src/components/character/TraitBand';
import { type PowerExplainer } from '../../src/lib/db/heroFacts';
import { RelatedHeroStrip } from '../../src/components/RelatedHeroStrip';
import { FirstIssueModal } from '../../src/components/FirstIssueModal';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { GalleryStrip } from '../../src/components/GalleryStrip';
import { ComicCoverRail } from '../../src/components/home/ComicCoverRail';
import { ImageLightbox } from '../../src/components/ImageLightbox';
import { UniverseEyebrow } from '../../src/components/PublisherBadge';
import { SeoHead } from '../../src/components/web/SeoHead';
import { PageEndCap } from '../../src/components/web/PageEndCap';
import { SITE_URL } from '../../src/constants/site';
import type { HeroStats } from '../../src/types';

const STAT_CONFIG = [
  { key: 'intelligence', label: 'Intelligence', color: COLORS.blue },
  { key: 'strength', label: 'Strength', color: COLORS.red },
  { key: 'speed', label: 'Speed', color: COLORS.yellow },
  { key: 'durability', label: 'Durability', color: COLORS.green },
  { key: 'power', label: 'Power', color: COLORS.orange },
  { key: 'combat', label: 'Combat', color: COLORS.brown },
];

// Was a local Set; moved to src/lib/characterFacts.ts when the native half
// turned out to be filtering a narrower list and leaking placeholders.

// Catalog median per stat (heroes with non-zero stats, 2026-07-02) — the faint
// tick on each Power Profile bar that makes "94 intelligence" mean something.
const STAT_MEDIANS: Record<string, number> = {
  intelligence: 50,
  strength: 24,
  speed: 30,
  durability: 36,
  power: 30,
  combat: 40,
};

// Mobile immersive portrait header height as a fraction of the viewport. Shared by
// the live page AND the loading skeleton so the two stay pixel-aligned — the
// skeleton crossfades out OVER the settled content, so any drift here shows up as a
// vertical jump of the body as the skeleton dissolves.
// Expressed in `svh`, not measured pixels. `svh` is the SMALL viewport height —
// the viewport with the iOS toolbar expanded — so it never changes as the bar
// collapses, which is the jitter a frozen JS measurement was there to avoid.
// The measurement was the bug: it was captured once at mount, and any reading
// taken before layout settles (hydration, a bfcache restore, a link opened
// while the toolbar animates) was then permanent. Because the identity block is
// bottom-anchored inside this box, a short box drives the name, chips and
// vitals up the portrait and over the face. CSS has nothing to measure.
const M_HERO_VH = '90svh';

// Stable identity — SectionDotRail re-attaches its IntersectionObserver whenever
// this array changes, so it must not be re-created on every render.
const RAIL_SECTIONS: RailSection[] = [
  { id: 'sec-power', label: 'Power', icon: 'flash' },
  { id: 'sec-abilities', label: 'Abilities', icon: 'sparkles' },
  { id: 'sec-relations', label: 'Relations', icon: 'people' },
  { id: 'sec-legend', label: 'Legend', icon: 'ribbon' },
  { id: 'sec-print', label: 'In Print', icon: 'library' },
];

// Map the raw alignment value to a display label (mirrors the Explore stage).
function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!isPresentableFact(value)) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// The dry label/value data (Profile + Appearance + Connections, plus the debut
// blurb) folded into one collapsed-by-default card — mirrors the native
// <Dossier> so web mobile reads the same way.
function MobileDossier({
  stats,
  teams,
  eraSummary,
  editValues,
  onEditField,
}: {
  stats: HeroStats;
  teams?: string[] | null;
  eraSummary?: string | null;
  /** Editable field → current value, supplied by the screen (has both stats + details). */
  editValues?: Record<string, string | null | undefined>;
  onEditField?: (field: EditableFieldDef | null, current: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const { biography: bio, appearance: app, work, connections } = stats;

  const valid = isPresentableFact;
  const aliases = bio.aliases.filter(valid);
  const heightStr = app.height.filter(valid).join(' / ');
  const weightStr = app.weight.filter(valid).join(' / ');
  const affiliation = teams?.length ? teams.join(', ') : connections['group-affiliation'];

  const hasProfile =
    valid(bio['full-name']) ||
    valid(bio['alter-egos']) ||
    valid(bio['place-of-birth']) ||
    valid(bio['first-appearance']) ||
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

  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        disabled={editing}
        style={[styles.dossierBar, (open || editing) && (styles.dossierBarOpen as object)]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open || editing }}
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
          <WebSectionPencil
            active={editing}
            onPress={() => setEditing((e) => !e)}
            label="Edit dossier"
          />
        </View>
      </Pressable>
      {editing ? (
        <View style={styles.dossierBody}>
          {DOSSIER_GROUPS.map((group, gi) => (
            <Fragment key={group.key}>
              <Text
                style={[styles.dossierGroupLabel, gi > 0 && (styles.dossierGroupSpacing as object)]}
              >
                {group.label}
              </Text>
              {group.fields.map((f) => {
                const v = editValues?.[f.field];
                const filled = !isBlankValue(v);
                return (
                  <Pressable
                    key={f.field}
                    onPress={() => onEditField?.(f, filled ? (v ?? null) : null)}
                    style={s2.editRow as object}
                  >
                    <Text style={s2.editRowLabel}>{f.label}</Text>
                    <View style={s2.editRowRight as object}>
                      <Text
                        style={(filled ? s2.editRowValue : s2.editRowAdd) as object}
                        numberOfLines={1}
                      >
                        {filled ? v : 'Add'}
                      </Text>
                      <Ionicons name={filled ? 'pencil' : 'add'} size={14} color={COLORS.orange} />
                    </View>
                  </Pressable>
                );
              })}
            </Fragment>
          ))}
          <Text style={[styles.dossierGroupLabel, styles.dossierGroupSpacing as object]}>
            Trivia
          </Text>
          <Pressable onPress={() => onEditField?.(null, null)} style={s2.editRow as object}>
            <Text style={s2.editRowLabel}>Did You Know fact</Text>
            <View style={s2.editRowRight as object}>
              <Text style={s2.editRowAdd as object}>Add</Text>
              <Ionicons name="bulb-outline" size={14} color={COLORS.orange} />
            </View>
          </Pressable>
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
              <Text
                style={[styles.dossierGroupLabel, hasEra && (styles.dossierGroupSpacing as object)]}
              >
                Profile
              </Text>
              <InfoRow label="Full name" value={bio['full-name']} />
              <InfoRow label="Alter egos" value={bio['alter-egos']} />
              <InfoRow label="Place of birth" value={bio['place-of-birth']} />
              <InfoRow label="First appearance" value={bio['first-appearance']} />
              {aliases.length > 0 ? <InfoRow label="Aliases" value={aliases.join(', ')} /> : null}
            </>
          ) : null}
          {hasAppearance ? (
            <>
              <Text
                style={[
                  styles.dossierGroupLabel,
                  hasProfile && (styles.dossierGroupSpacing as object),
                ]}
              >
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
                  (hasProfile || hasAppearance) && (styles.dossierGroupSpacing as object),
                ]}
              >
                Connections
              </Text>
              <InfoRow label="Occupation" value={work.occupation} />
              <InfoRow label="Base" value={work.base} />
              <InfoRow label="Group affiliation" value={affiliation} />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// Edit-mode affordances: banner, chips, and the editable field rows.
const s2 = StyleSheet.create({
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(41,60,67,0.1)',
    cursor: 'pointer',
  } as object,
  editGroupLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginTop: 14,
    marginBottom: 2,
  } as object,
  editRowLabel: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  editRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    maxWidth: '60%',
  } as object,
  editRowValue: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: PAPER_TEXT.faint,
  } as object,
  editRowAdd: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.orange,
  } as object,
  pencil: { paddingVertical: 2, paddingLeft: 7, cursor: 'pointer' } as object,
  // Card header row: title + pencil sit together, perfectly centered vertically.
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 } as object,
  contributeFooter: { alignItems: 'center', paddingTop: 24, paddingBottom: 8 } as object,
  contributeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.4)',
    backgroundColor: 'rgba(231,115,51,0.06)',
    cursor: 'pointer',
  } as object,
  contributeBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.orange,
    letterSpacing: 0.2,
  } as object,
  contributeMenu: {
    marginTop: 12,
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.1)',
    overflow: 'hidden',
  } as object,
  contributeMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    cursor: 'pointer',
  } as object,
  contributeMenuText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.navy,
  } as object,
  contributeMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(41,60,67,0.08)',
    marginHorizontal: 16,
  } as object,
});

// A subtle pencil for the right of a section header — clean glyph, no chip
// background, orange while its section is being edited.
function WebSectionPencil({
  onPress,
  active,
  label = 'Edit',
}: {
  onPress: () => void;
  active?: boolean;
  label?: string;
}) {
  return (
    <Pressable onPress={onPress} style={s2.pencil} accessibilityLabel={label}>
      <MaterialCommunityIcons
        name="pencil"
        size={15}
        color={active ? COLORS.orange : 'rgba(41,60,67,0.4)'}
      />
    </Pressable>
  );
}

// Admin-only editable power-stat list — swaps in for the dial/bar view when an
// admin taps the stats pen. Shared by the desktop and mobile-web layouts.
function StatEditList({
  stats,
  onPick,
}: {
  stats: HeroStats;
  onPick: (field: EditableFieldDef, current: string) => void;
}) {
  return (
    <View>
      {STAT_FIELDS.map((f) => {
        const cur = (stats.powerstats as Record<string, string>)[f.field] ?? '0';
        return (
          <Pressable key={f.field} onPress={() => onPick(f, cur)} style={s2.editRow as object}>
            <Text style={s2.editRowLabel}>{f.label}</Text>
            <View style={s2.editRowRight as object}>
              <Text style={s2.editRowValue as object}>{cur}</Text>
              <Ionicons name="pencil" size={14} color={COLORS.orange} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// A value that's blank or only separators (e.g. "/" when height fields are empty)
// counts as missing — keeps the Quick Facts grid free of empty tiles.
function genderIcon(value: string | null | undefined): IoniconName {
  const v = (value ?? '').toLowerCase();
  if (v.includes('female')) return 'female-outline';
  if (v.includes('male')) return 'male-outline';
  return 'transgender-outline';
}

// One Quick-Facts card: a compact square tile — icon, value, tiny label. Short
// facts sit two-up; long ones (full name, birthplace…) span the row via `wide`.
// `accent` tints the whole card + icon + value (used for alignment, the one pop
// of colour in the panel).
function FactTile({
  icon,
  label,
  value,
  wide,
  accent,
  iconTint,
}: {
  icon: IoniconName;
  label: string;
  value: string | null | undefined;
  wide?: boolean;
  accent?: string;
  /** Ambient page accent for the icon when the tile itself isn't accent-tinted. */
  iconTint?: string;
}) {
  const v = cleanFact(value);
  if (!v) return null;
  const tint = accent ? { backgroundColor: accent + '14', borderColor: accent + '33' } : null;
  return (
    <View style={[styles.factTile, wide && styles.factTileWide, tint] as object}>
      <Text style={styles.factLabel}>{label}</Text>
      <View style={styles.factValueRow}>
        <Ionicons name={icon} size={12} color={accent ?? iconTint ?? COLORS.navy + '70'} />
        <Text
          style={[styles.factValue, accent ? { color: accent } : null] as object}
          numberOfLines={2}
        >
          {v}
        </Text>
      </View>
    </View>
  );
}

// The hero vitals count up on arrival — the page's opening beat. Reduced
// motion (and SSR) renders the final value immediately.
function VitalCount({ value, style }: { value: number; style?: object }) {
  const reduced = typeof window === 'undefined' || prefersReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    // Start rolling immediately — the old 250ms "beat" held the display at a
    // flat 0 long enough to read as broken data ("0 POWER") in the entrance,
    // especially when values mount mid-morph. The count-up IS the beat.
    const start = performance.now();
    const DUR = 900;
    const tick = (now: number) => {
      const t = Math.min(Math.max(now - start, 0) / DUR, 1);
      setDisplay(statDisplayValue(t, value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <Text style={style}>{display.toLocaleString()}</Text>;
}

export default function WebCharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 700;
  // The stage's identity band puts the title and the meta pills side by side and
  // reserves 324px for the overlapping portrait. That needs real width: on an
  // iPad in portrait (820) the title column was squeezed to ~100px, which broke
  // the name mid-word ("Batma / n" — RNW sets word-wrap:break-word on Text) and
  // forced every trait pill onto its own line. Below this the band stacks.
  const stageWide = width >= 1100;

  // Document scroll so the page bleeds edge-to-edge under the iOS Safari toolbar.
  // Before the skeleton early-return so it applies in both states. Canvas is ink
  // and must stay ink: in a Safari tab ONE canvas colour tints BOTH the status-bar
  // zone and the bottom toolbar (env-inset covers are 0-height there), and the
  // tint is re-sampled across scroll/toolbar states — a paper canvas makes the
  // status zone flash beige over the dark hero depending on scroll history.
  // Bottom seamlessness comes from the page CLOSING on ink instead (PageEndCap
  // after the beige sheet), so both bars read ink in every scroll state.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

  const skeletonOpacity = useSkeletonAnim();
  // Houses this character belongs to — the link out of the family section and
  // into the whole dynasty. Jon Snow is in two.
  const {
    data,
    setData,
    heroRow,
    heroPortraitUrl,
    user,
    isAdmin,
    comicVineLoading,
    statsGenerating,
    notFound,
    loadError,
    favourited,
    favLoading,
    galleryImages,
    newIssues,
    family,
    narrative,
    titles,
    portrayals,
    links,
    retryLoad,
    toggleFavourite,
    powerTotal,
    percentile,
    relatedHeroMap,
    enemyNames,
    allyNames,
    teammateNames,
  } = useHeroDetail({ id });
  const heroHouses = useHeroHouses(heroRow?.id ?? null);

  // Portrait morph arrival: if we got here by tapping a hero card, the card
  // stashed its art here so we can paint the portrait immediately — even in the
  // skeleton state before stats load — and tag it with the shared name so the
  // card art morphs into it. Read once on mount.
  const [morphArt] = useState(() => consumeMorphArrival(String(id)));

  // Ambient per-character palette — blurhash average color → publisher → teal.
  // On a morph arrival the card's stashed blurhash/publisher seed the SAME
  // derivation before heroRow loads, so the skeleton stage wears the
  // character's own colours and the crossfade doesn't shift the atmosphere.
  const theme = useMemo(
    () =>
      deriveCharacterTheme({
        portrait_blurhash: heroRow?.portrait_blurhash ?? morphArt?.blurhash,
        publisher:
          heroRow?.publisher ?? data?.stats.biography.publisher ?? morphArt?.publisher ?? null,
      }),
    [heroRow, data, morphArt],
  );

  // Cold-load choreography (mirrors the title page): a single `loading` flag drives
  // a four-phase skeleton→content transition so the swap reads as a cross-dissolve.
  //   pre       — within the anti-flash window: show only the deepNavy shell, so an
  //               instant/cached load never flashes a half-frame of skeleton.
  //   skeleton  — load outlasted the window: show the full-page skeleton.
  //   crossfade — data arrived after the skeleton showed: render the real page and
  //               dissolve the skeleton out on top of it (placeholders resolve in
  //               place), so the body never hard-cuts.
  // Morph arrivals never see this skeleton machine — they render the real page
  // immediately (progressive hydration, below); this drives plain cold loads.
  const coldPhase = useSkeletonTransition(!data);

  // View-only UI state (edit affordances, first-issue modal, tabs, lightbox, stage).
  const [statsEditing, setStatsEditing] = useState(false);
  const [factsEditing, setFactsEditing] = useState(false);
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
  // Measured desktop stage height — lets the overlapping portrait anchor to a
  // constant top position regardless of how much identity content the stage has.
  const [stageHeight, setStageHeight] = useState(0);

  // A morph arrival owns the entrance choreography: the portrait morph + the
  // skeleton crossfade ARE the entrance, so per-section Reveal rises would read
  // as content jumping underneath them — render those settled instead.
  const arrivedViaMorph = !!morphArt;
  const [portraitTagged, setPortraitTagged] = useState(arrivedViaMorph);
  useEffect(() => {
    if (!portraitTagged) return undefined;
    const t = setTimeout(() => setPortraitTagged(false), MOTION.entrance);
    return () => clearTimeout(t);
  }, [portraitTagged]);
  const portraitVT = portraitTagged ? ({ viewTransitionName: VT_PORTRAIT } as object) : null;

  // Choreographed back: play the forward morph in reverse. Tag the portrait
  // synchronously (so it lands in the transition's "old" snapshot), mark this
  // hero as the return target (the matching card on the screen below tags
  // itself for the "new" snapshot via useHeroMorph), and navigate inside a view
  // transition — the portrait shrinks back into the exact card it grew from.
  // With no matching card (deep link, different origin) the name is unpaired
  // and it degrades to the soft root cross-fade; in unsupported browsers
  // withViewTransition falls back to a plain navigation.
  const goBack = useCallback(() => {
    flushSync(() => setPortraitTagged(true));
    beginMorphReturn(String(id));
    // Flips the corner-radius keyframes to the return direction (0 → rounded)
    // for the duration of the transition — see +html.tsx.
    document.documentElement.classList.add('vt-returning');
    const t = withViewTransition(() =>
      router.canGoBack() ? router.back() : router.replace('/explore'),
    );
    const done = () => {
      endMorphReturn();
      document.documentElement.classList.remove('vt-returning');
    };

    // Un-tag the card once the morph settles (or immediately on the fallback
    // path); a timer backstops a transition that never resolves.
    if (t?.finished) {
      t.finished.then(done, done);
    } else {
      done();
    }
    setTimeout(done, 800);
  }, [id, router]);
  // The exact (already-cached) image the card was showing — used as the content
  // portrait's placeholder so, on a morph arrival, it paints crisp immediately
  // and upgrades to full-res without flashing through a blur.
  const morphGridUri = morphArt
    ? (morphArt.grid
        ? heroGridImageSource(
            morphArt.id,
            morphArt.image_url,
            morphArt.portrait_url,
            morphArt.image_md_url,
            morphArt.gridWidth,
          )
        : heroImageSource(morphArt.id, morphArt.image_url, morphArt.portrait_url)
      ).uri || undefined
    : undefined;

  // Priority: Supabase portrait → local bundled → API image → CDN
  const heroImage = id
    ? heroImageSource(
        id,
        data?.stats.image.url ?? morphArt?.image_url ?? null,
        data?.stats.image.portraitUrl ?? morphArt?.portrait_url ?? null,
      )
    : null;

  // Once the stage (with the big hero name) has scrolled out of view, fade the
  // name into the sticky portrait so you always know who you're looking at.
  const [nameRevealed, setNameRevealed] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const threshold = (stageHeight || 280) - (TOPBAR_HEIGHT + 56);
    const onScroll = () => setNameRevealed(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [stageHeight]);

  // Affiliations + their team-id resolution are derived BEFORE any early return
  // so these hooks run on every render (data may be null / errored on first paint).
  // Deduped — team names repeat in the raw data and they key the chip list.
  const affiliations: string[] = Array.from(
    new Set(
      data?.details.teams?.length
        ? data.details.teams
        : (data?.stats.connections['group-affiliation'] ?? '')
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(isPresentableFact),
    ),
  );
  // Affiliations that match a real team become doorways into /team/[id].
  const resolveTeamId = useHeroTeams(affiliations);

  if (notFound) {
    return (
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
    );
  }

  if (loadError) {
    return (
      <LoadErrorView
        actions={[
          { label: 'Retry', primary: true, onPress: retryLoad },
          { label: 'Go back', onPress: () => router.back() },
        ]}
      />
    );
  }

  // Progressive hydration (morph arrivals): render the REAL page from the very
  // first frame using a synthetic CharacterData built from the card's stashed
  // art — name, portrait, publisher and theme are all already known, so the
  // page structure, stage and portrait are pixel-identical from the start and
  // the morph lands directly on the live portrait. Regions whose data hasn't
  // arrived yet render their own inline placeholders (gated on `hydrating`)
  // and resolve in place — there is no page-level skeleton swap at all.
  const view =
    data ??
    (morphArt
      ? heroRowToCharacterData({
          id: morphArt.id,
          name: morphArt.name ?? '',
          image_url: morphArt.image_url ?? null,
          portrait_url: morphArt.portrait_url ?? null,
          image_md_url: morphArt.image_md_url ?? null,
          publisher: morphArt.publisher ?? null,
          portrait_blurhash: morphArt.blurhash ?? null,
        } as unknown as Parameters<typeof heroRowToCharacterData>[0])
      : null);
  const hydrating = !data && !!morphArt;

  if (!view) {
    // Plain cold load (no morph): deepNavy shell so the `pre` window (and a web
    // refresh) fuses with the boot LogoLoader and the skeleton's dark stage —
    // no beige flash in between.
    return (
      <View style={styles.loadingShell}>
        {coldPhase === 'skeleton' ? (
          <CharacterSkeleton
            isDesktop={isDesktop}
            showHeart={!!user}
            // Seed the page-owned stage measurement so the real page (and the
            // crossfade overlay) mount with the portrait already anchored where
            // the skeleton put it — no fallback-frame jump at the handoff.
            stageHeight={stageHeight}
            onStageHeight={setStageHeight}
          />
        ) : null}
      </View>
    );
  }

  const { stats, details } = view;

  // Per-page SEO: title from name + publisher, description from the bio (HTML
  // stripped + truncated), OG image from the hero's portrait.
  const seoPublisher = stats.biography.publisher || 'Character';
  // The biography HTML used to be the second choice here. It is no longer
  // fetched by this screen — it reached 398 KB on Batman and was being pulled
  // to every character page — so a hero with no summary now takes the generic
  // line (543 of them). No SEO cost: crawlers are served by api/bot-page.ts,
  // which does its own query and still reads `description`. This tag is only
  // ever seen by a real browser.
  const seoRaw =
    details.summary || `${stats.name} — powers, stats, first appearance and more on Mythique.`;
  const seoDesc =
    seoRaw
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 155)
      .trim() + (seoRaw.length > 155 ? '…' : '');
  // Branded 1200×630 card from the OG renderer (falls back to the raw portrait
  // for heroes with no art — the renderer handles that itself too).
  const seoImage = `${SITE_URL}/api/og?hero=${encodeURIComponent(String(id))}`;

  // Editable-field → current value, shared by the mobile dossier editor and the
  // desktop contribute card (the screen has both stats + details).
  const editValues: Record<string, string | null | undefined> = {
    // Profile
    full_name: stats.biography['full-name'],
    alter_egos: stats.biography['alter-egos'],
    aliases: (stats.biography.aliases ?? []).filter(isPresentableFact).join('\n'),
    place_of_birth: stats.biography['place-of-birth'],
    first_appearance: stats.biography['first-appearance'],
    origin: details.origin,
    // Appearance
    gender: stats.appearance.gender,
    race: stats.appearance.race,
    height_imperial: stats.appearance.height?.[0],
    weight_imperial: stats.appearance.weight?.[0],
    eye_color: stats.appearance['eye-color'],
    hair_color: stats.appearance['hair-color'],
    // Connections
    occupation: stats.work.occupation,
    base: stats.work.base,
    group_affiliation: stats.connections['group-affiliation'],
  };

  // Re-derive from the freshly-edited DB row so the page reflects the change.
  const reloadHero = () => {
    getHeroById(stats.id)
      .then((hero) => hero && setData(heroRowToCharacterData(hero)))
      .catch(() => {});
  };

  const alias =
    stats.biography['full-name'] &&
    stats.biography['full-name'] !== stats.name &&
    stats.biography['full-name'] !== '-'
      ? stats.biography['full-name']
      : null;

  const alignmentColor = (() => {
    const a = (stats.biography.alignment ?? '').toLowerCase();
    if (a === 'good') return COLORS.blue;
    if (a === 'bad') return COLORS.red;
    return COLORS.orange;
  })();

  // Wording now comes from src/lib/characterTaxonomy.ts — this half said
  // "Anti-Hero" where native said "Neutral" for the same 919 characters.
  const alignmentLabel = taxoAlignment(stats.biography.alignment);
  const originLabel = taxoOrigin(details.origin);

  const statValues = STAT_CONFIG.map(({ key }) =>
    parseInt((stats.powerstats as Record<string, string>)[key] ?? '0', 10),
  ).filter((n) => !isNaN(n) && n > 0);
  const powerScore =
    statValues.length > 0
      ? Math.round(statValues.reduce((a, b) => a + b, 0) / statValues.length)
      : null;

  // How far the side-column portrait overlaps up into the stage. Anchored to a
  // constant top (TOPBAR_HEIGHT + 24) by clamping the overlap to the stage height,
  // so a shorter stage never pushes the portrait under the floating nav. With the
  // controls row gone the portrait can ride higher. Falls back to the design
  // default until the stage has been measured.
  const portraitOverlap = stageHeight
    ? -Math.min(300, Math.max(0, stageHeight - (TOPBAR_HEIGHT + 8)))
    : -300;

  return (
    <>
      <SeoHead
        title={`${stats.name} — ${seoPublisher} | Mythique`}
        description={seoDesc}
        path={`/character/${id}`}
        image={seoImage}
      />
      <View style={[styles.scroll, styles.scrollContent] as object}>
        {/* ── Desktop: cinematic identity stage. Mobile uses the native-style
            immersive portrait header inside the body branch below. ── */}
        {isDesktop ? (
          <View
            onLayout={(e) => setStageHeight(e.nativeEvent.layout.height)}
            style={[
              styles.stage,
              {
                paddingTop: TOPBAR_HEIGHT + 32,
                paddingBottom: 26,
              },
            ]}
          >
            {/* Ambient blurred portrait backdrop — depth, like the spotlight imagery */}
            {heroImage ? (
              <Image
                source={heroImage}
                contentFit="cover"
                contentPosition="top"
                style={[StyleSheet.absoluteFill, styles.stageBackdrop] as object}
                cachePolicy="memory-disk"
                recyclingKey={id}
                // Fills the stage, so Chrome often measures THIS as the LCP
                // element (largest paint) over the foreground portrait — keep it
                // high-priority too. Shares the source URI, so no extra fetch.
                priority="high"
                // Ease in rather than pop — on a cold load this lands after the
                // stage has already painted.
                transition={250}
              />
            ) : null}
            {/* Gradient scrim keeps the identity text legible over the backdrop */}
            <View style={[styles.stageScrim, { pointerEvents: 'none' }] as object} />
            {/* Name-side accent bloom — the character's own color owns the band */}
            <View
              style={
                [
                  StyleSheet.absoluteFill,
                  {
                    backgroundImage: `radial-gradient(55% 90% at 16% 35%, ${theme.accentDeep}59, transparent 70%)`,
                    pointerEvents: 'none',
                  },
                ] as object
              }
            />
            {/* Atmospheric orbs — accent-tinted, purely decorative */}
            <View
              style={
                [
                  styles.orbA,
                  {
                    backgroundImage: `radial-gradient(circle, ${theme.accent}40, transparent 70%)`,
                    pointerEvents: 'none',
                  },
                ] as object
              }
            />
            <View style={[styles.orbB, { pointerEvents: 'none' }] as object} />

            <View style={[styles.stageInner, { paddingHorizontal: isDesktop ? 24 : 16 }]}>
              {/* Identity — title hugs the left; secondary metadata fills the
                  band between the title and the overlapping body portrait, so
                  nothing has to stack downward past the portrait's edge. */}
              <View
                style={[styles.identityCol, isDesktop && (styles.identityColDesktop as object)]}
              >
                <View
                  style={[styles.identityRow, !stageWide && (styles.identityRowStack as object)]}
                >
                  <View style={styles.titleBlock}>
                    <UniverseEyebrow
                      publisher={stats.biography.publisher}
                      franchise={heroRow?.franchise}
                      logoHeight={isDesktop ? 18 : 16}
                      textStyle={styles.stageEyebrow}
                    />
                    <Text
                      style={[
                        styles.heroName,
                        { fontSize: isDesktop ? 46 : 30, lineHeight: isDesktop ? 50 : 34 },
                      ]}
                    >
                      {stats.name}
                    </Text>
                    {hydrating ? (
                      // Most characters carry a full-name alias — reserve its
                      // line so the chips below don't shift when it lands.
                      <SkeletonBlock
                        opacity={skeletonOpacity}
                        width={170}
                        height={16}
                        borderRadius={4}
                        dark
                        style={{ marginTop: 6 }}
                      />
                    ) : alias ? (
                      <Text style={styles.heroAlias}>{alias}</Text>
                    ) : null}

                    {/* Theme trait chips — inside the title block so the meta
                        pills keep bottom-aligning with the identity content.
                        While hydrating, reserve one pill row at the exact chip
                        height so the stage doesn't grow when the tags land. */}
                    {hydrating ? (
                      <View
                        style={[styles.stageTraits, { flexDirection: 'row', gap: 8 }] as object}
                      >
                        {[86, 110, 78].map((w, i) => (
                          <SkeletonBlock
                            key={i}
                            opacity={skeletonOpacity}
                            width={w}
                            height={28}
                            borderRadius={14}
                            dark
                          />
                        ))}
                      </View>
                    ) : narrative && narrative.tags.length > 0 ? (
                      <View style={styles.stageTraits}>
                        <TraitBand tags={narrative.tags} onInk />
                      </View>
                    ) : null}
                  </View>

                  {/* Meta block — credit on top, pills anchored to the name baseline */}
                  <View style={[styles.metaBlock, !stageWide && (styles.metaBlockStack as object)]}>
                    {comicVineLoading ? (
                      <SkeletonBlock
                        opacity={skeletonOpacity}
                        width={180}
                        height={10}
                        borderRadius={4}
                        dark
                      />
                    ) : details.creators?.length ? (
                      <Text style={styles.stageCredit}>
                        Created by {details.creators.join(' & ')}
                      </Text>
                    ) : null}

                    <View style={[styles.metaRow, !stageWide && (styles.metaRowStack as object)]}>
                      {/* Hydrating: reserve the pill row (alignment chip + stat
                          strip footprint) so the meta band doesn't reflow when
                          the data lands. */}
                      {hydrating ? (
                        <>
                          <SkeletonBlock
                            opacity={skeletonOpacity}
                            width={64}
                            height={30}
                            borderRadius={20}
                            dark
                          />
                          <SkeletonBlock
                            opacity={skeletonOpacity}
                            width={150}
                            height={44}
                            borderRadius={999}
                            dark
                          />
                        </>
                      ) : null}
                      {!hydrating && alignmentLabel ? (
                        <View
                          style={[
                            styles.alignChip,
                            {
                              borderColor: alignmentColor + '66',
                              backgroundColor: alignmentColor + '22',
                            },
                          ]}
                        >
                          <Text style={[styles.alignChipText, { color: alignmentColor }]}>
                            {alignmentLabel}
                          </Text>
                        </View>
                      ) : null}
                      {!hydrating && (powerScore !== null || (details.issueCount ?? 0) > 0) ? (
                        <View
                          style={[styles.statStrip, { borderColor: theme.accent + '44' }] as object}
                        >
                          {powerScore !== null ? (
                            <View style={styles.statStripItem}>
                              <Text style={styles.metaPillVal}>{powerScore}</Text>
                              <Text style={styles.metaPillKey}>Power</Text>
                            </View>
                          ) : null}
                          {powerScore !== null && (details.issueCount ?? 0) > 0 ? (
                            <View
                              style={
                                [
                                  styles.statStripDiv,
                                  { backgroundColor: theme.accent + '55' },
                                ] as object
                              }
                            />
                          ) : null}
                          {(details.issueCount ?? 0) > 0 ? (
                            <View style={styles.statStripItem}>
                              <Text style={styles.metaPillVal}>
                                {details.issueCount!.toLocaleString()}
                              </Text>
                              <Text style={styles.metaPillKey}>Issues</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Soft accent glow at the bottom edge — replaces the hard border */}
            <View
              style={
                [
                  styles.stageAccent,
                  {
                    backgroundColor: theme.accentDeep + 'b3',
                    boxShadow: `0 0 18px ${theme.accentDeep}99`,
                    pointerEvents: 'none',
                  },
                ] as object
              }
            />
          </View>
        ) : null}

        {/* ── Body ── */}
        <View style={styles.bodyWrap}>
          {isDesktop ? (
            <>
              {/* Quiet section dot-rail — only where there's gutter to hold it.
                  The rail is fixed at the far left while the body is centred at
                  1180 max, so at exactly 1180 (iPad landscape) it had no gutter
                  to sit in and crowded the content against the edge. Needs the
                  content max plus room for the rail on both sides. */}
              {width >= 1320 ? (
                <SectionDotRail accent={theme.accent} sections={RAIL_SECTIONS} />
              ) : null}
              <View style={styles.bodyDesktopNew}>
                {/* Main column — continuous editorial sections */}
                <View style={styles.mainCol}>
                  {/* Power Profile — card grammar, but washed with the character's
                      accent at the crown, fading to clean white where the bars live */}
                  <View
                    nativeID="sec-power"
                    style={
                      [
                        styles.powerBand,
                        {
                          backgroundImage: `linear-gradient(180deg, ${theme.accentWash} 0%, rgba(255,255,255,0) 65%)`,
                          borderColor: theme.accent + '33',
                        },
                      ] as object
                    }
                  >
                    <View style={styles.statCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Power Profile</Text>
                        {view.statsSource === 'ai' ? (
                          <View style={styles.aiBadge}>
                            <Text style={styles.aiBadgeText}>AI</Text>
                          </View>
                        ) : null}
                        {isAdmin ? (
                          <WebSectionPencil
                            active={statsEditing}
                            onPress={() => setStatsEditing((s) => !s)}
                            label="Edit power stats"
                          />
                        ) : null}
                      </View>
                      <View style={styles.statHeaderRight}>
                        {powerScore !== null || statsGenerating ? (
                          <Pressable
                            onPress={() =>
                              !statsGenerating &&
                              router.push(
                                `/compare/${id}/pick?name=${encodeURIComponent(stats.name)}`,
                              )
                            }
                            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                              [
                                styles.compareBtn,
                                {
                                  borderColor: theme.accent + '40',
                                  backgroundColor: theme.accent + '0f',
                                },
                                hovered &&
                                  !statsGenerating && {
                                    backgroundColor: theme.accent + '1f',
                                    borderColor: theme.accent + '80',
                                  },
                                statsGenerating && { opacity: 0.5 },
                              ] as object
                            }
                          >
                            <Ionicons name="git-compare-outline" size={14} color={theme.accent} />
                            <Text
                              style={[styles.compareBtnText, { color: theme.accent }] as object}
                            >
                              Compare
                            </Text>
                          </Pressable>
                        ) : null}
                        {powerScore !== null ? (
                          <View
                            style={
                              [
                                styles.powerScorePill,
                                {
                                  backgroundColor: theme.accent + '1a',
                                  borderColor: theme.accent + '33',
                                },
                              ] as object
                            }
                          >
                            <Text style={[styles.powerScoreValue, { color: theme.accent }]}>
                              {powerScore}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View
                      style={
                        [styles.cardDivider, { backgroundColor: theme.accent + '22' }] as object
                      }
                    />
                    {isAdmin && statsEditing ? (
                      <StatEditList
                        stats={stats}
                        onPick={(field, current) => setEditTarget({ field, current })}
                      />
                    ) : (
                      <View style={styles.statBand}>
                        {STAT_CONFIG.map(({ key, label, color }, si) => {
                          if (statsGenerating || hydrating) {
                            return (
                              <View key={key} style={styles.bandCell}>
                                <SkeletonBlock
                                  opacity={skeletonOpacity}
                                  width={42}
                                  height={28}
                                  borderRadius={5}
                                />
                                <SkeletonBlock
                                  opacity={skeletonOpacity}
                                  width="70%"
                                  height={5}
                                  borderRadius={3}
                                />
                                <SkeletonBlock
                                  opacity={skeletonOpacity}
                                  width={28}
                                  height={9}
                                  borderRadius={3}
                                />
                              </View>
                            );
                          }
                          const raw = parseInt(
                            (stats.powerstats as Record<string, string>)[key] ?? '0',
                            10,
                          );
                          return (
                            <PowerStatCell
                              // Cascade: cells sweep in sequence.
                              delay={si * 90}
                              key={key}
                              value={isNaN(raw) ? null : raw}
                              label={label}
                              color={color}
                              median={STAT_MEDIANS[key]}
                            />
                          );
                        })}
                      </View>
                    )}
                    {!statsEditing && !statsGenerating ? (
                      <View
                        style={
                          [styles.powerFooter, { borderTopColor: theme.accent + '1f' }] as object
                        }
                      >
                        <View style={styles.medianLegend}>
                          <View style={styles.medianLegendTick} />
                          <Text style={styles.medianLegendText}>catalog median</Text>
                        </View>
                        {percentile != null && percentile > 0 ? (
                          <View
                            style={
                              [
                                styles.percentileBadge,
                                {
                                  backgroundColor: theme.accent + '14',
                                  borderColor: theme.accent + '3d',
                                },
                              ] as object
                            }
                          >
                            <Ionicons name="flash" size={11} color={theme.accent} />
                            <Text
                              style={
                                [styles.percentileBadgeText, { color: theme.accent }] as object
                              }
                            >
                              Stronger than {percentile}% of characters
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {/* Story */}
                  {(comicVineLoading || hydrating) && !details.summary ? (
                    <View style={styles.summaryBox}>
                      <SkeletonBlock
                        opacity={skeletonOpacity}
                        height={12}
                        style={{ marginBottom: 10 }}
                      />
                      <SkeletonBlock
                        opacity={skeletonOpacity}
                        height={12}
                        width="85%"
                        style={{ marginBottom: 10 }}
                      />
                      <SkeletonBlock opacity={skeletonOpacity} height={12} width="65%" />
                    </View>
                  ) : details.summary || details.hasBiography ? (
                    <Reveal instant={arrivedViaMorph}>
                      <PullQuoteBio
                        summary={details.summary ?? ''}
                        accent={theme.accent}
                        hasBiography={details.hasBiography}
                        onReadMore={() => router.push(`/biography/${id}`)}
                        onEdit={() =>
                          setEditTarget({ field: SUMMARY_FIELD, current: details.summary ?? null })
                        }
                      />
                    </Reveal>
                  ) : null}

                  {/* Abilities — power explainers fold in as the "Decoded" strip */}
                  <View nativeID="sec-abilities">
                    <Reveal instant={arrivedViaMorph}>
                      <WebAbilitiesCard
                        powers={details.powers}
                        loading={comicVineLoading}
                        skeletonOpacity={skeletonOpacity}
                        explainers={narrative?.powerExplainers ?? []}
                        accent={theme.accent}
                        onEdit={() =>
                          setEditTarget({
                            field: POWERS_FIELD,
                            current: details.powers?.length ? details.powers.join('\n') : null,
                          })
                        }
                      />
                    </Reveal>
                  </View>

                  {/* Enemies & Allies */}
                  {comicVineLoading ? (
                    <View style={styles.card}>
                      <SkeletonBlock
                        opacity={skeletonOpacity}
                        width="45%"
                        height={11}
                        borderRadius={4}
                        style={{ marginBottom: 10 }}
                      />
                      <View style={styles.cardDivider} />
                      <SkeletonBlock
                        opacity={skeletonOpacity}
                        width="25%"
                        height={10}
                        borderRadius={4}
                        style={{ marginBottom: 8 }}
                      />
                      <View style={styles.chipRow}>
                        {[72, 90, 60, 80, 68].map((w, i) => (
                          <SkeletonBlock
                            key={i}
                            opacity={skeletonOpacity}
                            width={w}
                            height={26}
                            borderRadius={20}
                          />
                        ))}
                      </View>
                    </View>
                  ) : enemyNames.length ||
                    allyNames.length ||
                    teammateNames.length ||
                    affiliations.length ? (
                    <Reveal instant={arrivedViaMorph}>
                      <View nativeID="sec-relations" style={styles.card}>
                        <Text style={styles.cardTitle}>Enemies, Allies &amp; Teams</Text>
                        <View style={styles.cardDivider} />
                        {/* Break out of the card's 20px padding so the strips align */}
                        <View style={{ marginHorizontal: -20 }}>
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
                        </View>
                        <SocialWebPreview
                          heroId={id}
                          accent={theme.accent}
                          onExplore={() =>
                            router.push(`/social-web/${id}` as Parameters<typeof router.push>[0])
                          }
                        />
                        {affiliations.length ? (
                          <View style={styles.affGroup}>
                            <Text style={styles.chipGroupLabel}>Affiliations</Text>
                            <View style={styles.chipRow}>
                              {affiliations.map((t) => {
                                const teamId = resolveTeamId(t);
                                if (!teamId) {
                                  return (
                                    <View key={t} style={styles.affChip}>
                                      <Text style={styles.affChipText}>{t}</Text>
                                    </View>
                                  );
                                }
                                return (
                                  <Pressable
                                    key={t}
                                    onPress={() =>
                                      router.push(
                                        `/team/${teamId}` as Parameters<typeof router.push>[0],
                                      )
                                    }
                                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                                      [
                                        styles.affChip,
                                        styles.affChipLink,
                                        hovered && (styles.affChipLinkHover as object),
                                      ] as object
                                    }
                                  >
                                    <Text
                                      style={[styles.affChipText, styles.affChipLinkText] as object}
                                    >
                                      {t}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        ) : null}
                      </View>
                    </Reveal>
                  ) : null}

                  {/* On screen */}
                  {comicVineLoading ? (
                    <View style={styles.card}>
                      <SkeletonBlock
                        opacity={skeletonOpacity}
                        width="30%"
                        height={11}
                        borderRadius={4}
                        style={{ marginBottom: 10 }}
                      />
                      <View style={styles.cardDivider} />
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {[0, 1, 2].map((i) => (
                          <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                            <SkeletonBlock
                              opacity={skeletonOpacity}
                              width={80}
                              height={120}
                              borderRadius={8}
                            />
                            <SkeletonBlock
                              opacity={skeletonOpacity}
                              width={60}
                              height={10}
                              borderRadius={4}
                            />
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : titles && titles.length > 0 ? (
                    (() => {
                      const groups = groupTitlesByMedia(titles);
                      return (
                        <Reveal instant={arrivedViaMorph}>
                          <View style={styles.card}>
                            {groups.film.length > 0 ? (
                              <>
                                <Text style={styles.cardTitle}>
                                  On Screen · {groups.film.length}
                                </Text>
                                <View style={styles.cardDivider} />
                                <MovieStrip
                                  titles={groups.film}
                                  totalCount={groups.film.length}
                                  contentInset={20}
                                  bleedMargin={20}
                                />
                              </>
                            ) : null}
                            {groups.tv.length > 0 ? (
                              <View style={groups.film.length > 0 ? { marginTop: 22 } : undefined}>
                                <Text style={styles.cardTitle}>
                                  Television · {groups.tv.length}
                                </Text>
                                <View style={styles.cardDivider} />
                                <MovieStrip
                                  titles={groups.tv}
                                  totalCount={groups.tv.length}
                                  contentInset={20}
                                  bleedMargin={20}
                                />
                              </View>
                            ) : null}
                          </View>
                        </Reveal>
                      );
                    })()
                  ) : null}

                  {/* Legend — debut, trivia, portrayals on one timeline */}
                  <View nativeID="sec-legend">
                    <Reveal instant={arrivedViaMorph}>
                      <LegendBand
                        accent={theme.accent}
                        accentWash={theme.accentWash}
                        firstIssue={view.firstIssue ?? null}
                        facts={narrative?.didYouKnow ?? []}
                        portrayals={portrayals}
                        onPressDebut={() =>
                          view.firstIssue &&
                          router.push(
                            `/issue/cvi:${view.firstIssue.id}` as Parameters<typeof router.push>[0],
                          )
                        }
                      />
                    </Reveal>
                  </View>

                  {/* In Print — debut feature + cover gallery */}
                  {comicVineLoading ? (
                    <View style={styles.card}>
                      <SkeletonBlock
                        opacity={skeletonOpacity}
                        width="30%"
                        height={11}
                        borderRadius={4}
                        style={{ marginBottom: 10 }}
                      />
                      <View style={styles.cardDivider} />
                      <View style={{ flexDirection: 'row', gap: 22 }}>
                        <SkeletonBlock
                          opacity={skeletonOpacity}
                          width={150}
                          height={220}
                          borderRadius={10}
                        />
                        <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
                          {[0, 1, 2, 3].map((i) => (
                            <SkeletonBlock
                              key={i}
                              opacity={skeletonOpacity}
                              width={80}
                              height={110}
                              borderRadius={8}
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                  ) : newIssues.length > 0 || (galleryImages && galleryImages.length > 0) ? (
                    <Reveal instant={arrivedViaMorph}>
                      <View nativeID="sec-print" style={styles.card}>
                        <View style={styles.inPrintHeader}>
                          <Text style={styles.cardTitle}>In Print</Text>
                          {view.firstIssue?.coverDate ? (
                            <Text style={styles.inPrintSince}>
                              Since {view.firstIssue.coverDate.slice(0, 4)}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.cardDivider} />
                        {newIssues.length > 0 ? (
                          <View style={{ marginHorizontal: -20, marginBottom: 6 }}>
                            <ComicCoverRail
                              comics={newIssues}
                              onLight
                              onIssuePress={(issueId) =>
                                router.push(
                                  `/issue/${issueId}` as Parameters<typeof router.push>[0],
                                )
                              }
                            />
                          </View>
                        ) : null}
                        <View style={styles.inPrintBody}>
                          {/* Gallery — character art + covers (multi-source);
                            the debut moved up into the Legend band */}
                          {galleryImages && galleryImages.length > 0 ? (
                            <View style={styles.inPrintGallery}>
                              <Text style={styles.inPrintGalleryLabel}>
                                Gallery · {galleryImages.length}
                              </Text>
                              {/* Filmstrip fade — the run reads as film running off-frame */}
                              <View
                                style={
                                  [
                                    { marginRight: -20 },
                                    {
                                      maskImage:
                                        'linear-gradient(90deg, black 82%, transparent 100%)',
                                      WebkitMaskImage:
                                        'linear-gradient(90deg, black 82%, transparent 100%)',
                                    },
                                  ] as object
                                }
                              >
                                <GalleryStrip
                                  images={galleryImages.map((g) => ({
                                    url: g.url,
                                    caption: g.caption,
                                  }))}
                                  onPress={(i) => {
                                    const issueId = galleryImages[i]?.issueId;
                                    if (issueId) {
                                      router.push(
                                        `/issue/cvi:${issueId}` as Parameters<
                                          typeof router.push
                                        >[0],
                                      );
                                      return;
                                    }
                                    setLightboxImages(
                                      galleryImages.map((g) => ({
                                        url: g.url,
                                        caption: g.caption,
                                      })),
                                    );
                                    setLightboxIndex(i);
                                  }}
                                />
                              </View>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </Reveal>
                  ) : null}

                  {/* Elsewhere — external links drop to a quiet footer register */}
                  {heroLinksHasContent(links) ? (
                    <Reveal instant={arrivedViaMorph}>
                      <View style={styles.linksFooter}>
                        <Text style={styles.linksFooterLabel}>Elsewhere</Text>
                        <HeroLinksRow links={links!} contentInset={0} />
                      </View>
                    </Reveal>
                  ) : null}
                </View>

                {/* Side column — overlapping portrait + quick facts */}
                <View style={[styles.sideCol, { marginTop: portraitOverlap }] as object}>
                  <View
                    style={
                      [
                        styles.portraitCard,
                        {
                          // Depth shadow + the character's accent halo.
                          boxShadow: `0 24px 52px rgba(11,24,32,0.30), 0 0 0 1px ${theme.accent}33, 0 18px 60px -18px ${theme.accentDeep}bb`,
                        },
                        portraitVT,
                      ] as object
                    }
                  >
                    <HeroImage
                      id={id}
                      name={stats.name}
                      imageUrl={stats.image.url ?? null}
                      portraitUrl={stats.image.portraitUrl ?? null}
                      contentFit="cover"
                      contentPosition={{ top: 0, left: '50%' }}
                      style={StyleSheet.absoluteFill}
                      recyclingKey={id}
                      // On a morph arrival, show the card's cached grid image
                      // (crisp) while the full-res loads; otherwise the blurhash
                      // covers a cold load. Either way the portrait never blanks.
                      placeholderUri={morphGridUri}
                      blurhash={heroRow?.portrait_blurhash}
                      // The portrait is the above-the-fold LCP element on the
                      // most-trafficked SEO page — fetch it at high priority so
                      // it isn't queued behind lazy/below-the-fold requests.
                      priority="high"
                    />
                    <View style={[styles.portraitOverlay, { pointerEvents: 'none' }] as object} />
                    <View
                      style={
                        [
                          styles.portraitNameOverlay,
                          { opacity: nameRevealed ? 1 : 0, pointerEvents: 'none' },
                        ] as object
                      }
                    >
                      <Text style={styles.portraitNameText}>{stats.name}</Text>
                      {stats.biography['full-name'] ? (
                        <Text style={styles.portraitNameSub}>{stats.biography['full-name']}</Text>
                      ) : null}
                    </View>
                    {user ? (
                      <Pressable
                        onPress={toggleFavourite}
                        disabled={favLoading}
                        aria-label={favourited ? 'Remove favourite' : 'Add favourite'}
                        style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
                          [
                            styles.portraitFav,
                            hovered && !pressed && (styles.portraitFavHover as object),
                            pressTransform({ hovered, pressed }),
                          ] as object
                        }
                      >
                        <HeartPop favourited={favourited} size={20} />
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.card}>
                    <View style={s2.cardHeadRow as object}>
                      <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
                        {factsEditing ? 'Edit details' : 'Quick Facts'}
                      </Text>
                      <WebSectionPencil
                        active={factsEditing}
                        onPress={() => setFactsEditing((s) => !s)}
                        label="Edit details"
                      />
                    </View>
                    <View style={styles.cardDivider} />
                    {factsEditing ? (
                      <View>
                        {DOSSIER_GROUPS.map((group) => (
                          <Fragment key={group.key}>
                            <Text style={s2.editGroupLabel}>{group.label}</Text>
                            {group.fields.map((f) => {
                              const v = editValues[f.field];
                              const filled = !isBlankValue(v);
                              return (
                                <Pressable
                                  key={f.field}
                                  onPress={() =>
                                    setEditTarget({
                                      field: f,
                                      current: filled ? (v ?? null) : null,
                                    })
                                  }
                                  style={s2.editRow as object}
                                >
                                  <Text style={s2.editRowLabel}>{f.label}</Text>
                                  <View style={s2.editRowRight as object}>
                                    <Text
                                      style={(filled ? s2.editRowValue : s2.editRowAdd) as object}
                                      numberOfLines={1}
                                    >
                                      {filled ? v : 'Add'}
                                    </Text>
                                    <Ionicons
                                      name={filled ? 'pencil' : 'add'}
                                      size={14}
                                      color={COLORS.orange}
                                    />
                                  </View>
                                </Pressable>
                              );
                            })}
                          </Fragment>
                        ))}
                        <Text style={s2.editGroupLabel}>Trivia</Text>
                        <Pressable
                          onPress={() => setEditTarget({ field: null, current: null })}
                          style={s2.editRow as object}
                        >
                          <Text style={s2.editRowLabel}>Did You Know fact</Text>
                          <View style={s2.editRowRight as object}>
                            <Text style={s2.editRowAdd as object}>Add</Text>
                            <Ionicons name="bulb-outline" size={14} color={COLORS.orange} />
                          </View>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.factGrid}>
                        {(() => {
                          const rows = (
                            [
                              {
                                icon: 'shield-half-outline',
                                label: 'Alignment',
                                value: stats.biography.alignment,
                                accent: alignmentColor,
                              },
                              { icon: 'planet-outline', label: 'Origin', value: details.origin },
                              {
                                icon: genderIcon(stats.appearance.gender),
                                label: 'Gender',
                                value: stats.appearance.gender,
                              },
                              {
                                icon: 'people-outline',
                                label: 'Race',
                                value: stats.appearance.race,
                              },
                              {
                                icon: 'swap-vertical-outline',
                                label: 'Height',
                                value: stats.appearance.height.join(' / '),
                              },
                              {
                                icon: 'barbell-outline',
                                label: 'Weight',
                                value: stats.appearance.weight.join(' / '),
                              },
                              {
                                icon: 'id-card-outline',
                                label: 'Full name',
                                value: stats.biography['full-name'],
                                wide: true,
                              },
                              {
                                icon: 'location-outline',
                                label: 'Place of birth',
                                value: stats.biography['place-of-birth'],
                                wide: true,
                              },
                              {
                                icon: 'briefcase-outline',
                                label: 'Occupation',
                                value: stats.work.occupation,
                                wide: true,
                              },
                              {
                                icon: 'business-outline',
                                label: 'Base',
                                value: stats.work.base,
                                wide: true,
                              },
                            ] as {
                              icon: IoniconName;
                              label: string;
                              value: string | null | undefined;
                              wide?: boolean;
                              accent?: string;
                            }[]
                          ).filter((r) => cleanFact(r.value));
                          return rows.map((r) => (
                            <FactTile
                              key={r.label}
                              icon={r.icon}
                              label={r.label}
                              value={r.value}
                              wide={r.wide}
                              accent={r.accent}
                              iconTint={theme.accent}
                            />
                          ));
                        })()}
                      </View>
                    )}
                  </View>

                  {/* Debut — era summary folded into the sidebar */}
                  {narrative?.eraSummary ? (
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Debut</Text>
                      <View style={styles.cardDivider} />
                      <Text style={styles.eraText}>{narrative.eraSummary}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {family.length > 0 ? (
                <View style={styles.familyBand}>
                  <FamilyCanvas
                    heroName={stats.name}
                    heroImage={stats.image.portraitUrl || stats.image.url || null}
                    heroAvatar={heroRow?.avatar_url ?? null}
                    heroId={heroRow?.id ?? null}
                    members={family}
                    houses={heroHouses}
                  />
                </View>
              ) : null}
            </>
          ) : (
            /* ── Mobile: native-style immersive single scroll ── */
            <View>
              {/* Immersive portrait header */}
              <View style={styles.mHero}>
                {/* The morph tag lives on an IMAGE-ONLY layer, not the header:
                    tagging the whole header baked the identity overlay (name,
                    chips, vitals) into the transition snapshot, so a wall of
                    tiny text flew inside the growing box and the two snapshots
                    ghosted. Image→image keeps the flight clean; the identity
                    fades in place via the root cross-fade. */}
                <View style={[StyleSheet.absoluteFill as object, portraitVT] as object}>
                  <HeroImage
                    id={id}
                    name={stats.name}
                    imageUrl={stats.image.url ?? null}
                    portraitUrl={stats.image.portraitUrl ?? null}
                    contentFit="cover"
                    contentPosition="top"
                    style={StyleSheet.absoluteFill}
                    recyclingKey={id}
                    // On a morph arrival, show the card's cached grid image (crisp)
                    // while the full-res loads; blurhash covers a cold load.
                    placeholderUri={morphGridUri}
                    blurhash={heroRow?.portrait_blurhash}
                    priority="high"
                  />
                </View>
                <View style={[styles.mScrimTop, { pointerEvents: 'none' }] as object} />
                <View style={[styles.mScrimBottom, { pointerEvents: 'none' }] as object} />
                {/* Character accent bloom rising from the sheet edge */}
                <View
                  style={
                    [
                      StyleSheet.absoluteFill,
                      {
                        backgroundImage: `radial-gradient(90% 55% at 50% 100%, ${theme.accentDeep}66, transparent 72%)`,
                        pointerEvents: 'none',
                      },
                    ] as object
                  }
                />

                <View style={styles.mControls}>
                  <Pressable
                    onPress={goBack}
                    hitSlop={GLASS_SLOP}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                      [styles.glassIconBtn, hovered && (styles.glassBtnHover as object)] as object
                    }
                  >
                    <Ionicons name="arrow-back" size={18} color={COLORS.beige} />
                  </Pressable>
                  {user ? (
                    <Pressable
                      onPress={toggleFavourite}
                      disabled={favLoading}
                      hitSlop={GLASS_SLOP}
                      accessibilityRole="button"
                      accessibilityLabel={
                        favourited ? 'Remove from favourites' : 'Add to favourites'
                      }
                      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                        [styles.glassIconBtn, hovered && (styles.glassBtnHover as object)] as object
                      }
                    >
                      <Ionicons
                        name={favourited ? 'heart' : 'heart-outline'}
                        size={18}
                        color={favourited ? COLORS.red : 'rgba(245,235,220,0.85)'}
                      />
                    </Pressable>
                  ) : null}
                </View>

                <View
                  style={
                    [
                      styles.mIdentity,
                      // Morph arrivals: the identity holds while the portrait
                      // flies, then fades up just as it lands — text lands ON
                      // its backdrop instead of floating over the flight.
                      arrivedViaMorph && !prefersReducedMotion()
                        ? ({
                            animation: 'char-sheet-in 220ms cubic-bezier(0.2, 0, 0, 1) 140ms both',
                          } as object)
                        : null,
                    ] as object
                  }
                >
                  <UniverseEyebrow
                    publisher={stats.biography.publisher}
                    franchise={heroRow?.franchise}
                    textStyle={styles.mEyebrow}
                  />
                  <Text style={styles.mName}>{stats.name}</Text>
                  {hydrating ? (
                    <SkeletonBlock
                      opacity={skeletonOpacity}
                      width={150}
                      height={14}
                      borderRadius={4}
                      dark
                      style={{ marginTop: 4 }}
                    />
                  ) : alias ? (
                    <Text style={styles.mAlias}>{alias}</Text>
                  ) : null}

                  {/* Theme trait chips — identity, so they live with the name.
                      While hydrating, reserve one compact pill row so the
                      header doesn't grow when the tags land. */}
                  {hydrating ? (
                    <View style={[styles.mStageTraits, { flexDirection: 'row', gap: 8 }] as object}>
                      {[72, 94, 64].map((w, i) => (
                        <SkeletonBlock
                          key={i}
                          opacity={skeletonOpacity}
                          width={w}
                          height={23}
                          borderRadius={12}
                          dark
                        />
                      ))}
                    </View>
                  ) : narrative && narrative.tags.length > 0 ? (
                    <View style={styles.mStageTraits}>
                      <TraitBand tags={narrative.tags} onInk compact />
                    </View>
                  ) : null}

                  <View style={styles.mVitals}>
                    {hydrating ? (
                      // Reserve the vitals row footprint (numbers count up when
                      // the real values land).
                      <>
                        {[64, 88, 60].map((w, i) => (
                          <SkeletonBlock
                            key={i}
                            opacity={skeletonOpacity}
                            width={w}
                            height={34}
                            borderRadius={6}
                            dark
                          />
                        ))}
                      </>
                    ) : null}
                    {!hydrating && powerTotal > 0 ? (
                      <View style={styles.mVitalItem}>
                        <VitalCount value={powerTotal} style={styles.mVitalVal as object} />
                        <Text style={styles.mVitalLabel}>Power</Text>
                      </View>
                    ) : null}
                    {(details.issueCount ?? 0) > 0 ? (
                      <>
                        <View style={styles.mVitalDiv} />
                        <View style={styles.mVitalItem}>
                          <VitalCount
                            value={details.issueCount!}
                            style={styles.mVitalVal as object}
                          />
                          <Text style={styles.mVitalLabel}>Appearances</Text>
                        </View>
                      </>
                    ) : null}
                    {(details.movieCount ?? details.movies?.length ?? 0) > 0 ? (
                      <>
                        <View style={styles.mVitalDiv} />
                        <View style={styles.mVitalItem}>
                          <VitalCount
                            value={details.movieCount ?? details.movies!.length}
                            style={styles.mVitalVal as object}
                          />
                          <Text style={styles.mVitalLabel}>Movies</Text>
                        </View>
                      </>
                    ) : null}
                  </View>

                  <View style={styles.mBottomRow}>
                    {details.creators?.length ? (
                      <Text style={styles.mCreatedBy} numberOfLines={2}>
                        Created by {details.creators.join(' & ')}
                      </Text>
                    ) : null}
                    {alignmentLabel || originLabel ? (
                      <View style={styles.mBadgeRow}>
                        {alignmentLabel ? (
                          <View style={[styles.mBadge, { borderColor: alignmentColor + '99' }]}>
                            <Text style={[styles.mBadgeText, { color: alignmentColor }]}>
                              {alignmentLabel}
                            </Text>
                          </View>
                        ) : null}
                        {originLabel ? (
                          <View style={styles.mBadge}>
                            <Text style={styles.mBadgeText}>{originLabel}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Beige content sheet rising over the hero */}
              <View
                style={
                  [
                    styles.mSheet,
                    {
                      // A whisper of the character's colour at the sheet's
                      // crown — the page carries their temperature, not just
                      // their trims.
                      backgroundImage: `radial-gradient(120% 340px at 50% 0%, ${theme.accentWash} 0%, rgba(255,255,255,0) 70%)`,
                    },
                    // Morph arrivals: the sheet holds back a beat, then rises in
                    // as the portrait lands. Without this its dark-on-beige text
                    // cross-faded over the departing grid for the whole flight —
                    // two worlds interleaved. The delay clears the portrait's
                    // 250ms flight; `both` keeps it hidden until then.
                    arrivedViaMorph && !prefersReducedMotion()
                      ? ({
                          animation: 'char-sheet-in 240ms cubic-bezier(0.2, 0, 0, 1) 180ms both',
                        } as object)
                      : null,
                  ] as object
                }
              >
                {(comicVineLoading || hydrating) && !details.summary ? (
                  <View style={styles.mBlock}>
                    <SkeletonBlock
                      opacity={skeletonOpacity}
                      height={12}
                      style={{ marginBottom: 10 }}
                    />
                    <SkeletonBlock
                      opacity={skeletonOpacity}
                      height={12}
                      width="85%"
                      style={{ marginBottom: 10 }}
                    />
                    <SkeletonBlock opacity={skeletonOpacity} height={12} width="65%" />
                  </View>
                ) : details.summary || details.hasBiography ? (
                  <View style={styles.mBlock}>
                    <PullQuoteBio
                      flat
                      summary={details.summary ?? ''}
                      accent={theme.accent}
                      hasBiography={details.hasBiography}
                      onReadMore={() => router.push(`/biography/${id}`)}
                      onEdit={() =>
                        setEditTarget({ field: SUMMARY_FIELD, current: details.summary ?? null })
                      }
                    />
                  </View>
                ) : null}

                {/* Power Profile — card grammar with the accent crown wash */}
                <View style={[styles.mBlock, styles.mPowerBand] as object}>
                  <View style={styles.mStatTitleRow}>
                    <Text style={styles.mSectionTitle}>Power Profile</Text>
                    {view.statsSource === 'ai' ? (
                      <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>AI</Text>
                      </View>
                    ) : null}
                    {isAdmin ? (
                      <WebSectionPencil
                        active={statsEditing}
                        onPress={() => setStatsEditing((s) => !s)}
                        label="Edit power stats"
                      />
                    ) : null}
                  </View>
                  <View
                    style={
                      [styles.mSectionDivider, { backgroundColor: theme.accent + '22' }] as object
                    }
                  />
                  {isAdmin && statsEditing ? (
                    <StatEditList
                      stats={stats}
                      onPick={(field, current) => setEditTarget({ field, current })}
                    />
                  ) : (
                    <View style={styles.mStatRows}>
                      {[STAT_CONFIG.slice(0, 3), STAT_CONFIG.slice(3)].map((row, ri) => (
                        <View key={ri} style={styles.statBand}>
                          {row.map(({ key, label, color }, ci) => {
                            if (statsGenerating || hydrating) {
                              return (
                                <View key={key} style={styles.bandCell}>
                                  <SkeletonBlock
                                    opacity={skeletonOpacity}
                                    width={42}
                                    height={28}
                                    borderRadius={5}
                                  />
                                  <SkeletonBlock
                                    opacity={skeletonOpacity}
                                    width="70%"
                                    height={5}
                                    borderRadius={3}
                                  />
                                  <SkeletonBlock
                                    opacity={skeletonOpacity}
                                    width={28}
                                    height={9}
                                    borderRadius={3}
                                  />
                                </View>
                              );
                            }
                            const raw = parseInt(
                              (stats.powerstats as Record<string, string>)[key] ?? '0',
                              10,
                            );
                            return (
                              <PowerStatCell
                                delay={(ri * 3 + ci) * 90}
                                key={key}
                                value={isNaN(raw) ? null : raw}
                                label={label}
                                color={color}
                                median={STAT_MEDIANS[key]}
                              />
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  )}
                  {percentile != null || powerScore !== null || statsGenerating ? (
                    <View style={styles.mStatFooter}>
                      {percentile != null && percentile > 0 ? (
                        <View
                          style={
                            [
                              styles.percentileBadge,
                              {
                                backgroundColor: theme.accent + '1a',
                                borderColor: theme.accent + '40',
                              },
                            ] as object
                          }
                        >
                          <Ionicons name="flash" size={11} color={theme.accent} />
                          <Text
                            style={[styles.percentileBadgeText, { color: theme.accent }] as object}
                          >
                            Stronger than {percentile}% of characters
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.mStatFooterRight}>
                        {powerScore !== null ? (
                          <View
                            style={
                              [
                                styles.powerScorePill,
                                {
                                  backgroundColor: theme.accent + '1a',
                                  borderColor: theme.accent + '33',
                                },
                              ] as object
                            }
                          >
                            <Text style={[styles.powerScoreValue, { color: theme.accent }]}>
                              {powerScore}
                            </Text>
                          </View>
                        ) : null}
                        {powerScore !== null || statsGenerating ? (
                          <Pressable
                            onPress={() =>
                              !statsGenerating &&
                              router.push(
                                `/compare/${id}/pick?name=${encodeURIComponent(stats.name)}`,
                              )
                            }
                            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                              [
                                styles.compareBtn,
                                {
                                  borderColor: theme.accent + '40',
                                  backgroundColor: theme.accent + '0f',
                                },
                                hovered &&
                                  !statsGenerating && {
                                    backgroundColor: theme.accent + '1f',
                                    borderColor: theme.accent + '80',
                                  },
                                statsGenerating && { opacity: 0.5 },
                              ] as object
                            }
                          >
                            <Ionicons name="git-compare-outline" size={14} color={theme.accent} />
                            <Text
                              style={[styles.compareBtnText, { color: theme.accent }] as object}
                            >
                              Compare
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* Signature tier headlines; AbilitiesSection (shared with
                    native) keeps the full categorized grid below */}
                {!comicVineLoading && details.powers && details.powers.length > 0 ? (
                  <Reveal instant={arrivedViaMorph}>
                    <View style={styles.mBlock}>
                      <SignaturePowerTiles
                        powers={details.powers}
                        explainers={narrative?.powerExplainers ?? []}
                        accent={theme.accent}
                      />
                    </View>
                  </Reveal>
                ) : null}

                {/* Abilities grid — blurbs live on the signature tiles above,
                    so the shared section's decoded strip stays empty here */}
                <AbilitiesSection
                  powers={details.powers}
                  loading={comicVineLoading}
                  explainers={[]}
                  onEdit={() =>
                    setEditTarget({
                      field: POWERS_FIELD,
                      current: details.powers?.length ? details.powers.join('\n') : null,
                    })
                  }
                />

                {/* Legend — debut, trivia, portrayals on one timeline */}
                <Reveal instant={arrivedViaMorph}>
                  <View style={styles.mBlock}>
                    <LegendBand
                      flat
                      accent={theme.accent}
                      accentWash={theme.accentWash}
                      firstIssue={view.firstIssue ?? null}
                      facts={narrative?.didYouKnow ?? []}
                      portrayals={portrayals}
                      onPressDebut={() =>
                        view.firstIssue &&
                        router.push(
                          `/issue/cvi:${view.firstIssue.id}` as Parameters<typeof router.push>[0],
                        )
                      }
                    />
                  </View>
                </Reveal>

                {/* Family tree */}
                {family.length > 0 ? (
                  <View style={styles.mFamilyBlock}>
                    <FamilyCanvas
                      heroName={stats.name}
                      heroImage={stats.image.portraitUrl || stats.image.url || null}
                      heroAvatar={heroRow?.avatar_url ?? null}
                      heroId={heroRow?.id ?? null}
                      members={family}
                      houses={heroHouses}
                    />
                  </View>
                ) : null}

                {/* Enemies & Allies */}
                {!comicVineLoading &&
                (enemyNames.length || allyNames.length || teammateNames.length) ? (
                  <Reveal instant={arrivedViaMorph}>
                    <View style={styles.mSection}>
                      <View style={styles.mSectionHead}>
                        <Text style={styles.mSectionTitle}>Enemies, Allies &amp; Teams</Text>
                        <View style={styles.mSectionDivider} />
                      </View>
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
                      <View style={styles.mSocialWeb}>
                        <SocialWebPreview
                          heroId={id}
                          accent={theme.accent}
                          onExplore={() =>
                            router.push(`/social-web/${id}` as Parameters<typeof router.push>[0])
                          }
                        />
                      </View>
                    </View>
                  </Reveal>
                ) : null}

                {/* On Screen — film + TV grouped in one section, mirroring web desktop */}
                {titles && titles.length > 0
                  ? (() => {
                      const groups = groupTitlesByMedia(titles);
                      if (groups.film.length === 0 && groups.tv.length === 0) return null;
                      return (
                        <View style={styles.mSection}>
                          {groups.film.length > 0 ? (
                            <>
                              <View style={styles.mSectionHead}>
                                <Text style={styles.mSectionTitle}>
                                  On Screen · {groups.film.length}
                                </Text>
                                <View style={styles.mSectionDivider} />
                              </View>
                              <View style={styles.mRail}>
                                <MovieStrip
                                  titles={groups.film}
                                  totalCount={groups.film.length}
                                  contentInset={20}
                                  bleedMargin={20}
                                />
                              </View>
                            </>
                          ) : null}
                          {groups.tv.length > 0 ? (
                            <View style={groups.film.length > 0 ? styles.mSubBlock : undefined}>
                              <View style={styles.mSectionHead}>
                                <Text style={styles.mSectionTitle}>
                                  Television · {groups.tv.length}
                                </Text>
                                <View style={styles.mSectionDivider} />
                              </View>
                              <View style={styles.mRail}>
                                <MovieStrip
                                  titles={groups.tv}
                                  totalCount={groups.tv.length}
                                  contentInset={20}
                                  bleedMargin={20}
                                />
                              </View>
                            </View>
                          ) : null}
                        </View>
                      );
                    })()
                  : null}

                {/* On shelves now — recent issues featuring this character */}
                {/* In Print — the page's print footprint as ONE dense band:
                    this week's issues + the art gallery under a single title,
                    with the dossier's small-caps sub-label grammar. */}
                {newIssues.length > 0 || (galleryImages && galleryImages.length > 0) ? (
                  <View style={styles.mSection}>
                    <View style={styles.mSectionHead}>
                      <Text style={styles.mSectionTitle}>In Print</Text>
                      <View style={styles.mSectionDivider} />
                    </View>
                    {newIssues.length > 0 ? (
                      <>
                        <Text style={styles.mSubLabel}>This week</Text>
                        <ComicCoverRail
                          hideHeader
                          comics={newIssues}
                          onLight
                          onIssuePress={(issueId) =>
                            router.push(`/issue/${issueId}` as Parameters<typeof router.push>[0])
                          }
                        />
                      </>
                    ) : null}
                    {galleryImages && galleryImages.length > 0 ? (
                      <>
                        <Text
                          style={
                            [styles.mSubLabel, newIssues.length > 0 && { marginTop: 18 }] as object
                          }
                        >
                          Gallery · {galleryImages.length}
                        </Text>
                        <View>
                          <GalleryStrip
                            images={galleryImages.map((g) => ({ url: g.url, caption: g.caption }))}
                            onPress={(i) => {
                              const issueId = galleryImages[i]?.issueId;
                              if (issueId) {
                                router.push(
                                  `/issue/cvi:${issueId}` as Parameters<typeof router.push>[0],
                                );
                                return;
                              }
                              setLightboxImages(
                                galleryImages.map((g) => ({ url: g.url, caption: g.caption })),
                              );
                              setLightboxIndex(i);
                            }}
                          />
                        </View>
                      </>
                    ) : null}
                  </View>
                ) : null}

                {/* Dossier — Profile / Appearance / Connections + debut, folded
                  into one collapsed-by-default card to match the native screen. */}
                <View style={styles.mBlock}>
                  <MobileDossier
                    stats={stats}
                    teams={details.teams}
                    eraSummary={narrative?.eraSummary}
                    editValues={editValues}
                    onEditField={(field, current) => setEditTarget({ field, current })}
                  />
                </View>

                {/* Elsewhere — external links drop to a quiet footer register */}
                {heroLinksHasContent(links) ? (
                  <Reveal instant={arrivedViaMorph}>
                    <View style={[styles.mBlock, styles.linksFooter] as object}>
                      <Text style={styles.linksFooterLabel}>Elsewhere</Text>
                      <HeroLinksRow links={links!} contentInset={0} />
                    </View>
                  </Reveal>
                ) : null}
              </View>
            </View>
          )}

          {/* Open invitation to contribute — expands into a small menu of the
              contributions not tied to a section (a fact, or a report). */}
          <View style={s2.contributeFooter as object}>
            <Pressable
              style={s2.contributeBtn as object}
              onPress={() => setContributeMenu((o) => !o)}
            >
              <Ionicons name="sparkles-outline" size={15} color={COLORS.orange} />
              <Text style={s2.contributeBtnText as object}>Contribute to this character</Text>
              <Ionicons
                name={contributeMenu ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={COLORS.orange}
              />
            </Pressable>
            {contributeMenu ? (
              <View style={s2.contributeMenu as object}>
                <Pressable
                  style={s2.contributeMenuItem as object}
                  onPress={() => {
                    setContributeMenu(false);
                    setEditTarget({ field: null, current: null });
                  }}
                >
                  <Ionicons name="bulb-outline" size={17} color={COLORS.navy} />
                  <Text style={s2.contributeMenuText as object}>Add a “Did You Know” fact</Text>
                </Pressable>
                <View style={s2.contributeMenuDivider as object} />
                <Pressable
                  style={s2.contributeMenuItem as object}
                  onPress={() => {
                    setContributeMenu(false);
                    setReportCtx({ context: 'page' });
                  }}
                >
                  <Ionicons name="flag-outline" size={17} color={COLORS.navy} />
                  <Text style={s2.contributeMenuText as object}>Report a problem</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        {/* Close the paper sheet onto the ink floor — the page must END on ink
            (canvas colour) so the iOS toolbar frosts dark in every scroll state.
            See PageEndCap for the full why. */}
        <PageEndCap />

        <ContributeSheet
          visible={editTarget !== null}
          onClose={() => setEditTarget(null)}
          heroId={stats.id}
          heroName={stats.name}
          field={editTarget?.field ?? null}
          report={editTarget?.report ?? false}
          currentValue={editTarget?.current ?? null}
          user={user}
          isAdmin={isAdmin}
          priorCount={0}
          onRequestSignIn={() => router.push(loginHref(pathname))}
          onSubmitted={() => {
            if (isAdmin) reloadHero();
          }}
        />
        <ReportSheet
          visible={reportCtx !== null}
          onClose={() => setReportCtx(null)}
          heroId={stats.id}
          heroName={stats.name}
          context={reportCtx?.context ?? 'page'}
          imageUrl={reportCtx?.imageUrl ?? null}
          portraitUrl={heroPortraitUrl}
          user={user}
          onRequestSignIn={() => router.push(loginHref(pathname))}
        />
        {/* end mobile */}
      </View>
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
      {/* Crossfade reveal: the real page sits settled underneath while the same
          skeleton dissolves off the top of it — so placeholders resolve in place
          instead of the body hard-cutting in. Only mounts the one transition tick
          after data lands (and only if the skeleton was actually shown). */}
      {/* Plain cold loads only — morph arrivals hydrate in place, no overlay. */}
      {coldPhase === 'crossfade' && !morphArt ? (
        <FadeOutSkeleton>
          <CharacterSkeleton isDesktop={isDesktop} showHeart={!!user} stageHeight={stageHeight} />
        </FadeOutSkeleton>
      ) : null}
    </>
  );
}

// ── Web abilities card — categorized power profile (card-styled) ─────────────
function AbilitiesHead({ onEdit }: { onEdit?: () => void }) {
  return (
    <>
      <View style={s2.cardHeadRow as object}>
        <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Abilities</Text>
        {onEdit ? <WebSectionPencil label="Edit powers" onPress={onEdit} /> : null}
      </View>
      <View style={styles.cardDivider} />
    </>
  );
}

function WebAbilitiesCard({
  powers,
  loading,
  skeletonOpacity,
  explainers = [],
  accent,
  onEdit,
}: {
  powers: string[] | null;
  loading: boolean;
  skeletonOpacity: ReturnType<typeof useSkeletonAnim>;
  explainers?: PowerExplainer[];
  accent: string;
  onEdit?: () => void;
}) {
  // Pristine when empty — the card only appears once a hero has abilities.
  if (!loading && (!powers || powers.length === 0)) return null;

  // Signature tiles headline the decoded powers; the categorized grid below
  // stays complete so groups keep their true shape.
  const hasSignature = pickSignaturePowers(powers, explainers).length > 0;
  const groups = powers ? groupPowers(powers) : [];

  return (
    <View style={styles.card}>
      {loading && !powers ? (
        <>
          <SkeletonBlock
            opacity={skeletonOpacity}
            width={80}
            height={11}
            style={{ marginBottom: 10 }}
          />
          <View style={{ height: 1, backgroundColor: '#ede5da', marginBottom: 14 }} />
          {[0, 1].map((b) => (
            <View key={b} style={{ marginBottom: 16 }}>
              <SkeletonBlock
                opacity={skeletonOpacity}
                width={96}
                height={11}
                style={{ marginBottom: 12 }}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                {[100, 132, 88].map((w, i) => (
                  <SkeletonBlock key={i} opacity={skeletonOpacity} width={w} height={16} />
                ))}
              </View>
            </View>
          ))}
        </>
      ) : powers && powers.length > 0 ? (
        <>
          <AbilitiesHead onEdit={onEdit} />
          {hasSignature ? (
            <View style={styles.signatureWrap}>
              <SignaturePowerTiles powers={powers} explainers={explainers} accent={accent} />
            </View>
          ) : null}
          {groups.map((g, gi) => (
            <View
              key={g.category}
              style={[styles.abilityGroup, gi === groups.length - 1 && { marginBottom: 0 }]}
            >
              <View style={styles.abilityGroupHead}>
                <View style={[styles.abilityGroupMarker, { backgroundColor: g.color }]} />
                <Text style={[styles.abilityGroupLabel, { color: g.color }]}>{g.label}</Text>
                <Text style={styles.abilityGroupCount}>{g.items.length}</Text>
              </View>
              <View style={styles.abilityItems}>
                {g.items.map((it, i) => (
                  <View key={`${i}-${it.name}`} style={styles.abilityItem}>
                    <MaterialCommunityIcons
                      name={it.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                      size={15}
                      color={g.color}
                    />
                    <Text style={styles.abilityItemName}>{it.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

// ── Character page skeleton ──────────────────────────────────────────────────
function CharacterSkeleton({
  isDesktop,
  showHeart,
  stageHeight: stageHeightProp,
  onStageHeight,
}: {
  isDesktop: boolean;
  showHeart: boolean;
  /** Parent-owned stage measurement. Sharing one value across the loading
   *  skeleton, the real page, and the crossfade overlay keeps the overlapping
   *  portrait anchored to the SAME top at every handoff — three independent
   *  measurements each spend their first frame at the fallback offset and the
   *  portrait visibly jumps. */
  stageHeight?: number;
  onStageHeight?: (h: number) => void;
}) {
  const opacity = useSkeletonAnim();

  const divider = <View style={{ height: 1, backgroundColor: '#ede5da', marginBottom: 14 }} />;

  // Measure the stage so the overlapping side portrait anchors to the same
  // constant top the real page uses — keeps the skeleton→content swap seamless.
  // Prefer the parent-owned measurement (shared with the real page) so every
  // instance agrees; the local state is the standalone fallback.
  const [localStageHeight, setLocalStageHeight] = useState(0);
  const stageHeight = stageHeightProp || localStageHeight;
  const portraitOverlap = stageHeight
    ? -Math.min(300, Math.max(0, stageHeight - (TOPBAR_HEIGHT + 8)))
    : -300;

  // Desktop power-stat band — 6 columns mirroring the live statBand.
  const statBandCard = (
    <View style={sk.card}>
      <View style={sk.statHeaderRow}>
        <SkeletonBlock opacity={opacity} width={90} height={11} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Compare button is always shown (active or disabled) */}
          <SkeletonBlock opacity={opacity} width={96} height={30} borderRadius={20} />
          <SkeletonBlock opacity={opacity} width={40} height={24} borderRadius={12} />
        </View>
      </View>
      {divider}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
            <SkeletonBlock opacity={opacity} width={42} height={28} borderRadius={5} />
            <SkeletonBlock opacity={opacity} width="70%" height={5} borderRadius={3} />
            <SkeletonBlock opacity={opacity} width={44} height={9} borderRadius={3} />
          </View>
        ))}
      </View>
    </View>
  );

  // Summary box — three text lines, matching the live summary loading state.
  const summaryCard = (
    <View style={sk.summaryBox}>
      <SkeletonBlock opacity={opacity} height={12} style={{ marginBottom: 10 }} />
      <SkeletonBlock opacity={opacity} width="85%" height={12} style={{ marginBottom: 10 }} />
      <SkeletonBlock opacity={opacity} width="65%" height={12} />
    </View>
  );

  // Abilities — title + two categorized groups, matching WebAbilitiesCard's loader.
  const abilitiesCard = (
    <View style={sk.card}>
      <SkeletonBlock opacity={opacity} width={80} height={11} style={{ marginBottom: 10 }} />
      {divider}
      {[0, 1].map((b) => (
        <View key={b} style={{ marginBottom: b === 1 ? 0 : 16 }}>
          <SkeletonBlock opacity={opacity} width={96} height={11} style={{ marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {[100, 132, 88].map((w, i) => (
              <SkeletonBlock key={i} opacity={opacity} width={w} height={16} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  // Family — title + a few centered tier rows, matching the live family card shape.
  const familyCard = (
    <View style={sk.card}>
      <SkeletonBlock opacity={opacity} width={70} height={11} style={{ marginBottom: 10 }} />
      {divider}
      <View style={{ alignItems: 'center', gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[120, 96].map((w, i) => (
            <SkeletonBlock key={i} opacity={opacity} width={w} height={42} borderRadius={13} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SkeletonBlock opacity={opacity} width={150} height={56} borderRadius={15} />
          <SkeletonBlock opacity={opacity} width={120} height={56} borderRadius={14} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[110, 110].map((w, i) => (
            <SkeletonBlock key={i} opacity={opacity} width={w} height={46} borderRadius={14} />
          ))}
        </View>
      </View>
    </View>
  );

  // First appearance — horizontal cover + meta, matching the live loading card.
  const firstAppearanceCard = (
    <View style={sk.card}>
      <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
        <SkeletonBlock opacity={opacity} width={130} height={190} borderRadius={8} />
        <View style={{ flex: 1, gap: 10 }}>
          <SkeletonBlock opacity={opacity} width="40%" height={10} borderRadius={4} />
          <SkeletonBlock opacity={opacity} width={80} height={2} borderRadius={1} />
          <SkeletonBlock opacity={opacity} width="55%" height={36} borderRadius={5} />
          <SkeletonBlock opacity={opacity} width="80%" height={12} borderRadius={4} />
        </View>
      </View>
    </View>
  );

  // Quick Facts — title + a stack of label/value info rows for the side rail.
  const quickFactsCard = (
    <View style={sk.card}>
      <SkeletonBlock opacity={opacity} width={80} height={11} style={{ marginBottom: 10 }} />
      {divider}
      {[120, 80, 150, 64, 70, 56, 96, 110].map((w, i) => (
        <View key={i} style={sk.infoRowSkel}>
          <SkeletonBlock opacity={opacity} width={58} height={10} borderRadius={4} />
          <SkeletonBlock opacity={opacity} width={w} height={10} borderRadius={4} />
        </View>
      ))}
    </View>
  );

  return (
    <View style={[sk.scroll, sk.scrollContent] as object}>
      {/* Desktop: identity stage. Mobile uses an immersive portrait skeleton. */}
      {isDesktop ? (
        <View
          onLayout={(e) => {
            setLocalStageHeight(e.nativeEvent.layout.height);
            onStageHeight?.(e.nativeEvent.layout.height);
          }}
          style={[sk.stage, { paddingTop: TOPBAR_HEIGHT + 32, paddingBottom: 26 }]}
        >
          <View style={[sk.stageInner, { paddingHorizontal: 24 }]}>
            {/* Title hugs the left; meta block fills the band beside the portrait. */}
            <View style={sk.identityColDesktop}>
              <View style={sk.identityRow}>
                <View style={{ flexShrink: 1, minWidth: 0 }}>
                  <SkeletonBlock
                    opacity={opacity}
                    width={90}
                    height={11}
                    borderRadius={4}
                    dark
                    style={{ marginBottom: 10 }}
                  />
                  <SkeletonBlock
                    opacity={opacity}
                    width={320}
                    height={46}
                    borderRadius={8}
                    dark
                    style={{ marginBottom: 10 }}
                  />
                  <SkeletonBlock opacity={opacity} width={150} height={15} borderRadius={4} dark />
                </View>
                <View style={{ alignItems: 'flex-end', gap: 12, marginBottom: -3 }}>
                  <SkeletonBlock opacity={opacity} width={180} height={10} borderRadius={4} dark />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {[68, 74, 80].map((w, i) => (
                      <SkeletonBlock
                        key={i}
                        opacity={opacity}
                        width={w}
                        height={30}
                        borderRadius={20}
                        dark
                      />
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </View>
          {/* Soft alignment glow at the bottom edge */}
          <View style={sk.stageAccent} />
        </View>
      ) : null}

      {isDesktop ? (
        <View style={sk.bodyWrap}>
          {/* Desktop: editorial main column + overlapping portrait side rail. */}
          <View style={sk.bodyDesktopNew}>
            <View style={sk.mainCol}>
              {statBandCard}
              {summaryCard}
              {abilitiesCard}
              {familyCard}
              {firstAppearanceCard}
            </View>
            <View style={[sk.sideCol, { marginTop: portraitOverlap }] as object}>
              <Animated.View style={[sk.portraitCard as object, { opacity }]}>
                {/* Favourite lives on the portrait — only for authenticated users */}
                {showHeart ? <View style={sk.portraitFavSkel} /> : null}
              </Animated.View>
              {quickFactsCard}
            </View>
          </View>
        </View>
      ) : (
        // Mobile: native-style immersive skeleton (portrait header → beige sheet)
        <View style={sk.bodyWrap}>
          <View style={sk.mHero}>
            <View style={sk.mIdentitySkel}>
              <SkeletonBlock
                opacity={opacity}
                width={90}
                height={11}
                borderRadius={4}
                dark
                style={{ marginBottom: 12 }}
              />
              <SkeletonBlock
                opacity={opacity}
                width={210}
                height={32}
                borderRadius={6}
                dark
                style={{ marginBottom: 12 }}
              />
              <SkeletonBlock
                opacity={opacity}
                width={150}
                height={14}
                borderRadius={4}
                dark
                style={{ marginBottom: 20 }}
              />
              <View style={{ flexDirection: 'row', gap: 18 }}>
                {[46, 78, 52].map((w, i) => (
                  <View key={i} style={{ gap: 6 }}>
                    <SkeletonBlock opacity={opacity} width={w} height={22} borderRadius={5} dark />
                    <SkeletonBlock
                      opacity={opacity}
                      width={Math.round(w * 0.7)}
                      height={8}
                      borderRadius={3}
                      dark
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={sk.mSheet}>
            <View style={sk.mPad}>
              <SkeletonBlock opacity={opacity} height={12} style={{ marginBottom: 8 }} />
              <SkeletonBlock
                opacity={opacity}
                width="88%"
                height={12}
                style={{ marginBottom: 8 }}
              />
              <SkeletonBlock opacity={opacity} width="62%" height={12} />
            </View>
            <View style={sk.mPad}>
              <View style={sk.mStatsCard}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  <SkeletonBlock opacity={opacity} width={90} height={11} />
                  <SkeletonBlock opacity={opacity} width={36} height={22} borderRadius={11} />
                </View>
                {divider}
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={{ marginBottom: 14 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                      }}
                    >
                      <SkeletonBlock opacity={opacity} width={80} height={11} />
                      <SkeletonBlock opacity={opacity} width={22} height={16} borderRadius={4} />
                    </View>
                    <SkeletonBlock opacity={opacity} height={8} borderRadius={4} />
                  </View>
                ))}
              </View>
            </View>
            <View style={sk.mPad}>
              <SkeletonBlock
                opacity={opacity}
                width={88}
                height={20}
                borderRadius={4}
                style={{ alignSelf: 'flex-end', marginBottom: 10 }}
              />
              <View
                style={{
                  height: 2,
                  backgroundColor: COLORS.navy,
                  borderRadius: 30,
                  marginBottom: 16,
                }}
              />
              {[0, 1].map((b) => (
                <View key={b} style={{ marginBottom: 18 }}>
                  <SkeletonBlock
                    opacity={opacity}
                    width={90}
                    height={11}
                    borderRadius={4}
                    style={{ marginBottom: 12 }}
                  />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                    {[100, 132, 88].map((w, i) => (
                      <SkeletonBlock
                        key={i}
                        opacity={opacity}
                        width={w}
                        height={16}
                        borderRadius={4}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const sk = StyleSheet.create({
  scroll: { minHeight: '100lvh', backgroundColor: COLORS.beige } as object,
  scrollContent: { width: '100%' },
  bodyWrap: { maxWidth: 1180, alignSelf: 'center', width: '100%', paddingBottom: 0 },

  // ── Desktop identity stage ──
  stage: { backgroundColor: COLORS.deepNavy, position: 'relative', overflow: 'hidden' },
  stageInner: { maxWidth: 1180, width: '100%', alignSelf: 'center' },
  // Reserve the right zone so meta sits in the band beside the overlapping portrait.
  identityColDesktop: { paddingRight: 324 } as object,
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 32,
  } as object,
  stageAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.orange,
    boxShadow: `0 0 18px ${COLORS.orange}`,
  } as object,

  // ── Desktop body — main editorial column + overlapping side rail ──
  bodyDesktopNew: { flexDirection: 'row', alignItems: 'flex-start', gap: 24, padding: 24 },
  mainCol: { flex: 1, minWidth: 0, gap: 16 } as object,
  sideCol: {
    width: 300,
    flexShrink: 0,
    gap: 16,
    position: 'sticky',
    top: TOPBAR_HEIGHT + 24,
    alignSelf: 'flex-start',
  } as object,

  // Overlapping side portrait — matches the live portraitCard footprint.
  portraitCard: {
    width: '100%',
    height: 420,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ddd5c8',
  },
  portraitFavSkel: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(11,24,32,0.28)',
  } as object,

  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd0',
  },
  summaryBox: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd0',
  },
  statHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  // Quick Facts label/value row — mirrors the live InfoRow spacing.
  infoRowSkel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ea',
  },

  // Mobile immersive skeleton
  mHero: {
    width: '100%',
    height: M_HERO_VH,
    backgroundColor: COLORS.deepNavy,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  } as object,
  mIdentitySkel: { paddingHorizontal: 20, paddingBottom: 46 },
  mSheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingTop: 12,
    paddingBottom: 0,
    // Above the pinned hero so the sheet rides over it (the curtain).
    position: 'relative',
    zIndex: 1,
  },
  mPad: { paddingHorizontal: 20, paddingTop: 18 },
  // Flat like the live Power Profile section (the inset card chrome is gone).
  mStatsCard: { paddingVertical: 8 },
});

// 38pt glass control + 3pt of slop each side = the 44pt target floor.
const GLASS_SLOP = 3;

const styles = StyleSheet.create({
  // Narrative additions
  stageTraits: { marginTop: 14 },
  mStageTraits: { marginTop: 10 },
  eraText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: 22,
    color: COLORS.navy,
  },

  scroll: { minHeight: '100lvh', backgroundColor: COLORS.beige } as object,
  // Cold-load shell: deepNavy so the anti-flash `pre` window (and web refresh)
  // fuses with the boot LogoLoader and the skeleton's dark stage — no beige flash.
  loadingShell: { flex: 1, backgroundColor: COLORS.deepNavy },
  // Scroll content is full-width so the dark stage can bleed edge-to-edge;
  // the body re-constrains itself to a centred reading column.
  scrollContent: { width: '100%' },
  bodyWrap: { maxWidth: 1180, alignSelf: 'center', width: '100%', paddingBottom: 0 },
  familyBand: { paddingHorizontal: 24, paddingBottom: 24, marginTop: -8 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.beige,
  },

  // ── Cinematic identity stage ─────────────────────────────────────────────────
  stage: {
    backgroundColor: COLORS.deepNavy,
    position: 'relative',
    overflow: 'hidden',
  },
  // Blurred portrait fills the stage for atmosphere; scaled up to hide blur edges.
  stageBackdrop: {
    filter: 'blur(55px)',
    transform: [{ scale: 1.3 }],
    opacity: 0.4,
  } as object,
  stageScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(180deg, rgba(11,24,32,0.55) 0%, rgba(11,24,32,0.32) 38%, rgba(11,24,32,0.82) 100%)',
  } as object,
  orbA: {
    position: 'absolute',
    width: 380,
    height: 380,
    top: -90,
    left: '6%',
    borderRadius: 190,
    pointerEvents: 'none',
  } as object,
  orbB: {
    position: 'absolute',
    width: 280,
    height: 280,
    top: 40,
    right: '10%',
    borderRadius: 140,
    backgroundImage: 'radial-gradient(circle, rgba(231,115,51,0.10), transparent 70%)',
    pointerEvents: 'none',
  } as object,
  stageInner: {
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
    zIndex: 2,
  } as object,
  // Glass controls — echo the floating nav and Explore panels. (Mobile only.)
  glassBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.28)',
  } as object,
  glassIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    cursor: 'pointer',
    transition: 'background-color 150ms ease, border-color 150ms ease',
  } as object,
  stageMain: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 24,
  },
  stageMainMobile: { flexDirection: 'column', alignItems: 'stretch' } as object,
  identityCol: { flex: 1, minWidth: 0 } as object,
  // Reserve the right zone so the overlapping body portrait never collides with text.
  identityColDesktop: { paddingRight: 324 } as object,
  // Title left, meta right — bottom-aligned so the pills sit on the name baseline.
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 32,
  } as object,
  // Tablet and narrow-desktop: the title takes the band's full width and the
  // meta drops beneath it, so neither has to shrink into the other.
  identityRowStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 14,
  } as object,
  titleBlock: { flexShrink: 1, minWidth: 0 } as object,
  // Drops into the empty band beside the portrait; right-aligned toward it.
  metaBlock: { alignItems: 'flex-end', gap: 12, marginBottom: -3 } as object,
  metaBlockStack: { alignItems: 'flex-start', marginBottom: 0 } as object,
  metaRowStack: { justifyContent: 'flex-start' } as object,

  // Glass power panel (desktop right side) — mirrors the Explore featured panel.
  statPanel: {
    width: 300,
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    padding: 18,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
  } as object,
  statPanelEyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
    marginBottom: 14,
  } as object,
  statPods: { flexDirection: 'row', gap: 10 },
  statPod: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statPodVal: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.orange },
  statPodKey: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
  } as object,
  stageEyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  heroName: {
    fontFamily: 'Flame-Regular',
    color: COLORS.beige,
    marginBottom: 6,
    textShadow: '0 2px 20px rgba(0,0,0,0.45)',
  } as object,
  heroAlias: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: 'rgba(245,235,220,0.55)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  alignChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  alignChipText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(245,235,220,0.06)',
  },
  statStripItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statStripDiv: { width: 1, alignSelf: 'stretch', marginVertical: 7 },
  metaPillVal: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige },
  metaPillKey: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
  },
  stageCredit: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: INK_TEXT.faint,
    textAlign: 'right',
  },
  stageAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 3,
  } as object,
  // ── Desktop body — main editorial column + overlapping side rail ─────────────
  bodyDesktopNew: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
    padding: 24,
  },
  mainCol: { flex: 1, minWidth: 0, gap: 16 } as object,
  sideCol: {
    width: 300,
    flexShrink: 0,
    gap: 16,
    position: 'sticky',
    top: TOPBAR_HEIGHT + 24,
    alignSelf: 'flex-start',
  } as object,
  // Pull the portrait up so it straddles the header/body seam (magazine profile).
  portraitOverlapDesktop: { marginTop: -210 } as object,

  // Full-width power-stat band — 6 columns, dramatized. Loaded cells render
  // via PowerStatCell; bandCell survives for the loading skeletons.
  statBand: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  bandCell: { flex: 1, alignItems: 'center', gap: 8 },

  // ── Desktop two-column body (legacy / mobile-shared) ─────────────────────────
  bodyDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
    padding: 24,
  },
  leftCol: {
    width: 260,
    flexShrink: 0,
    gap: 12,
  },
  rightCol: {
    flex: 1,
    gap: 16,
  },

  // Portrait card — tall enough to display a full portrait image properly
  portraitCard: {
    width: '100%',
    height: 420,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    boxShadow: '0 24px 52px rgba(11,24,32,0.30)',
  } as object,
  // Subtle bottom gradient gives the portrait the same depth as Explore cards.
  portraitOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    backgroundImage: 'linear-gradient(to top, rgba(11,24,32,0.42), transparent)',
  } as object,
  // Hero name — fades into the sticky portrait once the stage scrolls away.
  portraitNameOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingHorizontal: 26,
    paddingTop: 40,
    paddingBottom: 22,
    alignItems: 'flex-end',
    transition: 'opacity 260ms ease',
  } as object,
  portraitNameText: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    lineHeight: 24,
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 11,
  },
  portraitNameSub: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: 'rgba(245,235,220,0.95)',
    marginTop: 1,
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  // Favourite — lives on the portrait it bookmarks.
  portraitFav: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,24,32,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.25)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    cursor: 'pointer',
    transition: `${PRESS_TRANSITION}, background-color 150ms ease, border-color 150ms ease`,
  } as object,
  portraitFavHover: {
    backgroundColor: 'rgba(11,24,32,0.55)',
    borderColor: 'rgba(245,235,220,0.45)',
  } as object,
  portraitPlaceholder: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },

  // Mobile portrait — aspect ratio 2:3 so portrait images display naturally
  portraitCardMobile: {
    width: '100%',
    aspectRatio: '2 / 3',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    boxShadow: '0 18px 40px rgba(11,24,32,0.28)',
  } as object,

  // Mobile single-column
  body: { padding: 16, gap: 14 },

  // Summary
  summaryBox: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd0',
    boxShadow: '0 6px 22px rgba(41,60,67,0.06)',
  } as object,
  // Segmented tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e8ddd0',
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 7,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  tabBtnActive: {
    backgroundColor: COLORS.navy,
    boxShadow: '0 4px 12px rgba(41,60,67,0.22)',
  } as object,
  tabLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: PAPER_TEXT.faint,
  },
  tabLabelActive: {
    color: COLORS.beige,
    fontFamily: 'Flame-Regular',
  },
  tabContent: {
    gap: 16,
  },

  // Power stats card header with score pill
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Contextual Compare — lives on the stats it acts on, light-themed for the card.
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.orange + '40',
    backgroundColor: COLORS.orange + '0f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    cursor: 'pointer',
    transition: 'background-color 150ms ease, border-color 150ms ease',
  } as object,
  compareBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: ORANGE_INK,
    letterSpacing: 0.2,
  },
  powerScorePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  powerScoreValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 17,
  },
  aiBadge: {
    backgroundColor: 'rgba(41,60,67,0.08)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  aiBadgeText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 9,
    color: PAPER_TEXT.faint,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },

  // Cards
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd0',
    boxShadow: '0 6px 22px rgba(41,60,67,0.06)',
  } as object,
  // Power Profile — card grammar (white base + shadow) with the character's
  // accent as a crown wash + hairline (dynamic backgroundImage/borderColor).
  powerBand: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    boxShadow: '0 6px 22px rgba(41,60,67,0.06)',
  } as object,
  powerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  medianLegend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  medianLegendTick: {
    width: 2,
    height: 10,
    borderRadius: 1,
    backgroundColor: 'rgba(41,60,67,0.35)',
  },
  medianLegendText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: PAPER_TEXT.faint,
    letterSpacing: 0.3,
  },
  cardTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: ORANGE_INK,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  cardDivider: { height: 1, backgroundColor: '#ede5da', marginBottom: 14 },

  percentileBadge: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  percentileBadgeText: {
    flexShrink: 1,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 12,
  },

  // ── Mobile native-style immersive layout ──
  mHero: {
    width: '100%',
    height: M_HERO_VH,
    // The curtain: the portrait pins to the viewport while the beige sheet
    // (zIndex above) slides up OVER it on scroll.
    position: 'sticky' as unknown as 'relative',
    top: 0,
    zIndex: 0,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
  } as object,
  // Deep-navy vignette over the top of the full-bleed portrait: opaque navy
  // through the status bar + back-button zone, easing to transparent below. It
  // fuses the navy status bar into the portrait (no hard cut), gives the head
  // breathing room as it emerges from the gradient, and reads as one seamless
  // surface from the system bar down into the art.
  // Short, soft deep-navy cap: just enough to fuse the navy status-bar cover and
  // the floating bar into the top of the portrait, then clear quickly so the
  // hero's head/crown stays fully visible (the taller hero gives the headroom).
  mScrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 'calc(env(safe-area-inset-top) + 96px)',
    backgroundImage:
      'linear-gradient(to bottom, #0b1820 0%, rgba(11,24,32,0.55) 46%, rgba(11,24,32,0.18) 76%, transparent 100%)',
  } as object,
  mScrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '64%',
    backgroundImage:
      'linear-gradient(to top, rgba(18,26,30,0.97), rgba(18,26,30,0.55) 44%, transparent)',
  },
  mControls: {
    position: 'absolute',
    top: TOPBAR_HEIGHT + 8,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  mIdentity: { paddingHorizontal: 20, paddingBottom: 46, zIndex: 1 },
  mEyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  mName: {
    fontFamily: 'Flame-Regular',
    fontSize: 34,
    lineHeight: 38,
    color: COLORS.beige,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  mAlias: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: 'rgba(245,235,220,0.82)',
    marginTop: 8,
  },
  mVitals: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  mVitalItem: { alignItems: 'flex-start' },
  mVitalVal: { fontFamily: 'Flame-Regular', fontSize: 22, lineHeight: 26, color: COLORS.beige },
  mVitalLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.6)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  mVitalDiv: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(245,235,220,0.22)',
    marginHorizontal: 18,
  },
  mBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  mCreatedBy: {
    flexShrink: 1,
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.6)',
  },
  mBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  mBadge: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.3)',
    backgroundColor: 'rgba(20,28,32,0.4)',
  },
  mBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.beige,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mSheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingTop: 12,
    paddingBottom: 0,
  },
  mBlock: { paddingHorizontal: 20, paddingTop: 18 },
  // Mobile Power Profile — inset white card with the accent crown wash;
  // horizontal padding compensates the margin so content stays flush with
  // sibling mBlock text (12 + 8 = 20).
  // Flat on the sheet like the sections around it — the white inset card read
  // heavy against the otherwise-flat mobile layout.
  mPowerBand: {
    marginTop: 2,
    paddingBottom: 18,
  } as object,

  // Dossier — collapsible card ported from the native screen.
  dossierBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    cursor: 'pointer',
  } as object,
  dossierBarOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  dossierBarText: { flex: 1 },
  dossierTitle: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.navy },
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
  dossierToggleText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  dossierBody: {
    backgroundColor: 'rgba(41,60,67,0.035)',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
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
  mFamilyBlock: { paddingHorizontal: 20, paddingTop: 18 },
  // Flat like the live Power Profile section (the inset card chrome is gone).
  mStatsCard: { paddingVertical: 8 },
  mStatRows: { gap: 14 },
  mStatTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  mStatFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    // The percentile copy varies ("Stronger than 84% of characters") — wrap
    // instead of overflowing the viewport (which widened the document and
    // painted an ink band down the whole page's right edge).
    flexWrap: 'wrap',
    gap: 8,
  },
  mStatFooterRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mSection: { paddingTop: 18 },
  // Small-caps sub-label inside a section — the dossier grammar (Legend's
  // DID YOU KNOW / PORTRAYED BY moments use the same voice).
  mSubLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: PAPER_TEXT.faint,
    paddingHorizontal: 20,
    marginBottom: 10,
  } as object,
  mSocialWeb: { paddingHorizontal: 20, paddingTop: 8 },
  mSubBlock: { marginTop: 22 },
  // Padding for edge-to-edge rails (MovieStrip) so the featured card + decade
  // labels inset to 20 while the shelves still bleed out via bleedMargin.
  mRail: { paddingHorizontal: 20 },
  mSectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
    textAlign: 'right',
    paddingVertical: 5,
  },
  mSectionDivider: {
    height: 2,
    backgroundColor: COLORS.navy,
    borderRadius: 30,
    marginBottom: 14,
  },
  // Pads the title/divider of full-bleed strip sections (Enemies, On Screen) while
  // the strip itself stays edge-to-edge.
  mSectionHead: { paddingHorizontal: 20 },
  mSectionBody: { paddingHorizontal: 20 },
  // Abilities — categorized groups
  signatureWrap: { marginBottom: 18 },
  abilityGroup: { marginBottom: 18 },
  abilityGroupHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  abilityGroupMarker: { width: 16, height: 3, borderRadius: 2 },
  abilityGroupLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  abilityGroupCount: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: PAPER_TEXT.faint,
  },
  abilityItems: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 13 },
  abilityItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  abilityItemName: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: COLORS.navy },

  // Abilities (legacy pill row — kept for skeleton usage elsewhere)
  powerTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  powerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#faf7f3',
  },
  powerTagText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
  },
  powerTagMore: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ddd5c8',
    backgroundColor: '#faf7f3',
    cursor: 'pointer',
  } as object,
  powerTagMoreText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: PAPER_TEXT.faint,
  },
  showLess: {
    alignSelf: 'flex-start',
    marginTop: 10,
    cursor: 'pointer',
  } as object,
  showLessText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: PAPER_TEXT.faint,
    textDecorationLine: 'underline',
  },

  // Desktop 2-col info grid
  infoGridDesktop: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 16,
  } as object,

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ea',
  },
  infoLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: PAPER_TEXT.faint,
    flexShrink: 0,
    marginRight: 8,
  },
  infoValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    color: COLORS.navy,
    textAlign: 'right',
    flex: 1,
    textTransform: 'capitalize',
  },
  // Quick Facts — compact square card grid (two-up; long facts span the row)
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  factTile: {
    width: '48.5%',
    backgroundColor: COLORS.navy + '06',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.10)',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 9,
    gap: 2,
  } as object,
  factTileWide: { width: '100%' } as object,
  factLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 8.5,
    color: PAPER_TEXT.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  factValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    color: COLORS.navy,
    lineHeight: 16,
    textTransform: 'capitalize',
    flexShrink: 1,
  },

  // Enemies & Allies chips
  chipGroup: { marginBottom: 12 },
  // Matches the SOCIAL WEB preview header (Nunito_800ExtraBold, tracked, muted).
  chipGroupLabel: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 11,
    color: PAPER_TEXT.faint,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  affGroup: { marginTop: 16 },
  affChip: {
    backgroundColor: COLORS.navy + '0d',
    borderWidth: 1,
    borderColor: COLORS.navy + '1f',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  affChipText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
  },
  // Team-linked affiliation chip — a warm tint + pointer to signal it's a doorway
  // into the team roster (/team/[id]); plain affiliations stay flat text chips.
  affChipLink: {
    backgroundColor: 'rgba(231,115,51,0.10)',
    borderColor: 'rgba(231,115,51,0.30)',
    cursor: 'pointer',
    transition: 'background-color 150ms ease, border-color 150ms ease',
  } as object,
  affChipLinkHover: {
    backgroundColor: 'rgba(231,115,51,0.18)',
    borderColor: 'rgba(231,115,51,0.5)',
  } as object,
  affChipLinkText: { color: '#9a4a1f' } as object,
  chipEnemy: {
    backgroundColor: 'rgba(181,48,43,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(181,48,43,0.2)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipAlly: {
    backgroundColor: 'rgba(99,169,54,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(99,169,54,0.2)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipTextEnemy: { fontFamily: 'FlameSans-Regular', fontSize: 11, color: COLORS.red },
  chipTextAlly: { fontFamily: 'FlameSans-Regular', fontSize: 11, color: ACCENT_INK.green },

  // First Appearance — desktop card (distinct tinted background)
  firstAppearanceDesktopCard: {
    backgroundColor: '#eef4f5',
    borderColor: '#cddde0',
  },

  // First Appearance — mobile card
  firstIssueRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  firstIssueCover: { width: 80, height: 120, borderRadius: 6 },
  firstIssueMeta: { flex: 1, justifyContent: 'flex-end' as const, paddingBottom: 4 },
  firstIssueTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.navy,
    marginBottom: 4,
  },
  firstIssueYear: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: PAPER_TEXT.faint },

  // First Appearance — desktop horizontal card
  firstAppearanceRow: { flexDirection: 'row', gap: 20, alignItems: 'center' },
  firstAppearanceMeta: { flex: 1, justifyContent: 'flex-start' as const },
  firstAppearanceLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: PAPER_TEXT.faint,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.4,
    marginBottom: 14,
  },
  firstAppearanceDivider: {
    height: 2,
    backgroundColor: COLORS.navy,
    opacity: 0.1,
    marginBottom: 14,
    width: 40,
  },
  firstAppearanceYear: {
    fontFamily: 'Flame-Regular',
    fontSize: 44,
    color: COLORS.navy,
    lineHeight: 48,
    marginBottom: 8,
  },
  firstAppearanceName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: PAPER_TEXT.faint,
    lineHeight: 20,
  },

  // In Print — debut feature + cover gallery
  inPrintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inPrintSince: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: PAPER_TEXT.faint,
  },
  inPrintBody: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // External links — the page's quiet footer register.
  linksFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(41,60,67,0.12)',
    paddingTop: 18,
    marginTop: 4,
    gap: 12,
  },
  linksFooterLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: PAPER_TEXT.faint,
  },

  // Cover gallery — the run that followed the debut
  inPrintGallery: { flex: 1, minWidth: 0, gap: 10 } as object,
  inPrintGalleryLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: PAPER_TEXT.faint,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    paddingLeft: 20,
  },
});
