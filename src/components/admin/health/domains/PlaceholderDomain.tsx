// "Coming soon" empty state for future app-wide domains (Users, Traffic).
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';

export function PlaceholderDomain({ label, icon, blurb }: { label: string; icon: keyof typeof Ionicons.glyphMap; blurb: string }) {
  return (
    <Panel>
      <View style={styles.wrap}>
        <Ionicons name={icon} size={34} color={COLORS.grey} />
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.blurb}>{blurb}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>COMING SOON</Text>
        </View>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  title: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.black },
  blurb: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey, textAlign: 'center', maxWidth: 360 },
  badge: { marginTop: 6, backgroundColor: COLORS.orange + '1a', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 1, color: COLORS.orange },
});
