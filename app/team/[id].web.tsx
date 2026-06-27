// app/team/[id].web.tsx — web team roster browse page.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTeamPage } from '../../src/hooks/useTeamPage';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS, SURFACE, SURFACE_GRADIENT, SEAM_COLOR } from '../../src/constants/colors';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { SeoHead } from '../../src/components/web/SeoHead';

export default function WebTeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { team, members, loading, notFound } = useTeamPage(id);
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });

  const eyebrow = team
    ? `${team.member_count.toLocaleString()} ${team.member_count === 1 ? 'member' : 'members'}${team.publisher ? ` · ${team.publisher}` : ''}`
    : '';

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 12,
  };

  return (
    <View style={styles.root}>
      <SeoHead
        title={team ? `${team.name} — team | Mythique` : 'Team | Mythique'}
        description={team ? `The members of ${team.name}.` : 'Team roster on Mythique.'}
        path={`/team/${id}`}
        noindex
      />
      <View style={styles.stage as object}>
        <View style={styles.stageInner}>
          <Text style={styles.eyebrow as object}>{eyebrow}</Text>
          <Text style={styles.title as object} numberOfLines={2}>
            {team?.name ?? (notFound ? 'Team not found' : ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.body as object}>
        {loading ? null : members.length === 0 ? (
          <Text style={styles.empty as object}>
            {notFound ? 'This team doesn’t exist.' : 'No members found.'}
          </Text>
        ) : (
          <View style={gridStyle as object}>
            {members.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => router.push(`/character/${h.id}`)}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [styles.card, hovered && (styles.cardHover as object)] as object
                }
              >
                <HeroImage
                  id={h.id}
                  name={h.name}
                  imageUrl={h.image_url}
                  portraitUrl={h.portrait_url}
                  grid
                  contentFit="cover"
                  contentPosition={{ top: 0, left: '50%' }}
                  style={StyleSheet.absoluteFill}
                  recyclingKey={h.id}
                  transition={150}
                />
                <View style={styles.cardOverlay as object} />
                <Text style={styles.cardName as object} numberOfLines={2}>
                  {h.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  stage: {
    backgroundColor: COLORS.navy,
    backgroundImage: SURFACE_GRADIENT.stage,
    paddingTop: TOPBAR_HEIGHT + 40,
    paddingBottom: 28,
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
    boxShadow: '0 14px 30px -14px rgba(11,24,32,0.55)',
  } as object,
  stageInner: { maxWidth: 1200, width: '100%', alignSelf: 'center' },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 6,
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 40,
    color: COLORS.beige,
    lineHeight: 44,
  } as object,
  body: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  empty: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.grey,
    paddingTop: 40,
  } as object,
  card: {
    width: '100%',
    aspectRatio: '3 / 4',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  cardHover: {
    transform: [{ scale: 1.04 }],
    boxShadow: '0 20px 56px rgba(0,0,0,0.32)',
    zIndex: 2,
  } as object,
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.97) 0%, rgba(29,45,51,0.08) 55%, transparent 100%)',
  } as object,
  cardName: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.beige,
    lineHeight: 18,
    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
  } as object,
});
