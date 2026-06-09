import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import {
  getPowerIcon,
  POWER_CATEGORY_ORDER,
  POWER_CATEGORY_META,
  type PowerCategory,
} from '../constants/powerIcons';
import { Skeleton } from './ui/Skeleton';
import { SkeletonProvider } from './ui/SkeletonProvider';

interface Props {
  powers: string[] | null;
  loading: boolean;
}

interface AbilityEntry {
  name: string;
  icon: string;
}

interface AbilityGroup {
  category: PowerCategory;
  label: string;
  color: string;
  items: AbilityEntry[];
}

// Bucket abilities by category, preserving order within each group and dropping
// empty categories. Order follows POWER_CATEGORY_ORDER for consistency.
function groupAbilities(powers: string[]): AbilityGroup[] {
  const buckets = new Map<PowerCategory, AbilityEntry[]>();
  for (const name of powers) {
    const def = getPowerIcon(name);
    const arr = buckets.get(def.category) ?? [];
    arr.push({ name, icon: def.icon });
    buckets.set(def.category, arr);
  }
  return POWER_CATEGORY_ORDER.filter((c) => buckets.has(c)).map((c) => ({
    category: c,
    label: POWER_CATEGORY_META[c].label,
    color: POWER_CATEGORY_META[c].color,
    items: buckets.get(c)!,
  }));
}

export function AbilitiesSection({ powers, loading }: Props) {
  if (!loading && (!powers || powers.length === 0)) return null;

  const groups = powers ? groupAbilities(powers) : [];

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Abilities</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.body}>
        {loading && !powers ? (
          <SkeletonProvider>
            {[0, 1].map((b) => (
              <View key={b} style={styles.group}>
                <Skeleton width={96} height={11} borderRadius={4} style={{ marginBottom: 14 }} />
                <View style={styles.items}>
                  {[92, 120, 78].map((w, i) => (
                    <Skeleton key={i} width={w} height={16} borderRadius={4} />
                  ))}
                </View>
              </View>
            ))}
          </SkeletonProvider>
        ) : (
          groups.map((g, gi) => (
            <View key={g.category} style={[styles.group, gi === groups.length - 1 && styles.groupLast]}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupMarker, { backgroundColor: g.color }]} />
                <Text style={[styles.groupLabel, { color: g.color }]}>{g.label}</Text>
                <Text style={styles.groupCount}>{g.items.length}</Text>
              </View>
              <View style={styles.items}>
                {g.items.map((it, i) => (
                  <View key={`${i}-${it.name}`} style={styles.item}>
                    <Ionicons
                      name={it.icon as keyof typeof Ionicons.glyphMap}
                      size={15}
                      color={g.color}
                    />
                    <Text style={styles.itemName}>{it.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
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
    marginBottom: 16,
  },

  body: { paddingHorizontal: 20 },

  group: { marginBottom: 22 },
  groupLast: { marginBottom: 2 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 12,
  },
  groupMarker: { width: 16, height: 3, borderRadius: 2 },
  groupLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  groupCount: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.navy,
    opacity: 0.35,
  },

  // Abilities flow and wrap within a category.
  items: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 18,
    rowGap: 13,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.navy,
  },
});
