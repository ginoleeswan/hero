import { Text, StyleSheet } from 'react-native';

interface RoleBadgeProps {
  alignment?: string | null;
}

export function RoleBadge({ alignment }: RoleBadgeProps) {
  if (!alignment) return null;

  const isHero = alignment === 'good';
  const isVillain = alignment === 'bad';
  const isAntiHero = alignment === 'neutral';

  if (!isHero && !isVillain && !isAntiHero) return null;

  let badgeStyle: object;
  let textColor: string;
  let label: string;

  if (isHero) {
    badgeStyle = styles.heroBadge;
    textColor = '#10B981';
    label = 'Hero';
  } else if (isVillain) {
    badgeStyle = styles.villainBadge;
    textColor = '#EF4444';
    label = 'Villain';
  } else {
    badgeStyle = styles.antiHeroBadge;
    textColor = '#FB923C';
    label = 'Anti-Hero';
  }

  return (
    <Text style={[styles.badge, badgeStyle, { color: textColor }]} numberOfLines={1}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexShrink: 0,
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    height: 18,
    textAlignVertical: 'center',
  } as object,

  heroBadge: {
    backgroundColor: 'rgba(16,185,129,0.15)',
  } as object,

  villainBadge: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  } as object,

  antiHeroBadge: {
    backgroundColor: 'rgba(251,146,60,0.15)',
  } as object,
});
