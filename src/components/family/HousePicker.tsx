// src/components/family/HousePicker.tsx
// Choosing a name without leaving the answer.
//
// The roster is a fine index and a poor control: on a phone it sits a screen
// below the console it drives, so every change was scroll down, tap, scroll
// back. One verb per opening — root the tree, or trace to — because the sheet
// is opened by the seat that asked.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, HOUSE_INK } from '../../constants/colors';
import { HeroAvatar } from '../HeroAvatar';
import { nodeDates } from '../../lib/family/lifespan';
import type { RosterMember } from './HouseRoster';

export type PickerMode = 'root' | 'with';

export function HousePicker({
  mode,
  members,
  excludeId,
  onPick,
  onClose,
}: {
  mode: PickerMode | null;
  members: RosterMember[];
  /** Whoever already holds the other seat — picking them would say nothing. */
  excludeId?: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = excludeId ? members.filter((m) => m.id !== excludeId) : members;
    return q ? pool.filter((m) => m.name.toLowerCase().includes(q)) : pool;
  }, [members, query, excludeId]);

  return (
    <Modal
      visible={mode !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={() => setQuery('')}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }] as object}>
          <View style={styles.head}>
            <Text style={styles.title}>
              {mode === 'root' ? 'Root the tree on' : 'Trace the line to'}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={17} color="#8d8375" />
            </Pressable>
          </View>

          <View style={styles.search}>
            <Ionicons name="search" size={15} color="#a99b84" />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Find a name"
              placeholderTextColor="#b3a894"
              style={styles.searchInput as object}
              accessibilityLabel="Find a name in this house"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                accessibilityLabel="Clear search"
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Ionicons name="close-circle" size={16} color="#c4b8a3" />
              </Pressable>
            ) : null}
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {shown.map((m) => {
              const reign = m.reign_start
                ? nodeDates({ reign_start: m.reign_start, reign_end: m.reign_end })
                : null;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onPick(m.id);
                  }}
                  accessibilityRole="button"
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
                    [
                      styles.row,
                      hovered && (styles.rowHover as object),
                      pressed && styles.pressed,
                    ] as object
                  }
                >
                  <HeroAvatar
                    id={m.id}
                    name={m.name}
                    avatarUrl={m.avatar_url}
                    fallbackUrl={m.portrait_url ?? m.image_md_url ?? m.image_url}
                    size={32}
                    radius={16}
                    bare
                  />
                  <Text style={styles.name} numberOfLines={1}>
                    {m.name}
                  </Text>
                  {reign ? (
                    <View style={styles.reign}>
                      <MaterialCommunityIcons name="crown-outline" size={11} color="#b3a48b" />
                      <Text style={styles.reignText}>{reign}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
            {shown.length === 0 ? <Text style={styles.empty}>No one by that name.</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,24,32,0.45)', justifyContent: 'flex-end' },
  pressed: { opacity: 0.6 },
  sheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
    maxHeight: '82%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: 'Flame-Regular', fontSize: 22, lineHeight: 28, color: COLORS.black },
  close: { marginLeft: 'auto', padding: 4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e7dcc9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: COLORS.black,
    outlineStyle: 'none',
  } as object,
  list: { flexGrow: 0, flexShrink: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 12,
    cursor: 'pointer',
  } as object,
  rowHover: { backgroundColor: '#efe4d0' } as object,
  name: { fontFamily: 'FlameSans-Regular', fontSize: 14.5, color: COLORS.black, flexShrink: 1 },
  reign: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' } as object,
  reignText: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 0.4, color: HOUSE_INK },
  empty: { fontFamily: 'FlameSans-Regular', fontSize: 13.5, color: '#8d8375', padding: 12 },
});
