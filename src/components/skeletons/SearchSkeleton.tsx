import { View, StyleSheet } from 'react-native';
import { Skeleton } from '../ui/Skeleton';

const AVATAR_SIZE = 48;
const ROWS = 10;

function SearchRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} borderRadius={AVATAR_SIZE / 2} />
      <View style={styles.text}>
        <Skeleton width="55%" height={14} borderRadius={6} />
        <Skeleton width="35%" height={11} borderRadius={5} style={styles.subline} />
      </View>
    </View>
  );
}

export function SearchSkeleton() {
  return (
    <View style={styles.container}>
      {Array.from({ length: ROWS }).map((_, i) => (
        <View key={i}>
          <SearchRowSkeleton />
          {i < ROWS - 1 && <View style={styles.separator} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 15,
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  text: {
    flex: 1,
    marginLeft: 14,
    gap: 6,
  },
  subline: {
    marginTop: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#d4c8b8',
    marginLeft: AVATAR_SIZE + 14,
  },
});
