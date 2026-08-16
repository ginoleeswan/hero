// src/hooks/useArrivalSubject.ts
// Resolve the subject a visitor's landing named, if any.
//
// Reads first-touch attribution (which attribution.ts has already parsed,
// normalised and pinned for the session) rather than the current URL, so the
// lead survives a client-side navigation back to the feed — a visitor who lands
// on /explore, taps into search, and comes back should still see the thing they
// arrived for.
//
// Returns null for almost every visit, which is correct: only traffic from a
// tagged social post names a subject at all.
import { useEffect, useState } from 'react';
import { getAttribution } from '../lib/attribution';
import { arrivalSubject } from '../lib/home/arrival';
import { getHeroById } from '../lib/db/heroes';
import type { Hero } from '../types';

export function useArrivalSubject(): Hero | null {
  const [hero, setHero] = useState<Hero | null>(null);

  useEffect(() => {
    const subject = arrivalSubject(getAttribution()?.content);
    if (!subject) return;

    let live = true;
    getHeroById(subject.id)
      .then((h) => {
        // Art is what makes this a card rather than a line of text, and a lead
        // without it would be worse than no lead. A hero the id does not
        // resolve to — a stale post, a mangled tag — simply yields nothing.
        if (live && h && (h.portrait_url || h.image_url)) setHero(h as Hero);
      })
      .catch(() => {
        /* A failed lookup is a missing card, never a broken feed. */
      });

    return () => {
      live = false;
    };
  }, []);

  return hero;
}
