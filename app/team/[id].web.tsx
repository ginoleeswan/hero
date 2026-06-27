// app/team/[id].web.tsx — web team roster browse page.
// Mirrors the universe/category browse page: a dark "gallery" canvas, a
// publisher-branded BrowseBanner masthead (the team name in the display face on
// its publisher's brand colour, with a member-portrait montage), and gallery
// hero cards. Data is the small one-shot roster from useTeamPage (no filters /
// pagination — teams are small).
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTeamPage } from '../../src/hooks/useTeamPage';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS, SURFACE } from '../../src/constants/colors';
import { brandForPublisher } from '../../src/constants/publishers';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { useSkeletonAnim } from '../../src/components/web/Skeleton';
import { SeoHead } from '../../src/components/web/SeoHead';
import { BrowseBanner } from '../../src/components/web/category/BrowseBanner';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';
import type { RosterHero } from '../../src/lib/teamBattle';

// Teams with no recognised publisher fall back to a warm orange stage.
const FALLBACK_COLOR = COLORS.orange;
const FALLBACK_COLOR_DARK = '#7a3411';

// ── Gallery card (matches the category/universe HeroCard) ─────────────────────
function SkeletonCard({ opacity }: { opacity: Animated.Value }) {
  return <Animated.View style={[sk.wrap as object, { opacity }]} />;
}
const sk = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 10,
    aspectRatio: '3 / 4',
    backgroundColor: '#1b3038',
  } as object,
});

function HeroCard({
  hero,
  onPress,
  onInfo,
}: {
  hero: RosterHero;
  onPress: () => void;
  onInfo: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onInfo}
      delayLongPress={300}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [card.wrap, hovered && (card.wrapHover as object)] as object
      }
    >
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
        <>
          <HeroImage
            id={String(hero.id)}
            name={hero.name}
            imageUrl={hero.image_url}
            portraitUrl={hero.portrait_url}
            grid
            contentFit="cover"
            contentPosition={{ top: 0, left: '50%' }}
            style={StyleSheet.absoluteFill}
            recyclingKey={String(hero.id)}
            transition={150}
          />
          <View style={card.overlay as object} />
          <View style={card.bottom}>
            <Text style={card.name as object} numberOfLines={2}>
              {hero.name}
            </Text>
          </View>
          <Pressable
            onPress={onInfo}
            accessibilityLabel={`About ${hero.name}`}
            pointerEvents={hovered ? 'auto' : 'none'}
            style={({ hovered: chipHovered }: { pressed: boolean; hovered?: boolean }) =>
              [
                card.infoChip,
                { opacity: hovered ? 1 : 0 },
                chipHovered && (card.infoChipHover as object),
              ] as object
            }
          >
            <Ionicons name="information" size={15} color={COLORS.beige} />
          </Pressable>
        </>
      )}
    </Pressable>
  );
}
const card = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
    aspectRatio: '3 / 4',
  } as object,
  wrapHover: {
    transform: [{ scale: 1.04 }],
    boxShadow: '0 20px 56px rgba(0,0,0,0.32)',
    zIndex: 2,
  } as object,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(11,24,32,0.98) 0%, rgba(11,24,32,0.6) 26%, rgba(11,24,32,0.12) 48%, transparent 70%)',
  } as object,
  bottom: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.beige,
    lineHeight: 18,
    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
  } as object,
  infoChip: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,14,10,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.4)',
    cursor: 'pointer',
    transition: 'opacity 150ms ease, background-color 150ms ease',
  } as object,
  infoChipHover: { backgroundColor: 'rgba(18,14,10,0.82)' } as object,
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function WebTeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { team, members, loading, notFound } = useTeamPage(id);
  const skeletonOpacity = useSkeletonAnim();

  // Dark "gallery" canvas so the colourful cards lift off it — same as universe.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

  const brand = brandForPublisher(team?.publisher);
  const color = brand?.color ?? FALLBACK_COLOR;
  const colorDark = brand?.colorDark ?? FALLBACK_COLOR_DARK;

  // Montage: lead with the top member, then a varied handful of the rest —
  // re-rolled per visit, stable across renders (keyed on the lead member only).
  const [montageUrls, setMontageUrls] = useState<string[]>([]);
  const topMemberId = members[0]?.id;
  useEffect(() => {
    if (members.length === 0) {
      setMontageUrls([]);
      return;
    }
    const pool = members.slice(1, 24);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setMontageUrls(
      [members[0], ...pool.slice(0, 5)]
        .map((h) => h.portrait_url ?? h.image_url)
        .filter((u): u is string => !!u),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topMemberId]);

  const [peek, setPeek] = useState<PeekHero | null>(null);

  const contentPad = isDesktop ? 32 : 16;
  const gridStyle = useMemo(
    () => ({
      display: 'grid',
      gridTemplateColumns: isDesktop
        ? 'repeat(auto-fill, minmax(160px, 1fr))'
        : 'repeat(auto-fill, minmax(108px, 1fr))',
      gap: 15,
    }),
    [isDesktop],
  );

  return (
    <View style={styles.root}>
      <SeoHead
        title={team ? `${team.name} — team | Mythique` : 'Team | Mythique'}
        description={
          team
            ? `Meet the members of ${team.name}${team.publisher ? `, the ${team.publisher} team` : ''}.`
            : 'Team roster on Mythique.'
        }
        path={`/team/${id}`}
        noindex
      />

      {team && (
        <BrowseBanner
          title={team.name}
          color={color}
          colorDark={colorDark}
          total={team.member_count}
          leadName={members[0]?.name}
          heroImageUrls={montageUrls}
          unitLabel="MEMBER"
          compact={!isDesktop}
          sticky={isDesktop}
        />
      )}

      {notFound && (
        <View style={[styles.notFoundStage, { paddingHorizontal: contentPad }] as object}>
          <Text style={styles.notFoundTitle as object}>Team not found</Text>
          <Text style={styles.notFoundSub as object}>This team doesn’t exist.</Text>
        </View>
      )}

      <View style={[styles.gridWrap, { paddingHorizontal: contentPad }] as object}>
        {loading ? (
          <View style={gridStyle as object}>
            {Array.from({ length: 18 }).map((_, i) => (
              <SkeletonCard key={i} opacity={skeletonOpacity} />
            ))}
          </View>
        ) : members.length === 0 ? (
          !notFound && <Text style={styles.empty as object}>No members found.</Text>
        ) : (
          <View style={gridStyle as object}>
            {members.map((h) => (
              <HeroCard
                key={h.id}
                hero={h}
                onPress={() => router.push(`/character/${h.id}`)}
                onInfo={() => setPeek(h)}
              />
            ))}
          </View>
        )}
      </View>

      {peek && (
        <HeroPeek
          hero={peek}
          onClose={() => setPeek(null)}
          onFight={() => router.push(`/compare/${peek.id}/pick`)}
          onViewProfile={() => {
            setPeek(null);
            router.push(`/character/${peek.id}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Grows with content (document scroll), dark gallery floor.
  root: { minHeight: '100vh' as unknown as number, backgroundColor: SURFACE.ink },
  gridWrap: {
    maxWidth: 1680,
    width: '100%',
    alignSelf: 'center',
    paddingTop: 20,
    paddingBottom: 40,
    backgroundColor: SURFACE.ink,
  } as object,
  empty: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: 'rgba(245,235,220,0.55)',
    paddingTop: 40,
  } as object,
  notFoundStage: {
    maxWidth: 1680,
    width: '100%',
    alignSelf: 'center',
    paddingTop: TOPBAR_HEIGHT + 60,
    paddingBottom: 12,
  } as object,
  notFoundTitle: { fontFamily: 'Flame-Regular', fontSize: 34, color: COLORS.beige } as object,
  notFoundSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: 'rgba(245,235,220,0.55)',
    marginTop: 6,
  } as object,
});
