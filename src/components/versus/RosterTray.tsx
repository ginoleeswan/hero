import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import { MAX_SIDE, type PickedHero } from '../../lib/battleBuilderState';

interface Props {
  label: string;
  tint: string;
  roster: PickedHero[];
  synergy: number;
  publisher: 'marvel' | 'dc' | null;
  active: boolean;
  onActivate: () => void;
  onRemove: (id: string) => void;
  slot?: number;
}

export function RosterTray({
  label,
  tint,
  roster,
  synergy,
  publisher,
  active,
  onActivate,
  onRemove,
  slot = 40,
}: Props) {
  const captain = roster[0];
  return (
    <Pressable onPress={onActivate} style={[styles.tray, active ? styles.active : null]}>
      <View style={styles.head}>
        <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
          {active ? '◉ ' : ''}
          {label}
          {captain ? ` · ${captain.name}` : ''}
        </Text>
        <View style={styles.meta}>
          {publisher ? (
            <Text style={styles.pub}>{publisher === 'dc' ? 'all-DC' : 'all-Marvel'}</Text>
          ) : null}
          {roster.length >= 2 ? (
            <Text style={[styles.syn, { color: tint }]}>SYN +{synergy}%</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.slots}>
        {Array.from({ length: MAX_SIDE }).map((_, i) => {
          const hero = roster[i];
          const size = { width: slot, height: Math.round((slot * 9) / 7) };
          if (!hero) {
            return (
              <View key={i} style={[styles.empty, size]}>
                <Text style={styles.plus}>+</Text>
              </View>
            );
          }
          const uri = hero.portrait_url ?? hero.image_url ?? undefined;
          return (
            <Pressable key={hero.id} onPress={() => onRemove(hero.id)} style={[styles.slot, size]}>
              {uri ? (
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View
                  style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: tint }]}
                />
              )}
              <View style={styles.removeBadge}>
                <Text style={styles.removeX}>×</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tray: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 10, gap: 8 },
  active: {
    backgroundColor: 'rgba(206,155,51,0.10)',
    borderWidth: 1.5,
    borderColor: COLORS.goldAccent,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12, letterSpacing: 0.3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.goldAccent,
    borderWidth: 1,
    borderColor: 'rgba(206,155,51,0.5)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  syn: { fontFamily: 'Nunito_700Bold', fontSize: 10 },
  slots: { flexDirection: 'row', gap: 6 },
  slot: { borderRadius: 8, overflow: 'hidden', backgroundColor: '#1b2a30' },
  fallback: {},
  empty: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  removeBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(11,24,32,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeX: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff', lineHeight: 13 },
});
