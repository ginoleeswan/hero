# Profile Reorganize & Elevate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the Profile screen (web + native) for hierarchy and identity — a unified stat strip, elevated fandom sections, Favourites as anchor — and extract account plumbing into a dedicated `/settings` route.

**Architecture:** No new data or schema. The existing platform-neutral hooks (`useProfile`, `useProfileData`) stay unchanged. Add one pure model builder (`buildProfileStats`) with tests, one shared `StatStrip` presentational component, a new `/settings` route (native + web view files that reuse existing `useAuth`/`useProfile` handlers), then recompose `profile.tsx` / `profile.web.tsx` to the new order and remove the Account card + standalone Battle Record section.

**Tech Stack:** Expo Router 4, React Native + React Native Web, TypeScript (strict, no `any`), `StyleSheet.create`, jest-expo. Package manager: **yarn**.

## Global Constraints

- Package manager is **yarn** — never npm/bun. Test command: `yarn test:ci`.
- TypeScript throughout — no `any`; use `unknown` for caught errors.
- Functional components only; `StyleSheet.create` for all styles (no inline style objects except `StyleSheet.absoluteFill`).
- Fonts: `Flame-Regular` for display headings (NEVER `Flame-Bold` — unreadable), `FlameSans-Regular` for UI, `Nunito_*` for UI text.
- Clamped Flame text needs `lineHeight ≥ 1.22× fontSize`.
- Base canvas colour `#f5ebdc` (`COLORS.beige`); use `COLORS` / `SURFACE` tokens from `src/constants/colors.ts`, never raw hexes for the ink/paper/navy family.
- Screens with a web variant MUST ship BOTH `foo.tsx` and `foo.web.tsx` or expo-router throws a resolution error. Keep them thin view layers; shared logic goes in `src/hooks/`.
- Screens never import `supabase` directly — all DB access via `src/lib/db/`.
- Do NOT test navigation or full-screen rendering — unit-test pure logic only.
- Commit directly to `main` (no feature branches).
- End commit messages with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## Reference interfaces (already in the codebase — consume, do not redefine)

```ts
// src/lib/profile/badges.ts
export function computeBadges(input: BadgeInput, now?: number): Badge[];
export function earnedCount(badges: Badge[]): number;

// src/lib/db/matchupVotes.ts
export interface BattleRecord {
  total: number;      // battles voted
  agreePct: number;   // agree/total as whole percentage, 0 when no votes
  streak: number;     // day streak
  // (other fields exist; only these three are used here)
}

// src/lib/profile/provider.ts
export function providerMeta(provider: string): { icon: IoniconName; label: string };

// src/lib/db/taste.ts
export function dominantAlignment(t: TasteProfile): string | null;
export function shortPublisher(name: string): string;

// src/hooks/useScreenChrome.ts
export function useScreenChrome({ top, canvas }: { top?: string; canvas: string }): void;
```

Design spec: `docs/superpowers/specs/2026-07-05-profile-reorganize-elevate-design.md`.

## File Structure

- **Create** `src/lib/profile/stats.ts` — pure `buildProfileStats(input)` → ordered, zero-filtered `ProfileStat[]`.
- **Create** `__tests__/lib/profile/stats.test.ts` — unit tests for the builder.
- **Create** `src/components/profile/StatStrip.tsx` — presentational stat row (shared web/native).
- **Create** `app/settings.tsx` — native settings screen (account rows + handlers moved from native profile).
- **Create** `app/settings.web.tsx` — web settings screen (account rows + handlers moved from web profile).
- **Modify** `app/(tabs)/profile.web.tsx` — remove Account card + Battle Record section; add gear→/settings, stat strip, member-since flex line, Ko-fi footer; elevate Universe/Badges; recompose desktop sidebar/main.
- **Modify** `app/(tabs)/profile.tsx` — mirror the same reorg on native.

---

### Task 1: Pure stat-strip model builder

**Files:**
- Create: `src/lib/profile/stats.ts`
- Test: `__tests__/lib/profile/stats.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  ```ts
  export interface ProfileStat {
    key: 'saved' | 'battles' | 'streak' | 'crowd' | 'badges';
    label: string;   // e.g. "Saved", "Battles", "Streak", "With the crowd", "Badges"
    value: string;   // display string, e.g. "12", "5", "83%"
    loading?: boolean; // true → render a skeleton tile instead of value
  }
  export interface ProfileStatInput {
    savedCount: number;
    favouritesLoading: boolean;
    battle: { total: number; agreePct: number; streak: number } | null;
    badgesEarned: number;
  }
  export function buildProfileStats(input: ProfileStatInput): ProfileStat[];
  ```

**Rules (from spec):**
- Order is fixed: `saved, battles, streak, crowd, badges`.
- A stat is included only when its underlying value is `> 0`, EXCEPT: `saved` is included as a `loading: true` skeleton tile while `favouritesLoading` is true (even though its value would read 0).
- `battles`, `streak`, `crowd` all derive from `battle` and are only considered when `battle && battle.total > 0`. Within that: `battles` (always, since total>0), `streak` only if `battle.streak > 0`, `crowd` only if `battle.agreePct > 0`.
- `badges` included only if `badgesEarned > 0`; value is the bare count (not `x/y`).
- If, after filtering, the result would be empty AND `favouritesLoading` is false, return `[]` (caller renders no strip).
- Value formatting: counts as plain integers; `crowd` value is `` `${battle.agreePct}%` ``.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/profile/stats.test.ts
import { buildProfileStats } from '../../../src/lib/profile/stats';

describe('buildProfileStats', () => {
  it('returns empty for a brand-new user with all zeros (loaded)', () => {
    const stats = buildProfileStats({
      savedCount: 0,
      favouritesLoading: false,
      battle: null,
      badgesEarned: 0,
    });
    expect(stats).toEqual([]);
  });

  it('shows a loading Saved tile while favourites load, even at 0', () => {
    const stats = buildProfileStats({
      savedCount: 0,
      favouritesLoading: true,
      battle: null,
      badgesEarned: 0,
    });
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ key: 'saved', loading: true });
  });

  it('includes saved + badges when present, in fixed order', () => {
    const stats = buildProfileStats({
      savedCount: 12,
      favouritesLoading: false,
      battle: null,
      badgesEarned: 7,
    });
    expect(stats.map((s) => s.key)).toEqual(['saved', 'badges']);
    expect(stats[0]).toMatchObject({ key: 'saved', value: '12', loading: undefined });
    expect(stats[1]).toMatchObject({ key: 'badges', value: '7' });
  });

  it('expands battle into battles/streak/crowd, dropping zero components', () => {
    const stats = buildProfileStats({
      savedCount: 3,
      favouritesLoading: false,
      battle: { total: 34, agreePct: 83, streak: 0 },
      badgesEarned: 0,
    });
    expect(stats.map((s) => s.key)).toEqual(['saved', 'battles', 'crowd']);
    const crowd = stats.find((s) => s.key === 'crowd');
    expect(crowd?.value).toBe('83%');
  });

  it('full house keeps the fixed order saved,battles,streak,crowd,badges', () => {
    const stats = buildProfileStats({
      savedCount: 12,
      favouritesLoading: false,
      battle: { total: 34, agreePct: 83, streak: 5 },
      badgesEarned: 7,
    });
    expect(stats.map((s) => s.key)).toEqual(['saved', 'battles', 'streak', 'crowd', 'badges']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:ci __tests__/lib/profile/stats.test.ts`
Expected: FAIL — cannot find module `../../../src/lib/profile/stats`.

- [ ] **Step 3: Implement the builder**

```ts
// src/lib/profile/stats.ts
export interface ProfileStat {
  key: 'saved' | 'battles' | 'streak' | 'crowd' | 'badges';
  label: string;
  value: string;
  loading?: boolean;
}

export interface ProfileStatInput {
  savedCount: number;
  favouritesLoading: boolean;
  battle: { total: number; agreePct: number; streak: number } | null;
  badgesEarned: number;
}

/**
 * Builds the profile "you at a glance" stat strip: a fixed-order, zero-filtered
 * list of tiles. Saved renders as a skeleton tile while favourites load; every
 * other tile appears only when its value is > 0. An all-zero loaded state
 * returns [] so the caller renders no strip.
 */
export function buildProfileStats(input: ProfileStatInput): ProfileStat[] {
  const { savedCount, favouritesLoading, battle, badgesEarned } = input;
  const stats: ProfileStat[] = [];

  if (favouritesLoading) {
    stats.push({ key: 'saved', label: 'Saved', value: '', loading: true });
  } else if (savedCount > 0) {
    stats.push({ key: 'saved', label: 'Saved', value: String(savedCount) });
  }

  if (battle && battle.total > 0) {
    stats.push({ key: 'battles', label: 'Battles', value: String(battle.total) });
    if (battle.streak > 0) {
      stats.push({ key: 'streak', label: 'Streak', value: String(battle.streak) });
    }
    if (battle.agreePct > 0) {
      stats.push({ key: 'crowd', label: 'With the crowd', value: `${battle.agreePct}%` });
    }
  }

  if (badgesEarned > 0) {
    stats.push({ key: 'badges', label: 'Badges', value: String(badgesEarned) });
  }

  return stats;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test:ci __tests__/lib/profile/stats.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile/stats.ts __tests__/lib/profile/stats.test.ts
git commit -m "feat(profile): add buildProfileStats stat-strip model builder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: StatStrip presentational component

**Files:**
- Create: `src/components/profile/StatStrip.tsx`

**Interfaces:**
- Consumes: `ProfileStat` from `src/lib/profile/stats.ts`.
- Produces:
  ```ts
  export function StatStrip(props: {
    stats: ProfileStat[];
    onPressStat?: (key: ProfileStat['key']) => void;
  }): JSX.Element | null;
  ```

**Behavior:** Renders a horizontal row of tiles, one per stat. Each tile shows the
`value` (large, `Flame-Regular`) above the `label` (small, `Nunito_700Bold`,
`COLORS.grey`). A `loading` tile shows a small skeleton bar in place of the value.
Returns `null` when `stats` is empty. `streak` tile prefixes a 🔥 (small flame icon
`flame` from Ionicons in `COLORS.orange`) — match how the current native profile
renders streak if it already uses an icon; otherwise a leading Ionicon is fine.
Tiles are `Pressable` only when `onPressStat` is provided; otherwise plain `View`s.

This is a shared component used by both `profile.tsx` and `profile.web.tsx`, so it
must use only cross-platform primitives (`View`, `Text`, `Pressable`,
`ActivityIndicator` or a simple skeleton `View`, `Ionicons`). No web-only DOM props.

- [ ] **Step 1: Implement the component**

```tsx
// src/components/profile/StatStrip.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import type { ProfileStat } from '../../lib/profile/stats';

export function StatStrip({
  stats,
  onPressStat,
}: {
  stats: ProfileStat[];
  onPressStat?: (key: ProfileStat['key']) => void;
}) {
  if (stats.length === 0) return null;

  return (
    <View style={styles.row}>
      {stats.map((s) => {
        const inner = (
          <>
            {s.loading ? (
              <View style={styles.skeleton} />
            ) : (
              <View style={styles.valueRow}>
                {s.key === 'streak' && (
                  <Ionicons name="flame" size={16} color={COLORS.orange} style={styles.flame} />
                )}
                <Text style={styles.value}>{s.value}</Text>
              </View>
            )}
            <Text style={styles.label} numberOfLines={1}>
              {s.label}
            </Text>
          </>
        );
        return onPressStat ? (
          <Pressable key={s.key} onPress={() => onPressStat(s.key)} style={styles.tile}>
            {inner}
          </Pressable>
        ) : (
          <View key={s.key} style={styles.tile}>
            {inner}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'center',
    gap: 8,
  },
  tile: {
    flex: 1,
    maxWidth: 110,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
  },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  flame: { marginTop: 1 },
  value: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    lineHeight: 27, // ≥ 1.22× fontSize for Flame descenders
    color: COLORS.navy,
  },
  skeleton: {
    width: 28,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(41,60,67,0.10)',
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    marginTop: 2,
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Typecheck the component**

Run: `yarn tsc --noEmit`
Expected: no new errors referencing `StatStrip.tsx`. (Pre-existing warnings elsewhere are fine.)

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/StatStrip.tsx
git commit -m "feat(profile): add shared StatStrip presentational component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `/settings` route — web + native

**Files:**
- Create: `app/settings.web.tsx`
- Create: `app/settings.tsx`

**Interfaces:**
- Consumes: `useAuth` (`user`, `signOut`, `changePassword`, `deleteAccount`),
  `useProfile(user?.id)` (for `is_admin` via `profile`), `providerMeta`,
  `useScreenChrome`, `ChangePasswordModal`, `Toast`/`useToast`, `KO_FI_URL` (redefine
  the constant locally: `'https://ko-fi.com/glstudio'`), `COLORS`/`SURFACE`.
- Produces: default-exported screen components. No exports consumed by other tasks.

**Contents (moved verbatim in behavior from the current profile Account card):**
Email (read-only), Signed in with (non-email users), Change Password (email users),
Catalog Health → `/admin/health` (admin only), Support this project → `KO_FI_URL`,
Sign Out → `signOut()` then `router.replace('/explore')`, Delete Account (destructive,
confirm `Alert`). Guests (`!user`) redirect to `/explore`.

**Reuse the existing account-row styles.** Rather than reinventing, copy the
relevant `accountRow` / `accountIconBadge*` / `divider` / `accountLabel*` style
rules and the row JSX out of the current `profile.web.tsx` (`desk`/`mob`) and
`profile.tsx` into these files. The handlers (`handleSignOut`, `handleDeleteAccount`,
`handleChangePassword`) also move here.

- [ ] **Step 1: Create the web settings screen**

Create `app/settings.web.tsx`. Structure:
- `useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper })`.
- `const { user, signOut, changePassword, deleteAccount } = useAuth();`
- `const { profile } = useProfile(user?.id);`
- `if (!user) { router.replace('/explore'); return null; }` (guard at top of render, after hooks).
- A simple header with a back affordance: a `Pressable` with `Ionicons name="chevron-back"` calling `router.back()`, and a `Text` title "Settings" (`Flame-Regular`, `lineHeight ≥ 1.22×`).
- The account card: the same rows currently in `profile.web.tsx` lines ~1079–1206 (Email, provider, Change Password, Member since — OMIT member-since here, it moves to the profile identity line; Catalog Health, Ko-fi, Sign Out, Delete Account). Reuse copied `desk.accountRow`-style rules under a local `styles` StyleSheet.
- `ChangePasswordModal` + `Toast` wired as in the current profile.
- `handleSignOut`, `handleDeleteAccount`, `handleChangePassword` copied from `profile.web.tsx`.
- Content constrained to a centered column (`maxWidth: 640, alignSelf: 'center', width: '100%'`).

Full account-row markup and styles are those already present in `app/(tabs)/profile.web.tsx`; move (not duplicate) them. After moving, they should no longer exist in the profile file (Task 5 removes them there).

- [ ] **Step 2: Create the native settings screen**

Create `app/settings.tsx`. Mirror Step 1 using native patterns from
`app/(tabs)/profile.tsx`: `useSafeAreaInsets` for top padding, the native
`accountRow` styles, native back header. Same rows, same handlers, same guest
redirect. `useScreenChrome` is web-oriented — on native, follow whatever chrome
pattern `profile.tsx` currently uses (it does not call `useScreenChrome`), so omit
it here and rely on the safe-area + `COLORS.beige` background.

- [ ] **Step 3: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no new errors in `app/settings.tsx` / `app/settings.web.tsx`. (The profile
files still contain their Account code at this point — that's expected; Task 5 removes it.)

- [ ] **Step 4: Commit**

```bash
git add app/settings.tsx app/settings.web.tsx
git commit -m "feat(settings): add dedicated /settings route (web + native)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Recompose the web profile (`profile.web.tsx`)

**Files:**
- Modify: `app/(tabs)/profile.web.tsx`

**Interfaces:**
- Consumes: `buildProfileStats` (Task 1), `StatStrip` (Task 2).
- Produces: nothing new.

**Changes (both mobile and desktop branches):**

1. **Add imports:**
   ```ts
   import { buildProfileStats } from '../../src/lib/profile/stats';
   import { StatStrip } from '../../src/components/profile/StatStrip';
   ```
2. **Build stats** near the other derived values (after `badgesEarned`):
   ```ts
   const profileStats = buildProfileStats({
     savedCount: favourites.length,
     favouritesLoading: loading,
     battle,
     badgesEarned,
   });
   ```
3. **Gear → /settings:** add a `Pressable` over the cover, top-right, styled like the
   existing `editCoverPill` family but icon-only (`Ionicons name="settings-outline"`,
   white, on a `rgba(0,0,0,0.45)` circle). `onPress={() => router.push('/settings')}`.
   Add to both the mobile cover `Pressable` block and the desktop cover block. Because
   the cover is itself a `Pressable` (opens the cover picker), render the gear as a
   sibling positioned absolutely — put it as a child of the cover `Pressable` and call
   `e.stopPropagation?.()` in its `onPress` if taps bubble; simplest: give the gear a
   higher `zIndex` and its own `onPress` that navigates (RNW stops propagation on nested
   Pressables by default).
4. **Identity block — member-since flex line:** under the name/email, add a quiet line
   `Member since {joinedDate}` (only when `joinedDate` truthy), style `mob.email`/
   `desk.email` sizing in `COLORS.grey`. `joinedDate` already exists in scope.
5. **Replace the saved-heroes pill with the stat strip.** Remove the `mob.statPill` /
   `desk.statPill` block (the `❤ N saved heroes` pill). In its place render
   `<StatStrip stats={profileStats} onPressStat={handleStatPress} />` where:
   ```ts
   const handleStatPress = (key: 'saved' | 'battles' | 'streak' | 'crowd' | 'badges') => {
     if (key === 'battles' || key === 'streak' || key === 'crowd') router.push('/versus');
   };
   ```
   Keep the "Share my universe" button directly below the strip.
6. **Delete the standalone Battle Record section** in both branches (mobile lines
   ~617–640; desktop `desk.battleBlock` for Battle Record, ~1218–1238). Its numbers now
   live in the strip.
7. **Delete the entire Account card** in both branches (mobile ~795–926; desktop
   `desk.accountCard` block ~1078–1206) and its now-unused handlers if they're not used
   elsewhere: `handleSignOut`, `handleDeleteAccount`, `handleChangePassword`,
   `handleAvatarRightClick`/`handleCoverRightClick` STAY (still used by avatar/cover).
   Remove `ChangePasswordModal` usage from the profile ONLY IF nothing else references
   it — password change now lives in settings, so remove the `showChangePassword` state,
   its modal, and the `handleChangePassword`. Keep `EditDisplayNameModal`,
   `BadgeDetailModal`, `Toast`, `universeCard`.
8. **Add a Ko-fi support footer** near the disclaimer (both branches): a single
   `Pressable` row (reuse a small version of the old account-row style) →
   `Linking.openURL(KO_FI_URL)`. `KO_FI_URL` constant already defined at top of file.
9. **Elevate Your Universe + Badges:** bump their `sectionTitle` treatment. Minimal,
   low-risk change: give these two section headers a slightly larger font and add a thin
   accent (e.g. a 3px `COLORS.orange` left rule or a bump to `fontSize`). Do NOT restyle
   every section — only Universe + Badges, so they read as the identity core. Favourites
   stays visually prominent by size (the grid) but keeps its current header.
10. **Desktop sidebar:** now that the Account card is gone, the sidebar holds avatar +
    identity (name, member-since, stat strip, share) + Ko-fi + disclaimer. Move the
    `Your Universe` and `Badges` blocks to remain in the main column (current location is
    fine) OR summarize in the sidebar — keep them in the main column for this pass to
    minimize churn. Ensure the sidebar still renders without the removed card (no empty
    wrappers left behind).
11. **Remove now-dead styles** (`statPill*`, `battleBlock`/`battleTile*` if unused after
    removal, `accountCard`/`accountRow*`/`accountIconBadge*`/`divider`/`accountLabel*`)
    from the `mob`/`desk` StyleSheets to keep the file clean. Only remove rules with zero
    remaining references.

**Verification is behavioral (no unit test for the view).**

- [ ] **Step 1: Apply the changes above to `profile.web.tsx`.**

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no new errors. Fix any unused-import/variable errors created by the removals.

- [ ] **Step 3: Run the full test suite (guards against import breakage)**

Run: `yarn test:ci`
Expected: PASS — no test imports the profile view, but this confirms nothing shared broke.

- [ ] **Step 4: Visual verify (web).** Load the profile as a signed-in user in the browser
  (the user verifies via iOS Safari screenshots on their device per their workflow —
  hand off a summary of what to check: gear opens /settings, stat strip hides zeros, no
  Account card on profile, Ko-fi footer present, Universe/Badges read as elevated).

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/profile.web.tsx"
git commit -m "feat(profile): recompose web profile — stat strip, gear→settings, elevate fandom

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Mirror the reorg on native (`profile.tsx`)

**Files:**
- Modify: `app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `buildProfileStats` (Task 1), `StatStrip` (Task 2).
- Produces: nothing new.

Apply the same changes as Task 4, adapted to the native file's structure and styles:

1. Import `buildProfileStats` + `StatStrip`.
2. Build `profileStats` from `favourites.length`, `loading`, `battle`, `badgesEarned`.
3. Add a gear button over the cover → `router.push('/settings')` (native uses
   `PressScale`/`Pressable` + `Ionicons`; place top-right respecting `useSafeAreaInsets`).
4. Add the `Member since {joinedDate}` line in the identity block.
5. Replace the saved-heroes pill with `<StatStrip stats={profileStats} onPressStat={...} />`;
   keep Share button below.
6. Remove the standalone Battle Record section.
7. Remove the entire Account block + its handlers/modals that now live in `/settings`
   (`ChangePasswordModal`, `showChangePassword`, sign-out/delete rows). Keep avatar/cover
   editing, `EditDisplayNameModal`, `BadgeDetailModal`, `Toast`.
8. Add the Ko-fi footer row near the disclaimer.
9. Elevate Your Universe + Badges section headers (same minimal treatment).
10. Remove now-dead styles.

- [ ] **Step 1: Apply the changes to `profile.tsx`.**

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no new errors; resolve unused-import/variable fallout from removals.

- [ ] **Step 3: Run the full test suite**

Run: `yarn test:ci`
Expected: PASS.

- [ ] **Step 4: Visual verify (native).** Launch the app (Expo Go / dev client) and open
  the Profile tab signed-in: gear → /settings, stat strip present & zero-hiding, no
  Account block on profile, Ko-fi footer, elevated Universe/Badges. Confirm `/settings`
  works: all rows, sign-out returns to /explore, delete confirms.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "feat(profile): mirror stat-strip + settings reorg on native

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Reorganize identity→fandom→collection → Tasks 4/5 (recompose order). ✓
- Stat strip, zero-hiding, all-zero → no strip → Task 1 (builder + tests) + Task 2 (render). ✓
- Battle Record collapses into strip → Task 1 (crowd/battles/streak) + Tasks 4/5 (remove section). ✓
- Elevate Your Universe + Badges → Tasks 4/5 step 9. ✓
- Favourites as anchor → Tasks 4/5 (kept prominent, order preserved). ✓
- Account → `/settings` route (web + native, both files) → Task 3. ✓
- Member-since as flex line → Tasks 4/5 step 4 (and removed from settings). ✓
- Ko-fi on profile AND settings → Task 3 (settings) + Tasks 4/5 (footer). ✓
- Guest handling for /settings → Task 3 redirect. ✓
- Skeleton for Saved while loading → Task 1 (`loading` flag) + Task 2 (skeleton tile). ✓
- Only pure-logic tests → Task 1 only. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Task 3/4/5 reference
concrete line ranges and moved blocks; the actual markup is the existing code being
moved, not invented. ✓

**Type consistency:** `ProfileStat.key` union (`'saved'|'battles'|'streak'|'crowd'|'badges'`)
is identical across Task 1 (definition), Task 2 (`onPressStat` param), Task 4/5
(`handleStatPress`). `buildProfileStats` signature matches its call sites. `BattleRecord`
fields (`total`, `agreePct`, `streak`) match the codebase interface. ✓
