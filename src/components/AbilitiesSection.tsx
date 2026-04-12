// src/components/AbilitiesSection.tsx
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { getPowerIcon } from '../constants/powerIcons';
import { Skeleton } from './ui/Skeleton';
import { SkeletonProvider } from './ui/SkeletonProvider';

const COLLAPSED_COUNT = 8;
const ORB_SIZE = 64;
const ITEM_WIDTH = 76;

interface Props {
  powers: string[] | null;
  loading: boolean;
}

function PowerOrb({ name }: { name: string }) {
  const { icon, gradientStart, gradientEnd } = getPowerIcon(name);
  return (
    <View style={styles.orbItem}>
      <LinearGradient
        colors={[gradientStart, gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.orb}
      >
        <Ionicons name={icon as any} size={26} color="white" style={styles.orbIcon} />
      </LinearGradient>
      <Text style={styles.orbName} numberOfLines={2}>{name}</Text>
    </View>
  );
}

function MoreOrb({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.orbItem}>
      <View style={[styles.orb, styles.moreOrb]}>
        <Text style={styles.moreOrbText}>+{count}</Text>
      </View>
      <Text style={styles.orbName}>more</Text>
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
      {/* Section header — matches the app's existing Section pattern */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Abilities</Text>
        <View style={styles.divider} />
      </View>

      {loading ? (
        <SkeletonProvider>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.orbItem}>
                <Skeleton width={ORB_SIZE} height={ORB_SIZE} borderRadius={ORB_SIZE / 2} />
                <Skeleton width={52} height={10} borderRadius={4} style={styles.skeletonLabel} />
              </View>
            ))}
          </ScrollView>
        </SkeletonProvider>
      ) : expanded ? (
        <>
          <View style={styles.expandedGrid}>
            {visible.map((name, index) => (
              <PowerOrb key={`${index}-${name}`} name={name} />
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
            <PowerOrb key={`${index}-${name}`} name={name} />
          ))}
          {overflow > 0 && (
            <MoreOrb count={overflow} onPress={() => setExpanded(true)} />
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

  // Section header — mirrors the app's existing Section component style
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

  // Scroll view — padding goes on contentContainerStyle, NOT style, to avoid clipping
  scrollView: {},
  scrollContent: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  // Orb item
  orbItem: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    gap: 6,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  orbIcon: {
    // drop-shadow via shadow props on the orb itself
  },
  orbName: {
    fontFamily: 'Flame-Regular',
    fontSize: 9,
    color: COLORS.navy,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 12,
  },

  // "+N more" orb
  moreOrb: {
    backgroundColor: COLORS.navy,
  },
  moreOrbText: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.beige,
  },

  // Expanded grid
  expandedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
  },

  // Show less
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
  skeletonLabel: {
    marginTop: 6,
  },
});
