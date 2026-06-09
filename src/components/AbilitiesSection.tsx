import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/colors';
import { getPowerIcon } from '../constants/powerIcons';
import { Skeleton } from './ui/Skeleton';
import { SkeletonProvider } from './ui/SkeletonProvider';

const COLLAPSED_COUNT = 8;

interface Props {
  powers: string[] | null;
  loading: boolean;
}

// One reference-grid cell: a gradient icon disc + the ability name.
function AbilityItem({ name }: { name: string }) {
  const { icon, gradientStart, gradientEnd } = getPowerIcon(name);
  return (
    <View style={styles.item}>
      <LinearGradient
        colors={[gradientStart, gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.itemIcon}
      >
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color="#fff" />
      </LinearGradient>
      <Text style={styles.itemName} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

export function AbilitiesSection({ powers, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!loading && (!powers || powers.length === 0)) return null;

  const total = powers?.length ?? 0;
  const visible = powers ? (expanded ? powers : powers.slice(0, COLLAPSED_COUNT)) : [];
  const overflow = Math.max(0, total - COLLAPSED_COUNT);

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Abilities</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.body}>
        {loading && !powers ? (
          <SkeletonProvider>
            <View style={styles.grid}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={styles.item}>
                  <Skeleton width={34} height={34} borderRadius={17} />
                  <Skeleton width="62%" height={12} borderRadius={4} />
                </View>
              ))}
            </View>
          </SkeletonProvider>
        ) : (
          <>
            <View style={styles.grid}>
              {visible.map((name, i) => (
                <AbilityItem key={`${i}-${name}`} name={name} />
              ))}
            </View>
            {overflow > 0 ? (
              <TouchableOpacity
                onPress={() => setExpanded((e) => !e)}
                activeOpacity={0.7}
                style={styles.toggle}
              >
                <Text style={styles.toggleText}>
                  {expanded ? 'Show less' : `Show all ${total}`}
                </Text>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={COLORS.orange}
                />
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionHeader: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
    textAlign: 'right',
    paddingVertical: 5,
  },
  divider: {
    height: 2,
    backgroundColor: COLORS.navy,
    borderRadius: 30,
    marginBottom: 14,
  },

  body: { paddingHorizontal: 20, paddingTop: 2 },
  // Two-column reference grid.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  item: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    flex: 1,
    fontFamily: 'FlameSans-Regular',
    fontSize: 13.5,
    lineHeight: 17,
    color: COLORS.navy,
  },

  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 18,
  },
  toggleText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.orange,
  },
});
