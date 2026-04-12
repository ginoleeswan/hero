import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { getPowerIcon } from '../constants/powerIcons';
import { Skeleton } from './ui/Skeleton';
import { SkeletonProvider } from './ui/SkeletonProvider';

const COLLAPSED_COUNT = 8;

interface Props {
  powers: string[] | null;
  loading: boolean;
}

function PowerPill({ name }: { name: string }) {
  const { icon, gradientEnd } = getPowerIcon(name);
  return (
    <View style={[styles.pill, { borderColor: gradientEnd + '40' }]}>
      <Ionicons name={icon as any} size={13} color={gradientEnd} />
      <Text style={styles.pillText}>{name}</Text>
    </View>
  );
}

function MorePill({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.morePill}>
      <Text style={styles.morePillText}>+{count} more</Text>
    </TouchableOpacity>
  );
}

export function AbilitiesSection({ powers, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!loading && (!powers || powers.length === 0)) return null;

  const overflow = powers ? Math.max(0, powers.length - COLLAPSED_COUNT) : 0;
  const visible = powers ? (expanded ? powers : powers.slice(0, COLLAPSED_COUNT)) : [];

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Abilities</Text>
        <View style={styles.divider} />
      </View>

      {loading && !powers ? (
        <SkeletonProvider>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {[80, 100, 70, 95, 85].map((w, i) => (
              <Skeleton key={i} width={w} height={34} borderRadius={17} />
            ))}
          </ScrollView>
        </SkeletonProvider>
      ) : expanded ? (
        <>
          <View style={styles.expandedGrid}>
            {visible.map((name, index) => (
              <PowerPill key={`${index}-${name}`} name={name} />
            ))}
          </View>
          <TouchableOpacity onPress={() => setExpanded(false)} style={styles.showLess}>
            <Text style={styles.showLessText}>Show less</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {visible.map((name, index) => (
            <PowerPill key={`${index}-${name}`} name={name} />
          ))}
          {overflow > 0 && (
            <MorePill count={overflow} onPress={() => setExpanded(true)} />
          )}
        </ScrollView>
      )}
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

  scrollView: {},
  scrollContent: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: '#faf7f3',
  },
  pillText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
  },

  morePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd5c8',
    backgroundColor: '#faf7f3',
  },
  morePillText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.grey,
  },

  expandedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
  },

  showLess: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  showLessText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
    textDecorationLine: 'underline',
  },
});
