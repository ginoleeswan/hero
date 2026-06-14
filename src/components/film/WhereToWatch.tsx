import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import type { WatchProvider } from '../../lib/db/films';

export function WhereToWatch({ providers }: { providers: WatchProvider[] }) {
  if (providers.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.label}>Where to Watch</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {providers.map((p) => (
          <View key={p.name} style={styles.chip}>
            {p.logoUrl ? (
              <Image
                source={{ uri: p.logoUrl }}
                style={styles.logo}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : null}
            <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

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
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.navy + '12',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logo: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  name: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
    maxWidth: 100,
  },
});
