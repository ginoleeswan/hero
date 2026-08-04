// src/components/search/TeamResultRow.tsx — native team search-hit row.
// Monogram tile + name + "N members · publisher", a doorway into /team/[id].
// Native sibling of the web TeamResultRow.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressScale } from '../ui/PressScale';
import { BrandLogoView } from '../PublisherBadge';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { teamLogo } from '../../constants/teamBrands';
import type { TeamSearchResult } from '../../lib/db/teams';

export function TeamResultRow({ team, onPress }: { team: TeamSearchResult; onPress: () => void }) {
  const tlogo = teamLogo(team);
  const meta = [`${team.member_count} member${team.member_count === 1 ? '' : 's'}`, team.publisher]
    .filter(Boolean)
    .join(' · ');
  return (
    <PressScale onPress={onPress} style={styles.row}>
      <View style={[styles.tile, tlogo && styles.tileLogo]}>
        {tlogo ? (
          <BrandLogoView
            logo={tlogo.logo}
            width={Math.min(34, 26 * (tlogo.badgeSize.width / tlogo.badgeSize.height))}
            height={26}
            tint={tlogo.logoTint}
          />
        ) : (
          <Text style={styles.monogram} numberOfLines={1}>
            {team.name.slice(0, 2).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {team.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(245,235,220,0.35)" />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,115,51,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.35)',
  },
  tileLogo: { backgroundColor: COLORS.navy, borderColor: 'rgba(245,235,220,0.16)' },
  monogram: { fontFamily: 'Flame-Regular', fontSize: 16, lineHeight: 20, color: COLORS.orange },
  text: { flex: 1, flexDirection: 'column' },
  name: { fontFamily: 'Flame-Regular', fontSize: 17, lineHeight: 21, color: COLORS.beige },
  meta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: INK_TEXT.faint,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 1,
  },
});
