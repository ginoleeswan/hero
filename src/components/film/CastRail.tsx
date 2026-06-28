import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import type { HeroTitleCastMember } from '../../lib/db/titles';

function CastMember({ member }: { member: HeroTitleCastMember }) {
  return (
    <View style={styles.member}>
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
      <Text style={styles.name} numberOfLines={2}>
        {member.name}
      </Text>
      {member.character ? (
        <Text style={styles.character} numberOfLines={2}>
          {member.character}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Horizontal, edge-to-edge cast rail. `inCard` drops the rail's own header (the
 * card supplies it) and bleeds the scroller to the card edges.
 */
export function CastRail({
  cast,
  inCard,
}: {
  cast: HeroTitleCastMember[];
  inCard?: boolean;
}) {
  if (cast.length === 0) return null;

  const scroller = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={inCard ? styles.bleed : undefined}
      contentContainerStyle={styles.row}
    >
      {cast.map((member, i) => (
        <CastMember key={`${member.name}-${i}`} member={member} />
      ))}
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
  avatarPlaceholder: {
    backgroundColor: COLORS.navy + '14',
    alignItems: 'center',
    justifyContent: 'center',
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
});
