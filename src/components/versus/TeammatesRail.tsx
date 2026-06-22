import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { OpponentCard } from '../compare/OpponentCard';

interface Item { id: string; name: string; image_url?: string | null; portrait_url?: string | null; }

interface Props {
  captainName: string;
  sideLabel: string;
  tint: string;
  items: Item[];
  onAdd: (item: Item) => void;
}

/** Canon teammates of the active side's captain — one tap adds to that side.
 *  Renders nothing when there are no teammates to suggest. */
export function TeammatesRail({ captainName, sideLabel, tint, items, onAdd }: Props) {
  if (items.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        ★ Teammates of {captainName} → {sideLabel}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((it) => (
          <OpponentCard key={it.id} item={it} onPress={() => onAdd(it)} width={56} height={72} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(154,62,56,0.08)', borderWidth: 1, borderColor: 'rgba(154,62,56,0.25)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, gap: 8 },
  label: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  row: { gap: 8 },
});
