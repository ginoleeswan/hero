import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { groupPowers } from '../constants/powerIcons';
import { Skeleton } from './ui/Skeleton';
import { SkeletonProvider } from './ui/SkeletonProvider';
import { PowersDecoded } from './character/PowersDecoded';
import type { PowerExplainer } from '../lib/db/heroFacts';

interface Props {
  powers: string[] | null;
  loading: boolean;
  explainers?: PowerExplainer[];
  /** When set, a subtle pencil sits at the right of the header to edit the whole
   *  powers list (one per line). */
  onEdit?: () => void;
}

function Header({ onEdit }: { onEdit?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Abilities</Text>
        {onEdit ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onEdit}
            hitSlop={10}
            style={styles.pencil}
            accessibilityRole="button"
            accessibilityLabel="Edit powers"
          >
            <MaterialCommunityIcons name="pencil" size={16} color="rgba(41,60,67,0.4)" />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.divider} />
    </View>
  );
}

export function AbilitiesSection({ powers, loading, explainers = [], onEdit }: Props) {
  // Pristine when empty — the section only appears once a hero has abilities.
  if (!loading && (!powers || powers.length === 0)) return null;

  const groups = powers ? groupPowers(powers) : [];

  return (
    <View style={styles.container}>
      <Header onEdit={onEdit} />

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
            <View
              key={g.category}
              style={[styles.group, gi === groups.length - 1 && styles.groupLast]}
            >
              <View style={styles.groupHeader}>
                <View style={[styles.groupMarker, { backgroundColor: g.color }]} />
                <Text style={[styles.groupLabel, { color: g.color }]}>{g.label}</Text>
                <Text style={styles.groupCount}>{g.items.length}</Text>
              </View>
              <View style={styles.items}>
                {g.items.map((it, i) => (
                  <View key={`${i}-${it.name}`} style={styles.item}>
                    <MaterialCommunityIcons
                      name={it.icon as keyof typeof MaterialCommunityIcons.glyphMap}
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
        {!loading && powers && powers.length > 0 ? <PowersDecoded explainers={explainers} /> : null}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pencil: { paddingVertical: 2 },
  sectionTitle: {
    flex: 1,
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
