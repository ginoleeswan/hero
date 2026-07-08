// Command-center buttons. One home for the orange-primary / beige-ghost /
// tinted-tone buttons (with optional icon + loading spinner) that every domain
// was hand-rolling, plus a square icon-only button for toolbars and row actions.
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { CC } from '../format';

export type ButtonTone = 'primary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md';

// bg / fg (text + icon + spinner) per tone. Ghost is the neutral beige used
// everywhere; the rest are solid colour CTAs on white text.
const TONE: Record<ButtonTone, { bg: string; fg: string }> = {
  primary: { bg: COLORS.orange, fg: '#fff' },
  ghost: { bg: '#efe6d6', fg: COLORS.navy },
  danger: { bg: COLORS.red, fg: '#fff' },
  success: { bg: COLORS.green, fg: '#fff' },
};

export function Button({
  label,
  icon,
  onPress,
  tone = 'ghost',
  size = 'md',
  loading = false,
  disabled = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle | ViewStyle[];
}) {
  const t = TONE[tone];
  const off = disabled || loading;
  // Mobile: enforce the 44pt touch-target floor (desktop stays compact for density).
  const narrow = useWindowDimensions().width < 760;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        narrow && styles.touch,
        { backgroundColor: t.bg },
        // Jewel finish on the one action that matters: bevel + warm bloom.
        tone === 'primary' && !off && styles.primaryJewel,
        off && styles.dim,
        style as ViewStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={t.fg} />
      ) : icon ? (
        <Ionicons name={icon} size={size === 'sm' ? 12 : 15} color={t.fg} />
      ) : null}
      <Text style={[size === 'sm' ? styles.labelSm : styles.label, { color: t.fg }]}>{label}</Text>
    </Pressable>
  );
}

// Square, icon-only button (toolbar refresh, row config, etc.). `active` flips it
// to the solid navy state used by toggles.
export function IconButton({
  icon,
  onPress,
  active = false,
  disabled = false,
  size = 'md',
  accessibilityLabel,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  size?: ButtonSize;
  accessibilityLabel?: string;
  style?: ViewStyle | ViewStyle[];
}) {
  // Mobile: expand the tap area to the 44pt floor without inflating the visual box.
  const narrow = useWindowDimensions().width < 760;
  const box = size === 'sm' ? 26 : 30;
  const slop = narrow ? Math.max(0, Math.round((44 - box) / 2)) : 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={slop}
      style={[
        styles.icon,
        { width: box, height: box },
        active && styles.iconActive,
        disabled && styles.dim,
        style as ViewStyle,
      ]}
    >
      <Ionicons name={icon} size={size === 'sm' ? 14 : 15} color={active ? '#fff' : COLORS.navy} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sm: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 6 },
  md: { borderRadius: 11, paddingHorizontal: 14, paddingVertical: 9 },
  // Mobile touch floor — content stays centered within the taller box.
  touch: { minHeight: 44 },
  label: { fontFamily: 'Nunito_700Bold', fontSize: 13 },
  labelSm: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
  dim: { opacity: 0.4 },
  // Web-only screen: CSS gradient/shadow strings are house style here.
  primaryJewel: {
    backgroundImage: CC.primary,
    boxShadow: CC.primaryShadow,
  } as object,
  icon: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#efe6d6',
  },
  iconActive: { backgroundColor: COLORS.navy },
});
