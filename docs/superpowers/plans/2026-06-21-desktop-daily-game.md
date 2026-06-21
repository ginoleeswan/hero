# Desktop Daily Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a desktop two-panel layout to `/play` on wide web screens, leaving mobile-web and native unchanged.

**Architecture:** A single responsive branch inside `DailyGame.tsx`, gated on `Platform.OS === 'web' && useWindowDimensions().width >= 960`. The shared `useDailyHero` hook and all derived state are computed once; only the returned JSX branches. The scaled hero card (art + glow + sheen + finished overlay + stickers) is factored into a local render helper so it isn't duplicated between layouts.

**Tech Stack:** React Native Web, expo-router, react-native-reanimated (existing), react-native-svg (existing). No new dependencies.

## Global Constraints

- Package manager: **yarn** only.
- TypeScript, no `any`; functional components; `StyleSheet.create` for all styles (no inline objects except `StyleSheet.absoluteFill`).
- Fonts: `Flame-Regular` (display), `FlameSans-Regular`/`Nunito_*` (UI). Never `Flame-Bold`.
- Do not modify `useDailyHero` or any other component — `DailyGame.tsx` only.
- Native + mobile-web layout must render byte-for-byte as today (the existing branch is untouched).
- Breakpoint: `isWide = Platform.OS === 'web' && width >= 960`.

---

### Task 1: Desktop two-panel layout in DailyGame

**Files:**
- Modify: `src/components/game/DailyGame.tsx`

**Interfaces:**
- Consumes: `useDailyHero()` return shape (unchanged), `useWindowDimensions` from `react-native`.
- Produces: nothing new exported. Internal helper `renderCard(size, slots)` closing over `hero`, `blur`, `finished`, `won`, `router`.

- [ ] **Step 1: Add `useWindowDimensions` import and `isWide` flag**

In the `react-native` import add `useWindowDimensions`. Inside the component, after the hook destructure:

```tsx
const { width } = useWindowDimensions();
const isWide = Platform.OS === 'web' && width >= 960;
```

- [ ] **Step 2: Add desktop constants near the existing `CARD_W`/`CARD_H` and `STICKER_SLOTS`**

```tsx
const CARD_W_WIDE = 240;
const CARD_H_WIDE = 320;

// Desktop sticker fan — same five keys, retuned for the larger card so they sit
// clear of it with more spread.
const STICKER_SLOTS_WIDE: Record<string, object> = {
  Publisher: { right: '100%', marginRight: -10, top: -10 },
  Alignment: { right: '100%', marginRight: 6, top: 96 },
  'Signature power': { right: '100%', marginRight: -10, top: 196 },
  'First appeared': { left: '100%', marginLeft: -6, top: 14 },
  Origin: { left: '100%', marginLeft: 2, top: 168 },
};
```

- [ ] **Step 3: Factor the card into a local `renderCard` helper**

Extract the existing card JSX (the `<Pressable style={[styles.card …]}>` block with `MysteryPortrait`, the sheen `LinearGradient`, and the finished overlay) into a helper inside the component that takes the card size and renders at that size. Replace the inline mobile usage with a call. Parameterise the card dimensions by passing a style override:

```tsx
const renderCard = (cardStyle: object, portraitW: number, portraitH: number) => (
  <Pressable
    disabled={!finished}
    onPress={() =>
      finished &&
      router.push({
        pathname: '/character/[id]',
        params: {
          id: hero.id,
          imageUri: hero.portraitUrl ?? hero.imageUrl ?? undefined,
        },
      })
    }
    style={[styles.card, cardStyle, finished && (won ? styles.cardWon : styles.cardDone)]}
  >
    <MysteryPortrait
      id={hero.id}
      name={hero.name}
      imageUrl={hero.imageUrl}
      portraitUrl={hero.portraitUrl}
      blur={blur}
    />
    <LinearGradient
      colors={['rgba(255,255,255,0.18)', 'transparent', 'rgba(206,155,51,0.20)']}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
      pointerEvents="none"
    />
    {finished ? (
      <LinearGradient
        colors={['transparent', 'rgba(8,12,20,0.94)']}
        locations={[0.45, 1]}
        style={styles.fill}
        pointerEvents="none"
      >
        <View style={styles.cardFooter}>
          <Text style={styles.cardName} numberOfLines={1}>{hero.name}</Text>
          <Text style={styles.cardLink}>View profile →</Text>
        </View>
      </LinearGradient>
    ) : null}
  </Pressable>
);
```

`MysteryPortrait` fills its parent, so only the card box needs sizing — `portraitW/portraitH` params are unused and should be dropped; pass only `cardStyle`. (Confirm `MysteryPortrait` uses `StyleSheet.absoluteFill`/`flex` before finalising; if it takes explicit width/height, thread the size through.)

- [ ] **Step 4: Build the `isWide` branch**

After the loading/error guards, when `hero` is present, branch on `isWide`. The wide branch returns the two-panel shell; the existing single-column stage/footer stays as the `else`. The header row is shared — lift it above the branch or duplicate the same JSX in both. Wide branch shape:

```tsx
<View style={stylesWide.shell}>
  <View style={stylesWide.panels}>
    {/* Left — theatre */}
    <View style={stylesWide.left}>
      <View style={stylesWide.cardWrapWide}>
        <View style={[styles.glow, stylesWide.glowWide, GLOW]} pointerEvents="none" />
        {renderCard(stylesWide.cardWide)}
        {clues.map((c) => (
          <View
            key={c.label}
            style={[styles.slot, STICKER_SLOTS_WIDE[c.label] ?? STICKER_SLOTS_WIDE.Publisher]}
            pointerEvents="none"
          >
            <ClueSticker clue={c} tilt={STICKER_TILT[c.label] ?? 0} />
          </View>
        ))}
      </View>
    </View>

    {/* Right — gameplay */}
    <View style={stylesWide.right}>
      {dossierBlock}
      {!finished ? (
        <View style={styles.pips}>{/* same pips map as mobile */}</View>
      ) : (
        <View style={styles.result}>{/* same result block as mobile */}</View>
      )}
      {!finished ? (
        <View style={stylesWide.lineup}>
          <View style={styles.lineupHead}>
            <Text style={styles.lineupTitle}>Who is it?</Text>
            <Text style={styles.remaining}>
              {remaining} {remaining === 1 ? 'guess' : 'guesses'} left
            </Text>
          </View>
          <View style={styles.grid}>
            {options.map((o) => {/* same option Pressable, with stylesWide.optionWide */})}
          </View>
        </View>
      ) : null}
    </View>
  </View>
</View>
```

The pips, result, and option JSX are identical to the mobile branch — to stay DRY, extract `pipsRow`, `resultBlock`, and `lineupGrid` as `const` elements/closures above the `return` and use them in both branches. The only per-layout difference for options is an extra `stylesWide.optionWide` style (`flexBasis: '31%'`) appended in the wide branch; pass the grid a layout flag or build two grid consts.

- [ ] **Step 5: Add the `stylesWide` StyleSheet block**

```tsx
const stylesWide = StyleSheet.create({
  shell: { flexGrow: 1, width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 32 },
  panels: { flexDirection: 'row', flexGrow: 1, alignItems: 'center', gap: 48, paddingVertical: 24 },
  left: { flexBasis: '46%', alignItems: 'center', justifyContent: 'center' },
  right: { flexBasis: '54%', maxWidth: 480, justifyContent: 'center', gap: 4 },
  cardWrapWide: { width: CARD_W_WIDE, height: CARD_H_WIDE, alignItems: 'center', justifyContent: 'center' },
  cardWide: { width: CARD_W_WIDE, height: CARD_H_WIDE },
  glowWide: { width: 480, height: 480, marginLeft: -240, marginTop: -240, borderRadius: 240 },
  lineup: { marginTop: 20 },
  optionWide: { flexBasis: '31%' },
});
```

Also wrap the wide shell so it scrolls if a short window overflows: keep the outer `ScrollView`, switching its `contentContainerStyle` to centre the shell when `isWide` (e.g. `[styles.scroll, isWide && stylesWide.scrollWide]` with `stylesWide.scrollWide: { paddingHorizontal: 0 }`). The header `topPad` already accounts for `WEB_NAV_CLEARANCE`.

- [ ] **Step 6: Add a web hover affordance to options (cosmetic, web-only)**

Add `onHoverIn`/`onHoverOut` local state per the existing pressed pattern, OR inject a `<style>` tag like the clue-peel CSS in `ClueSticker.tsx` targeting a `dataSet` attribute on options. Keep it to a subtle background/border lift matching `optionPressed`. Eliminated and pressed states unchanged. This is optional polish — only on the wide branch.

- [ ] **Step 7: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no new errors (baseline may carry the documented expo-env divergence — confirm no errors reference `DailyGame.tsx`).

- [ ] **Step 8: Lint the file**

Run: `yarn eslint src/components/game/DailyGame.tsx`
Expected: no new errors (warnings tolerated per the project's errors-only gate).

- [ ] **Step 9: Visual verification**

Start the dev server (`yarn start`, web) and load `http://localhost:8081/play`:
- Desktop browser ≥960px: two-panel layout, card centred-left with stickers fanned, gameplay on the right, 3-column options.
- Narrow the window below 960px: snaps back to today's single-column layout.
- User confirms mobile via iOS Safari device screenshot (must be unchanged).

- [ ] **Step 10: Commit**

```bash
git add src/components/game/DailyGame.tsx docs/superpowers/plans/2026-06-21-desktop-daily-game.md
git commit -m "feat(play): desktop two-panel layout for the daily game"
```
