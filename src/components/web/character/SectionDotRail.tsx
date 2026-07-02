import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';

// Quiet fixed dot-rail on the far left of the desktop dossier: one dot per
// section, active dot tracks scroll, click jumps. Labels appear on hover only.
export function SectionDotRail({
  sections,
  accent,
}: {
  sections: { id: string; label: string }[];
  accent: string;
}) {
  const [active, setActive] = useState(sections[0]?.id ?? '');
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        // The visible section closest to the top of the viewport wins.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <View style={styles.rail}>
      {sections.map((s) => {
        const isActive = active === s.id;
        return (
          <Pressable
            key={s.id}
            onPress={() => jump(s.id)}
            onHoverIn={() => setHovered(s.id)}
            onHoverOut={() => setHovered(null)}
            style={styles.dotHit}
            accessibilityRole="button"
            accessibilityLabel={`Jump to ${s.label}`}
          >
            <View
              style={
                [
                  styles.dot,
                  {
                    backgroundColor: isActive ? accent : 'rgba(41,60,67,0.25)',
                    transform: [{ scale: isActive ? 1.35 : 1 }],
                    transition: 'background-color 200ms ease, transform 200ms ease',
                  },
                ] as object
              }
            />
            {hovered === s.id ? (
              <View style={styles.labelBubble}>
                <Text style={styles.labelText}>{s.label}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'fixed',
    left: 14,
    top: '50%',
    transform: [{ translateY: '-50%' as unknown as number }],
    gap: 10,
    zIndex: 40,
    alignItems: 'center',
  } as object,
  dotHit: { padding: 5, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 } as object,
  labelBubble: {
    position: 'absolute',
    left: 24,
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    boxShadow: '0 4px 14px rgba(11,24,32,0.30)',
  } as object,
  labelText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.beige,
    whiteSpace: 'nowrap',
  } as object,
});
