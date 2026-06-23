import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import type { FeaturedTeam } from '../../lib/db/teams';

interface Props {
  teams: FeaturedTeam[];
  /** Caption suffix, e.g. "→ Side A". */
  label: string;
  tint: string;
  onPick: (teamId: string) => void;
  /** 'light' for the beige sheet (native), 'dark' for the navy stage (web). */
  tone?: 'light' | 'dark';
  /** Cap how many pills show (they wrap; the rest are reachable via search). */
  limit?: number;
}

/** One-tap iconic-team fills (Avengers, Justice League…) for the active side.
 *  Pills wrap (no horizontal cutoff). Renders nothing when there are no teams. */
export function PresetRail({ teams, label, tint, onPick, tone = 'light', limit = 8 }: Props) {
  if (teams.length === 0) return null;
  const dark = tone === 'dark';
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        ⚡ Quick teams {label}
      </Text>
      <View style={styles.row}>
        {teams.slice(0, limit).map((t) => (
          <Pressable
            key={t.id}
            onPress={() => onPick(t.id)}
            style={[styles.pill, dark ? styles.pillDark : styles.pillLight, { borderColor: tint }]}
          >
            {t.logo_url ? (
              <Image source={{ uri: t.logo_url }} style={styles.logo} contentFit="contain" />
            ) : (
              <View style={[styles.logo, styles.monogram, { backgroundColor: tint }]}>
                <Text style={styles.monogramText}>{t.name.slice(0, 1)}</Text>
              </View>
            )}
            <Text style={[styles.name, dark ? styles.nameDark : null]} numberOfLines={1}>
              {t.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  pillLight: { backgroundColor: 'rgba(255,255,255,0.5)' },
  pillDark: { backgroundColor: 'rgba(255,255,255,0.07)' },
  logo: { width: 22, height: 22, borderRadius: 11 },
  monogram: { alignItems: 'center', justifyContent: 'center' },
  monogramText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy, maxWidth: 130 },
  nameDark: { color: COLORS.beige },
});
