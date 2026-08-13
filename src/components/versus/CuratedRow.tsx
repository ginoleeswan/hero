import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { OpponentCard } from '../compare/OpponentCard';
import { PAPER_TEXT } from '../../constants/colors';

interface Item {
  id: string;
  name: string;
  image_url?: string | null;
  portrait_url?: string | null;
}

interface Props {
  label: string;
  items: Item[];
  onPick: (item: Item) => void;
  /** 'dark' for the navy stage (default), 'light' for a beige sheet. */
  tone?: 'light' | 'dark';
  cardW?: number;
  /** Host column padding to bleed past (mobile rail edge-to-edge). */
  bleed?: number;
}

/** A labeled horizontal-scroll row of tap-to-add hero cards (Teammates,
 *  Rivalries, …). Renders nothing when empty (degrade-to-hidden). */
export function CuratedRow({ label, items, onPick, tone = 'dark', cardW = 88, bleed = 0 }: Props) {
  if (items.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, tone === 'light' ? styles.labelLight : null]}>{label}</Text>
      <ScrollView
        style={bleed ? ({ marginHorizontal: -bleed } as object) : undefined}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={
          [styles.row, bleed ? { paddingLeft: bleed, paddingRight: bleed } : null] as object
        }
      >
        {items.map((item) => (
          <OpponentCard
            key={item.id}
            item={item}
            onPress={() => onPick(item)}
            width={cardW}
            height={Math.round(cardW * 1.32)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.75)',
  },
  labelLight: { color: PAPER_TEXT.faint },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 1, paddingRight: 8 },
});
