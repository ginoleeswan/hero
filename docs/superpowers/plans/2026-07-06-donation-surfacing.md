# Donation Surfacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make donating (Ko-fi) easy and inviting — one-tap in-app, a rich `/support` screen for context, and very-gentle peak-moment nudges after share/tier-up/new-badge.

**Architecture:** A single centralized Ko-fi link + `openKofi()`. A pure, tested frequency policy (`shouldPrompt`) + milestone detector (`detectMilestone`) backed by cross-platform local storage. A `useDonationNudge` hook the profile mounts, rendering a `DonateNudge` bottom-sheet. A guest-viewable `/support` screen (web + native) reached from the landing CTA. No DB, no native IAP.

**Tech Stack:** Expo Router 4, React Native + RN Web, TypeScript (strict), `@react-native-async-storage/async-storage` (native) / `localStorage` (web), jest-expo. Package manager: **yarn**.

## Global Constraints

- Package manager is **yarn** — never npm/bun. Tests: `yarn test:ci`. Typecheck: `yarn tsc --noEmit`.
- TypeScript throughout — no `any`; `unknown` for caught errors.
- Functional components; `StyleSheet.create` for styles (no inline objects except `StyleSheet.absoluteFill` and dynamic values that can't be static).
- Fonts: `Flame-Regular` for display headings (NEVER `Flame-Bold`), `FlameSans-Regular`/`Nunito_*` for UI. Clamped Flame text (any `Text` with `numberOfLines` on a Flame style) needs `lineHeight ≥ 1.22× fontSize`.
- Base canvas `#f5ebdc` (`COLORS.beige`); use `COLORS`/`SURFACE` tokens.
- Screens with a web variant MUST ship BOTH `foo.tsx` and `foo.web.tsx` or expo-router throws a resolution error.
- Cross-platform storage must guard SSR: mirror `src/lib/supabase.ts` (`Platform.OS === 'web'` → localStorage / `typeof window` guard).
- Commit directly to `main`. No pushing unless asked.
- End commit messages with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## Reference interfaces (already in the codebase)

```ts
// src/lib/profile/fanTier.ts  (TIERS order, low→high: Newcomer, Fan, Collector, Curator, Legend)
export function fanTier(input: FanTierInput): { name: string; icon: IoniconName; score: number };
// src/lib/profile/badges.ts
export interface Badge { id: string; earned: boolean; /* … */ }
// src/hooks/useUniverseShareImage.tsx
type ShareImageResult = 'shared' | 'downloaded' | 'unsupported' | 'error'; // success = 'shared' | 'downloaded'
// Existing per-file constant being centralized:
const KO_FI_URL = 'https://ko-fi.com/glstudio';
```

Spec: `docs/superpowers/specs/2026-07-06-donation-surfacing-design.md`.

## File Structure

- **Create** `src/lib/support/kofi.ts` — Ko-fi link registry + `openKofi()`.
- **Create** `src/lib/support/donationPrompt.ts` — pure `shouldPrompt`/`detectMilestone` + storage.
- **Create** `src/hooks/useDonationNudge.ts` — nudge controller hook.
- **Create** `src/components/support/DonateNudge.tsx` — bottom-sheet UI.
- **Create** `app/support.tsx` + `app/support.web.tsx` — `/support` screen.
- **Create** `__tests__/lib/support/donationPrompt.test.ts`.
- **Modify** `src/lib/profile/fanTier.ts` (+`tierRank`) & its test.
- **Modify** `app/(tabs)/profile.tsx`, `app/(tabs)/profile.web.tsx` — use `openKofi`, mount nudge + triggers.
- **Modify** `app/settings.tsx`, `app/settings.web.tsx` — use `openKofi`.
- **Modify** `src/components/landing/LandingPage.dom.tsx` — Support CTA.

---

### Task 1: Centralize the Ko-fi link

**Files:**
- Create: `src/lib/support/kofi.ts`
- Modify: `app/(tabs)/profile.tsx`, `app/(tabs)/profile.web.tsx`, `app/settings.tsx`, `app/settings.web.tsx`

**Interfaces:**
- Produces:
  ```ts
  export const KO_FI_URL: string;
  export const SUPPORT_LINKS: readonly { id: string; label: string; url: string }[];
  export function openKofi(): void;
  ```

- [ ] **Step 1: Create the module**

```ts
// src/lib/support/kofi.ts
import { Linking } from 'react-native';

/** The project's donation page. Single source of truth. */
export const KO_FI_URL = 'https://ko-fi.com/glstudio';

/** Extensible registry — adding a partner later is one entry. */
export const SUPPORT_LINKS = [{ id: 'kofi', label: 'Ko-fi', url: KO_FI_URL }] as const;

/** Open the donation page. One call site so analytics can hook in later. */
export function openKofi(): void {
  Linking.openURL(KO_FI_URL);
}
```

- [ ] **Step 2: Repoint the four existing support rows**

In each of `app/(tabs)/profile.tsx`, `app/(tabs)/profile.web.tsx`, `app/settings.tsx`, `app/settings.web.tsx`:
1. Delete the local `const KO_FI_URL = 'https://ko-fi.com/glstudio';` line.
2. Add `import { openKofi } from '../../src/lib/support/kofi';` (settings files: `'../src/lib/support/kofi'`).
3. Replace every `onPress={() => Linking.openURL(KO_FI_URL)}` with `onPress={openKofi}`.
4. If `Linking` is now unused in a file, remove it from the `react-native` import. (Check: `grep -n "Linking" <file>` — profile files still use it elsewhere? If no other use, drop it.)

- [ ] **Step 3: Typecheck**

Run: `yarn tsc --noEmit`
Expected: clean (no `KO_FI_URL`/`Linking` unused-or-undefined errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/support/kofi.ts "app/(tabs)/profile.tsx" "app/(tabs)/profile.web.tsx" app/settings.tsx app/settings.web.tsx
git commit -m "refactor(support): centralize Ko-fi link + openKofi()

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Tier ranking helper

**Files:**
- Modify: `src/lib/profile/fanTier.ts`
- Test: `__tests__/lib/profile/fanTier.test.ts`

**Interfaces:**
- Produces: `export function tierRank(name: string): number;` — higher = better tier; unknown name → -1.

- [ ] **Step 1: Write the failing test** (append to the existing `describe`s in the file)

```ts
// __tests__/lib/profile/fanTier.test.ts  — add this import to the existing top import line:
//   import { fanScore, fanTier, tierProgress, tierRank } from '../../../src/lib/profile/fanTier';
describe('tierRank', () => {
  it('orders tiers low → high', () => {
    expect(tierRank('Newcomer')).toBeLessThan(tierRank('Fan'));
    expect(tierRank('Fan')).toBeLessThan(tierRank('Collector'));
    expect(tierRank('Collector')).toBeLessThan(tierRank('Curator'));
    expect(tierRank('Curator')).toBeLessThan(tierRank('Legend'));
  });
  it('returns -1 for an unknown tier', () => {
    expect(tierRank('Nope')).toBe(-1);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `yarn test:ci __tests__/lib/profile/fanTier.test.ts`
Expected: FAIL — `tierRank is not a function`.

- [ ] **Step 3: Implement** (add to `src/lib/profile/fanTier.ts`, after the `TIERS` array)

```ts
/** Rank of a tier by name (higher = better). Unknown → -1. */
export function tierRank(name: string): number {
  // TIERS is descending by min; reverse-index gives low→high rank.
  const idx = TIERS.findIndex((t) => t.name === name);
  return idx === -1 ? -1 : TIERS.length - 1 - idx;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `yarn test:ci __tests__/lib/profile/fanTier.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile/fanTier.ts __tests__/lib/profile/fanTier.test.ts
git commit -m "feat(profile): add tierRank helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Donation prompt policy + storage

**Files:**
- Create: `src/lib/support/donationPrompt.ts`
- Test: `__tests__/lib/support/donationPrompt.test.ts`

**Interfaces:**
- Consumes: `tierRank` from `src/lib/profile/fanTier.ts`.
- Produces:
  ```ts
  export interface DonationPromptState {
    lastShownAt: number | null;
    lastDismissedAt: number | null;
    lastConvertedAt: number | null;
    lastSeenTier: string | null;
    seenBadgeIds: string[];
  }
  export const MIN_DAYS_BETWEEN_SHOWS: number; // 30
  export const BACKOFF_DAYS_AFTER_ACTION: number; // 90
  export const DEFAULT_STATE: DonationPromptState;
  export function shouldPrompt(state: DonationPromptState, now: number): boolean;
  export function detectMilestone(
    prev: Pick<DonationPromptState, 'lastSeenTier' | 'seenBadgeIds'>,
    current: { tier: string; earnedBadgeIds: string[] },
  ): 'tier' | 'badge' | null;
  export function loadPromptState(): Promise<DonationPromptState>;
  export function savePromptState(patch: Partial<DonationPromptState>): Promise<void>;
  ```

**Policy rules:**
- `shouldPrompt`: true only when `(now - lastShownAt) ≥ 30d` **and** `(now - max(lastDismissedAt, lastConvertedAt)) ≥ 90d`. `null` timestamps = "infinitely long ago" (allowed).
- `detectMilestone`: if `prev.lastSeenTier === null` → return `null` (first-run seeding, never fire). Else if `tierRank(current.tier) > tierRank(prev.lastSeenTier)` → `'tier'`. Else if any id in `current.earnedBadgeIds` is not in `prev.seenBadgeIds` → `'badge'`. Else `null`.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/support/donationPrompt.test.ts
import {
  shouldPrompt,
  detectMilestone,
  DEFAULT_STATE,
  type DonationPromptState,
} from '../../../src/lib/support/donationPrompt';

const DAY = 86_400_000;
const base: DonationPromptState = {
  lastShownAt: null,
  lastDismissedAt: null,
  lastConvertedAt: null,
  lastSeenTier: 'Fan',
  seenBadgeIds: ['day-one'],
};

describe('shouldPrompt', () => {
  const now = 1_000 * DAY;
  it('allows when never shown or acted on', () => {
    expect(shouldPrompt(base, now)).toBe(true);
  });
  it('blocks within 30 days of last show', () => {
    expect(shouldPrompt({ ...base, lastShownAt: now - 20 * DAY }, now)).toBe(false);
    expect(shouldPrompt({ ...base, lastShownAt: now - 31 * DAY }, now)).toBe(true);
  });
  it('blocks for 90 days after a dismiss', () => {
    expect(shouldPrompt({ ...base, lastDismissedAt: now - 60 * DAY }, now)).toBe(false);
    expect(shouldPrompt({ ...base, lastDismissedAt: now - 91 * DAY }, now)).toBe(true);
  });
  it('blocks for 90 days after a convert', () => {
    expect(shouldPrompt({ ...base, lastConvertedAt: now - 60 * DAY }, now)).toBe(false);
  });
});

describe('detectMilestone', () => {
  it('seeds silently on first run (null tier)', () => {
    expect(
      detectMilestone(
        { lastSeenTier: null, seenBadgeIds: [] },
        { tier: 'Collector', earnedBadgeIds: ['day-one'] },
      ),
    ).toBeNull();
  });
  it('fires tier on a level-up', () => {
    expect(
      detectMilestone(
        { lastSeenTier: 'Fan', seenBadgeIds: ['day-one'] },
        { tier: 'Collector', earnedBadgeIds: ['day-one'] },
      ),
    ).toBe('tier');
  });
  it('does not fire on a tier drop or same tier', () => {
    expect(
      detectMilestone(
        { lastSeenTier: 'Curator', seenBadgeIds: ['day-one'] },
        { tier: 'Collector', earnedBadgeIds: ['day-one'] },
      ),
    ).toBeNull();
  });
  it('fires badge on a new earned badge', () => {
    expect(
      detectMilestone(
        { lastSeenTier: 'Fan', seenBadgeIds: ['day-one'] },
        { tier: 'Fan', earnedBadgeIds: ['day-one', 'veteran'] },
      ),
    ).toBe('badge');
  });
  it('returns null when nothing changed', () => {
    expect(
      detectMilestone(
        { lastSeenTier: 'Fan', seenBadgeIds: ['day-one'] },
        { tier: 'Fan', earnedBadgeIds: ['day-one'] },
      ),
    ).toBeNull();
  });
});

it('DEFAULT_STATE has null timestamps and empty seen sets', () => {
  expect(DEFAULT_STATE).toEqual({
    lastShownAt: null,
    lastDismissedAt: null,
    lastConvertedAt: null,
    lastSeenTier: null,
    seenBadgeIds: [],
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `yarn test:ci __tests__/lib/support/donationPrompt.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

```ts
// src/lib/support/donationPrompt.ts
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tierRank } from '../profile/fanTier';

export interface DonationPromptState {
  lastShownAt: number | null;
  lastDismissedAt: number | null;
  lastConvertedAt: number | null;
  lastSeenTier: string | null;
  seenBadgeIds: string[];
}

export const MIN_DAYS_BETWEEN_SHOWS = 30;
export const BACKOFF_DAYS_AFTER_ACTION = 90;
const DAY = 86_400_000;
const KEY = 'mythique.donationPrompt.v1';

export const DEFAULT_STATE: DonationPromptState = {
  lastShownAt: null,
  lastDismissedAt: null,
  lastConvertedAt: null,
  lastSeenTier: null,
  seenBadgeIds: [],
};

/** Very gentle: ≥30d since any show, ≥90d since a dismiss or convert. */
export function shouldPrompt(state: DonationPromptState, now: number): boolean {
  const sinceShown = state.lastShownAt == null ? Infinity : now - state.lastShownAt;
  const lastAction = Math.max(state.lastDismissedAt ?? -Infinity, state.lastConvertedAt ?? -Infinity);
  const sinceAction = lastAction === -Infinity ? Infinity : now - lastAction;
  return sinceShown >= MIN_DAYS_BETWEEN_SHOWS * DAY && sinceAction >= BACKOFF_DAYS_AFTER_ACTION * DAY;
}

/** Which new milestone fired (if any). Null-tier prev = first-run seed → never fires. */
export function detectMilestone(
  prev: Pick<DonationPromptState, 'lastSeenTier' | 'seenBadgeIds'>,
  current: { tier: string; earnedBadgeIds: string[] },
): 'tier' | 'badge' | null {
  if (prev.lastSeenTier === null) return null;
  if (tierRank(current.tier) > tierRank(prev.lastSeenTier)) return 'tier';
  const prevSet = new Set(prev.seenBadgeIds);
  if (current.earnedBadgeIds.some((id) => !prevSet.has(id))) return 'badge';
  return null;
}

// ── Cross-platform storage (mirrors supabase.ts SSR guard) ───────────────────
function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve(null);
    return Promise.resolve(window.localStorage.getItem(key));
  }
  return AsyncStorage.getItem(key);
}
function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve();
    window.localStorage.setItem(key, value);
    return Promise.resolve();
  }
  return AsyncStorage.setItem(key, value);
}

export async function loadPromptState(): Promise<DonationPromptState> {
  try {
    const raw = await getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<DonationPromptState>;
    return { ...DEFAULT_STATE, ...parsed, seenBadgeIds: parsed.seenBadgeIds ?? [] };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function savePromptState(patch: Partial<DonationPromptState>): Promise<void> {
  try {
    const current = await loadPromptState();
    await setItem(KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Best-effort; a failed write just means we may ask again sooner.
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `yarn test:ci __tests__/lib/support/donationPrompt.test.ts`
Expected: PASS (all `shouldPrompt`, `detectMilestone`, `DEFAULT_STATE` cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/support/donationPrompt.ts __tests__/lib/support/donationPrompt.test.ts
git commit -m "feat(support): donation prompt policy + milestone detection + storage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: DonateNudge bottom-sheet

**Files:**
- Create: `src/components/support/DonateNudge.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function DonateNudge(props: {
    visible: boolean;
    onConvert: () => void;   // "Buy me a coffee"
    onDismiss: () => void;   // "Maybe later" / backdrop
  }): JSX.Element;
  ```

**Behavior:** A `Modal` (transparent, slide/fade) anchored to the bottom. Paper card
with a ☕ emoji, a Flame heading "Enjoying Mythique?", one line
"It's free, made by one person — a coffee keeps it alive.", a primary orange
**Buy me a coffee** button (`onConvert`), and a quiet **Maybe later** (`onDismiss`).
Backdrop press = dismiss. Cross-platform (RN `Modal` works on web + native). No hover
required; use `Pressable` with `pressed` opacity.

- [ ] **Step 1: Implement**

```tsx
// src/components/support/DonateNudge.tsx
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

export function DonateNudge({
  visible,
  onConvert,
  onDismiss,
}: {
  visible: boolean;
  onConvert: () => void;
  onDismiss: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.emoji}>☕</Text>
          <Text style={styles.title}>Enjoying Mythique?</Text>
          <Text style={styles.body}>It’s free, made by one person — a coffee keeps it alive.</Text>
          <Pressable
            onPress={onConvert}
            style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          >
            <Text style={styles.primaryText}>Buy me a coffee</Text>
          </Pressable>
          <Pressable onPress={onDismiss} style={styles.later} hitSlop={8}>
            <Text style={styles.laterText}>Maybe later</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,28,32,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 34,
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
  },
  emoji: { fontSize: 34, marginBottom: 8 },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 24,
    lineHeight: 30, // ≥ 1.22× fontSize
    color: COLORS.navy,
    marginBottom: 6,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.grey,
    textAlign: 'center',
    marginBottom: 18,
  },
  primary: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryPressed: { opacity: 0.9 },
  primaryText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },
  later: { paddingVertical: 12, marginTop: 4 },
  laterText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.grey },
});
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no errors referencing `DonateNudge.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/support/DonateNudge.tsx
git commit -m "feat(support): DonateNudge bottom-sheet

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: useDonationNudge hook

**Files:**
- Create: `src/hooks/useDonationNudge.ts`

**Interfaces:**
- Consumes: `shouldPrompt`, `detectMilestone`, `loadPromptState`, `savePromptState` from `../lib/support/donationPrompt`; `openKofi` from `../lib/support/kofi`.
- Produces:
  ```ts
  export function useDonationNudge(): {
    visible: boolean;
    requestNudge: (reason: 'share' | 'milestone') => Promise<void>;
    syncMilestones: (input: { tier: string; earnedBadgeIds: string[] }) => Promise<void>;
    onConvert: () => void;
    onDismiss: () => void;
  };
  ```

**Behavior:**
- `syncMilestones`: load state → `detectMilestone(prev, current)`; **always** persist
  `lastSeenTier`/`seenBadgeIds` = current; if a milestone fired AND `shouldPrompt(state, now)`
  → set `visible=true` and persist `lastShownAt=now`. Guarded so it runs at most once per
  distinct `(tier, badge-set)` via an internal ref key.
- `requestNudge('share')`: load state → if `shouldPrompt` → show + persist `lastShownAt`.
- `onConvert`: persist `lastConvertedAt=now`, `openKofi()`, hide.
- `onDismiss`: persist `lastDismissedAt=now`, hide.

- [ ] **Step 1: Implement**

```ts
// src/hooks/useDonationNudge.ts
import { useCallback, useRef, useState } from 'react';
import {
  loadPromptState,
  savePromptState,
  shouldPrompt,
  detectMilestone,
} from '../lib/support/donationPrompt';
import { openKofi } from '../lib/support/kofi';

export function useDonationNudge() {
  const [visible, setVisible] = useState(false);
  // Dedupe: only process a given tier+badge signature once per mount.
  const lastSig = useRef<string | null>(null);

  const requestNudge = useCallback(async (_reason: 'share' | 'milestone') => {
    const state = await loadPromptState();
    if (shouldPrompt(state, Date.now())) {
      await savePromptState({ lastShownAt: Date.now() });
      setVisible(true);
    }
  }, []);

  const syncMilestones = useCallback(
    async (input: { tier: string; earnedBadgeIds: string[] }) => {
      const sig = `${input.tier}|${[...input.earnedBadgeIds].sort().join(',')}`;
      if (lastSig.current === sig) return;
      lastSig.current = sig;

      const state = await loadPromptState();
      const milestone = detectMilestone(
        { lastSeenTier: state.lastSeenTier, seenBadgeIds: state.seenBadgeIds },
        input,
      );
      // Always record the current baseline so a milestone only counts once.
      await savePromptState({ lastSeenTier: input.tier, seenBadgeIds: input.earnedBadgeIds });
      if (milestone && shouldPrompt(state, Date.now())) {
        await savePromptState({ lastShownAt: Date.now() });
        setVisible(true);
      }
    },
    [],
  );

  const onConvert = useCallback(() => {
    void savePromptState({ lastConvertedAt: Date.now() });
    openKofi();
    setVisible(false);
  }, []);

  const onDismiss = useCallback(() => {
    void savePromptState({ lastDismissedAt: Date.now() });
    setVisible(false);
  }, []);

  return { visible, requestNudge, syncMilestones, onConvert, onDismiss };
}
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no errors referencing `useDonationNudge.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDonationNudge.ts
git commit -m "feat(support): useDonationNudge controller hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Wire nudge triggers into the profile (web + native)

**Files:**
- Modify: `app/(tabs)/profile.tsx`, `app/(tabs)/profile.web.tsx`

**Interfaces:**
- Consumes: `useDonationNudge` (Task 5), `DonateNudge` (Task 4), `tier` (already computed as `fanTier(...)`), `badges` (already computed).

Apply the SAME changes to both files (native `profile.tsx` and web `profile.web.tsx`), adapting import depth (`'../../src/...'`).

- [ ] **Step 1: Add imports**

```ts
import { useEffect } from 'react'; // web file already imports from 'react'; add useEffect to that import instead of a new line
import { useDonationNudge } from '../../src/hooks/useDonationNudge';
import { DonateNudge } from '../../src/components/support/DonateNudge';
```
(For `profile.web.tsx` the existing first import is `import { useEffect, useState } from 'react';` — already has `useEffect`. For `profile.tsx` the first import is `import { useCallback, useState } from 'react';` — add `useEffect`.)

- [ ] **Step 2: Mount the hook + fire milestone sync**

In the authed component body, after `const tier = fanTier(tierInput);` and `badges`/`badgesEarned` exist, add:

```ts
const nudge = useDonationNudge();
useEffect(() => {
  if (loading) return;
  void nudge.syncMilestones({
    tier: tier.name,
    earnedBadgeIds: badges.filter((b) => b.earned).map((b) => b.id),
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [loading, tier.name, badges]);
```

- [ ] **Step 3: Fire the post-share nudge**

Find `handleShareUniverse` and add the nudge request on success:

```ts
const handleShareUniverse = async () => {
  const result = await shareUniverse();
  if (result === 'error') showToast('Could not create your card');
  else if (result === 'unsupported') showToast('Sharing not available');
  else void nudge.requestNudge('share'); // 'shared' | 'downloaded'
};
```

- [ ] **Step 4: Render the nudge**

Near the other modals at the end of the authed return (next to `<Toast …/>` / `<BadgeDetailModal …/>`), add:

```tsx
<DonateNudge visible={nudge.visible} onConvert={nudge.onConvert} onDismiss={nudge.onDismiss} />
```

- [ ] **Step 5: Typecheck + tests**

Run: `yarn tsc --noEmit` (expect clean) then `yarn test:ci` (expect all pass — no test imports these views).

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/profile.tsx" "app/(tabs)/profile.web.tsx"
git commit -m "feat(support): peak-moment donate nudge on profile (share + milestones)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: `/support` screen (web + native)

**Files:**
- Create: `app/support.web.tsx`, `app/support.tsx`

**Interfaces:**
- Consumes: `openKofi`, `SUPPORT_LINKS` from `../src/lib/support/kofi`; `SectionShell` from `../src/components/profile/SectionShell`; `useScreenChrome` (web) / `useSafeAreaInsets` (native), `COLORS`/`SURFACE`.

**Contents (both):** back affordance + Flame title "Support Mythique"; a story
`SectionShell` ("Mythique is a free, unofficial fan encyclopedia built by one
person. No ads, no paywall — just heroes."); a "Ways to help" `SectionShell` with
three suggested-tier chips (☕ Coffee · $3, ❤️ Fan · $10, ⭐ Champion · $25) each
calling `openKofi`, plus the note "Amounts are suggestions — Ko-fi lets you choose";
a primary **Buy me a coffee** button (`openKofi`); a thank-you line. **Guest-safe:
NO auth gate** (unlike settings). Web clears the nav with top padding like
`app/settings.web.tsx` (`paddingTop: 92`); native uses `useSafeAreaInsets`.

- [ ] **Step 1: Create `app/support.web.tsx`**

```tsx
// app/support.web.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SURFACE } from '../src/constants/colors';
import { useScreenChrome } from '../src/hooks/useScreenChrome';
import { SectionShell } from '../src/components/profile/SectionShell';
import { openKofi } from '../src/lib/support/kofi';

const TIERS = [
  { emoji: '☕', label: 'Coffee', amount: '$3' },
  { emoji: '❤️', label: 'Fan', amount: '$10' },
  { emoji: '⭐', label: 'Champion', amount: '$25' },
];

export default function WebSupportScreen() {
  const router = useRouter();
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });

  return (
    <View style={styles.root}>
      <View style={styles.column}>
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.backBtn,
              hovered && (styles.backHover as object),
            ]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.navy} />
          </Pressable>
          <Text style={styles.title}>Support Mythique</Text>
        </View>

        <SectionShell title="Why support?">
          <Text style={styles.body}>
            Mythique is a free, unofficial fan encyclopedia built by one person. No ads, no
            paywall — just heroes. If it’s brought you a bit of joy, a coffee keeps it alive.
          </Text>
        </SectionShell>

        <SectionShell title="Ways to help">
          <View style={styles.tierRow}>
            {TIERS.map((t) => (
              <Pressable
                key={t.label}
                onPress={openKofi}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.tier,
                  hovered && (styles.tierHover as object),
                ]}
              >
                <Text style={styles.tierEmoji}>{t.emoji}</Text>
                <Text style={styles.tierLabel}>{t.label}</Text>
                <Text style={styles.tierAmount}>{t.amount}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.note}>Amounts are suggestions — Ko-fi lets you choose.</Text>
          <Pressable
            onPress={openKofi}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.primary,
              hovered && (styles.primaryHover as object),
            ]}
          >
            <Ionicons name="cafe" size={16} color="#fff" />
            <Text style={styles.primaryText}>Buy me a coffee</Text>
          </Pressable>
        </SectionShell>

        <Text style={styles.thanks}>Thank you — it genuinely means a lot. 🧡</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  column: {
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 92,
    paddingBottom: 48,
  } as object,
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18, marginLeft: -8 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } as object,
  backHover: { backgroundColor: 'rgba(41,60,67,0.06)' } as object,
  title: { fontFamily: 'Flame-Regular', fontSize: 32, lineHeight: 40, color: COLORS.navy },
  body: { fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 21, color: COLORS.grey },
  tierRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tier: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#fbf3ea',
    borderWidth: 1,
    borderColor: '#f0e2d0',
    cursor: 'pointer',
  } as object,
  tierHover: { backgroundColor: '#fdece0', borderColor: COLORS.orange } as object,
  tierEmoji: { fontSize: 22 },
  tierLabel: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  tierAmount: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
  note: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey, marginBottom: 16 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 13,
    cursor: 'pointer',
  } as object,
  primaryHover: { opacity: 0.92 } as object,
  primaryText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },
  thanks: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.navy,
    textAlign: 'center',
    marginTop: 8,
  },
});
```

- [ ] **Step 2: Create `app/support.tsx` (native)**

Mirror Step 1 with native patterns: `ScrollView` + `useSafeAreaInsets` for top
padding (no `useScreenChrome`, no `cursor`/hover — use `Pressable` `pressed` for the
tier/primary/back press feedback). Same copy, same three tiers → `openKofi`, same
guest-safe (no auth gate). Root `backgroundColor: COLORS.beige`; column
`paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48` inside the safe-area view.

- [ ] **Step 3: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no errors in `app/support.tsx` / `app/support.web.tsx`.

- [ ] **Step 4: Add an in-app "Learn more" entry (optional, low-risk)**

In `app/settings.web.tsx` and `app/settings.tsx`, in the "Support" `SectionShell`,
add a second row **above** the Ko-fi row: `SettingRow icon="information-circle-outline"
label="About supporting" onPress={() => router.push('/support')} chevron`. (Keep the
existing one-tap Ko-fi row unchanged.)

- [ ] **Step 5: Commit**

```bash
git add app/support.tsx app/support.web.tsx app/settings.web.tsx app/settings.tsx
git commit -m "feat(support): /support screen (web + native) + settings entry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Web landing CTA

**Files:**
- Modify: `src/components/landing/LandingPage.dom.tsx`

**Interfaces:**
- Consumes: `KO_FI_URL` from `../../lib/support/kofi` (DOM component — use a plain `<a>`/router link, not RN `Linking`).

- [ ] **Step 1: Add a Support entry**

Read the file to find its footer / secondary CTA area. Add a tasteful "Support
Mythique" link that navigates to `/support` (in-app route) — e.g. an `<a href="/support">`
styled to match the landing's secondary links, placed in the footer, NOT competing with
the primary sign-up CTA. If the landing has no in-app router link pattern, link directly
to `KO_FI_URL` with `target="_blank" rel="noopener noreferrer"` as the fallback. Match
the surrounding styling (this file owns its own styles).

- [ ] **Step 2: Typecheck + tests**

Run: `yarn tsc --noEmit` (clean) then `yarn test:ci` (all pass).

- [ ] **Step 3: Visual verify + commit**

Load the landing page (web) and confirm the Support link appears in the footer and
routes to `/support`. Then:

```bash
git add src/components/landing/LandingPage.dom.tsx
git commit -m "feat(support): Support CTA on the web landing page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Single Ko-fi source + `openKofi` + repoint 4 files → Task 1. ✓
- `shouldPrompt` (≥30d / ≥90d) + `detectMilestone` + first-run seed + storage → Task 3 (+ `tierRank` Task 2). ✓
- `DonateNudge` bottom-sheet, one-tap Ko-fi → Task 4. ✓
- `useDonationNudge` (syncMilestones/requestNudge/onConvert/onDismiss) → Task 5. ✓
- Triggers: post-share + milestone on load, both gated → Task 6. ✓
- `/support` screen (web+native, tiers, guest-safe) + settings "Learn more" → Task 7. ✓
- Landing CTA → Task 8. ✓
- Tests: policy + milestone + tierRank → Tasks 2, 3. ✓ (No view/hook-storage/nav tests, per spec.)

**Placeholder scan:** No TBD/"handle errors"/"similar to". Task 7 Step 2 (native) and
Task 8 Step 1 (landing) describe concrete adaptations of shown code against files whose
exact surrounding styling must be read first — the code to mirror is fully given in
Task 7 Step 1; the landing link is a standard anchor. ✓

**Type consistency:** `DonationPromptState`, `shouldPrompt`, `detectMilestone`,
`loadPromptState`/`savePromptState` signatures match between Task 3 (def), Task 5
(consumer). `tierRank` (Task 2) consumed by Task 3. `DonateNudge` props
(`visible/onConvert/onDismiss`) match Task 4 (def) and Task 6 (render). `useDonationNudge`
return shape matches Task 5 (def) and Task 6 (use). Success literals `'shared'|'downloaded'`
handled in Task 6 via the `else` branch. ✓
