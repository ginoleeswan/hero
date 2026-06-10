import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Render children into a dedicated container appended directly to `<body>`,
 * escaping the React Native Web app root (`#root`) and every navigator wrapper
 * in between.
 *
 * Why this exists: a `position: fixed` element is only pinned to the viewport
 * when *none* of its ancestors establish a containing block. Any ancestor with
 * `transform`, `filter`, `perspective`, `will-change`, or `contain` re-roots
 * `fixed` to *that* element instead — so the "fixed" node starts scrolling with
 * the page. `react-native-screens` applies exactly those properties to the screen
 * wrappers it mounts for a route (especially nested stacks, e.g. the Search tab's
 * own layout), and once one is present the floating header detaches and rides the
 * scroll — on that screen and every screen after it.
 *
 * Mounting the header at the body level removes those ancestors entirely, so
 * `fixed` resolves against the viewport again no matter what the navigator does.
 * React context still flows through the portal, so the header keeps its router /
 * auth / search hooks. Renders nothing during SSR (no `document`).
 */
export function BodyPortal({ children }: { children: ReactNode }) {
  const [el] = useState(() =>
    typeof document !== 'undefined' ? document.createElement('div') : null,
  );

  useEffect(() => {
    if (!el) return undefined;
    document.body.appendChild(el);
    return () => {
      document.body.removeChild(el);
    };
  }, [el]);

  if (!el) return null;
  return createPortal(children, el);
}
