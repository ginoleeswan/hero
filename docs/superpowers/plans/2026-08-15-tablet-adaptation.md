# Tablet Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the iPad rendering a stretched phone on Profile, Arena and Compare, and use the extra width for density on Explore the way the web desktop does.

**Architecture:** No new primitives. `PageColumn` caps and centres screen content (a no-op on phones by construction); `railCardWidth` from `constants/layout.ts` replaces proportion-scaled card widths; `useLayout()` supplies the live window. Explore gains one two-column row at `wide`.

**Tech Stack:** TypeScript, React Native (Expo SDK 56), expo-router, jest-expo.

**Spec:** `docs/superpowers/specs/2026-08-15-tablet-adaptation-design.md`

## Global Constraints

- **yarn only.** Never npm or bun.
- Gate for every task, run in the FOREGROUND: `yarn tsc --noEmit`, `yarn test:ci`, `yarn lint` (`--max-warnings=0`, 0 errors), `yarn check:ui`, `yarn format:check`. Task 5 also runs `yarn docs:links`.
- **`check:ui` must exit 0 and must not report ratchet slack. Do NOT raise `scripts/ui/design-baseline.json`.** `RADIUS_SCALE = {4,8,12,16,20,24,999}`, `FONT_SCALE = {10,11,12,13,13.5,14.5,15,18,23,30,38,46}` — pick from these.
- **THE PHONE MUST NOT MOVE BY ONE POINT.** Every change here is gated above a width threshold. Any value derived at 390pt must be identical to what it was before. Where a task adds a test, this is the assertion that matters most.
- **No `any`**; `unknown` for caught errors.
- **`StyleSheet.create` for all styles**; no inline style objects except `StyleSheet.absoluteFill`; dynamic values in a style array.
- **Never read `Dimensions.get()` at module scope** — that is the exact bug `constants/layout.ts` exists to undo. Use `useWindowDimensions()` / `useLayout()`.
- Fonts: `Flame-Regular` display, `FlameSans-Regular` body, `Nunito_700Bold` UI labels. **Never `Flame-Bold`.** Clamped Flame text needs `lineHeight` ≥ 1.22× `fontSize` (uppercase-only exempt — no descenders).
- **Never a coloured vertical side rail.** Colour belongs on a pill or badge that labels something.
- A screen with a `.web.tsx` twin must be changed in **both**, with shared logic in a platform-neutral hook in `src/hooks/`.
- Screens never import `supabase` directly.
- Commit directly to `main`. No branch, no push. Stage only the files you changed — **never `git add -A`**.

---

### Task 1: Profile through `PageColumn`

Highest ratio of "stops looking wrong" to risk in the app. Do it first.

**Files:**
- Modify: `app/(tabs)/profile.tsx`
- Modify: `app/(tabs)/profile.web.tsx`
- Test: `__tests__/constants/pageColumn.test.ts` (new)

- [ ] **Step 1: Read `src/components/ui/PageColumn.tsx` and one existing consumer**

`app/settings.tsx` already uses it. Match how that screen composes it — `PageColumn` deliberately owns only a width cap and centring, not scrolling, safe areas or backgrounds, so it is wrapped *inside* whatever the screen already has.

- [ ] **Step 2: Write the phone-invariant test first**

```ts
import { CONTENT_MAX_WIDTH, contentWidth } from '../../src/constants/layout';

describe('PageColumn is a no-op on a phone', () => {
  it.each([320, 375, 390, 428])('does not narrow a %ipt window', (w) => {
    // The cap only bites once the window exceeds it, which is why wrapping a
    // screen in PageColumn cannot change any phone layout.
    expect(Math.min(w, CONTENT_MAX_WIDTH)).toBe(w);
  });

  it('caps and centres a landscape iPad', () => {
    expect(contentWidth(1376)).toBe(CONTENT_MAX_WIDTH);
  });
});
```

- [ ] **Step 3: Run it**

Run: `yarn test:ci __tests__/constants/pageColumn.test.ts`
Expected: PASS immediately — this pins existing behaviour rather than driving new code. Say so in your report; it is a guard, not TDD theatre.

- [ ] **Step 4: Wrap both profile screens**

Wrap the scrolling content column, not the screen background — the cover image and any full-bleed chrome stay full width. The signed-out "Join the Mythique community" state and the signed-in state both need it.

- [ ] **Step 5: Gate and commit**

```bash
git add app/'(tabs)'/profile.tsx app/'(tabs)'/profile.web.tsx __tests__/constants/pageColumn.test.ts
git commit -m "fix(profile): a 1330pt-wide button is an iPhone app on an iPad"
```

---

### Task 2: Arena — one gutter, and cards that are cards

**Files:**
- Modify: `app/(tabs)/versus.tsx`
- Modify: `app/(tabs)/versus.web.tsx` (only if it shares the offending code)
- Modify: whichever component renders the battle-builder cards (find it; likely under `src/components/versus/`)

- [ ] **Step 1: Find the two faults**

`app/(tabs)/versus.tsx` already imports `PageColumn` but applies it per-section, which is why the left edge steps between 16pt and centred down the screen. Find every section and establish one column for the screen.

Separately, find where the builder cards get their width. On the simulator at 1376pt they render ~840pt each with cropped faces, which is the signature of a proportion (`width * 0.48` or similar) rather than a size.

- [ ] **Step 2: One column for the screen**

Hoist `PageColumn` so every section shares one left edge. Full-bleed elements (a cover, a gradient) stay outside it.

- [ ] **Step 3: Cards get a size, not a proportion**

Use `railCardWidth(width)` from `src/constants/layout.ts`. Read its doc comment first — below the tablet threshold it returns the existing proportion, which is what keeps the phone identical; above it, a fixed size.

If the builder needs a different fixed width than the rail's 260, pass it as the `tabletWidth` argument rather than writing a second rule.

- [ ] **Step 4: Phone-invariant test**

Add to `__tests__/constants/layout.test.ts` (it exists) an assertion that `railCardWidth(390)` is unchanged from `Math.round(390 * 0.6)`, and that it is a fixed value at 1032 and 1376. If an equivalent assertion is already there, say so rather than duplicating it.

- [ ] **Step 5: Gate and commit**

```bash
git commit -m "fix(arena): one gutter, and a card that is a card"
```

---

### Task 3: Compare — the same card rule

**Files:**
- Modify: `app/compare/[hero]/[opponent].tsx`
- Modify: `app/compare/[hero]/[opponent].web.tsx` if it shares the code

- [ ] **Step 1: Apply the same fix**

`app/compare/pick.tsx` and `app/compare/[hero]/pick.tsx` already use `gridColumns` and are fine. The pair-view builder cards are not. Same `railCardWidth` treatment as Task 2, and `PageColumn` if the screen's sections step like Arena's did.

- [ ] **Step 2: Gate and commit**

```bash
git commit -m "fix(compare): the builder cards stop scaling with the window"
```

---

### Task 4: Pair the Explore rows at `wide`

The one change that uses the width for density rather than size.

**Files:**
- Modify: `app/(tabs)/explore.tsx`

- [ ] **Step 1: Find the two rows**

`TodaysMatchup` and the daily-challenge banner are adjacent items in Explore's feed. Both are compact, self-contained cards that each currently occupy a full-width band for a few hundred points of content.

- [ ] **Step 2: Pair them above `wide`**

At `breakpointFor(width) === 'wide'` (≥1024), render the two side by side in one row, each taking half the content width minus the gap. Below that, leave the existing stacked rendering completely alone.

**Pair only these two.** Do not pair rows carrying horizontal rails — `RightNowBand`, `HomeHeroRow`, `TitlePosterRail`, `CoverGallery`. A rail in a half-width column is the "broken carousel" failure `constants/layout.ts` was written to prevent, and its header says so.

Mind the feed's virtualisation: Explore renders through a list, so two rows becoming one changes the item structure. Follow how the feed already composes items rather than special-casing at the renderer.

- [ ] **Step 3: Gate and commit**

```bash
git commit -m "feat(explore): use the width for density, not for size"
```

---

### Task 5: Device pass, then documentation

The suite cannot see any of this. This task is the verification.

- [ ] **Step 1: Verify on the simulator**

Build/launch is already available: Metro is running and the app is installed on the `iPad Pro 13-inch (M5)` simulator. Rotate with `osascript` sending Cmd+Left/Right to the Simulator app. Note: screenshots come back in the raw **portrait** framebuffer regardless of orientation — correct with `sips -r 90` (and check; it may need 270 or a further 180). The tap coordinate space also stays portrait-oriented: a landscape point `(xl, yl)` maps to `(yl, 1376 - xl)`.

Check, in both orientations: Profile no longer has a full-width button and its rows are capped; Arena has one left edge and human-sized builder cards; Compare likewise; Explore pairs the two daily cards at `wide` and stacks them below it.

Then check an **iPhone** simulator and confirm all four screens are unchanged.

- [ ] **Step 2: Update the docs**

`profile-and-gamification.md`, `arena-and-matchups.md`, `explore-feed-and-pulse.md`, and `platform-and-motion.md` (which covers the platform split and is where the tablet-adoption rule belongs). Record the rule, not just the change: **`PageColumn` at the screen level, `railCardWidth` for anything card-shaped, and width buys density not size.** Add the spec to each History section by explicit path.

- [ ] **Step 3: Full gate and commit**

Run: `yarn tsc --noEmit && yarn test:ci && yarn lint && yarn check:ui && yarn format:check && yarn docs:links`

```bash
git commit -m "docs(tablet): the iPad stops being a stretched phone"
```

---

## Self-Review

**Spec coverage.** Explore pairing → Task 4. Profile → Task 1. Arena → Task 2. Compare → Task 3. Device verification and docs → Task 5. The phone-invariant non-goal is enforced by tests in Tasks 1 and 2 and re-checked on an iPhone simulator in Task 5.

**Known risk.** Task 4 touches Explore's virtualised feed, where merging two items into one row can disturb item keys and measurement. It is sequenced last of the code tasks so a problem there cannot block the three low-risk wins.

**Deliberate gap.** No test asserts any of the visual outcomes, because the repo rules out rendering tests for screens. Task 5's device pass is the substitute and is a required step.
