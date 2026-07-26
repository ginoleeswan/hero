import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { HeroAvatar } from '../HeroAvatar';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { matchCharacterToHero } from '../../lib/db/titles';
import type { HeroTitleCastMember } from '../../lib/db/titles';
import type { RelatedHeroCard } from '../../lib/db/heroes';

function CastMember({
  member,
  hero,
  onPress,
}: {
  member: HeroTitleCastMember;
  hero: RelatedHeroCard | null;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <View>
        {member.profile_url ? (
          <Image
            source={{ uri: member.profile_url }}
            style={styles.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={24} color={COLORS.grey} />
          </View>
        )}
        {/* The character, not a link glyph.
            A cast row is the one place the app can show WHO an actor played
            rather than only naming them, and the avatars are cut-outs with no
            plate — so the head can overlap the headshot and read as one object.
            Falls back to the link mark for anyone with no head yet. */}
        {hero ? (
          hero.avatar_url ? (
            <View style={styles.heroHead}>
              <HeroAvatar
                id={hero.id}
                name={hero.name}
                avatarUrl={hero.avatar_url}
                size={30}
                bare
              />
            </View>
          ) : (
            <View style={styles.heroBadge}>
              <Ionicons name="link" size={11} color="#fff" />
            </View>
          )
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {member.name}
      </Text>
      {member.character ? (
        <Text
          style={[styles.character, hero && styles.characterLinked] as object}
          numberOfLines={2}
        >
          {member.character}
        </Text>
      ) : null}
    </>
  );

  if (hero && onPress) {
    return (
      <TouchableOpacity
        style={styles.member}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="link"
        accessibilityLabel={`${member.name} as ${hero.name}`}
      >
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.member}>{inner}</View>;
}

/**
 * Horizontal, edge-to-edge cast rail. When `heroes` is supplied, cast whose
 * character matches a catalog hero become tappable links to that character.
 * `inCard` drops the rail's own header (the card supplies it).
 */
export function CastRail({
  cast,
  heroes,
  inCard,
}: {
  cast: HeroTitleCastMember[];
  heroes?: RelatedHeroCard[];
  inCard?: boolean;
}) {
  const router = useRouter();
  if (cast.length === 0) return null;

  const pool = heroes ?? [];
  const goToHero = (hero: RelatedHeroCard) =>
    router.push(`/character/${hero.id}?name=${encodeURIComponent(hero.name)}`);

  const scroller = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={inCard ? styles.bleed : undefined}
      contentContainerStyle={styles.row}
    >
      {cast.map((member, i) => {
        const hero = matchCharacterToHero(member.character, pool);
        return (
          <CastMember
            key={`${member.name}-${i}`}
            member={member}
            hero={hero}
            onPress={hero ? () => goToHero(hero) : undefined}
          />
        );
      })}
    </ScrollView>
  );

  if (inCard) return scroller;

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Cast</Text>
      {scroller}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  label: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: 20,
  },
  row: {
    gap: 14,
    paddingHorizontal: 20,
  },
  bleed: { marginHorizontal: -20 },
  member: {
    width: 84,
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  // Bottom-right of the headshot, overlapping it — the cut-out needs no plate,
  // and the overlap is what makes actor and character read as one unit.
  heroHead: { position: 'absolute', right: -6, bottom: -4 },
  avatarPlaceholder: {
    backgroundColor: COLORS.navy + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.navy,
    textAlign: 'center',
    lineHeight: 14,
  },
  character: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.grey,
    textAlign: 'center',
    lineHeight: 13,
  },
  characterLinked: {
    color: COLORS.orange,
  },
});
