import { Fragment, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { type IssueCreator, type NewComic, type NewComicCharacter } from '../../src/lib/db/comics';
import { useIssue, useNewComics } from '../../src/lib/query/comicQueries';
import { HeroImage } from '../../src/components/HeroImage';
import { UniverseEyebrow } from '../../src/components/PublisherBadge';
import { ComicCoverRail } from '../../src/components/home/ComicCoverRail';
import { brandForPublisher } from '../../src/constants/publishers';
import { COLORS, SURFACE, SEAM_COLOR } from '../../src/constants/colors';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { NotFoundView } from '../../src/components/NotFoundView';

// Wide editorial layout constants — the cover straddles the dark→paper seam.
const MAXW = 1100;
const PAD = 24;
const COVER_W = 256;
const COVER_H = 384;
const COVER_TOP = 150; // sits clear of the floating web TopBar
const HEADER_H = COVER_TOP + Math.round(COVER_H / 2); // seam at the cover's midline
const COVER_COL = PAD + COVER_W + 48; // left reserve for content beside the cover

function onSaleLabel(storeDate: string | null): string | null {
  if (!storeDate) return null;
  const d = new Date(storeDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// A historical issue can credit dozens of one-off characters with no art. Show
// the recognizable cast — those with a portrait — and cap it; only fall back to
// the raw list when almost nobody has art (so the section is never empty for an
// obscure book).
function curateCast(chars: NewComicCharacter[], cap = 12): NewComicCharacter[] {
  const withArt = chars.filter((c) => !!(c.portrait_url || c.image_url));
  return (withArt.length >= 3 ? withArt : chars).slice(0, cap);
}

// True only for issues that shipped in the recent window — so the "New this week"
// kicker isn't shown on a read-through historical issue (a debut, a back issue).
function isNewThisWeek(storeDate: string | null): boolean {
  if (!storeDate) return false;
  const d = new Date(storeDate);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() <= 21 * 86_400_000;
}

// Publisher mark · "new this week" · big title · divided spec rail.
function Masthead({
  issue,
  accent,
  centered,
  showStats = true,
}: {
  issue: NewComic;
  accent: string;
  centered: boolean;
  showStats?: boolean;
}) {
  const onSale = onSaleLabel(issue.storeDate);
  const count = issue.characters.length;
  const stats = [
    onSale ? `On sale ${onSale}` : null,
    issue.publisher,
    count > 0 ? `${count} ${count === 1 ? 'character' : 'characters'}` : null,
  ].filter((s): s is string => !!s);

  return (
    <View style={[ms.col, centered && ms.colCentered]}>
      <UniverseEyebrow publisher={issue.publisher} logoHeight={20} textStyle={ms.pub} />
      {isNewThisWeek(issue.storeDate) ? (
        <Text style={[ms.kicker, { color: accent }]}>New this week</Text>
      ) : null}
      <Text style={[ms.title, centered ? ms.titleNarrow : ms.titleWide]} numberOfLines={3}>
        {issue.volumeName ?? 'Untitled'}
        {issue.issueNumber ? (
          <Text style={[ms.issueNo, { color: accent }]}>{`  #${issue.issueNumber}`}</Text>
        ) : null}
      </Text>
      {issue.storyTitle ? (
        <Text style={[ms.story, centered && ms.storyCentered]} numberOfLines={2}>
          “{issue.storyTitle}”
        </Text>
      ) : null}
      {showStats && stats.length > 0 ? (
        <View style={[ms.statRail, centered && ms.statCentered]}>
          {stats.map((s, i) => (
            <Fragment key={s}>
              {i > 0 ? <View style={ms.statDivider} /> : null}
              <Text style={ms.statText}>{s}</Text>
            </Fragment>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Synopsis({ text, accent, centered }: { text: string; accent: string; centered: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 340;
  return (
    <View style={syn.wrap}>
      <Text style={[syn.heading, { color: accent }, centered && syn.center]}>The Story</Text>
      <Text
        style={[syn.body, centered && syn.center]}
        numberOfLines={expanded || !long ? undefined : 6}
      >
        {text}
      </Text>
      {long ? (
        <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={6}>
          <Text style={[syn.more, { color: accent }, centered && syn.center]}>
            {expanded ? 'Show less' : 'Read more'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ComicVine lists each creator with a free-text role; bucket them into the
// canonical credits so "penciler, inker" lands under Art, etc.
const CREATOR_ROLES: [string, string[]][] = [
  ['Writer', ['writer', 'script', 'plot']],
  ['Art', ['pencil', 'artist', 'inker', 'breakdowns', 'finishes', 'illustrat']],
  ['Colors', ['color', 'colour']],
  ['Letters', ['letter']],
  ['Cover', ['cover']],
  ['Editor', ['editor']],
];

function groupCreators(creators: IssueCreator[]): { label: string; names: string[] }[] {
  const buckets = new Map<string, string[]>();
  for (const c of creators) {
    const role = (c.role ?? '').toLowerCase();
    for (const [label, matchers] of CREATOR_ROLES) {
      if (matchers.some((m) => role.includes(m))) {
        const list = buckets.get(label) ?? [];
        if (!list.includes(c.name)) list.push(c.name);
        buckets.set(label, list);
      }
    }
  }
  return CREATOR_ROLES.map(([label]) => ({ label, names: buckets.get(label) ?? [] })).filter(
    (g) => g.names.length > 0,
  );
}

function Credits({
  creators,
  accent,
  centered,
  stacked,
  wide,
}: {
  creators: IssueCreator[];
  accent: string;
  centered: boolean;
  stacked?: boolean;
  wide?: boolean;
}) {
  const groups = groupCreators(creators);
  if (groups.length === 0) return null;
  const cap = wide ? 8 : 5;
  const items = groups.map((g) => {
    const names =
      g.names.slice(0, cap).join(', ') +
      (g.names.length > cap ? ` +${g.names.length - cap} more` : '');
    if (wide || stacked) {
      return (
        <View key={g.label} style={wide ? cr.wideItem : undefined}>
          <DossierItem label={g.label} value={names} />
        </View>
      );
    }
    return (
      <View key={g.label} style={[cr.row, centered && cr.rowCentered]}>
        <Text style={cr.role}>{g.label}</Text>
        <Text style={cr.names}>{names}</Text>
      </View>
    );
  });
  return (
    <View style={wide ? cr.wrapWide : cr.wrap}>
      <Text style={[cr.heading, { color: accent }, centered && cr.center]}>Creators</Text>
      {wide ? <View style={cr.wideRow}>{items}</View> : items}
    </View>
  );
}

// A stacked label/value row — the sidebar dossier idiom (no awkward wrapping in a
// narrow column).
function DossierItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={cr.item}>
      <Text style={cr.itemLabel}>{label}</Text>
      <Text style={cr.itemValue}>{value}</Text>
    </View>
  );
}

function Details({ issue, accent }: { issue: NewComic; accent: string }) {
  const onSale = onSaleLabel(issue.storeDate);
  const count = issue.characters.length;
  const rows: [string, string][] = [];
  if (onSale) rows.push(['On sale', onSale]);
  if (issue.publisher) rows.push(['Publisher', issue.publisher]);
  if (count > 0) rows.push(['Cast', `${count} ${count === 1 ? 'character' : 'characters'}`]);
  if (rows.length === 0) return null;
  return (
    <View style={cr.wrap}>
      <Text style={[cr.heading, { color: accent }]}>Details</Text>
      {rows.map(([label, val]) => (
        <DossierItem key={label} label={label} value={val} />
      ))}
    </View>
  );
}

function CoverArt({ url, accent }: { url: string | null; accent: string }) {
  return (
    <View style={[art.shadow, { borderColor: accent }]}>
      {url ? (
        <Image source={{ uri: url }} contentFit="cover" style={art.img} />
      ) : (
        <View style={[art.img, art.fallback]}>
          <Ionicons name="book-outline" size={34} color="rgba(255,255,255,0.5)" />
        </View>
      )}
    </View>
  );
}

function CastCard({
  character,
  accent,
  lead,
  onPress,
}: {
  character: NewComicCharacter;
  accent: string;
  lead: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={cast.card}
      accessibilityRole="button"
      accessibilityLabel={`View ${character.name}`}
    >
      <View style={[cast.frame, lead && { borderColor: accent, borderWidth: 2.5 }]}>
        <HeroImage
          id={character.id}
          name={character.name}
          imageUrl={character.image_url}
          portraitUrl={character.portrait_url}
          grid
          contentFit="cover"
          contentPosition="top"
          style={StyleSheet.absoluteFill as object}
          recyclingKey={character.id}
          transition={150}
        />
        <LinearGradient
          colors={['transparent', 'rgba(11,24,32,0.92)']}
          locations={[0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        {lead ? (
          <View style={[cast.leadTag, { backgroundColor: accent }]}>
            <Text style={cast.leadTagText}>Lead</Text>
          </View>
        ) : null}
        <Text style={cast.name} numberOfLines={2}>
          {character.name}
        </Text>
      </View>
    </Pressable>
  );
}

function CastRail({
  characters,
  accent,
  onPress,
}: {
  characters: NewComicCharacter[];
  accent: string;
  onPress: (id: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: accent }]}>Featuring</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.castStrip}
      >
        {characters.map((c, i) => (
          <CastCard
            key={c.id}
            character={c}
            accent={accent}
            lead={i === 0}
            onPress={() => onPress(c.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function IssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const wide = isWeb && width >= 760;
  const hasSidebar = isWeb && width >= 1000;

  // Cached/deduped via React Query (was bespoke useEffect/useState).
  // issue: undefined = loading, null = not found.
  const issueQuery = useIssue(id);
  const issue = id ? issueQuery.data : null;
  const newComics = useNewComics(12).data;
  const more = useMemo(
    () => (newComics ?? []).filter((c) => c.id !== id).slice(0, 10),
    [newComics, id],
  );

  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });

  if (issue === undefined) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={COLORS.navy} />
      </View>
    );
  }

  if (issue === null) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <NotFoundView
          stamp="Missing"
          stampColor={COLORS.red}
          icon="book-outline"
          headline="Issue not found"
          subline="We don't have this issue in the archive yet."
          actions={[{ label: 'Go back', primary: true, onPress: () => router.back() }]}
        />
      </View>
    );
  }

  const accent = brandForPublisher(issue.publisher)?.color ?? COLORS.orange;
  const cast = curateCast(issue.characters);
  const moreBand =
    more.length > 0 ? (
      <View style={styles.moreBand}>
        <ComicCoverRail
          comics={more}
          onIssuePress={(issueId) => router.push(`/issue/${issueId}`)}
        />
      </View>
    ) : null;

  // ── Wide web: the cover straddles the seam, content reflows around it. ──────
  if (wide) {
    const contentLeft = Math.max(0, (width - MAXW) / 2);
    const coverLeft = contentLeft + PAD;
    const storyBlock = issue.description ? (
      <Synopsis text={issue.description} accent={accent} centered={false} />
    ) : (
      <Text style={w.fallback}>
        {[issue.publisher, `${issue.characters.length} featured characters`]
          .filter(Boolean)
          .join('  ·  ')}
      </Text>
    );
    const castBlock =
      cast.length > 0 ? (
        <View style={w.castBlock}>
          <Text style={[w.castLabel, { color: accent }]}>Featuring</Text>
          <View style={w.castGrid}>
            {cast.map((c, i) => (
              <CastCard
                key={c.id}
                character={c}
                accent={accent}
                lead={i === 0}
                onPress={() => router.push(`/character/${c.id}`)}
              />
            ))}
          </View>
        </View>
      ) : null;
    return (
      <View style={styles.webPage}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={w.wrap}>
          {/* Dark cover-stage header (top half of cover) */}
          <View style={[w.header, { height: HEADER_H }]}>
            {issue.coverUrl ? (
              <Image
                source={{ uri: issue.coverUrl }}
                contentFit="cover"
                blurRadius={48}
                style={w.backdrop}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, w.backdropFallback]} />
            )}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: accent, opacity: 0.16 }]} />
            <LinearGradient
              colors={['rgba(11,24,32,0.32)', 'rgba(11,24,32,0.72)', 'rgba(11,24,32,0.97)']}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={w.headerInner}>
              <Masthead issue={issue} accent={accent} centered={false} showStats={!hasSidebar} />
            </View>
          </View>

          {/* Paper — three zones: cover (left) · story + featuring (main) ·
              details + creators (sidebar). The sidebar collapses into the main
              column below 1000px. */}
          <View style={w.paper}>
            <View style={w.paperInner}>
              <View style={w.overlapRow}>
                <View style={w.coverGutter} />
                {hasSidebar ? (
                  <>
                    <View style={w.mainCol}>{storyBlock}</View>
                    <View style={w.sidebar}>
                      <Details issue={issue} accent={accent} />
                    </View>
                  </>
                ) : (
                  <View style={w.rightCol}>{storyBlock}</View>
                )}
              </View>
              {castBlock}
              {issue.creators ? (
                <View style={w.creditsWide}>
                  <Credits creators={issue.creators} accent={accent} centered={false} wide />
                </View>
              ) : null}
            </View>
          </View>

          {/* The cover itself — absolute, spanning the seam */}
          <View style={[w.coverAbs, { left: coverLeft }]}>
            <CoverArt url={issue.coverUrl} accent={accent} />
          </View>
        </View>
        {moreBand}
      </View>
    );
  }

  // ── Narrow: a clean centered stack. ────────────────────────────────────────
  const narrowCoverW = Math.min(190, width * 0.48);
  const narrowBody = (
    <>
      <View style={[n.header, { minHeight: 430 }]}>
        {issue.coverUrl ? (
          <Image
            source={{ uri: issue.coverUrl }}
            contentFit="cover"
            blurRadius={22}
            style={w.backdrop}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, w.backdropFallback]} />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: accent, opacity: 0.22 }]} />
        <LinearGradient
          colors={['rgba(11,24,32,0.55)', 'rgba(11,24,32,0.82)', 'rgba(11,24,32,0.98)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        {!isWeb ? (
          <Pressable
            onPress={() => router.back()}
            style={[n.backBtn, { top: insets.top + 12 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
        ) : null}
        <View style={[n.content, { paddingTop: isWeb ? 80 : insets.top + 60 }]}>
          <View style={{ width: narrowCoverW, height: Math.round(narrowCoverW * 1.5) }}>
            <CoverArt url={issue.coverUrl} accent={accent} />
          </View>
          <Masthead issue={issue} accent={accent} centered />
        </View>
      </View>

      <View style={styles.paper}>
        {issue.description ? (
          <View style={n.synSection}>
            <Synopsis text={issue.description} accent={accent} centered={false} />
          </View>
        ) : null}
        {issue.creators ? (
          <View style={n.synSection}>
            <Credits creators={issue.creators} accent={accent} centered={false} />
          </View>
        ) : null}
        {cast.length > 0 ? (
          <CastRail
            characters={cast}
            accent={accent}
            onPress={(cid) => router.push(`/character/${cid}`)}
          />
        ) : null}
      </View>
      {moreBand}
    </>
  );

  if (isWeb) {
    return (
      <View style={styles.webPage}>
        <Stack.Screen options={{ headerShown: false }} />
        {narrowBody}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
      >
        {narrowBody}
      </ScrollView>
    </View>
  );
}

// CoverArt (shared)
const art = StyleSheet.create({
  shadow: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: COLORS.navy,
  },
  img: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});

// Wide editorial layout
const w = StyleSheet.create({
  wrap: { position: 'relative', width: '100%' },
  // Masthead grounded near the seam (flex-end) so the title anchors to the
  // cover's centre instead of floating in the upper stage.
  header: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    paddingTop: 64,
    backgroundColor: COLORS.deepNavy,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    transform: [{ scale: 1.25 }],
  } as object,
  backdropFallback: { backgroundColor: COLORS.navy },
  // Flat wash to tame bright covers so the white title always reads.
  headerDarken: { backgroundColor: 'rgba(11,24,32,0.4)' },
  headerInner: {
    maxWidth: MAXW,
    alignSelf: 'center',
    width: '100%',
    paddingLeft: COVER_COL,
    paddingRight: PAD,
    paddingBottom: 30,
  },
  paper: { width: '100%', backgroundColor: COLORS.beige, paddingBottom: 30 },
  paperInner: { maxWidth: MAXW, alignSelf: 'center', width: '100%' },
  overlapRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: Math.round(COVER_H / 2) + 24,
  },
  coverGutter: { width: COVER_COL },
  rightCol: { flex: 1, minWidth: 0, paddingRight: PAD, paddingTop: 22 } as object,
  // ≥1000px: story + featuring in the main column, details + creators in a slim
  // right sidebar (a comic dossier).
  mainCol: { flex: 1, minWidth: 0, paddingTop: 22, paddingRight: 28 } as object,
  sidebar: {
    width: 232,
    flexShrink: 0,
    paddingLeft: 26,
    paddingRight: PAD,
    paddingTop: 24,
    gap: 24,
    borderLeftWidth: 1,
    borderLeftColor: '#e6dccd',
  } as object,
  fallback: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.grey,
    letterSpacing: 0.3,
  },
  // Featuring, flowing under the synopsis (beside the cover) — not stranded below.
  // Featuring spans the full width below the (always-short) dossier, so the cast
  // breathes and no creators list can strand a gap above it.
  castBlock: { marginTop: 16, paddingHorizontal: PAD },
  castLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 14,
  },
  // Wrapping grid — all characters visible, contained (no horizontal bleed).
  castGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Creators as a full-width multi-column strip below Featuring — the "end
  // credits", so the dossier sidebar stays short.
  creditsWide: { paddingHorizontal: PAD, marginTop: 30 },
  // The cover, straddling the dark→paper seam.
  coverAbs: {
    position: 'absolute',
    top: COVER_TOP,
    width: COVER_W,
    height: COVER_H,
    zIndex: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 26,
    elevation: 16,
  } as object,
});

// Narrow stacked layout
const n = StyleSheet.create({
  header: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    paddingBottom: 28,
    backgroundColor: COLORS.deepNavy,
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { alignItems: 'center', gap: 18, paddingHorizontal: 20, paddingBottom: 4 },
  synSection: { paddingHorizontal: 20, paddingTop: 22 },
});

const ms = StyleSheet.create({
  col: { gap: 11 },
  colCentered: { alignItems: 'center', paddingHorizontal: 6 },
  pub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  // Soft shadow so the white title reads over a light/bright blurred cover —
  // lets the header stay colourful instead of a flat dark void.
  title: {
    fontFamily: 'Flame-Regular',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
  },
  titleWide: { fontSize: 62, lineHeight: 64, textAlign: 'left', letterSpacing: -0.8 },
  titleNarrow: { fontSize: 32, lineHeight: 36, textAlign: 'center' },
  issueNo: { fontFamily: 'Flame-Regular' },
  story: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    fontStyle: 'italic',
    color: 'rgba(245,235,220,0.82)',
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  storyCentered: { textAlign: 'center' },
  statRail: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  statCentered: { justifyContent: 'center' },
  statDivider: { width: 1, height: 13, backgroundColor: 'rgba(255,255,255,0.28)' },
  statText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13.5,
    color: 'rgba(245,235,220,0.82)',
    letterSpacing: 0.3,
  },
});

const syn = StyleSheet.create({
  wrap: { gap: 9 },
  heading: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  body: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 16,
    lineHeight: 26,
    color: COLORS.navy + 'cc',
    maxWidth: 700,
  },
  center: { textAlign: 'center', alignSelf: 'center' },
  more: { fontFamily: 'Nunito_700Bold', fontSize: 13, letterSpacing: 0.3, marginTop: 4 },
});

const cr = StyleSheet.create({
  wrap: { marginTop: 26, gap: 7, maxWidth: 520 },
  heading: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', gap: 14 },
  rowCentered: { justifyContent: 'center' },
  role: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    width: 58,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingTop: 2,
  },
  names: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    color: COLORS.navy,
    flex: 1,
    lineHeight: 20,
  },
  // Stacked label/value — the sidebar dossier idiom.
  item: { gap: 1, marginBottom: 9 },
  itemLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  itemValue: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    color: COLORS.navy,
    lineHeight: 19,
  },
  // Full-width "end credits" — roles laid out as a wrapping multi-column grid.
  wrapWide: { width: '100%' },
  wideRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 40, rowGap: 16, marginTop: 6 },
  wideItem: { width: 220 },
});

const cast = StyleSheet.create({
  card: { width: 104 },
  frame: {
    width: 104,
    height: 142,
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    borderWidth: 1,
    borderColor: '#e2d6c6',
    justifyContent: 'flex-end',
  },
  leadTag: {
    position: 'absolute',
    top: 7,
    left: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  leadTagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  name: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    color: COLORS.beige,
    lineHeight: 14,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  // minHeight floors the beige at one viewport so a short page doesn't leak the
  // now-navy body below it; grows to content past that under document scroll.
  webPage: { width: '100%', minHeight: '100dvh', backgroundColor: COLORS.beige } as object,
  loading: {
    flex: 1,
    backgroundColor: COLORS.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paper: { backgroundColor: COLORS.beige },
  section: { paddingTop: 22, paddingBottom: 10 },
  sectionLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 2,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  castStrip: { gap: 12, paddingHorizontal: 20, paddingBottom: 4 },
  moreBand: {
    backgroundColor: SURFACE.ink,
    borderTopWidth: 1,
    borderTopColor: SEAM_COLOR,
    paddingTop: 22,
    paddingBottom: 24,
    marginTop: 6,
  },
});
