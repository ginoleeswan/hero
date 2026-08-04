// src/components/biography/SectionAnchor.tsx — measures where each <h2> sits.
//
// Web gets section positions for free: `extractHeadings` already stamps
// `id="bio-s{n}"` on every heading, and IntersectionObserver reports which one
// is on screen. Native has no equivalent — react-native-render-html renders one
// flat tree with no per-node position — so the offsets have to be measured.
//
// The alternative was splitting the document into one <RenderHTML> per section,
// which measures trivially but breaks margin collapsing across every seam and
// spins up N renderer instances. This keeps a single document and a single
// renderer, and pays for it with one measure per heading.
//
// `onLayout` alone is not enough: it reports y relative to the heading's
// immediate parent, which is somewhere deep in the transient render tree. The
// number we need is y relative to the scroll content, so the layout pass is
// only the *trigger* — measureLayout against the content view does the work.
//
// The renderer is a module constant reading its dependencies from context,
// rather than a component built inside the screen's render: RNRH remounts the
// whole subtree when a renderer's identity changes, so a per-render closure
// would tear down and re-measure the document on every state update — which
// includes the state updates this very component causes.
import { createContext, useCallback, useContext, useRef } from 'react';
import { View } from 'react-native';
import type { CustomBlockRenderer } from 'react-native-render-html';

interface AnchorDeps {
  /** The scroll view's content container — the frame offsets are measured in. */
  contentRef: React.RefObject<View | null>;
  /** index → y. Mutated in place; the screen mirrors it into a shared value. */
  offsets: React.RefObject<Record<number, number>>;
  /** Called after a measurement lands, so the screen can republish offsets. */
  onMeasured: () => void;
}

const AnchorContext = createContext<AnchorDeps | null>(null);

export const SectionAnchorProvider = AnchorContext.Provider;

/**
 * `h2` renderer. The heading index comes from the `bio-s{n}` id that
 * `extractHeadings` already stamps, so the same anchor identity drives both
 * platforms — no second numbering scheme to keep in sync.
 */
export const SectionAnchorH2: CustomBlockRenderer = ({ TDefaultRenderer, ...props }) => {
  const deps = useContext(AnchorContext);
  const ref = useRef<View | null>(null);

  const id = typeof props.tnode.attributes?.id === 'string' ? props.tnode.attributes.id : '';
  const match = id.match(/^bio-s(\d+)$/);
  const index = match ? Number(match[1]) : -1;

  const measure = useCallback(() => {
    const node = ref.current;
    const content = deps?.contentRef.current;
    if (!deps || index < 0 || !node || !content) return;
    // measureLayout is best-effort: it throws if either node has been detached
    // mid-measure (fast back-navigation), which is not an error worth
    // surfacing — the offset simply keeps its last good value.
    try {
      node.measureLayout(
        content as never,
        (_x: number, y: number) => {
          if (deps.offsets.current[index] === y) return;
          deps.offsets.current[index] = y;
          deps.onMeasured();
        },
        () => {},
      );
    } catch {
      // Node detached — keep the previous offset.
    }
  }, [deps, index]);

  return (
    // collapsable={false} keeps the wrapper as a real native view; Android
    // flattens single-child views away and there would be nothing to measure.
    <View ref={ref} onLayout={measure} collapsable={false}>
      <TDefaultRenderer {...props} />
    </View>
  );
};

/** Stable renderer map — passing a fresh object would remount the document. */
export const BIOGRAPHY_RENDERERS = { h2: SectionAnchorH2 } as const;
