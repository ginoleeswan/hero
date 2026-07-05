import { View, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import type { TitleExternalIds } from '../../lib/tmdb/extras';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function build(
  ext: TitleExternalIds,
): { key: string; label: string; url: string; icon: IconName }[] {
  const out: { key: string; label: string; url: string; icon: IconName }[] = [];
  if (ext.imdb)
    out.push({
      key: 'imdb',
      label: 'IMDb',
      url: `https://www.imdb.com/title/${ext.imdb}/`,
      icon: 'film-outline',
    });
  if (ext.instagram)
    out.push({
      key: 'ig',
      label: 'Instagram',
      url: `https://instagram.com/${ext.instagram}`,
      icon: 'logo-instagram',
    });
  if (ext.twitter)
    out.push({ key: 'x', label: 'X', url: `https://x.com/${ext.twitter}`, icon: 'logo-twitter' });
  if (ext.facebook)
    out.push({
      key: 'fb',
      label: 'Facebook',
      url: `https://facebook.com/${ext.facebook}`,
      icon: 'logo-facebook',
    });
  if (ext.homepage)
    out.push({ key: 'web', label: 'Website', url: ext.homepage, icon: 'globe-outline' });
  return out;
}

/** Row of external/social link buttons. Renders nothing when there are none. */
export function SocialLinks({ externalIds }: { externalIds: TitleExternalIds | null }) {
  if (!externalIds) return null;
  const links = build(externalIds);
  if (links.length === 0) return null;

  return (
    <View style={styles.row}>
      {links.map((l) => (
        <TouchableOpacity
          key={l.key}
          style={styles.btn}
          onPress={() => Linking.openURL(l.url)}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel={l.label}
        >
          <Ionicons name={l.icon} size={18} color={COLORS.navy} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navy + '10',
    borderWidth: 1,
    borderColor: COLORS.navy + '14',
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
});
