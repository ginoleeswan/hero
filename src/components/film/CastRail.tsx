import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
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
          <Ionicons name="person" size={20} color={COLORS.grey} />
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

export function CastRail({ cast, inCard }: { cast: HeroTitleCastMember[]; inCard?: boolean }) {
  if (cast.length === 0) return null;

  if (Platform.OS === 'web') {
    const grid = (
      <View style={[webStyles.grid, inCard && webStyles.bare] as object}>
        {cast.map((member, i) => (
          <CastMember key={`${member.name}-${i}`} member={member} />
        ))}
      </View>
    );
    if (inCard) return grid;
    return (
      <View style={styles.block}>
        <Text style={styles.label}>Cast</Text>
        {grid}
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Cast</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {cast.map((member, i) => (
          <CastMember key={`${member.name}-${i}`} member={member} />
        ))}
      </ScrollView>
    </View>
  );
}

const webStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: 20,
  },
  bare: { paddingHorizontal: 0 },
});

const styles = StyleSheet.create({
  block: { gap: 8 },
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
  },
  row: {
    gap: 12,
    paddingHorizontal: 20,
  },
  member: {
    width: 72,
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.navy + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    textAlign: 'center',
    lineHeight: 13,
  },
  character: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 9,
    color: COLORS.grey,
    textAlign: 'center',
    lineHeight: 12,
  },
});
