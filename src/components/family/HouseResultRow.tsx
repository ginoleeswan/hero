// src/components/family/HouseResultRow.tsx
// A house in a search result list. Shared by the web palette, the web search
// page and the native one — it's RN primitives only, so all three read the same.
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HouseCrest } from './HouseCrest';
import type { HouseSearchResult } from '../../lib/db/houses';

export function HouseResultRow({
  house,
  active = false,
  variant = 'light',
  onPress,
}: {
  house: HouseSearchResult;
  /** Keyboard-highlighted in the palette. */
  active?: boolean;
  /** `dark` for the ink-surfaced search page; the palette and page differ. */
  variant?: 'light' | 'dark';
  onPress: () => void;
}) {
  const dark = variant === 'dark';
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="link"
      accessibilityLabel={`${house.name} family tree`}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.row,
          (hovered || active) && (dark ? styles.rowActiveDark : styles.rowActive),
          pressed && styles.pressed,
        ] as object
      }
    >
      <HouseCrest name={house.name} tint={house.sigil_tint ?? COLORS.orange} size={34} />
      <View style={styles.meta}>
        <Text style={[styles.name, dark && styles.nameDark] as object} numberOfLines={1}>
          {house.name}
        </Text>
        <Text style={[styles.sub, dark && styles.subDark] as object} numberOfLines={1}>
          {/* Size first: it's what says whether there's a tree worth opening. */}
          {house.memberCount} {house.memberCount === 1 ? 'member' : 'members'}
          {house.seat ? ` · ${house.seat}` : ''}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={15}
        color={dark ? 'rgba(245,235,220,0.4)' : '#c4b8a3'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  pressed: { opacity: 0.6 },
  rowActive: { backgroundColor: 'rgba(41,60,67,0.06)' } as object,
  rowActiveDark: { backgroundColor: 'rgba(245,235,220,0.08)' } as object,
  meta: { flex: 1, minWidth: 0 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  nameDark: { color: COLORS.beige },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: '#8d8375', marginTop: 1 },
  subDark: { color: INK_TEXT.faint },
});
