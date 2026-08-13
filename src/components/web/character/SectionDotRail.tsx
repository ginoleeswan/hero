import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { TOPBAR_HEIGHT } from '../TopBar';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type RailSection = { id: string; label: string; icon: IoniconName };

// The fixed TopBar overlays the top of the document, so a bare
// scrollIntoView({block:'start'}) parks the section heading underneath it.
// Offset the jump by the bar plus a little breathing room.
const JUMP_OFFSET = TOPBAR_HEIGHT + 24;

// Quiet fixed rail on the far left of the desktop dossier: one icon per section,
// outline while resting and filled in the character's accent when active. No
// chrome behind the icons — the rail floats directly on the page. The active
// mark tracks scroll, click jumps. Labels appear on hover only.
export function SectionDotRail({ sections, accent }: { sections: RailSection[]; accent: string }) {
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
    const el = document.getElementById(id);
    if (!el) return;
    // Light up immediately — the observer only catches up once the smooth scroll
    // settles, which would leave the tapped icon dim for the whole glide.
    setActive(id);
    const top = el.getBoundingClientRect().top + window.scrollY - JUMP_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  return (
    <View style={styles.rail}>
      {sections.map((s) => {
        const isActive = active === s.id;
        const isHovered = hovered === s.id;
        return (
          <Pressable
            key={s.id}
            onPress={() => jump(s.id)}
            onHoverIn={() => setHovered(s.id)}
            onHoverOut={() => setHovered(null)}
            style={styles.hit}
            accessibilityRole="button"
            accessibilityLabel={`Jump to ${s.label}`}
          >
            <View
              style={
                [
                  styles.iconBox,
                  {
                    transform: [{ scale: isActive ? 1.1 : 1 }],
                    transition: 'transform 200ms ease',
                  },
                ] as object
              }
            >
              <Ionicons
                name={isActive ? s.icon : (`${s.icon}-outline` as IoniconName)}
                size={18}
                color={
                  isActive ? accent : isHovered ? 'rgba(41,60,67,0.78)' : 'rgba(41,60,67,0.34)'
                }
              />
            </View>
            {isHovered ? (
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
    left: 'max(12px, env(safe-area-inset-left))' as unknown as number,
    top: '50%',
    transform: [{ translateY: '-50%' as unknown as number }],
    gap: 4,
    zIndex: 40,
    alignItems: 'center',
  } as object,
  hit: { flexDirection: 'row', alignItems: 'center' },
  // Sizing + hit target only — deliberately no background, the rail floats on the page.
  iconBox: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  labelBubble: {
    position: 'absolute',
    left: 34,
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
