// src/components/search/UniverseResultRow.tsx — native universe search-hit row.
// Brand logo on a tinted tile + name, a doorway into /universe/[slug]. Renders
// via the shared BrandLogoView so SVG-component and PNG logos (and single-colour
// tinted marks) all paint correctly. The web surfaces use UniverseChip; this is
// the native equivalent (no hover; press feedback via PressScale).
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressScale } from '../ui/PressScale';
import { COLORS } from '../../constants/colors';
import { BrandLogoView } from '../PublisherBadge';
import type { UniverseResult } from '../../lib/db/universes';

export function UniverseResultRow({
  universe,
  onPress,
}: {
  universe: UniverseResult;
  onPress: () => void;
}) {
  const { name, color, logo, badgeSize, logoOnLight, logoTint } = universe;
  return (
    <PressScale onPress={onPress} style={styles.row}>
      <View style={[styles.tile, { backgroundColor: logoOnLight ? COLORS.beige : color }]}>
        {logo && badgeSize ? (
          <BrandLogoView
            logo={logo}
            width={badgeSize.width}
            height={badgeSize.height}
            tint={logoTint}
          />
        ) : (
          <Text style={styles.fallback} numberOfLines={1}>
            {name.slice(0, 2).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.kicker}>Universe</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(245,235,220,0.35)" />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: { flex: 1, flexDirection: 'column' },
  name: { fontFamily: 'Flame-Regular', fontSize: 17, lineHeight: 21, color: COLORS.beige },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fallback: { fontFamily: 'Flame-Regular', fontSize: 15, lineHeight: 19, color: COLORS.navy },
});
