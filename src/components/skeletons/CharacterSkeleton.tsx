import { View, StyleSheet } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';

function NameBlock() {
  return (
    <View style={styles.nameBlock}>
      <Skeleton width="55%" height={34} borderRadius={8} />
      <View style={styles.nameRow}>
        <Skeleton width="40%" height={14} borderRadius={6} />
        <Skeleton width={50} height={30} borderRadius={4} />
      </View>
      <View style={styles.nameDivider} />
    </View>
  );
}

function SummaryBlock() {
  return (
    <View style={styles.summaryBlock}>
      <Skeleton width="100%" height={12} borderRadius={5} style={styles.summaryLine} />
      <Skeleton width="92%" height={12} borderRadius={5} style={styles.summaryLine} />
      <Skeleton width="75%" height={12} borderRadius={5} style={styles.summaryLine} />
    </View>
  );
}

function StatDialsSkeleton() {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Skeleton width="30%" height={18} borderRadius={6} style={styles.sectionTitleSkeleton} />
      </View>
      <View style={styles.sectionDivider} />
      <View style={styles.statsCard}>
        <View style={styles.statsGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.dialWrap}>
              <Skeleton width={72} height={72} borderRadius={36} />
              <Skeleton width={52} height={11} borderRadius={4} style={styles.dialLabel} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function InfoSectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Skeleton width="35%" height={18} borderRadius={6} style={styles.sectionTitleSkeleton} />
      </View>
      <View style={styles.sectionDivider} />
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.infoRow}>
          <Skeleton width="30%" height={13} borderRadius={5} />
          <Skeleton width="45%" height={13} borderRadius={5} />
        </View>
      ))}
    </View>
  );
}

export function CharacterSkeleton({ hideNameBlock = false }: { hideNameBlock?: boolean }) {
  return (
    <SkeletonProvider>
      <View style={styles.container}>
        {!hideNameBlock && <NameBlock />}
        <SummaryBlock />
        <StatDialsSkeleton />
        <InfoSectionSkeleton rows={5} />
        <InfoSectionSkeleton rows={4} />
        <InfoSectionSkeleton rows={2} />
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },

  // Name block
  nameBlock: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  nameDivider: {
    height: 2,
    backgroundColor: '#e8ddd0',
    borderRadius: 30,
    marginTop: 12,
  },

  // Summary
  summaryBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 7,
  },
  summaryLine: {},

  // Sections
  section: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionTitleRow: {
    alignItems: 'flex-end',
    paddingVertical: 5,
  },
  sectionTitleSkeleton: {},
  sectionDivider: {
    height: 2,
    backgroundColor: '#e8ddd0',
    borderRadius: 30,
    marginBottom: 14,
  },

  // Stat dials (matches real circular-dial statsCard layout)
  statsCard: {
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  dialWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    marginVertical: 6,
  },
  dialLabel: {
    marginTop: 8,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
});
