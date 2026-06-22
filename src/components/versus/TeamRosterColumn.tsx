import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import type { TeamSide } from '../../lib/teamBattle';

interface Props { side: TeamSide; }

/** A vertical stack of holo hero cards for one team. */
export function TeamRosterColumn({ side }: Props) {
  return (
    <View style={styles.col}>
      {side.roster.map((h) => (
        <View key={h.id} style={styles.card}>
          {/* portrait_url is null-safe; expo-image renders a blank box if absent */}
          <Image source={{ uri: h.portrait_url ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.plate}>
            <Text style={styles.name} numberOfLines={1}>{h.name}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1, gap: 12 },
  card: {
    width: '100%', aspectRatio: 7 / 9, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#241a36',
  },
  plate: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.6)' },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: '#fff' },
});
