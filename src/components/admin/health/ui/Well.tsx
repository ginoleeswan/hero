// Recessed data well — the trough that list rows sit *in* while actions rest
// *on* the paper card around it. The inset shadow + hairline border give the
// worktop its depth story; row dividers come free via `divided`.
import { Children, type ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { CC } from '../format';

export function Well({
  children,
  divided = true,
  style,
}: {
  children: ReactNode;
  /** Hairline divider between each direct child row (default on). */
  divided?: boolean;
  style?: ViewStyle | ViewStyle[];
}) {
  const kids = Children.toArray(children);
  return (
    <View style={[styles.well, style as ViewStyle]}>
      {kids.map((child, i) => (
        <View key={i} style={divided && i > 0 ? styles.rowDivider : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Web-only screen: CSS shadow strings are house style here.
  well: {
    backgroundColor: CC.well,
    borderWidth: 1,
    borderColor: CC.wellBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
    boxShadow: CC.wellShadow,
  } as object,
  rowDivider: { borderTopWidth: 1, borderTopColor: CC.hairline },
});
