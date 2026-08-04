// src/hooks/useDocumentReadingPosition.web.ts — web's half of the reading pill.
//
// Web-only by construction (DOM APIs, document scroll), and imported only from
// `app/biography/[id].web.tsx`, so there is deliberately no native twin: the
// native screen measures section offsets itself because react-native-render-html
// gives it no anchors to observe. This is the cheap side of that split — the
// `bio-s{n}` ids `extractHeadings` stamps are real DOM nodes, so the browser
// does the work.
//
// Two observers rather than one scroll handler doing both jobs: IntersectionObserver
// reports the active section with no per-frame cost at all, and the scroll
// listener only exists for the progress hairline and the hide-on-read-down.
import { useEffect, useRef, useState } from 'react';

export interface DocumentReadingPosition {
  activeIndex: number;
  /** 0..1 through the document. Quantised to whole percent. */
  progress: number;
  /** True while the reader is moving down the page. */
  hidden: boolean;
}

export function useDocumentReadingPosition(
  sectionCount: number,
  enabled: boolean,
): DocumentReadingPosition {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    if (!enabled || sectionCount === 0) return;

    const nodes: HTMLElement[] = [];
    for (let i = 0; i < sectionCount; i++) {
      const el = document.getElementById(`bio-s${i}`);
      if (el) nodes.push(el);
    }
    if (!nodes.length) return;

    // The band is the middle ~10% of the viewport — the "read line". A heading
    // becomes current as it settles into the reading zone, not the instant its
    // first pixel clears the top.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = Number((entry.target as HTMLElement).id.replace('bio-s', ''));
          if (!Number.isNaN(i)) setActiveIndex(i);
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    nodes.forEach((n) => observer.observe(n));

    const onScroll = () => {
      const y = window.scrollY;
      const span = document.documentElement.scrollHeight - window.innerHeight;
      const pct = span > 0 ? Math.min(100, Math.max(0, Math.round((y / span) * 100))) : 0;
      setProgress((prev) => (prev === pct ? prev : pct));

      // IntersectionObserver only fires when a heading crosses the band, so a
      // reader sitting between two distant headings would otherwise never
      // update. Scrolling above the first heading resets to section one.
      if (y < (nodes[0]?.offsetTop ?? 0)) setActiveIndex(0);

      if (y > lastY.current + 4 && y > 220) setHidden(true);
      else if (y < lastY.current - 4) setHidden(false);
      lastY.current = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
    // Re-bind when the section count changes — the ids only exist once the
    // biography HTML has actually been written into the DOM.
  }, [sectionCount, enabled]);

  return { activeIndex, progress: progress / 100, hidden };
}
