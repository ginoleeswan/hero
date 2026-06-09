import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';

interface PulseTickerProps {
  heroCount: number;
  newlyAddedCount: number;
}

const KEYFRAMES_ID = 'mythique-ticker-keyframes';
const ANIM_NAME = 'mythique-ticker-scroll';

// Inject the @keyframes once into the document. Doing this in raw CSS (rather
// than via RNW's animationKeyframes, which doesn't compile reliably here) is the
// dependable path on web.
function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `@keyframes ${ANIM_NAME} { from { transform: translateX(0); } to { transform: translateX(-50%); } }`;
  document.head.appendChild(style);
}

/**
 * Auto-scrolling marquee. Two identical copies sit in a content-width track that
 * translates by exactly -50% (one copy) via a CSS animation applied straight to
 * the DOM node — runs on the compositor, never stalls, seamless at any width.
 */
export function PulseTicker({ heroCount, newlyAddedCount }: PulseTickerProps) {
  const text = `${heroCount.toLocaleString()} Heroes & Villains  ·  Marvel, DC & Beyond  ·  Powers, Origins & First Appearances  ·  500+ Teams & Affiliations  ·  ${newlyAddedCount} Recently Added  ·  `;
  const trackRef = useRef<View>(null);

  useEffect(() => {
    ensureKeyframes();
    // RNW renders View as a DOM element at runtime; the TS type doesn't reflect it.
    const el = trackRef.current as unknown as HTMLElement | null;
    if (!el) return;
    el.style.width = 'max-content';
    el.style.willChange = 'transform';
    el.style.animation = `${ANIM_NAME} 32s linear infinite`;
  }, []);

  return (
    <View style={s.wrap} accessibilityElementsHidden>
      <View ref={trackRef} style={s.track as object}>
        <Text style={s.text} numberOfLines={1}>
          {text}
        </Text>
        <Text style={s.text} numberOfLines={1} aria-hidden>
          {text}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.orange,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  track: {
    flexDirection: 'row',
    flexShrink: 0,
  } as object,
  text: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.88)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  } as object,
});
