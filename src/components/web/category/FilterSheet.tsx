import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { CategorySlug } from '../../../lib/db/heroes';
import type { CategoryFilters, FacetCounts } from '../../../lib/db/categoryFilters';
import { FilterControls } from './FilterControls';

interface Props {
  open: boolean;
  slug: CategorySlug;
  filters: CategoryFilters;
  counts: FacetCounts | null;
  setFilter: <K extends keyof CategoryFilters>(k: K, v: CategoryFilters[K]) => void;
  onReset: () => void;
  onClose: () => void;
  total: number;
  hasActive: boolean;
}

export function FilterSheet({
  open,
  slug,
  filters,
  counts,
  setFilter,
  onReset,
  onClose,
  total,
  hasActive,
}: Props) {
  const [mounted, setMounted] = useState(open);
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else if (mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [640, 0] });

  return (
    <View style={s.overlay as object}>
      <Animated.View style={[s.scrim, { opacity: anim }] as object}>
        <Pressable style={StyleSheet.absoluteFill as object} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[s.sheet, { transform: [{ translateY }] }] as object}>
        <View style={s.grab as object} />

        <View style={s.header}>
          <Text style={s.title as object}>Filters</Text>
          {hasActive && (
            <Pressable onPress={onReset}>
              <Text style={s.clearText as object}>Clear all</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent as object}
          showsVerticalScrollIndicator={false}
        >
          <FilterControls slug={slug} filters={filters} counts={counts} setFilter={setFilter} />
        </ScrollView>

        <View style={s.footer as object}>
          <Pressable
            onPress={onClose}
            style={({ hovered }: { hovered?: boolean }) =>
              [s.apply, hovered && (s.applyHover as object)] as object
            }
          >
            <Text style={s.applyText as object}>
              Show {total.toLocaleString()} result{total !== 1 ? 's' : ''}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    justifyContent: 'flex-end',
  } as object,
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,27,0.6)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  } as object,
  sheet: {
    backgroundImage: 'linear-gradient(180deg, rgba(48,69,77,0.99) 0%, rgba(30,44,51,1) 100%)',
    backgroundColor: COLORS.navy,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.1)',
    boxShadow: '0 -20px 50px -10px rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    maxHeight: '82%',
    gap: 16,
  } as object,
  grab: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(245,235,220,0.22)',
    marginBottom: 4,
  } as object,
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige } as object,
  clearText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.orange,
    letterSpacing: 0.2,
  } as object,
  body: { flexGrow: 0 },
  bodyContent: { paddingVertical: 6, paddingBottom: 14 } as object,
  footer: { paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(245,235,220,0.08)' } as object,
  apply: {
    height: 52,
    borderRadius: 14,
    backgroundImage: 'linear-gradient(180deg, #ef8442 0%, #df6a26 100%)',
    backgroundColor: COLORS.orange,
    boxShadow: '0 12px 30px -8px rgba(231,115,51,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 140ms ease, box-shadow 140ms ease',
  } as object,
  applyHover: {
    transform: [{ translateY: -1 }],
    boxShadow: '0 16px 36px -8px rgba(231,115,51,0.75)',
  } as object,
  applyText: {
    fontFamily: 'Nunito_900Black',
    fontSize: 15.5,
    color: '#fff',
    letterSpacing: 0.3,
  } as object,
});
