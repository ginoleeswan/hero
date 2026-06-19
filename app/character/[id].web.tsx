import { useEffect, useState, Fragment, type ComponentProps } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NotFoundView, LoadErrorView } from '../../src/components/NotFoundView';
import { getHeroById, heroRowToCharacterData } from '../../src/lib/db/heroes';
import { FamilyCanvas } from '../../src/components/family/FamilyCanvas.web';
import { getPowerIcon, groupPowers } from '../../src/constants/powerIcons';
import { useHeroDetail } from '../../src/hooks/useHeroDetail';
import { ContributeSheet } from '../../src/components/contribute/ContributeSheet';
import { isBlankValue } from '../../src/lib/contribute/missingFields';
import {
  DOSSIER_GROUPS,
  SUMMARY_FIELD,
  POWERS_FIELD,
  STAT_FIELDS,
  type EditableFieldDef,
} from '../../src/lib/db/contributions';
import { heroImageSource } from '../../src/constants/heroImages';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS } from '../../src/constants/colors';
import { useWebCanvas } from '../../src/hooks/useWebCanvas';
import { StatBar } from '../../src/components/web/StatBar';
import { MovieStrip } from '../../src/components/MovieStrip';
import { groupTitlesByMedia } from '../../src/lib/db/titles';
import { PortrayedBySection } from '../../src/components/PortrayedBySection';
import { HeroLinksRow, heroLinksHasContent } from '../../src/components/HeroLinksRow';
import { AbilitiesSection } from '../../src/components/AbilitiesSection';
import { TraitBand } from '../../src/components/character/TraitBand';
import { DidYouKnowDeck } from '../../src/components/character/DidYouKnowDeck';
import { PowersDecoded } from '../../src/components/character/PowersDecoded';
import { type PowerExplainer } from '../../src/lib/db/heroFacts';
import { RelatedHeroStrip } from '../../src/components/RelatedHeroStrip';
import { FirstIssueModal } from '../../src/components/FirstIssueModal';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { GalleryStrip } from '../../src/components/GalleryStrip';
import { ImageLightbox } from '../../src/components/ImageLightbox';
import { PublisherLogoChip } from '../../src/components/PublisherBadge';
import { brandForPublisher } from '../../src/constants/publishers';
import type { HeroStats } from '../../src/types';

const STAT_CONFIG = [
  { key: 'intelligence', label: 'Intelligence', color: COLORS.blue },
  { key: 'strength', label: 'Strength', color: COLORS.red },
  { key: 'speed', label: 'Speed', color: COLORS.yellow },
  { key: 'durability', label: 'Durability', color: COLORS.green },
  { key: 'power', label: 'Power', color: COLORS.orange },
  { key: 'combat', label: 'Combat', color: COLORS.brown },
];

const JUNK_VALUES = new Set(['-', 'null', 'none', 'no alter egos found.', 'n/a', 'unknown']);

// Map the raw alignment value to a display label (mirrors the Explore stage).
function alignmentLabel(alignment?: string | null): string | null {
  const a = (alignment ?? '').toLowerCase();
  if (a === 'good') return 'Hero';
  if (a === 'bad') return 'Villain';
  if (a === 'neutral') return 'Anti-Hero';
  return null;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '' || JUNK_VALUES.has(value.toLowerCase().trim())) return null;
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

  const valid = (v?: string | null) => !!v && v !== '' && !JUNK_VALUES.has(v.toLowerCase().trim());
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
    color: 'rgba(41,60,67,0.7)',
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
function cleanFact(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v === '' || JUNK_VALUES.has(v.toLowerCase())) return null;
  if (/^[\s/–-]*$/.test(v)) return null;
  return v;
}

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
}: {
  icon: IoniconName;
  label: string;
  value: string | null | undefined;
  wide?: boolean;
  accent?: string;
}) {
  const v = cleanFact(value);
  if (!v) return null;
  const tint = accent ? { backgroundColor: accent + '14', borderColor: accent + '33' } : null;
  return (
    <View style={[styles.factTile, wide && styles.factTileWide, tint] as object}>
      <Text style={styles.factLabel}>{label}</Text>
      <View style={styles.factValueRow}>
        <Ionicons name={icon} size={12} color={accent ?? COLORS.navy + '70'} />
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

function ExpandableChipGroup({
  label,
  chips,
  chipStyle,
  chipTextStyle,
}: {
  label: string;
  chips: string[];
  chipStyle: object;
  chipTextStyle: object;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? chips : chips.slice(0, 10);
  const remainder = chips.length - 10;
  return (
    <View style={styles.chipGroup}>
      <Text style={styles.chipGroupLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {visible.map((name, i) => (
          <View key={i} style={chipStyle as object}>
            <Text style={chipTextStyle as object}>{name}</Text>
          </View>
        ))}
        {!expanded && remainder > 0 ? (
          <Pressable onPress={() => setExpanded(true)} style={chipStyle as object}>
            <Text style={chipTextStyle as object}>+{remainder} more</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function WebCharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width, height: winHeight } = useWindowDimensions();
  const mHeroHeight = Math.round(winHeight * 0.9);
  const isDesktop = width >= 700;

  // Document scroll so the page bleeds edge-to-edge under the iOS Safari toolbar.
  // Before the skeleton early-return so it applies in both states.
  useWebCanvas(COLORS.beige);

  const skeletonOpacity = useSkeletonAnim();
  const {
    data,
    setData,
    user,
    isAdmin,
    comicVineLoading,
    statsGenerating,
    notFound,
    loadError,
    favourited,
    favLoading,
    issueCovers,
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
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'universe'>('overview');
  const [lightboxImages, setLightboxImages] = useState<{ url: string; caption?: string | null }[]>(
    [],
  );
  const [lightboxIndex, setLightboxIndex] = useState(0);
  // Measured desktop stage height — lets the overlapping portrait anchor to a
  // constant top position regardless of how much identity content the stage has.
  const [stageHeight, setStageHeight] = useState(0);

  // Priority: Supabase portrait → local bundled → API image → CDN
  const heroImage = id
    ? heroImageSource(id, data?.stats.image.url ?? null, data?.stats.image.portraitUrl ?? null)
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

  if (notFound) {
    return (
      <NotFoundView
        stamp="Missing"
        stampColor={COLORS.red}
        icon="person"
        headline="Whereabouts unknown"
        subline="No such hero in the archive."
        actions={[
          { label: 'Back to Discover', primary: true, onPress: () => router.replace('/') },
          { label: 'Search heroes', onPress: () => router.replace('/search') },
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

  if (!data) {
    return <CharacterSkeleton isDesktop={isDesktop} showHeart={!!user} />;
  }

  const { stats, details } = data;

  // Editable-field → current value, shared by the mobile dossier editor and the
  // desktop contribute card (the screen has both stats + details).
  const editValues: Record<string, string | null | undefined> = {
    // Profile
    full_name: stats.biography['full-name'],
    alter_egos: stats.biography['alter-egos'],
    aliases: (stats.biography.aliases ?? [])
      .filter((a) => a && !JUNK_VALUES.has(a.toLowerCase().trim()))
      .join('\n'),
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

  // Affiliations live in the main "Enemies, Allies & Teams" card (not Quick Facts)
  // so the sticky side rail stays short enough to fit the viewport.
  const affiliations: string[] = details.teams?.length
    ? details.teams
    : (stats.connections['group-affiliation'] ?? '')
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !JUNK_VALUES.has(s.toLowerCase()));

  const publisherBrand = brandForPublisher(stats.biography.publisher);

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

  const alignmentLabel = (() => {
    const a = (stats.biography.alignment ?? '').toLowerCase();
    if (a === 'good') return 'Hero';
    if (a === 'bad') return 'Villain';
    if (a === 'neutral') return 'Anti-Hero';
    return null;
  })();

  const ORIGIN_LABELS: Record<string, string> = {
    mutant: 'Mutant',
    alien: 'Alien',
    human: 'Human',
    'god/eternal': 'Eternal',
    radiation: 'Radiation',
    cyborg: 'Cyborg',
    robot: 'Robot',
    inhuman: 'Inhuman',
    training: 'Trained',
  };
  const originLabel = details.origin
    ? (ORIGIN_LABELS[details.origin.toLowerCase().trim()] ?? null)
    : null;

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
              />
            ) : null}
            {/* Gradient scrim keeps the identity text legible over the backdrop */}
            <View style={[styles.stageScrim, { pointerEvents: 'none' }] as object} />
            {/* Atmospheric orbs — alignment-tinted, purely decorative */}
            <View
              style={
                [
                  styles.orbA,
                  {
                    backgroundImage: `radial-gradient(circle, ${alignmentColor}2e, transparent 70%)`,
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
                <View style={styles.identityRow}>
                  <View style={styles.titleBlock}>
                    {publisherBrand?.logo ? (
                      <PublisherLogoChip
                        publisher={stats.biography.publisher}
                        height={isDesktop ? 18 : 16}
                      />
                    ) : stats.biography.publisher ? (
                      <Text style={styles.stageEyebrow}>{stats.biography.publisher}</Text>
                    ) : null}
                    <Text
                      style={[
                        styles.heroName,
                        { fontSize: isDesktop ? 46 : 30, lineHeight: isDesktop ? 50 : 34 },
                      ]}
                    >
                      {stats.name}
                    </Text>
                    {alias ? <Text style={styles.heroAlias}>{alias}</Text> : null}
                  </View>

                  {/* Meta block — credit on top, pills anchored to the name baseline */}
                  <View style={styles.metaBlock}>
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

                    <View style={styles.metaRow}>
                      {alignmentLabel ? (
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
                      {powerScore !== null ? (
                        <View style={styles.metaPill}>
                          <Text style={styles.metaPillVal}>{powerScore}</Text>
                          <Text style={styles.metaPillKey}>Power</Text>
                        </View>
                      ) : null}
                      {(details.issueCount ?? 0) > 0 ? (
                        <View style={styles.metaPill}>
                          <Text style={styles.metaPillVal}>
                            {details.issueCount!.toLocaleString()}
                          </Text>
                          <Text style={styles.metaPillKey}>Issues</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Soft alignment glow at the bottom edge — replaces the hard border */}
            <View
              style={
                [
                  styles.stageAccent,
                  {
                    backgroundColor: alignmentColor,
                    boxShadow: `0 0 18px ${alignmentColor}`,
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
              <View style={styles.bodyDesktopNew}>
                {/* Main column — continuous editorial sections */}
                <View style={styles.mainCol}>
                  {/* Theme trait band — colour-coded by vocab category */}
                  {narrative && narrative.tags.length > 0 ? (
                    <View style={styles.webTraitBand}>
                      <TraitBand tags={narrative.tags} />
                    </View>
                  ) : null}

                  {/* Power stats band */}
                  <View style={styles.card}>
                    <View style={styles.statCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Power Stats</Text>
                        {data.statsSource === 'ai' ? (
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
                                hovered && !statsGenerating && (styles.compareBtnHover as object),
                                statsGenerating && { opacity: 0.5 },
                              ] as object
                            }
                          >
                            <Ionicons name="git-compare-outline" size={14} color={COLORS.orange} />
                            <Text style={styles.compareBtnText}>Compare</Text>
                          </Pressable>
                        ) : null}
                        {powerScore !== null ? (
                          <View
                            style={[
                              styles.powerScorePill,
                              { backgroundColor: alignmentColor + '22' },
                            ]}
                          >
                            <Text style={[styles.powerScoreValue, { color: alignmentColor }]}>
                              {powerScore}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.cardDivider} />
                    {isAdmin && statsEditing ? (
                      <StatEditList
                        stats={stats}
                        onPick={(field, current) => setEditTarget({ field, current })}
                      />
                    ) : (
                      <View style={styles.statBand}>
                        {STAT_CONFIG.map(({ key, label, color }) => {
                          if (statsGenerating) {
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
                          const fill = isNaN(raw) ? 0 : Math.min(raw, 100);
                          return (
                            <View key={key} style={styles.bandCell}>
                              <Text style={[styles.bandVal, { color }]}>
                                {isNaN(raw) ? '—' : raw}
                              </Text>
                              <View style={styles.bandTrack}>
                                <View
                                  style={[
                                    styles.bandFill,
                                    {
                                      width: `${fill}%` as unknown as number,
                                      backgroundColor: color,
                                    },
                                  ]}
                                />
                              </View>
                              <Text style={styles.bandLabel}>{label}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                    {percentile != null && percentile > 0 ? (
                      <Text style={styles.percentileText}>
                        Stronger than {percentile}% of heroes
                      </Text>
                    ) : null}
                  </View>

                  {/* Story */}
                  {comicVineLoading && !details.summary ? (
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
                  ) : details.summary || details.description ? (
                    <View style={styles.summaryBox}>
                      {details.summary ? (
                        <Text style={styles.summaryText}>
                          {details.summary}
                          {'  '}
                          <MaterialCommunityIcons
                            name="pencil"
                            size={15}
                            color="rgba(41,60,67,0.5)"
                            onPress={() =>
                              setEditTarget({
                                field: SUMMARY_FIELD,
                                current: details.summary ?? null,
                              })
                            }
                          />
                        </Text>
                      ) : null}
                      {details.description ? (
                        <Pressable
                          onPress={() => router.push(`/biography/${id}`)}
                          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                            [
                              styles.biographyLink,
                              hovered && (styles.biographyLinkHover as object),
                            ] as object
                          }
                        >
                          <Text style={styles.biographyLinkText}>Read biography</Text>
                          <Ionicons name="chevron-forward" size={13} color={COLORS.orange} />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Abilities — power explainers fold in as the "Decoded" strip */}
                  <WebAbilitiesCard
                    powers={details.powers}
                    loading={comicVineLoading}
                    skeletonOpacity={skeletonOpacity}
                    explainers={narrative?.powerExplainers ?? []}
                    onEdit={() =>
                      setEditTarget({
                        field: POWERS_FIELD,
                        current: details.powers?.length ? details.powers.join('\n') : null,
                      })
                    }
                  />

                  {/* Did You Know — swipeable trivia deck */}
                  {narrative && narrative.didYouKnow.length > 0 ? (
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Did You Know</Text>
                      <View style={styles.cardDivider} />
                      <DidYouKnowDeck facts={narrative.didYouKnow} />
                    </View>
                  ) : null}

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
                    <View style={styles.card}>
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
                            onPressHero={(h) =>
                              router.push(`/character/${h.id}?name=${encodeURIComponent(h.name)}`)
                            }
                          />
                        ) : null}
                      </View>
                      {affiliations.length ? (
                        <View style={styles.affGroup}>
                          <Text style={styles.chipGroupLabel}>Affiliations</Text>
                          <View style={styles.chipRow}>
                            {affiliations.map((t) => (
                              <View key={t} style={styles.affChip}>
                                <Text style={styles.affChipText}>{t}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}
                    </View>
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
                        <View style={styles.card}>
                          {groups.film.length > 0 ? (
                            <>
                              <Text style={styles.cardTitle}>On Screen ({groups.film.length})</Text>
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
                              <Text style={styles.cardTitle}>Television ({groups.tv.length})</Text>
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
                      );
                    })()
                  ) : null}

                  {/* Portrayed By */}
                  {portrayals &&
                  (portrayals.performers.length > 0 || portrayals.voiceActors.length > 0) ? (
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Portrayed By</Text>
                      <View style={styles.cardDivider} />
                      <PortrayedBySection portrayals={portrayals} contentInset={0} />
                    </View>
                  ) : null}

                  {/* Links */}
                  {heroLinksHasContent(links) ? (
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Links</Text>
                      <View style={styles.cardDivider} />
                      <HeroLinksRow links={links!} contentInset={0} />
                    </View>
                  ) : null}

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
                  ) : data.firstIssue?.imageUrl || (issueCovers && issueCovers.length > 0) ? (
                    <View style={styles.card}>
                      <View style={styles.inPrintHeader}>
                        <Text style={styles.cardTitle}>In Print</Text>
                        {data.firstIssue?.coverDate ? (
                          <Text style={styles.inPrintSince}>
                            Since {data.firstIssue.coverDate.slice(0, 4)}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.cardDivider} />
                      <View style={styles.inPrintBody}>
                        {/* Debut — the first issue, given hero treatment */}
                        {data.firstIssue?.imageUrl ? (
                          <Pressable
                            onPress={() => setShowIssueModal(true)}
                            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                              [
                                styles.debutBlock,
                                hovered && (styles.debutBlockHover as object),
                              ] as object
                            }
                          >
                            <View style={styles.debutCoverWrap}>
                              <img
                                src={data.firstIssue.imageUrl}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                }}
                              />
                              <View
                                style={
                                  [styles.debutCoverScrim, { pointerEvents: 'none' }] as object
                                }
                              />
                              <View style={styles.debutBadge}>
                                <Ionicons name="ribbon" size={11} color={COLORS.deepNavy} />
                                <Text style={styles.debutBadgeText}>1st Appearance</Text>
                              </View>
                              {data.firstIssue.coverDate ? (
                                <Text style={styles.debutYear}>
                                  {data.firstIssue.coverDate.slice(0, 4)}
                                </Text>
                              ) : null}
                            </View>
                            {data.firstIssue.name ? (
                              <Text style={styles.debutName} numberOfLines={2}>
                                {data.firstIssue.name.split(';')[0].trim()}
                              </Text>
                            ) : null}
                          </Pressable>
                        ) : null}

                        {/* Cover gallery — the publication run that followed */}
                        {issueCovers && issueCovers.length > 0 ? (
                          <View style={styles.inPrintGallery}>
                            <Text style={styles.inPrintGalleryLabel}>
                              Through the years · {issueCovers.length}
                            </Text>
                            <View style={{ marginRight: -20 }}>
                              <GalleryStrip
                                images={issueCovers.map((c) => ({ url: c.url, caption: c.name }))}
                                onPress={(i) => {
                                  setLightboxImages(
                                    issueCovers.map((c) => ({ url: c.url, caption: c.name })),
                                  );
                                  setLightboxIndex(i);
                                }}
                              />
                            </View>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* Side column — overlapping portrait + quick facts */}
                <View style={[styles.sideCol, { marginTop: portraitOverlap }] as object}>
                  <View style={styles.portraitCard}>
                    <HeroImage
                      id={id}
                      name={stats.name}
                      imageUrl={stats.image.url ?? null}
                      portraitUrl={stats.image.portraitUrl ?? null}
                      contentFit="cover"
                      contentPosition={{ top: 0, left: '50%' }}
                      style={StyleSheet.absoluteFill}
                      recyclingKey={id}
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
                        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                          [
                            styles.portraitFav,
                            hovered && (styles.portraitFavHover as object),
                          ] as object
                        }
                      >
                        <Ionicons
                          name={favourited ? 'heart' : 'heart-outline'}
                          size={20}
                          color={favourited ? COLORS.red : COLORS.beige}
                        />
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
                    members={family}
                  />
                </View>
              ) : null}
            </>
          ) : (
            /* ── Mobile: native-style immersive single scroll ── */
            <View>
              {/* Immersive portrait header */}
              <View style={[styles.mHero, { height: mHeroHeight }]}>
                <HeroImage
                  id={id}
                  name={stats.name}
                  imageUrl={stats.image.url ?? null}
                  portraitUrl={stats.image.portraitUrl ?? null}
                  contentFit="cover"
                  contentPosition="top"
                  style={StyleSheet.absoluteFill}
                  recyclingKey={id}
                />
                <View style={[styles.mScrimTop, { pointerEvents: 'none' }] as object} />
                <View style={[styles.mScrimBottom, { pointerEvents: 'none' }] as object} />

                <View style={styles.mControls}>
                  <Pressable
                    onPress={() =>
                      router.canGoBack() ? router.back() : router.replace('/explore')
                    }
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

                <View style={styles.mIdentity}>
                  {publisherBrand?.logo ? (
                    <PublisherLogoChip publisher={stats.biography.publisher} height={16} />
                  ) : stats.biography.publisher ? (
                    <Text style={styles.mEyebrow}>{stats.biography.publisher}</Text>
                  ) : null}
                  <Text style={styles.mName}>{stats.name}</Text>
                  {alias ? <Text style={styles.mAlias}>{alias}</Text> : null}

                  <View style={styles.mVitals}>
                    {powerTotal > 0 ? (
                      <View style={styles.mVitalItem}>
                        <Text style={styles.mVitalVal}>{powerTotal}</Text>
                        <Text style={styles.mVitalLabel}>Power</Text>
                      </View>
                    ) : null}
                    {(details.issueCount ?? 0) > 0 ? (
                      <>
                        <View style={styles.mVitalDiv} />
                        <View style={styles.mVitalItem}>
                          <Text style={styles.mVitalVal}>
                            {details.issueCount!.toLocaleString()}
                          </Text>
                          <Text style={styles.mVitalLabel}>Appearances</Text>
                        </View>
                      </>
                    ) : null}
                    {(details.movieCount ?? details.movies?.length ?? 0) > 0 ? (
                      <>
                        <View style={styles.mVitalDiv} />
                        <View style={styles.mVitalItem}>
                          <Text style={styles.mVitalVal}>
                            {details.movieCount ?? details.movies!.length}
                          </Text>
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
              <View style={styles.mSheet}>
                {/* Theme trait band — colour-coded by vocab category */}
                {narrative && narrative.tags.length > 0 ? (
                  <View style={styles.mTraitBand}>
                    <TraitBand tags={narrative.tags} />
                  </View>
                ) : null}

                {comicVineLoading && !details.summary ? (
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
                ) : details.summary || details.description ? (
                  <View style={styles.mBlock}>
                    {details.summary ? (
                      <Text style={styles.mSummary}>
                        {details.summary}
                        {'  '}
                        <MaterialCommunityIcons
                          name="pencil"
                          size={14}
                          color="rgba(41,60,67,0.5)"
                          onPress={() =>
                            setEditTarget({
                              field: SUMMARY_FIELD,
                              current: details.summary ?? null,
                            })
                          }
                        />
                      </Text>
                    ) : null}
                    {details.description ? (
                      <Pressable
                        onPress={() => router.push(`/biography/${id}`)}
                        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                          [
                            styles.biographyLink,
                            hovered && (styles.biographyLinkHover as object),
                          ] as object
                        }
                      >
                        <Text style={styles.biographyLinkText}>Read biography</Text>
                        <Ionicons name="chevron-forward" size={13} color={COLORS.orange} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {/* Power Stats */}
                <View style={styles.mBlock}>
                  <View style={styles.mStatsCard}>
                    <View style={styles.statCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Power Stats</Text>
                        {data.statsSource === 'ai' ? (
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
                                hovered && !statsGenerating && (styles.compareBtnHover as object),
                                statsGenerating && { opacity: 0.5 },
                              ] as object
                            }
                          >
                            <Ionicons name="git-compare-outline" size={14} color={COLORS.orange} />
                            <Text style={styles.compareBtnText}>Compare</Text>
                          </Pressable>
                        ) : null}
                        {powerScore !== null ? (
                          <View
                            style={[
                              styles.powerScorePill,
                              { backgroundColor: alignmentColor + '22' },
                            ]}
                          >
                            <Text style={[styles.powerScoreValue, { color: alignmentColor }]}>
                              {powerScore}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.cardDivider} />
                    {isAdmin && statsEditing ? (
                      <StatEditList
                        stats={stats}
                        onPick={(field, current) => setEditTarget({ field, current })}
                      />
                    ) : statsGenerating ? (
                      STAT_CONFIG.map(({ key }) => (
                        <SkeletonBlock
                          key={key}
                          opacity={skeletonOpacity}
                          height={10}
                          borderRadius={5}
                          style={{ marginBottom: 14 }}
                        />
                      ))
                    ) : (
                      STAT_CONFIG.map(({ key, label, color }) => (
                        <StatBar
                          key={key}
                          label={label}
                          value={(stats.powerstats as Record<string, string>)[key] ?? '0'}
                          color={color}
                        />
                      ))
                    )}
                    {percentile != null && percentile > 0 ? (
                      <Text style={styles.percentileText}>
                        Stronger than {percentile}% of heroes
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Abilities — power explainers fold in as the "Decoded" strip */}
                <AbilitiesSection
                  powers={details.powers}
                  loading={comicVineLoading}
                  explainers={narrative?.powerExplainers ?? []}
                  onEdit={() =>
                    setEditTarget({
                      field: POWERS_FIELD,
                      current: details.powers?.length ? details.powers.join('\n') : null,
                    })
                  }
                />

                {/* Did You Know — swipeable trivia deck */}
                {narrative && narrative.didYouKnow.length > 0 ? (
                  <View style={styles.mSection}>
                    <View style={styles.mSectionHead}>
                      <Text style={styles.mSectionTitle}>Did You Know</Text>
                      <View style={styles.mSectionDivider} />
                    </View>
                    <DidYouKnowDeck facts={narrative.didYouKnow} contentInset={20} />
                  </View>
                ) : null}

                {/* Family tree */}
                {family.length > 0 ? (
                  <View style={styles.mFamilyBlock}>
                    <FamilyCanvas
                      heroName={stats.name}
                      heroImage={stats.image.portraitUrl || stats.image.url || null}
                      members={family}
                    />
                  </View>
                ) : null}

                {/* Enemies & Allies */}
                {!comicVineLoading &&
                (enemyNames.length || allyNames.length || teammateNames.length) ? (
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
                        onPressHero={(h) =>
                          router.push(`/character/${h.id}?name=${encodeURIComponent(h.name)}`)
                        }
                      />
                    ) : null}
                  </View>
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
                                  On Screen ({groups.film.length})
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
                                  Television ({groups.tv.length})
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

                {/* Portrayed By */}
                {portrayals &&
                (portrayals.performers.length > 0 || portrayals.voiceActors.length > 0) ? (
                  <View style={styles.mSection}>
                    <View style={styles.mSectionHead}>
                      <Text style={styles.mSectionTitle}>Portrayed By</Text>
                      <View style={styles.mSectionDivider} />
                    </View>
                    <PortrayedBySection portrayals={portrayals} contentInset={20} />
                  </View>
                ) : null}

                {/* Links */}
                {heroLinksHasContent(links) ? (
                  <View style={styles.mSection}>
                    <View style={styles.mSectionHead}>
                      <Text style={styles.mSectionTitle}>Links</Text>
                      <View style={styles.mSectionDivider} />
                    </View>
                    <HeroLinksRow links={links!} contentInset={20} />
                  </View>
                ) : null}

                {/* In Print */}
                {issueCovers && issueCovers.length > 0 ? (
                  <View style={styles.mSection}>
                    <View style={styles.mSectionHead}>
                      <Text style={styles.mSectionTitle}>In Print</Text>
                      <View style={styles.mSectionDivider} />
                    </View>
                    <GalleryStrip
                      images={issueCovers.map((c) => ({ url: c.url, caption: c.name }))}
                      onPress={(i) => {
                        setLightboxImages(
                          issueCovers.map((c) => ({ url: c.url, caption: c.name })),
                        );
                        setLightboxIndex(i);
                      }}
                    />
                  </View>
                ) : null}

                {/* First Appearance */}
                {data.firstIssue?.imageUrl ? (
                  <View style={styles.mBlock}>
                    <Text style={styles.mSectionTitle}>First Appearance</Text>
                    <View style={styles.mSectionDivider} />
                    <Pressable onPress={() => setShowIssueModal(true)} style={styles.mDebutCard}>
                      <Image
                        source={{ uri: data.firstIssue.imageUrl }}
                        style={styles.mDebutCover as object}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                      <View style={styles.mDebutMeta}>
                        {data.firstIssue.name ? (
                          <Text style={styles.mDebutTitle}>
                            {data.firstIssue.name.split(';')[0].trim()}
                          </Text>
                        ) : null}
                        {data.firstIssue.coverDate ? (
                          <Text style={styles.mDebutYear}>
                            {data.firstIssue.coverDate.slice(0, 4)}
                          </Text>
                        ) : null}
                        <View style={styles.mDebutCta}>
                          <Text style={styles.mDebutCtaText}>View issue</Text>
                          <Ionicons name="chevron-forward" size={14} color={COLORS.orange} />
                        </View>
                      </View>
                    </Pressable>
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
                    setEditTarget({ field: null, current: null, report: true });
                  }}
                >
                  <Ionicons name="flag-outline" size={17} color={COLORS.navy} />
                  <Text style={s2.contributeMenuText as object}>Report incorrect info</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

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
          onRequestSignIn={() => router.push('/(auth)/login')}
          onSubmitted={() => {
            if (isAdmin) reloadHero();
          }}
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
        />
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
  onEdit,
}: {
  powers: string[] | null;
  loading: boolean;
  skeletonOpacity: ReturnType<typeof useSkeletonAnim>;
  explainers?: PowerExplainer[];
  onEdit?: () => void;
}) {
  // Pristine when empty — the card only appears once a hero has abilities.
  if (!loading && (!powers || powers.length === 0)) return null;

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
          <PowersDecoded explainers={explainers} />
        </>
      ) : null}
    </View>
  );
}

// ── Character page skeleton ──────────────────────────────────────────────────
function CharacterSkeleton({ isDesktop, showHeart }: { isDesktop: boolean; showHeart: boolean }) {
  const opacity = useSkeletonAnim();
  const { height: winH } = useWindowDimensions();
  const heroH = Math.round(winH * 0.62);
  const divider = <View style={{ height: 1, backgroundColor: '#ede5da', marginBottom: 14 }} />;

  // Measure the stage so the overlapping side portrait anchors to the same
  // constant top the real page uses — keeps the skeleton→content swap seamless.
  const [stageHeight, setStageHeight] = useState(0);
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
          onLayout={(e) => setStageHeight(e.nativeEvent.layout.height)}
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
          <View style={[sk.mHero, { height: heroH }]}>
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
  scroll: { flex: 1, backgroundColor: COLORS.beige },
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
    backgroundColor: COLORS.deepNavy,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  mIdentitySkel: { paddingHorizontal: 20, paddingBottom: 46 },
  mSheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingTop: 12,
    paddingBottom: 0,
  },
  mPad: { paddingHorizontal: 20, paddingTop: 18 },
  mStatsCard: { backgroundColor: 'rgba(41,60,67,0.05)', borderRadius: 16, padding: 16 },
});

const styles = StyleSheet.create({
  // Narrative additions
  webTraitBand: { marginBottom: 2 },
  mTraitBand: { paddingHorizontal: 20, paddingTop: 18 },
  eraText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: 22,
    color: COLORS.navy,
  },

  scroll: { flex: 1, backgroundColor: COLORS.beige },
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
  titleBlock: { flexShrink: 1, minWidth: 0 } as object,
  // Drops into the empty band beside the portrait; right-aligned toward it.
  metaBlock: { alignItems: 'flex-end', gap: 12, marginBottom: -3 } as object,

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
    color: 'rgba(245,235,220,0.4)',
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
    color: 'rgba(245,235,220,0.5)',
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
  metaPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  metaPillVal: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige },
  metaPillKey: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.5)',
  },
  stageCredit: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.45)',
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
  biographyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingTop: 10,
  },
  biographyLinkHover: { opacity: 0.7 },
  biographyLinkText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.orange,
  },

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

  // Full-width power-stat band — 6 columns, dramatized.
  statBand: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  bandCell: { flex: 1, alignItems: 'center', gap: 8 },
  bandVal: { fontFamily: 'Flame-Regular', fontSize: 30, lineHeight: 32 } as object,
  bandTrack: {
    width: '72%',
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ece3d6',
    overflow: 'hidden',
  } as object,
  bandFill: { height: '100%' as unknown as number, borderRadius: 3 },
  bandLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.grey,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },

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
    transition: 'background-color 150ms ease, border-color 150ms ease',
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
  summaryText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: COLORS.navy,
    lineHeight: 24,
    maxWidth: 720,
  },

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
    color: COLORS.grey,
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
  compareBtnHover: {
    backgroundColor: COLORS.orange + '1f',
    borderColor: COLORS.orange + '80',
  } as object,
  compareBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.orange,
    letterSpacing: 0.2,
  },
  powerScorePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
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
    color: COLORS.navy,
    opacity: 0.5,
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
  cardTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  cardDivider: { height: 1, backgroundColor: '#ede5da', marginBottom: 14 },

  percentileText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.orange,
    textAlign: 'right',
    marginTop: 6,
    letterSpacing: 0.2,
  },

  // ── Mobile native-style immersive layout ──
  mHero: {
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
  },
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
    color: COLORS.orange,
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
  mSummary: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.navy,
    opacity: 0.85,
  },
  mStatsCard: { backgroundColor: 'rgba(41,60,67,0.05)', borderRadius: 16, padding: 16 },
  mSection: { paddingTop: 18 },
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
  mDebutCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 16,
    padding: 12,
  },
  mDebutCover: { width: 92, height: 138, borderRadius: 8, backgroundColor: COLORS.deepNavy },
  mDebutMeta: { flex: 1, justifyContent: 'center', gap: 6 },
  mDebutTitle: { fontFamily: 'Flame-Regular', fontSize: 16, lineHeight: 21, color: COLORS.navy },
  mDebutYear: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: '#54606A' },
  mDebutCta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  mDebutCtaText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange },

  // Abilities — categorized groups
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
    color: COLORS.navy,
    opacity: 0.35,
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
    color: COLORS.grey,
  },
  showLess: {
    alignSelf: 'flex-start',
    marginTop: 10,
    cursor: 'pointer',
  } as object,
  showLessText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.grey,
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
    color: COLORS.grey,
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
    backgroundColor: COLORS.navy + '08',
    borderWidth: 1,
    borderColor: COLORS.navy + '0f',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 9,
    gap: 2,
  } as object,
  factTileWide: { width: '100%' } as object,
  factLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 8.5,
    color: COLORS.grey,
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
  chipGroupLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    opacity: 0.5,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  affGroup: { marginTop: 4 },
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
  chipTextAlly: { fontFamily: 'FlameSans-Regular', fontSize: 11, color: COLORS.green },

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
  firstIssueYear: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: COLORS.grey },

  // First Appearance — desktop horizontal card
  firstAppearanceRow: { flexDirection: 'row', gap: 20, alignItems: 'center' },
  firstAppearanceMeta: { flex: 1, justifyContent: 'flex-start' as const },
  firstAppearanceLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    opacity: 0.45,
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
    color: COLORS.navy,
    opacity: 0.7,
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
    color: COLORS.navy,
    opacity: 0.5,
  },
  inPrintBody: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Debut poster — the first issue, given hero treatment
  debutBlock: {
    width: 150,
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'transform 180ms ease',
  } as object,
  debutBlockHover: { transform: [{ translateY: -3 }] } as object,
  debutCoverWrap: {
    width: 150,
    height: 222,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    borderWidth: 1.5,
    borderColor: COLORS.goldAccent,
    boxShadow: '0 8px 24px rgba(41,60,67,0.26)',
  } as object,
  debutCoverScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    backgroundImage: 'linear-gradient(to top, rgba(11,24,32,0.85), transparent)',
  } as object,
  debutBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: COLORS.goldAccent,
  } as object,
  debutBadgeText: {
    fontFamily: 'FlameSans-Regular',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.3,
    color: COLORS.deepNavy,
  },
  debutYear: {
    position: 'absolute',
    left: 12,
    bottom: 10,
    fontFamily: 'Flame-Regular',
    fontSize: 30,
    lineHeight: 32,
    color: COLORS.beige,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  } as object,
  debutName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12.5,
    color: COLORS.navy,
    opacity: 0.75,
    lineHeight: 17,
    marginTop: 10,
  },

  // Cover gallery — the run that followed the debut
  inPrintGallery: { flex: 1, minWidth: 0, gap: 10 } as object,
  inPrintGalleryLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    opacity: 0.45,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    paddingLeft: 20,
  },
});
