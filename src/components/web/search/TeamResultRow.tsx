import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { COLORS, INK_TEXT, PAPER_TEXT } from '../../../constants/colors';
import { BrandLogoView } from '../../PublisherBadge';
import { brandForPublisher } from '../../../constants/publishers';
import { teamLogo } from '../../../constants/teamBrands';
import type { TeamSearchResult } from '../../../lib/db/teams';

// A team search-hit row: monogram tile + name + "N members · publisher", a
// doorway into /team/[id]. Teams have no logo art yet, so the tile shows the
// team's initials. Dark variant = palette panel; light = beige results page.
export function TeamResultRow({
  team,
  onPress,
  variant = 'dark',
  active = false,
}: {
  team: TeamSearchResult;
  onPress: () => void;
  variant?: 'dark' | 'light';
  active?: boolean;
}) {
  const light = variant === 'light';
  const tlogo = teamLogo(team);
  // No logo art? Tint the monogram tile with the team's universe brand colour
  // (Marvel red, DC blue…) instead of a uniform orange — instant identity + variety.
  const tint = brandForPublisher(team.publisher)?.color ?? COLORS.orange;
  const meta = [`${team.member_count} member${team.member_count === 1 ? '' : 's'}`, team.publisher]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`Browse the ${team.name} team`}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.row,
          (hovered || active) && ((light ? styles.rowHoverLight : styles.rowHover) as object),
        ] as object
      }
    >
      <View
        style={
          [
            styles.tile,
            tlogo
              ? (styles.tileLogo as object)
              : { backgroundColor: `${tint}22`, borderColor: `${tint}55` },
          ] as object
        }
      >
        {tlogo ? (
          <BrandLogoView
            logo={tlogo.logo}
            width={Math.min(30, 22 * (tlogo.badgeSize.width / tlogo.badgeSize.height))}
            height={22}
            tint={tlogo.logoTint}
          />
        ) : (
          <Text style={[styles.monogram, { color: tint }] as object} numberOfLines={1}>
            {team.name.slice(0, 2).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.text}>
        <Text
          style={[styles.name, light && (styles.nameLight as object)] as object}
          numberOfLines={1}
        >
          {team.name}
        </Text>
        <Text
          style={[styles.meta, light && (styles.metaLight as object)] as object}
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  rowHover: { backgroundColor: 'rgba(245,235,220,0.06)' } as object,
  rowHoverLight: { backgroundColor: 'rgba(29,45,51,0.06)' } as object,
  tile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,115,51,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.35)',
  } as object,
  // Logo tiles get a dark backing so white/coloured marks read (the orange
  // monogram tint is too light for a logo).
  tileLogo: {
    backgroundColor: COLORS.navy,
    borderColor: 'rgba(245,235,220,0.16)',
  } as object,
  monogram: { fontFamily: 'Flame-Regular', fontSize: 14, color: COLORS.orange } as object,
  text: { flexDirection: 'column', flexShrink: 1 },
  name: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige } as object,
  nameLight: { color: COLORS.navy } as object,
  meta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: INK_TEXT.faint,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  } as object,
  metaLight: { color: PAPER_TEXT.faint } as object,
});
