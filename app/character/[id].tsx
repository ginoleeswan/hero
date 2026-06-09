import { useEffect, useState, useCallback, useRef, useMemo, Fragment } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import * as Haptics from 'expo-haptics';
import { fetchHeroStats, fetchHeroDetails, fetchHeroGallery } from '../../src/lib/api';
import { heroRowToCharacterData, type RelatedHeroCard } from '../../src/lib/db/heroes';
import { useHeroRow, useHeroPercentile, useHeroesByNames } from '../../src/lib/query/heroQueries';
import {
  isFavourited,
  addFavourite,
  removeFavourite,
  getHeroFavouriteCount,
} from '../../src/lib/db/favourites';
import { useAuth } from '../../src/hooks/useAuth';
import { useRecordView } from '../../src/hooks/useViewHistory';
import { heroImageSource } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';
import { CharacterSkeleton } from '../../src/components/skeletons/CharacterSkeleton';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../src/components/ui/SkeletonProvider';
import { AbilitiesSection } from '../../src/components/AbilitiesSection';
import { MovieStrip } from '../../src/components/MovieStrip';
import { FirstIssueModal } from '../../src/components/FirstIssueModal';
import { GalleryStrip } from '../../src/components/GalleryStrip';
import { ImageLightbox } from '../../src/components/ImageLightbox';
import { RelatedHeroStrip } from '../../src/components/RelatedHeroStrip';
import type { CharacterData, IssueCover } from '../../src/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_IMAGE_HEIGHT = Math.round(SCREEN_HEIGHT * 0.66);
// The identity (name + vitals) sits ON the portrait over a dark scrim; the beige
// content sheet then rises over the hero with a rounded lip, overlapping this far.
const SHEET_OVERLAP = 28;
// Sheet's top offset within the scroll content (hero spacer height − the lip),
// added to each section's local onLayout y so the quick-nav anchors stay correct.
const SHEET_TOP = HERO_IMAGE_HEIGHT - SHEET_OVERLAP;

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

// Shared "is this a real value" guard — DB rows carry '-' / 'null' / '' sentinels.
const valid = (v?: string | null) => !!v && v !== '-' && v !== 'null' && v.trim() !== '';

function StatDial({ label, value, tint }: { label: string; value: string; tint: string }) {
  const numeric = parseInt(value, 10);
  const fill = isNaN(numeric) ? 0 : numeric;

  return (
    <View style={styles.dialWrap}>
      <AnimatedCircularProgress
        size={72}
        width={11}
        duration={1800}
        backgroundWidth={9}
        rotation={-124}
        arcSweepAngle={250}
        fill={fill}
        tintColor={tint}
        backgroundColor={'rgba(41,60,67,0.12)'}
        padding={0}
        lineCap="round"
      >
        {(f: number) => <Text style={styles.dialValue}>{Math.floor(f)}</Text>}
      </AnimatedCircularProgress>
      <Text style={styles.dialLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.divider} />
      {children}
    </View>
  );
}

// Padded title + divider with no body padding — used for sections whose body is
// a full-bleed horizontal scroller (the scroller carries its own edge insets).
function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeaderPad}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.divider} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '-' || value === 'null' || value === '') return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const ALIGNMENT_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  good: { label: 'Hero', bg: 'rgba(39,174,96,0.15)', color: COLORS.green },
  bad: { label: 'Villain', bg: 'rgba(231,76,60,0.15)', color: COLORS.red },
  neutral: { label: 'Neutral', bg: 'rgba(100,100,100,0.12)', color: COLORS.grey },
};

function AlignmentBadge({ alignment }: { alignment: string | null | undefined }) {
  if (!alignment) return null;
  const config = ALIGNMENT_CONFIG[alignment.toLowerCase().trim()];
  if (!config) return null;
  return (
    <View style={[styles.taxoBadge, { backgroundColor: config.bg, borderColor: config.color }]}>
      <Text style={[styles.taxoBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const ORIGIN_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  mutant: { label: 'Mutant', bg: 'rgba(139,92,246,0.15)', color: COLORS.purple },
  alien: { label: 'Alien', bg: 'rgba(21,161,171,0.15)', color: COLORS.blue },
  human: { label: 'Human', bg: 'rgba(162,161,155,0.15)', color: COLORS.grey },
  'god/eternal': { label: 'Eternal', bg: 'rgba(249,178,34,0.18)', color: COLORS.gold },
  radiation: { label: 'Radiation', bg: 'rgba(231,115,51,0.15)', color: COLORS.orange },
  cyborg: { label: 'Cyborg', bg: 'rgba(45,45,45,0.12)', color: COLORS.black },
  robot: { label: 'Robot', bg: 'rgba(45,45,45,0.12)', color: COLORS.black },
  training: { label: 'Training', bg: 'rgba(80,35,20,0.12)', color: COLORS.brown },
  inhuman: { label: 'Inhuman', bg: 'rgba(21,161,171,0.15)', color: COLORS.blue },
};

function OriginBadge({ origin }: { origin: string | null | undefined }) {
  if (!origin) return null;
  const config = ORIGIN_CONFIG[origin.toLowerCase().trim()];
  if (!config) return null;
  return (
    <View style={[styles.taxoBadge, { backgroundColor: config.bg, borderColor: config.color }]}>
      <Text style={[styles.taxoBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function AffiliationChips({ value }: { value: string | null | undefined }) {
  const [expanded, setExpanded] = useState(false);
  if (!value || value === '-' || value === 'null' || value === '') return null;
  const chips = value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s && s !== '-' && s !== 'null' && s !== 'none');
  if (chips.length === 0) return null;
  const visible = expanded ? chips : chips.slice(0, 8);
  const remainder = chips.length - 8;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>Affiliations:</Text>
      <View style={styles.chipsWrap}>
        {visible.map((chip, i) => (
          <View key={i} style={styles.chip}>
            <Text style={styles.chipText}>{chip}</Text>
          </View>
        ))}
        {!expanded && remainder > 0 && (
          <TouchableOpacity onPress={() => setExpanded(true)} style={styles.chip}>
            <Text style={styles.chipText}>+{remainder} more</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function RelativesList({ value }: { value: string | null | undefined }) {
  if (!value || value === '-' || value === 'null' || value === '') return null;
  const entries = value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s && s !== '-' && s !== 'null');
  if (entries.length === 0) return null;
  if (entries.length === 1) {
    return <InfoRow label="Relatives" value={entries[0]} />;
  }
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { alignSelf: 'flex-start', paddingTop: 1 }]}>Relatives:</Text>
      <View style={{ flex: 1 }}>
        {entries.map((entry, i) => (
          <Text key={i} style={[styles.infoValue, i < entries.length - 1 && { marginBottom: 5 }]}>
            {entry}
          </Text>
        ))}
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
  const hasConnections =
    valid(work.occupation) ||
    valid(work.base) ||
    valid(affiliation) ||
    valid(connections.relatives);
  return hasProfile || hasAppearance || hasConnections;
}

// The dry label/value data (Profile + Appearance + Connections), folded into one
// collapsed-by-default card so it stops dominating the lower half of the screen.
function Dossier({
  data,
  includeFirstAppearance,
}: {
  data: CharacterData;
  includeFirstAppearance: boolean;
}) {
  const [open, setOpen] = useState(false);
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
  const hasConnections =
    valid(work.occupation) ||
    valid(work.base) ||
    valid(affiliation) ||
    valid(connections.relatives);

  if (!hasProfile && !hasAppearance && !hasConnections) return null;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
    Haptics.selectionAsync();
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.7}
        style={[styles.dossierBar, open && styles.dossierBarOpen]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Collapse dossier' : 'Expand dossier'}
      >
        <View style={styles.dossierBarText}>
          <Text style={styles.dossierTitle}>Dossier</Text>
          {!open ? (
            <Text style={styles.dossierHint}>Appearance, affiliations, relatives & more</Text>
          ) : null}
        </View>
        <View style={styles.dossierToggle}>
          <Text style={styles.dossierToggleText}>{open ? 'Hide' : 'View'}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={COLORS.navy} />
        </View>
      </TouchableOpacity>
      {open ? (
        <View style={styles.dossierBody}>
          {hasProfile ? (
            <>
              <Text style={styles.dossierGroupLabel}>Profile</Text>
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
              <RelativesList value={connections.relatives} />
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
  const insets = useSafeAreaInsets();
  const compareStripStyle = [styles.compareStrip, { paddingBottom: insets.bottom || 16 }];
  const { user } = useAuth();
  useRecordView(user?.id, id);
  const [data, setData] = useState<CharacterData | null>(null);
  const [comicVineLoading, setComicVineLoading] = useState(true);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favourited, setFavourited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [favCount, setFavCount] = useState<number>(0);
  const [issueCovers, setIssueCovers] = useState<IssueCover[] | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; caption?: string | null }[]>(
    [],
  );
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const heroRowQuery = useHeroRow(id);
  const heroRow = heroRowQuery.data;

  const scrollY = useRef(new Animated.Value(0)).current;
  const compareScale = useRef(new Animated.Value(1)).current;

  const springCompare = (toValue: number) =>
    Animated.spring(compareScale, {
      toValue,
      stiffness: 260,
      damping: 18,
      mass: 0.6,
      useNativeDriver: true,
    }).start();

  // Parallax: image drifts up at ~0.3x scroll speed as content covers it
  // Overscroll zoom: when scrollY < 0, translateY tracks half the overscroll
  // so the scaled image stays anchored at the top edge
  const imageTranslateY = scrollY.interpolate({
    inputRange: [-HERO_IMAGE_HEIGHT, 0, HERO_IMAGE_HEIGHT],
    outputRange: [-HERO_IMAGE_HEIGHT / 2, 0, -HERO_IMAGE_HEIGHT / 3],
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

  const navOpacity = scrollY.interpolate({
    inputRange: [HERO_IMAGE_HEIGHT * 0.45, HERO_IMAGE_HEIGHT * 0.62],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Sections live inside the beige sheet, so their onLayout y is relative to the
  // sheet — add the sheet's offset to get the absolute scroll position to jump to.
  const registerAnchor = (key: string) => (e: LayoutChangeEvent) => {
    sectionOffsets.current[key] = SHEET_TOP + e.nativeEvent.layout.y;
  };

  const jumpTo = useCallback((key: string) => {
    const y = sectionOffsets.current[key];
    if (y == null) return;
    Haptics.selectionAsync();
    scrollRef.current?.scrollTo({ y: Math.max(0, y - NAV_CLEARANCE), animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setNavVisible((prev) => {
      const next = y > HERO_IMAGE_HEIGHT * 0.5;
      return next === prev ? prev : next;
    });
    const probe = y + NAV_CLEARANCE + 12;
    let current = '';
    for (const key of sectionOrder.current) {
      const off = sectionOffsets.current[key];
      if (off != null && off <= probe) current = key;
    }
    if (current !== activeRef.current) {
      activeRef.current = current;
      setActiveSection(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Total powerstats — drives both the vitals strip and the percentile hook.
  const powerTotal = useMemo(() => {
    if (!data) return 0;
    return STAT_CONFIG.map(({ key }) =>
      parseInt((data.stats.powerstats as Record<string, string>)[key] ?? '0', 10),
    )
      .filter((n) => !isNaN(n) && n > 0)
      .reduce((sum, n) => sum + n, 0);
  }, [data]);

  const { data: percentile } = useHeroPercentile(powerTotal || null);

  // A hero with a cover image gets the visual "First Appearance" section; without
  // one, the same fact shows as a text row inside the Dossier (no duplication).
  const hasFirstVisual = !!data?.firstIssue?.imageUrl;

  // The sections that actually render, in scroll order — drives the quick-nav
  // chips and active-section tracking. Mirrors the render conditions below.
  const presentSections = useMemo<{ key: string; label: string }[]>(() => {
    if (!data) return [];
    const s: { key: string; label: string }[] = [];
    if (comicVineLoading || data.details.summary || data.details.description)
      s.push({ key: 'summary', label: 'Summary' });
    s.push({ key: 'stats', label: 'Stats' });
    if (comicVineLoading || data.details.powers?.length)
      s.push({ key: 'abilities', label: 'Abilities' });
    if (comicVineLoading || data.details.enemies?.length || data.details.friends?.length)
      s.push({ key: 'allies', label: 'Allies' });
    if (comicVineLoading || data.details.movies?.length)
      s.push({ key: 'screen', label: 'On Screen' });
    if ((issueCovers === null && galleryLoading) || (issueCovers && issueCovers.length > 0))
      s.push({ key: 'print', label: 'In Print' });
    if (hasFirstVisual) s.push({ key: 'first', label: 'Debut' });
    if (hasDossierData(data, !hasFirstVisual)) s.push({ key: 'dossier', label: 'Dossier' });
    return s;
  }, [data, comicVineLoading, issueCovers, galleryLoading, hasFirstVisual]);
  sectionOrder.current = presentSections.map((s) => s.key);

  // Resolve enemy + ally names → hero rows (one query) so they render as
  // navigable cards. heroMap is keyed by exact name; unresolved names fall
  // back to chips inside RelatedHeroStrip.
  const relatedNames = useMemo(
    () => (data ? [...(data.details.enemies ?? []), ...(data.details.friends ?? [])] : []),
    [data],
  );
  const { data: relatedHeroes } = useHeroesByNames(relatedNames);
  const relatedHeroMap = useMemo(() => {
    const m = new Map<string, RelatedHeroCard>();
    for (const h of relatedHeroes ?? []) m.set(h.name, h);
    return m;
  }, [relatedHeroes]);

  useEffect(() => {
    if (!id) return;

    const loadFromApi = () => {
      fetchHeroStats(id)
        .then((stats) => {
          setData({
            stats,
            details: {
              summary: null,
              publisher: null,
              firstIssueId: null,
              firstIssueData: null,
              powers: null,
              description: null,
              origin: null,
              issueCount: null,
              creators: null,
              enemies: null,
              friends: null,
              movies: null,
              movieCount: null,
              teams: null,
            },
            firstIssue: null,
          });
          fetchHeroDetails(stats.id, stats.name)
            .then((details) => {
              setData({ stats, details, firstIssue: details.firstIssueData });
            })
            .catch(() => {})
            .finally(() => setComicVineLoading(false));
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : 'Failed to load character');
        });
    };

    // Wait for the real row (ignore the instant placeholder used only for paint).
    if (heroRowQuery.isPlaceholderData) return;

    // Query settled with no row → hero not enriched, fall back to external APIs.
    if (heroRowQuery.isError || (heroRowQuery.isSuccess && !heroRow)) {
      loadFromApi();
      return;
    }
    if (!heroRow) return;

    if (heroRow.enriched_at) {
      setData(heroRowToCharacterData(heroRow));

      // Seed issue covers from DB if already populated
      if (heroRow.issue_covers) {
        setIssueCovers(heroRow.issue_covers as unknown as IssueCover[]);
      }

      // Lazy-fetch covers only if never enriched (sentinel null). Heroes with no
      // covers keep a null column but a set timestamp, so they don't re-trigger
      // the fetch on every visit.
      const needsGallery = heroRow.comicvine_id != null && heroRow.gallery_enriched_at === null;
      if (needsGallery) {
        setGalleryLoading(true);
        fetchHeroGallery(heroRow.id, heroRow.comicvine_id!)
          .then(({ issueCovers: covers }) => {
            if (covers) setIssueCovers(covers);
          })
          .catch(() => {})
          .finally(() => setGalleryLoading(false));
      }

      const needsComicVine =
        !heroRow.comicvine_enriched_at ||
        heroRow.powers === null ||
        !heroRow.movies?.length ||
        !heroRow.first_issue_id ||
        !heroRow.first_issue_data;
      const moviesIncomplete =
        !needsComicVine &&
        heroRow.movie_count != null &&
        heroRow.movies != null &&
        heroRow.movie_count > (heroRow.movies as unknown[]).length;
      const moviesLackDetail =
        !needsComicVine &&
        !moviesIncomplete &&
        heroRow.movies != null &&
        (heroRow.movies as unknown[]).length > 0 &&
        (
          heroRow.movies as Array<{
            deck?: string | null;
            rating?: string | null;
            runtime?: string | null;
          }>
        )
          .slice(0, 5)
          .every((m) => m.deck === null && m.rating === null && m.runtime === null);
      setComicVineLoading(needsComicVine);

      if (needsComicVine || moviesIncomplete || moviesLackDetail) {
        fetchHeroDetails(heroRow.id, heroRow.name)
          .then((details) => {
            setData((prev) =>
              prev
                ? { ...prev, details, firstIssue: details.firstIssueData ?? prev.firstIssue }
                : prev,
            );
          })
          .catch(() => {})
          .finally(() => {
            if (needsComicVine) setComicVineLoading(false);
          });
      }
      return;
    }

    // Row exists but isn't enriched — use external APIs.
    loadFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    id,
    heroRow?.id,
    heroRow?.enriched_at,
    heroRowQuery.isPlaceholderData,
    heroRowQuery.isError,
    heroRowQuery.isSuccess,
  ]);

  useEffect(() => {
    if (!user || !id) return;
    isFavourited(user.id, id)
      .then(setFavourited)
      .catch(() => {});
  }, [user, id]);

  useEffect(() => {
    if (!id) return;
    getHeroFavouriteCount(id)
      .then(setFavCount)
      .catch(() => {});
  }, [id]);

  const toggleFavourite = useCallback(async () => {
    if (!user || !id || favLoading) return;
    setFavLoading(true);
    const next = !favourited;
    setFavourited(next);
    Haptics.impactAsync(
      next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
    try {
      await (next ? addFavourite(user.id, id) : removeFavourite(user.id, id));
      getHeroFavouriteCount(id)
        .then(setFavCount)
        .catch(() => {});
    } catch {
      setFavourited(!next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setFavLoading(false);
    }
  }, [user, id, favourited, favLoading]);

  // Priority: Supabase portrait → param portrait (from card) → local bundled → API image → CDN
  const heroImage = id
    ? heroImageSource(
        id,
        data?.stats.image.url ?? heroRow?.image_url ?? null,
        data?.stats.image.portraitUrl ?? heroRow?.portrait_url ?? paramImageUri ?? null,
      )
    : null;

  // Show name immediately from params while API loads
  const displayName = data?.stats.name ?? heroRow?.name ?? paramName ?? '';

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTransparent: true,
            headerStyle: { backgroundColor: 'transparent' },
            headerShadowVisible: false,
            headerTitle: '',
            headerBackTitle: '',
          }}
        />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

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
          headerTintColor: COLORS.orange,
          headerStyle: { backgroundColor: 'transparent' },
          headerTitleAlign: 'center',
          headerTitle: () => (
            <Animated.Text
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
          headerRight: user
            ? () => (
                <TouchableOpacity
                  onPress={toggleFavourite}
                  disabled={favLoading}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.headerBtn}
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
              )
            : undefined,
        }}
      />

      {/* Hero image — parallax + zoom-on-overscroll. The opaque beige sheet covers
          it on scroll, so no opacity fade is needed. */}
      <Animated.View
        style={[
          styles.heroImageContainer,
          { transform: [{ translateY: imageTranslateY }, { scale: imageScale }] },
        ]}
      >
        <Image
          source={heroImage}
          contentFit="cover"
          contentPosition="top"
          style={styles.heroImage}
          cachePolicy="memory-disk"
          recyclingKey={id ?? 'hero'}
          transition={
            heroImage !== null && typeof heroImage === 'object' && 'uri' in heroImage ? 200 : null
          }
        />
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
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
          listener: handleScroll,
        })}
      >
        {/* Hero spacer — transparent over the parallaxing image; the identity sits
            at its bottom, on the dark scrim. Name paints instantly from params. */}
        <View style={styles.heroSpacer}>
          {displayName ? (
            <View style={styles.identity}>
              {data ? (
                (() => {
                  const publisher = data.stats.biography.publisher;
                  const hasPublisher = valid(publisher);
                  const alignment = data.stats.biography.alignment;
                  const origin = data.details.origin;
                  const hasBadges = !!(alignment || origin);
                  const fullName = data.stats.biography['full-name'];
                  const hasAlias = !!fullName && fullName !== '-' && fullName !== 'null';
                  const hasCreators = !!data.details.creators?.length;
                  // Badges anchor the bottom-right of the block, balanced against the
                  // "created by" line on the left.
                  const bottomJustify: 'space-between' | 'flex-end' | 'flex-start' =
                    hasCreators && hasBadges
                      ? 'space-between'
                      : hasBadges
                        ? 'flex-end'
                        : 'flex-start';
                  return (
                    <>
                      {hasPublisher ? (
                        <Text style={styles.eyebrow} numberOfLines={1}>
                          {publisher}
                        </Text>
                      ) : null}

                      <Text style={styles.heroName}>{displayName}</Text>

                      {hasAlias ? (
                        <Text style={styles.heroAlias} numberOfLines={1}>
                          {fullName}
                        </Text>
                      ) : null}

                      <VitalsStrip
                        powerTotal={powerTotal}
                        issueCount={data.details.issueCount}
                        movieCount={data.details.movieCount ?? data.details.movies?.length ?? null}
                      />

                      {hasCreators || hasBadges ? (
                        <View style={[styles.bottomMeta, { justifyContent: bottomJustify }]}>
                          {hasCreators ? (
                            <Text style={styles.createdBy} numberOfLines={2}>
                              Created by {data.details.creators!.join(' & ')}
                            </Text>
                          ) : null}
                          {hasBadges ? (
                            <View style={styles.chipRow}>
                              <AlignmentBadge alignment={alignment} />
                              <OriginBadge origin={origin} />
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </>
                  );
                })()
              ) : (
                <Text style={styles.heroName}>{displayName}</Text>
              )}
            </View>
          ) : null}
        </View>

        {/* Beige content sheet — opaque, rounded top; rises over the hero on scroll */}
        <View style={styles.sheet}>
          {!data ? (
            <CharacterSkeleton hideNameBlock />
          ) : (
            <>
              {/* Summary — the lede; shows skeleton lines while ComicVine loads */}
              <View onLayout={registerAnchor('summary')}>
                {comicVineLoading ? (
                  <SkeletonProvider>
                    <View style={styles.summaryBlock}>
                      <Skeleton
                        width="100%"
                        height={12}
                        borderRadius={5}
                        style={{ marginBottom: 7 }}
                      />
                      <Skeleton
                        width="88%"
                        height={12}
                        borderRadius={5}
                        style={{ marginBottom: 7 }}
                      />
                      <Skeleton width="65%" height={12} borderRadius={5} />
                    </View>
                  </SkeletonProvider>
                ) : data.details.summary || data.details.description ? (
                  <View style={styles.summaryBlock}>
                    {data.details.summary ? (
                      <Text style={styles.summary}>{data.details.summary}</Text>
                    ) : null}
                    {data.details.description ? (
                      <TouchableOpacity
                        style={styles.biographyLink}
                        onPress={() => router.push(`/biography/${id}`)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.biographyLinkText}>Full biography →</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>

              {/* Power Stats — circular dials, 3×2 grid + percentile hook */}
              <View onLayout={registerAnchor('stats')}>
                <Section title="Power Stats">
                  <View style={styles.statsCard}>
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
                          <Text style={styles.statPercentile}>
                            Stronger than {percentile}% of heroes
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </Section>
              </View>

              {/* Abilities */}
              <View onLayout={registerAnchor('abilities')}>
                <AbilitiesSection powers={data.details.powers} loading={comicVineLoading} />
              </View>

              {/* Enemies & Allies — full-bleed card strips */}
              <View onLayout={registerAnchor('allies')} style={styles.bleedSection}>
                {comicVineLoading ? (
                  <SkeletonProvider>
                    <SectionHeader title="Enemies & Allies" />
                    <View style={styles.bleedPad}>
                      <Skeleton
                        width={50}
                        height={9}
                        borderRadius={4}
                        style={{ marginBottom: 10 }}
                      />
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
                ) : data.details.enemies?.length || data.details.friends?.length ? (
                  <>
                    <SectionHeader title="Enemies & Allies" />
                    {data.details.enemies?.length ? (
                      <RelatedHeroStrip
                        label="Enemies"
                        names={data.details.enemies}
                        heroMap={relatedHeroMap}
                        kind="enemy"
                        onPressHero={(h) =>
                          router.push(`/character/${h.id}?name=${encodeURIComponent(h.name)}`)
                        }
                      />
                    ) : null}
                    {data.details.friends?.length ? (
                      <RelatedHeroStrip
                        label="Allies"
                        names={data.details.friends}
                        heroMap={relatedHeroMap}
                        kind="ally"
                        onPressHero={(h) =>
                          router.push(`/character/${h.id}?name=${encodeURIComponent(h.name)}`)
                        }
                      />
                    ) : null}
                  </>
                ) : null}
              </View>

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
                ) : data.details.movies?.length ? (
                  <>
                    <SectionHeader
                      title={`On Screen (${data.details.movieCount ?? data.details.movies.length})`}
                    />
                    <MovieStrip
                      movies={data.details.movies}
                      totalCount={data.details.movieCount ?? data.details.movies.length}
                      contentInset={20}
                    />
                  </>
                ) : null}
              </View>

              {/* In Print — full-bleed cover gallery */}
              <View onLayout={registerAnchor('print')} style={styles.bleedSection}>
                {issueCovers === null && galleryLoading ? (
                  <SkeletonProvider>
                    <SectionHeader title="In Print" />
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
                ) : issueCovers && issueCovers.length > 0 ? (
                  <>
                    <SectionHeader title="In Print" />
                    <GalleryStrip
                      images={issueCovers.map((c) => ({ url: c.url, caption: c.name }))}
                      onPress={(i) => {
                        setLightboxImages(
                          issueCovers.map((c) => ({ url: c.url, caption: c.name })),
                        );
                        setLightboxIndex(i);
                      }}
                    />
                  </>
                ) : null}
              </View>

              {/* First Appearance — editorial debut card: cover + issue meta */}
              {hasFirstVisual ? (
                <View onLayout={registerAnchor('first')}>
                  <Section title="First Appearance">
                    <TouchableOpacity
                      onPress={() => setShowIssueModal(true)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="View first appearance issue"
                    >
                      <View style={styles.debutCard}>
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
                  </Section>
                </View>
              ) : null}

              {/* Dossier — Profile + Appearance + Connections, collapsed by default */}
              <View onLayout={registerAnchor('dossier')}>
                <Dossier data={data} includeFirstAppearance={!hasFirstVisual} />
              </View>
            </>
          )}
        </View>
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
    width: SCREEN_WIDTH,
    height: HERO_IMAGE_HEIGHT,
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: '100%' },
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
  heroSpacer: { height: HERO_IMAGE_HEIGHT, justifyContent: 'flex-end' },
  identity: { paddingHorizontal: 20, paddingBottom: SHEET_OVERLAP + 18 },
  sheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
    marginTop: -SHEET_OVERLAP,
    paddingTop: 10,
    minHeight: Math.round(SCREEN_HEIGHT * 0.6),
  },

  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
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
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  // Bottom line of the identity block: "created by" (left) + taxonomy badges
  // (right) so the badges anchor the bottom-right corner of the section.
  bottomMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  vitals: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
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

  // Summary
  summaryBlock: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  biographyLink: { alignSelf: 'flex-end', paddingTop: 8 },
  biographyLinkText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.orange,
  },
  summary: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.navy,
    lineHeight: 22,
    opacity: 0.85,
    textAlign: 'justify',
  },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
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
  dossierGroupLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  dossierGroupSpacing: { marginTop: 18 },

  // Circular stat dials
  statsCard: {
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 18,
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
    paddingHorizontal: 12,
    marginTop: 2,
  },
  statTotal: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
    opacity: 0.45,
    letterSpacing: 0.3,
  },
  statPercentile: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    letterSpacing: 0.2,
  },

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
    color: COLORS.navy,
    opacity: 0.6,
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

  // First issue
  // First Appearance — horizontal editorial card (cover + issue meta).
  debutCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 16,
    borderCurve: 'continuous',
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
    color: COLORS.orange,
  },
  errorText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: COLORS.red,
    textAlign: 'center',
    paddingHorizontal: 32,
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
  },
  compareBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
