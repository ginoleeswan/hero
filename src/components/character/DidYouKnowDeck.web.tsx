import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';

// Web variant of the "did you know" deck: a horizontal scroll-snap row of dark
// pull-quote cards with hover arrows and clickable dots. Follows the codebase's
// proven web-carousel pattern — a plain View whose RNW node IS the scrollable
// div, driven by DOM scroll listeners (a ScrollView ref would not expose
// scrollLeft directly).
export function DidYouKnowDeck({
  facts,
  contentInset = 0,
}: {
  facts: string[];
  contentInset?: number;
}) {
  const sectionRef = useRef<View>(null);
  const scrollRef = useRef<View>(null);
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(0);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = sectionRef.current as unknown as HTMLElement | null;
    if (!el) return;
    const enter = () => setHovered(true);
    const leave = () => setHovered(false);
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
    };
  }, []);

  useEffect(() => {
    const node = scrollRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const update = () => {
      const card = node.clientWidth * 0.84;
      setCanLeft(node.scrollLeft > 8);
      setCanRight(node.scrollLeft < node.scrollWidth - node.clientWidth - 8);
      setActive(card > 0 ? Math.round(node.scrollLeft / card) : 0);
    };
    node.addEventListener('scroll', update, { passive: true });
    const t = setTimeout(update, 100);
    return () => {
      node.removeEventListener('scroll', update);
      clearTimeout(t);
    };
  }, [facts.length]);

  if (facts.length === 0) return null;
  const single = facts.length === 1;

  const step = (dir: -1 | 1) => {
    const node = scrollRef.current as unknown as HTMLElement | null;
    if (!node) return;
    node.scrollBy({ left: dir * Math.round(node.clientWidth * 0.84), behavior: 'smooth' });
  };

  const scrollToCard = (i: number) => {
    const node = scrollRef.current as unknown as HTMLElement | null;
    if (!node) return;
    node.scrollTo({ left: Math.round(node.clientWidth * 0.84) * i, behavior: 'smooth' });
  };

  return (
    <View ref={sectionRef} style={styles.wrap}>
      <View style={styles.viewport}>
        <View
          ref={scrollRef}
          style={
            [
              styles.scroller,
              single && (styles.scrollerSingle as object),
              // Snap must rest at the inset, otherwise scroll-snap scrolls past
              // the first card's leading margin and pins it back to the edge.
              contentInset
                ? ({ scrollPaddingLeft: contentInset, scrollPaddingRight: contentInset } as object)
                : null,
            ] as object
          }
        >
          {facts.map((f, i) => (
            <View
              key={i}
              style={
                [
                  styles.slot,
                  single && (styles.slotSingle as object),
                  // Inset the first/last cards via item margins — padding on the
                  // overflow:auto scroller collapses at the scroll origin in Chrome.
                  contentInset && i === 0 ? { marginLeft: contentInset } : null,
                  contentInset && i === facts.length - 1 ? { marginRight: contentInset } : null,
                ] as object
              }
            >
              <FactCard index={i} total={facts.length} text={f} />
            </View>
          ))}
        </View>

        {!single && hovered && canLeft ? <Arrow dir="left" onPress={() => step(-1)} /> : null}
        {!single && hovered && canRight ? <Arrow dir="right" onPress={() => step(1)} /> : null}
      </View>

      {!single ? (
        <View style={styles.dots}>
          {facts.map((_, i) => (
            <Pressable key={i} onPress={() => scrollToCard(i)}>
              <View style={[styles.dot, i === active && (styles.dotActive as object)]} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FactCard({ index, total, text }: { index: number; total: number; text: string }) {
  return (
    <View style={styles.card}>
      <MaterialCommunityIcons
        name="format-quote-open"
        size={44}
        color={COLORS.orange}
        style={styles.quote as object}
      />
      <View style={styles.cardHead}>
        <Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text>
        <Text style={styles.total}>/ {String(total).padStart(2, '0')}</Text>
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

function Arrow({ dir, onPress }: { dir: 'left' | 'right'; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      // 40pt arrow + 2pt of slop each side = the 44pt target floor.
      hitSlop={2}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.arrow,
          dir === 'left' ? styles.arrowLeft : styles.arrowRight,
          hovered && (styles.arrowHover as object),
        ] as object
      }
    >
      <Text style={styles.chevron as object}>{dir === 'left' ? '‹' : '›'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  viewport: { position: 'relative' },
  scroller: {
    flexDirection: 'row',
    gap: 14,
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollSnapType: 'x mandatory',
    paddingBottom: 4,
    // Hide the scrollbar — dots + arrows carry the affordance.
    scrollbarWidth: 'none',
  } as object,
  scrollerSingle: { overflowX: 'visible' } as object,
  slot: { width: '84%', flexShrink: 0, scrollSnapAlign: 'start' } as object,
  slotSingle: { width: '100%' } as object,
  card: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 20,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 22,
    gap: 14,
    overflow: 'hidden',
    minHeight: 150,
  },
  quote: { position: 'absolute', top: 12, right: 16, opacity: 0.22 } as object,
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  index: { fontFamily: 'Nunito_900Black', fontSize: 24, color: COLORS.orange, letterSpacing: 0.5 },
  total: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: INK_TEXT.faint },
  text: { fontFamily: 'FlameSans-Regular', fontSize: 16, lineHeight: 24, color: COLORS.beige },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(41,60,67,0.22)',
    cursor: 'pointer',
  } as object,
  dotActive: { width: 18, backgroundColor: COLORS.orange } as object,
  arrow: {
    position: 'absolute',
    top: '50%',
    width: 40,
    height: 40,
    marginTop: -20,
    borderRadius: 20,
    backgroundColor: COLORS.beige,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 150ms ease',
  } as object,
  arrowLeft: { left: -12 } as object,
  arrowRight: { right: -4 } as object,
  arrowHover: { transform: [{ scale: 1.12 }] } as object,
  chevron: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 24,
    color: COLORS.navy,
    lineHeight: 26,
    marginTop: -2,
  } as object,
});
