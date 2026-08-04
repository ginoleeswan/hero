// src/components/ui/EmptyState.tsx — the one "there's nothing here" surface.
//
// Extracted from the Search tab's treatment, which was the only designed empty
// state in the native app: a circular icon well, a Flame headline, one quiet
// line of guidance. Everywhere else showed a bare line of grey text — Category
// rendered the exact same "No characters found" string as unstyled 16pt.
//
// `tone` matters because the app has two canvases: the deep-navy stage and the
// beige paper. Pass the one the surrounding surface uses.
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, PAPER_TEXT } from '../../constants/colors';
import { RADIUS, TRACKING } from '../../constants/tokens';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  body,
  action,
  tone = 'dark',
  compact = false,
}: {
  icon?: IoniconName;
  title: string;
  /** One quiet line of guidance. Omit when the title says everything. */
  body?: string;
  action?: EmptyStateAction;
  tone?: 'dark' | 'light';
  /** Inline inside a section rather than filling a screen — smaller, less air. */
  compact?: boolean;
}) {
  const light = tone === 'light';
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.iconWell, light && styles.iconWellLight, compact && styles.wellCompact]}>
        <Ionicons name={icon} size={compact ? 22 : 30} color={COLORS.orange} />
      </View>
      <Text style={[styles.title, light && styles.titleLight, compact && styles.titleCompact]}>
        {title}
      </Text>
      {!!body && <Text style={[styles.body, light && styles.bodyLight]}>{body}</Text>}
      {action && (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            action.onPress();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <Text style={styles.btnText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  wrapCompact: { paddingTop: 28, paddingBottom: 12, gap: 6 },
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245,235,220,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconWellLight: { backgroundColor: 'rgba(41,60,67,0.06)' },
  wellCompact: { width: 46, height: 46, borderRadius: 23, marginBottom: 2 },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    lineHeight: 28,
    color: COLORS.beige,
    textAlign: 'center',
  },
  titleLight: { color: COLORS.navy },
  titleCompact: { fontSize: 17, lineHeight: 22 },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(245,235,220,0.55)',
    textAlign: 'center',
  },
  bodyLight: { color: PAPER_TEXT.faint },
  btn: {
    marginTop: 12,
    backgroundColor: COLORS.orange,
    borderRadius: RADIUS.pill,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  btnPressed: { opacity: 0.75 },
  btnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: '#fff',
    letterSpacing: TRACKING.wide,
  },
});
