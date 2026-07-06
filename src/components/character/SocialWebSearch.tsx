import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import type { NeighborNode } from '../../lib/db/heroes/neighborhood';

// Search the current web's nodes by name; picking one focuses + centres it.
export function SocialWebSearch({
  nodes,
  onPick,
}: {
  nodes: NeighborNode[];
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const results = q.trim()
    ? nodes.filter((n) => n.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];
  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Ionicons name="search" size={15} color={INK_TEXT.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Find in this web…"
          placeholderTextColor={INK_TEXT.faint}
          style={styles.input}
        />
        {q ? (
          <Pressable onPress={() => setQ('')} hitSlop={8}>
            <Ionicons name="close" size={15} color={INK_TEXT.muted} />
          </Pressable>
        ) : null}
      </View>
      {q.trim() ? (
        <View style={styles.results}>
          {results.length === 0 ? (
            <Text style={styles.empty}>No one by that name here.</Text>
          ) : (
            results.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => {
                  onPick(n.id);
                  setQ('');
                }}
                style={styles.row}
              >
                <View style={styles.thumb}>
                  <HeroImage
                    id={n.id}
                    name={n.name}
                    imageUrl={n.image_url}
                    portraitUrl={n.portrait_url}
                    imageMdUrl={n.image_md_url}
                    grid
                    contentFit="cover"
                    contentPosition={{ top: '-15%', left: '50%' }}
                    style={StyleSheet.absoluteFill}
                    recyclingKey={n.id}
                  />
                </View>
                <Text style={styles.rowName} numberOfLines={1}>
                  {n.name}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 240, maxWidth: '70%' } as object,
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(245,235,220,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
  },
  input: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: INK_TEXT.primary,
    outlineStyle: 'none',
  } as object,
  results: {
    marginTop: 6,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(11,24,32,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  } as object,
  rowName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: INK_TEXT.primary },
  empty: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: INK_TEXT.faint, padding: 12 },
});
