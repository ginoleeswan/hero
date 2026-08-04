import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Image } from 'expo-image';
import { COLORS, PAPER_TEXT, ORANGE_INK } from '../../constants/colors';
import type { WatchKind, WatchProvider } from '../../lib/db/titles';

const GROUPS: { kind: WatchKind; label: string }[] = [
  { kind: 'flatrate', label: 'Stream' },
  { kind: 'rent', label: 'Rent' },
  { kind: 'buy', label: 'Buy' },
];

function ProviderTile({ p, onPress }: { p: WatchProvider; onPress?: () => void }) {
  const tile = (
    <View style={styles.tile}>
      {p.logoUrl ? (
        <Image
          source={{ uri: p.logoUrl }}
          style={styles.logo}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <Text style={styles.fallback} numberOfLines={1}>
          {p.name}
        </Text>
      )}
    </View>
  );

  if (!onPress) {
    return (
      <View style={styles.tileItem} accessible accessibilityLabel={p.name}>
        {tile}
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={styles.tileItem}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="link"
      accessibilityLabel={`Watch on ${p.name}`}
    >
      {tile}
    </TouchableOpacity>
  );
}

export function WhereToWatch({
  providers,
  link,
  inCard,
}: {
  providers: WatchProvider[];
  link: string | null;
  inCard?: boolean;
}) {
  if (providers.length === 0) return null;

  const open = link ? () => Linking.openURL(link) : undefined;
  const groups = GROUPS.map((g) => ({
    ...g,
    items: providers.filter((p) => p.kind === g.kind),
  })).filter((g) => g.items.length > 0);

  const body = (
    <View style={styles.groups}>
      {groups.map((g) => (
        <View key={g.kind} style={styles.group}>
          <Text style={styles.groupLabel}>{g.label}</Text>
          <View style={styles.tileWrap}>
            {g.items.map((p) => (
              <ProviderTile key={p.name} p={p} onPress={open} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  if (inCard) return body;

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Where to Watch</Text>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12, paddingHorizontal: 20 },
  label: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: ORANGE_INK,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  groups: { gap: 16 },
  group: { gap: 9 },
  groupLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10.5,
    color: PAPER_TEXT.faint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tileWrap: {
    ...Platform.select({
      // Responsive grid: columns auto-fill and stretch to 1fr, so tiles always
      // fill the row edge-to-edge — no awkward trailing gap at any card width.
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))',
        gap: 10,
      } as object,
      default: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    }),
  },
  tileItem: Platform.select({
    web: { width: '100%' } as object,
    default: {},
  }) as object,
  tile: {
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.navy + '1a',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        width: '100%',
        aspectRatio: 1,
        boxShadow: '0 3px 10px -3px rgba(41,60,67,0.18)',
        cursor: 'pointer',
      } as object,
      default: { width: 48, height: 48 },
    }),
  },
  logo: { width: '100%', height: '100%' },
  fallback: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 9,
    color: COLORS.navy,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
