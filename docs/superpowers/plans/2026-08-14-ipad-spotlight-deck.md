# iPad Spotlight Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the full-bleed Explore billboard above 720pt with the card-deck layout the web already runs, so an iPad stops cropping away 57–74% of every portrait.

**Architecture:** `spotlightLayout()` moves from `src/components/web/home/` to `src/constants/` and becomes the single source of billboard geometry for both platforms. Native gains a thin view layer — `SpotlightDeck` (stage) over `SpotlightDeckCard` (one card) over a pure `deckCards()` helper — that `SpotlightCarousel` renders instead of the carousel above 720pt. Below 720pt nothing changes.

**Tech Stack:** TypeScript, React Native (Expo SDK 56), expo-router, expo-image, react-native-reanimated 4, jest-expo.

**Spec:** `docs/superpowers/specs/2026-08-14-ipad-spotlight-deck-design.md`

## Global Constraints

- **yarn only.** Never npm or bun.
- **Every task's final gate:** `yarn tsc --noEmit`, `yarn test:ci`, `yarn lint`, `yarn format:check`. `yarn lint` runs at `--max-warnings=0` and 0 errors.
- Any `eslint-disable` needs a **specific** reason, and the reason comment goes **above** the directive — `eslint-disable-next-line` applies to the next LINE, so a comment between the directive and the code breaks it.
- **No `any`.** Use `unknown` for caught errors.
- **`StyleSheet.create` for all styles.** No inline style objects except `StyleSheet.absoluteFill`. Dynamic values go in an array: `style={[styles.card, { width, height }]}`.
- **Fonts:** `Flame-Regular` for display, `FlameSans-Regular` for body, `Nunito_700Bold` for UI labels. **Never `Flame-Bold`** — it is unreadable at any size.
- **Clamped Flame text needs `lineHeight` ≥ 1.22× `fontSize`.** Any `Text` with `numberOfLines` set in a Flame family clips its descenders below that.
- **No coloured vertical side rails.** Colour belongs on a pill or badge that labels something.
- Commit directly to `main`. No feature branches.
- Other sessions may commit mid-task: never `git add -A`, and re-check `git log` after a failed push.
- Screens never import `supabase` directly; this plan touches no data layer.

---

### Task 1: Move `spotlightLayout` to `src/constants/`

Pure relocation. No behaviour change — the existing test suite must pass untouched apart from its own import path.

**Files:**
- Move: `src/components/web/home/spotlightLayout.ts` → `src/constants/spotlightLayout.ts`
- Move: `__tests__/components/web/home/spotlightLayout.test.ts` → `__tests__/constants/spotlightLayout.test.ts`
- Modify: `app/(tabs)/explore.web.tsx:28`
- Modify: `src/components/web/HomeSkeleton.tsx:4`

**Interfaces:**
- Consumes: nothing.
- Produces: `import { spotlightLayout, type SpotlightLayout, type SpotlightState, type SpotlightDetail } from '../constants/spotlightLayout'` — every later task imports from this path. Signature is unchanged: `spotlightLayout(width: number): SpotlightLayout`.

- [ ] **Step 1: Move both files with git so history follows**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero
git mv src/components/web/home/spotlightLayout.ts src/constants/spotlightLayout.ts
mkdir -p __tests__/constants
git mv __tests__/components/web/home/spotlightLayout.test.ts __tests__/constants/spotlightLayout.test.ts
```

- [ ] **Step 2: Fix the module's own import**

In `src/constants/spotlightLayout.ts`, line 17 currently reads:

```ts
import { pageGutter } from '../../../constants/colors';
```

Change it to:

```ts
import { pageGutter } from './colors';
```

- [ ] **Step 3: Fix the test's import**

In `__tests__/constants/spotlightLayout.test.ts`, line 1 currently reads:

```ts
import { spotlightLayout } from '../../../../src/components/web/home/spotlightLayout';
```

Change it to:

```ts
import { spotlightLayout } from '../../src/constants/spotlightLayout';
```

- [ ] **Step 4: Update the two importers**

In `app/(tabs)/explore.web.tsx` line 28:

```ts
import { spotlightLayout } from '../../src/constants/spotlightLayout';
```

In `src/components/web/HomeSkeleton.tsx` line 4:

```ts
import { spotlightLayout } from '../../constants/spotlightLayout';
```

- [ ] **Step 5: Add the note explaining why it lives here**

Insert at the top of `src/constants/spotlightLayout.ts`, above the existing header comment:

```ts
// Lives in constants/ — NOT in components/web/ — because both platforms read
// it. The native deck and the web spotlight derive their card widths, stage
// height and deck taper from this one function, which is the only thing that
// keeps them from drifting apart the way the character screen's native/web
// pair did. It is pure arithmetic: no React, no platform APIs.
```

- [ ] **Step 6: Verify nothing else referenced the old path**

Run: `rg "web/home/spotlightLayout" src app __tests__`
Expected: no matches.

- [ ] **Step 7: Run the gate**

Run: `yarn tsc --noEmit && yarn test:ci && yarn lint && yarn format:check`
Expected: all pass. The spotlightLayout suite's 9 tests still pass unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/constants/spotlightLayout.ts __tests__/constants/spotlightLayout.test.ts app/'(tabs)'/explore.web.tsx src/components/web/HomeSkeleton.tsx
git commit -m "refactor(spotlight): one copy of the billboard's arithmetic, where both platforms can reach it"
```

---

### Task 2: Gate the ghost name to `gallery`

Spec decision 3. Type-as-scenery needs negative space; `duo` has none. This is a deliberate web-visible change at 1000–1279px.

**Files:**
- Modify: `src/constants/spotlightLayout.ts`
- Test: `__tests__/constants/spotlightLayout.test.ts:82-88`

**Interfaces:**
- Consumes: `spotlightLayout()` from Task 1.
- Produces: `SpotlightLayout.showGhostName` is now `true` only when `state === 'gallery'`.

- [ ] **Step 1: Rewrite the failing test**

Replace the whole `it('drops the scenery type and the deck together', ...)` block at lines 82–88 with:

```ts
  it('keeps the scenery type to the gallery, where there is room for it', () => {
    // Type-as-scenery only works where there's negative space for it. The duo
    // deck fills its stage — strip plus panel — so a ghost name there would set
    // the character's name at display size twice within 40pt of itself.
    for (const w of WIDTHS) {
      const { state, showGhostName } = spotlightLayout(w);
      expect(showGhostName).toBe(state === 'gallery');
    }
  });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `yarn test:ci -t "keeps the scenery type to the gallery"`
Expected: FAIL — at a duo width (e.g. 1032) `showGhostName` is `true` while `state` is `'duo'`, so received `true`, expected `false`.

- [ ] **Step 3: Change the rule**

In `src/constants/spotlightLayout.ts`, the returned object at the end of `spotlightLayout()` currently has:

```ts
    showGhostName: tail.length > 0,
```

Replace that line with:

```ts
    // Gallery only. The duo deck fills its stage, so scenery type there is just
    // the name printed twice — see the 2026-08-14 iPad spotlight spec.
    showGhostName: tail.length > 0 && gallery,
```

Also update the interface doc comment on `showGhostName` (currently *"Type-as-scenery needs negative space to be scenery."*) to:

```ts
  /** Type-as-scenery needs negative space to be scenery — so, gallery only. */
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:ci -t "keeps the scenery type to the gallery"`
Expected: PASS.

- [ ] **Step 5: Run the full gate**

Run: `yarn tsc --noEmit && yarn test:ci && yarn lint && yarn format:check`
Expected: all pass. The other 8 tests in the suite are unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/constants/spotlightLayout.ts __tests__/constants/spotlightLayout.test.ts
git commit -m "fix(spotlight): the ghost name needs a gallery's worth of room"
```

---

### Task 3: `deckCards()` — the pure helper the stage renders from

Keeping card selection out of the component is what makes the deck testable at all, given the repo's rule against rendering tests.

**Files:**
- Create: `src/components/home/spotlightDeck.ts`
- Test: `__tests__/components/home/spotlightDeck.test.ts`

**Interfaces:**
- Consumes: `SpotlightLayout` from Task 1; `Hero` from `src/lib/db/heroes`.
- Produces:
  - `SLIVER_OPACITY: readonly number[]`
  - `interface DeckCard { hero: Hero; index: number; width: number; opacity: number; active: boolean }`
  - `deckCards(heroes: Hero[], layout: Pick<SpotlightLayout, 'cardWidth' | 'tail'>, activeIndex: number): DeckCard[]`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/home/spotlightDeck.test.ts`:

```ts
import { deckCards, SLIVER_OPACITY } from '../../../src/components/home/spotlightDeck';
import type { Hero } from '../../../src/lib/db/heroes';

// Only the fields the deck reads. Cast once here rather than building 34 columns
// of Hero for a geometry test.
const hero = (id: string): Hero => ({ id, name: id }) as unknown as Hero;
const heroes = ['a', 'b', 'c', 'd'].map(hero);
const layout = { cardWidth: 280, tail: [140, 100, 76, 54] };

describe('deckCards', () => {
  it('leads with the active hero at the full card width', () => {
    const cards = deckCards(heroes, layout, 2);
    expect(cards[0].hero.id).toBe('c');
    expect(cards[0].width).toBe(280);
    expect(cards[0].opacity).toBe(1);
    expect(cards[0].active).toBe(true);
  });

  it('wraps around the deck rather than running off the end', () => {
    const cards = deckCards(heroes, layout, 3);
    expect(cards.map((c) => c.hero.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('never shows more cards than there are heroes', () => {
    const cards = deckCards(heroes.slice(0, 2), layout, 0);
    expect(cards).toHaveLength(2);
  });

  it('never shows more cards than the layout has widths for', () => {
    const cards = deckCards(heroes, { cardWidth: 276, tail: [138, 99] }, 0);
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.width)).toEqual([276, 138, 99]);
  });

  it('recedes: each card is lit no more brightly than the one in front', () => {
    const cards = deckCards(heroes, layout, 0);
    for (let i = 1; i < cards.length; i += 1) {
      expect(cards[i].opacity).toBeLessThanOrEqual(cards[i - 1].opacity);
    }
  });

  it('carries the index a tap needs to promote a sliver', () => {
    const cards = deckCards(heroes, layout, 1);
    expect(cards.map((c) => c.index)).toEqual([1, 2, 3, 0]);
  });

  it('has an opacity for every width the taper can produce', () => {
    // buildTail tops out at 7 slivers, so 8 cards is the deepest deck.
    expect(SLIVER_OPACITY.length).toBeGreaterThanOrEqual(8);
  });

  it('returns nothing when there is nothing to show', () => {
    expect(deckCards([], layout, 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `yarn test:ci __tests__/components/home/spotlightDeck.test.ts`
Expected: FAIL — "Cannot find module '../../../src/components/home/spotlightDeck'".

- [ ] **Step 3: Write the implementation**

Create `src/components/home/spotlightDeck.ts`:

```ts
// src/components/home/spotlightDeck.ts — which cards the tablet stage shows.
//
// Pure, and separate from the view, because the repo's testing convention rules
// out rendering tests for screens: if the selection logic lived inside
// SpotlightDeck it would ship untested. The component's job is to draw what this
// returns, nothing more.
import type { SpotlightLayout } from '../../constants/spotlightLayout';
import type { Hero } from '../../lib/db/heroes';

/**
 * Depth taper — the active card is fully lit and each sliver behind it sits a
 * step further back. The same ramp the web deck uses, so a character reads at
 * the same depth on both platforms.
 */
export const SLIVER_OPACITY: readonly number[] = [1, 0.82, 0.66, 0.54, 0.44, 0.36, 0.28, 0.2];

export interface DeckCard {
  hero: Hero;
  /** Index into `heroes` — what a tap on this card promotes to active. */
  index: number;
  width: number;
  opacity: number;
  active: boolean;
}

/**
 * The active hero first at the full card width, then the deck behind it in
 * order, each at its own sliver width. Wraps, so a deck near the end of the
 * list keeps its taper instead of thinning out.
 */
export function deckCards(
  heroes: Hero[],
  layout: Pick<SpotlightLayout, 'cardWidth' | 'tail'>,
  activeIndex: number,
): DeckCard[] {
  if (heroes.length === 0) return [];
  const widths = [layout.cardWidth, ...layout.tail].slice(0, heroes.length);
  return widths.map((width, i) => {
    const index = (activeIndex + i) % heroes.length;
    return {
      hero: heroes[index],
      index,
      width,
      opacity: SLIVER_OPACITY[Math.min(i, SLIVER_OPACITY.length - 1)],
      active: i === 0,
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:ci __tests__/components/home/spotlightDeck.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Run the gate**

Run: `yarn tsc --noEmit && yarn test:ci && yarn lint && yarn format:check`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/home/spotlightDeck.ts __tests__/components/home/spotlightDeck.test.ts
git commit -m "feat(spotlight): work out the deck's cards where they can be tested"
```

---

### Task 4: `SpotlightDeckCard` — one card

**Files:**
- Create: `src/components/home/SpotlightDeckCard.tsx`

**Interfaces:**
- Consumes: `DeckCard` fields from Task 3; `HeroImage` from `src/components/HeroImage`.
- Produces: `<SpotlightDeckCard hero={Hero} width={number} height={number} opacity={number} active={boolean} onPress={() => void} />`

- [ ] **Step 1: Write the component**

Create `src/components/home/SpotlightDeckCard.tsx`:

```tsx
// src/components/home/SpotlightDeckCard.tsx — one portrait in the tablet deck.
import { Pressable, StyleSheet } from 'react-native';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { Hero } from '../../lib/db/heroes';

export function SpotlightDeckCard({
  hero,
  width,
  height,
  opacity,
  active,
  onPress,
}: {
  hero: Hero;
  width: number;
  height: number;
  opacity: number;
  /** The front card opens the character; the rest step forward in the deck. */
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={active ? 'link' : 'button'}
      accessibilityLabel={active ? `View ${hero.name}` : `Show ${hero.name}`}
      style={[styles.card, { width, height, opacity }]}
    >
      <HeroImage
        id={hero.id}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        contentFit="cover"
        // These portraits are a profile head-and-shoulders on a flat field: the
        // face sits in the upper third and the sides are background. Anchoring
        // high keeps the head whole even in a 20pt sliver, and spends the loss
        // on empty colour — the same reasoning as the web plate.
        contentPosition={{ top: '8%', left: '50%' }}
        style={StyleSheet.absoluteFill}
        recyclingKey={hero.id}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
  },
});
```

- [ ] **Step 2: Run the gate**

Run: `yarn tsc --noEmit && yarn lint && yarn format:check`
Expected: all pass. (No test — per the repo's convention this is a view with no logic; its geometry is covered by Task 3.)

- [ ] **Step 3: Commit**

```bash
git add src/components/home/SpotlightDeckCard.tsx
git commit -m "feat(spotlight): the deck's card, anchored so a sliver still has a face in it"
```

---

### Task 5: `SpotlightDeck` — the tablet stage

**Files:**
- Create: `src/components/home/SpotlightDeck.tsx`

**Interfaces:**
- Consumes: `spotlightLayout()` (Task 1), `deckCards()` (Task 3), `SpotlightDeckCard` (Task 4), `SpotlightProgress` from `./SpotlightProgress`.
- Produces: `<SpotlightDeck heroes={Hero[]} onHeroPress={(hero: Hero) => void} />`. It reads its own width from `useWindowDimensions()` and owns its own active index and autoplay.

- [ ] **Step 1: Write the component**

Create `src/components/home/SpotlightDeck.tsx`:

```tsx
// src/components/home/SpotlightDeck.tsx — the billboard above 720pt.
//
// The phone billboard crops a 2:3 portrait into a box whose aspect comes from
// the window, which is fine at 0.81 and ruinous at 2.55: a landscape iPad kept
// the top 26% of the artwork. Here the card's aspect is the invariant and the
// stage height follows it, so rotating changes how many cards you see and never
// what shape they are. `spotlightLayout` owns that arithmetic for both
// platforms; this component owns only what is shown at each of its states.
import { useCallback, useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text } from '../ui/Text';
import { SpotlightDeckCard } from './SpotlightDeckCard';
import { SpotlightProgress } from './SpotlightProgress';
import { deckCards } from './spotlightDeck';
import { spotlightLayout } from '../../constants/spotlightLayout';
import { COLORS } from '../../constants/colors';
import { ALIGNMENT_LABELS } from '../../lib/characterTaxonomy';
import type { Hero } from '../../lib/db/heroes';

// One clock for the deck and its progress fill, matching the phone carousel.
const AUTOPLAY_MS = 6000;
const CARD_GAP = 12;
/** Past this a horizontal drag is a deck flip rather than a stray touch. */
const SWIPE_THRESHOLD = 44;

export function SpotlightDeck({
  heroes,
  onHeroPress,
}: {
  heroes: Hero[];
  onHeroPress: (hero: Hero) => void;
}) {
  const { width } = useWindowDimensions();
  const layout = spotlightLayout(width);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();

  const step = useCallback(
    (dir: number) => setActive((i) => (i + dir + heroes.length) % heroes.length),
    [heroes.length],
  );

  // Autoplay only re-renders the deck, not the feed around it. Off entirely
  // under Reduce Motion, where an unattended advance is the thing being asked
  // for less of.
  useEffect(() => {
    if (heroes.length <= 1 || reduced) return;
    const timer = setInterval(() => step(1), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [heroes.length, reduced, step]);

  if (heroes.length === 0) return null;

  const { stageHeight, cardWidth, tail, detail, showGhostName, gutter } = layout;
  const hero = heroes[active];
  const cards = deckCards(heroes, { cardWidth, tail }, active);
  const align = hero.alignment ? ALIGNMENT_LABELS[hero.alignment.toLowerCase().trim()] : undefined;
  const kicker = [hero.publisher, align].filter(Boolean).join('   ·   ');
  // caption sheds the blurb; duo clamps it; gallery lets it run.
  const blurbLines = detail === 'full' ? 4 : 3;

  let touchStart: number | null = null;

  return (
    <View style={[styles.stage, { height: stageHeight, paddingHorizontal: gutter }]}>
      {showGhostName && (
        <Text style={styles.ghost} numberOfLines={1} pointerEvents="none" accessible={false}>
          {hero.name}
        </Text>
      )}

      <View
        style={styles.row}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          touchStart = e.nativeEvent.pageX;
        }}
        onResponderRelease={(e) => {
          const from = touchStart;
          touchStart = null;
          if (from == null) return;
          const dx = e.nativeEvent.pageX - from;
          if (Math.abs(dx) > SWIPE_THRESHOLD) {
            step(dx < 0 ? 1 : -1);
            if (!reduced) Haptics.selectionAsync();
          }
        }}
      >
        <View style={styles.strip}>
          {cards.map((card) => (
            <SpotlightDeckCard
              key={`${card.hero.id}-${card.index}`}
              hero={card.hero}
              width={card.width}
              height={stageHeight}
              opacity={card.opacity}
              active={card.active}
              onPress={() => (card.active ? onHeroPress(card.hero) : setActive(card.index))}
            />
          ))}
        </View>

        <View style={styles.panel}>
          {!!kicker && (
            <Text style={styles.kicker} numberOfLines={1}>
              {kicker}
            </Text>
          )}
          {/* The name is the link. A "View profile" button beside a tappable
              portrait is the same instruction printed twice — the argument the
              web plate already settled — so the chevron says it once. */}
          <Pressable
            onPress={() => onHeroPress(hero)}
            accessibilityRole="link"
            accessibilityLabel={`View ${hero.name}`}
          >
            <Text style={styles.name} numberOfLines={2}>
              {hero.name}
            </Text>
          </Pressable>
          {detail !== 'lean' && !!hero.summary && (
            <Text style={styles.blurb} numberOfLines={blurbLines}>
              {hero.summary}
            </Text>
          )}
          {heroes.length > 1 && (
            <View style={styles.progress}>
              <SpotlightProgress
                count={heroes.length}
                active={active}
                intervalMs={AUTOPLAY_MS}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { backgroundColor: COLORS.deepNavy, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: CARD_GAP },
  panel: { flex: 1, minWidth: 0, gap: 12 },
  // Ink on ink, behind the deck. Set large enough to read as scenery rather
  // than as a heading someone forgot to style.
  ghost: {
    position: 'absolute',
    left: 24,
    right: 0,
    top: '50%',
    fontFamily: 'Flame-Regular',
    fontSize: 200,
    // Flame needs ≥1.22× or a clamped line loses its descenders.
    lineHeight: 244,
    color: COLORS.beige,
    opacity: 0.055,
  },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    letterSpacing: 0.4,
    color: COLORS.orange,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 46,
    // 1.24× — clamped Flame clips below 1.22×.
    lineHeight: 58,
    color: COLORS.beige,
  },
  blurb: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(245,235,220,0.66)',
  },
  progress: { marginTop: 4, alignItems: 'flex-start' },
});
```

- [ ] **Step 2: Run the gate**

Run: `yarn tsc --noEmit && yarn test:ci && yarn lint && yarn format:check`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/SpotlightDeck.tsx
git commit -m "feat(spotlight): a deck for the tablet, where the art keeps its shape"
```

**Already verified against the codebase — do not re-check:**
- `Hero` re-exports through the `src/lib/db/heroes.ts` barrel (`export * from './heroes/types'`), which is how `SpotlightSlide` already imports it.
- `heroes.summary` is `string | null`, so the `!!hero.summary` guard is load-bearing and correct.
- `ALIGNMENT_LABELS` is `Record<string, string>` — `{ good: 'Hero', bad: 'Villain', neutral: 'Anti-Hero' }` — so indexing by a lowercased, trimmed alignment can return `undefined`, which the `.filter(Boolean)` on `kicker` handles.
- `SpotlightProgress` takes exactly `{ count: number; active: number; intervalMs: number }`.

---

### Task 6: Branch the carousel and the skeleton at 720pt

The seam. Below 720 nothing changes; above it the deck replaces the full-bleed slide, and the skeleton follows so the handoff does not jump.

**Files:**
- Modify: `src/components/home/SpotlightCarousel.tsx:25-27` (the `spotlightHeight` export) and `:54-90` (the render)
- Modify: `src/components/skeletons/HomeSkeleton.tsx:43` (already calls `spotlightHeight`, so it inherits the new height — verify only)

**Interfaces:**
- Consumes: `SpotlightDeck` (Task 5), `spotlightLayout()` (Task 1).
- Produces: `spotlightHeight(width, height, insetTop)` now returns the deck's `stageHeight` at ≥720pt and the unchanged full-bleed height below it. `usesSpotlightDeck(width): boolean` is exported for the skeleton.

- [ ] **Step 1: Replace the `spotlightHeight` export**

In `src/components/home/SpotlightCarousel.tsx`, replace lines 18–27 (the doc comment and `spotlightHeight`) with:

```tsx
/** Above this the billboard is a deck of correctly-proportioned cards rather
 *  than one full-bleed crop. It is `spotlightLayout`'s own stacked threshold,
 *  not `BREAKPOINTS.tablet` (700) — this number is tuned to the card
 *  arithmetic, and a 20pt band where the page is "tablet" but the billboard is
 *  still a phone billboard costs nothing. */
export const SPOTLIGHT_DECK_MIN_WIDTH = 720;

export function usesSpotlightDeck(width: number): boolean {
  return width >= SPOTLIGHT_DECK_MIN_WIDTH;
}

/**
 * A tall billboard (Apple TV / Disney+) so the portrait reads big — below the
 * deck threshold.
 *
 * Takes the window rather than reading it at import: on a tablet in portrait,
 * half the height is a near-square slab that eats the entire fold, so the
 * height is also capped against the width. See constants/layout.ts.
 *
 * Above the threshold the answer comes from `spotlightLayout` instead, so the
 * skeleton and the feed agree on the deck's stage without either restating it.
 */
export function spotlightHeight(width: number, height: number, insetTop: number): number {
  if (usesSpotlightDeck(width)) return spotlightLayout(width).stageHeight;
  return spotlightHeightFor(width, height, insetTop);
}
```

- [ ] **Step 2: Add the two imports**

At the top of `src/components/home/SpotlightCarousel.tsx`, alongside the existing imports:

```tsx
import { SpotlightDeck } from './SpotlightDeck';
import { spotlightLayout } from '../../constants/spotlightLayout';
```

- [ ] **Step 3: Branch the render**

In `SpotlightCarousel`, immediately after `if (heroes.length === 0) return null;` (line 49), insert:

```tsx
  // Tablet widths get the deck. The phone path below is untouched: it is tuned,
  // shipped, and the defect this branch fixes does not exist at phone widths.
  if (usesSpotlightDeck(winW)) {
    return (
      <View style={[styles.wrap, { height }]}>
        <SpotlightDeck heroes={heroes} onHeroPress={onHeroPress} />
        {showLip && <View style={styles.lip} pointerEvents="none" />}
      </View>
    );
  }
```

- [ ] **Step 4: Confirm the skeleton inherits the new height**

`src/components/skeletons/HomeSkeleton.tsx:43` already calls `spotlightHeight(width, height, insetTop)`, so it now reserves the deck's stage height automatically.

Run: `rg -n "spotlightHeight" src/components/skeletons/HomeSkeleton.tsx`
Expected: one call site, unchanged. No edit needed — note this in the commit body.

- [ ] **Step 5: Run the gate**

Run: `yarn tsc --noEmit && yarn test:ci && yarn lint && yarn check:ui && yarn format:check`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/home/SpotlightCarousel.tsx
git commit -m "feat(spotlight): hand the billboard to the deck above 720pt

The skeleton needed no change: it already sizes itself from spotlightHeight(),
which is exactly why that function was the right place to put the branch."
```

---

### Task 7: Device pass on the iPad simulator

The defect was invisible to every check in CI and only appeared on a device. This task is the verification the last one could not do.

**Files:** none — verification only.

**Interfaces:** consumes the whole feature.

- [ ] **Step 1: Build and launch on the iPad simulator**

Two env vars are required locally or the build fails for reasons unrelated to this change — CocoaPods needs a UTF-8 locale, and the Sentry upload phase has no org configured outside EAS:

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 SENTRY_DISABLE_AUTO_UPLOAD=true npx expo run:ios --device "iPad Pro 13-inch (M5)"
```

- [ ] **Step 2: Check portrait**

Expected at 1032pt: `duo` — one 276pt card, two slivers at 138 and 99, panel with kicker, name, a 3-line blurb and the progress rail. **No ghost name.** Every face whole.

- [ ] **Step 3: Rotate to landscape mid-autoplay**

Rotate with `osascript -e 'tell application "Simulator" to activate' -e 'tell application "System Events" to keystroke (ASCII character 29) using command down'`.

Expected at 1376pt: `gallery` — a 280pt card and a taper down to 20pt, ghost name behind, 4-line blurb. The deck must re-lay out immediately, not on next advance. Note that simulator screenshots come back in the raw portrait framebuffer — correct them with `sips -r 90` before judging.

- [ ] **Step 4: Confirm the phone is untouched**

Boot an iPhone simulator and compare Explore against `main` before this branch.

Expected: pixel-identical. Full-bleed billboard, centred name, dots with a filling pill.

- [ ] **Step 5: Check the skeleton handoff**

Cold-start the iPad app and watch the billboard area as the feed arrives.

Expected: no vertical jump — the skeleton reserved the deck's stage height.

- [ ] **Step 6: Record what you saw**

If anything above failed, stop and report rather than patching past it. This step has no commit.

---

### Task 8: Update the domain doc

Repo rule: a PR that changes a domain's behaviour updates that domain's doc in the same PR.

**Files:**
- Modify: `docs/features/explore-feed-and-pulse.md`

- [ ] **Step 1: Find the billboard section**

Run: `rg -n "billboard|Spotlight" docs/features/explore-feed-and-pulse.md`
Expected: the spotlight discussion around lines 289 and 341–358.

- [ ] **Step 2: Add the deck to that section**

Add, after the existing billboard/indicator prose:

```markdown
**Above 720pt the billboard is a deck, not a crop.** The full-bleed spotlight
sizes its box from the window, so the share of a 2:3 portrait that survives
`contentFit="cover"` falls with the box's aspect — 82% on a phone, 43% on an
iPad in portrait, 26% in landscape, where the art was reduced to hair and hats.
Above `SPOTLIGHT_DECK_MIN_WIDTH` (720) `SpotlightCarousel` renders
`SpotlightDeck` instead: an active card at a fixed 0.55 crop, a tapering deck of
slivers behind it, and a panel carrying the kicker, name, blurb and progress
rail. Geometry for both platforms comes from `src/constants/spotlightLayout.ts`
— the same function the web spotlight uses, moved out of `components/web/` so
the two cannot drift. The panel has no CTA button: the card and the name are
both the link, which is the argument the web plate settled first. The ghost name
is gallery-only. Below 720pt nothing changed — the phone billboard is exactly
what it was.

Design: `docs/superpowers/specs/2026-08-14-ipad-spotlight-deck-design.md`.
```

- [ ] **Step 3: Run the full gate including doc links**

Run: `yarn tsc --noEmit && yarn test:ci && yarn lint && yarn check:ui && yarn format:check && yarn docs:links`
Expected: all pass. `docs:links` verifies every path named above still exists.

- [ ] **Step 4: Commit**

```bash
git add docs/features/explore-feed-and-pulse.md
git commit -m "docs(explore): the billboard becomes a deck above 720pt"
```

---

## Self-Review

**Spec coverage.** Decision 1 (shared module) → Task 1. Decision 2 (no CTA, chevron on the name) → Task 5, panel markup. Decision 3 (ghost name gallery-only) → Task 2. Decision 4 (phone unchanged) → Task 6 branch and Task 7 step 4. `detail` → panel mapping → Task 5, `blurbLines` and the `detail !== 'lean'` guard. Skeleton mirroring → Task 6 step 4. Testing section → Tasks 2, 3 and 7. Out-of-scope items are absent, as intended.

**Known gap, deliberate.** The spec's "unit-test the invariant that `cardWidth / stageHeight` stays near 0.55 from 320 to 1600" is already covered by the existing test `never slices the portrait into a ribbon`, which sweeps 320–2560 and asserts the aspect bounds. No new test added rather than duplicating it.

**Type consistency.** `deckCards(heroes, layout, activeIndex)` is defined in Task 3 and called with that argument order in Task 5. `DeckCard.index` is produced in Task 3 and consumed by `setActive(card.index)` in Task 5. `SpotlightDeckCard`'s six props in Task 4 match the six passed in Task 5. `usesSpotlightDeck` and `SPOTLIGHT_DECK_MIN_WIDTH` are defined in Task 6 and used only there and in the doc. `spotlightLayout` is imported from `../../constants/spotlightLayout` in Tasks 5 and 6, matching the path Task 1 creates.
