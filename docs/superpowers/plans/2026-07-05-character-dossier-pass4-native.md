# Character Dossier — Pass 4: Native Parity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Character Dossier's identity — per-character ambient accent theming plus the pull-quote bio and signature-power tiles — to the native character screen (`app/character/[id].tsx`), adapted to its existing native idioms (parallax header, circular StatDials, tight 20px-gutter phone layout), without disrupting its spacing.

**Architecture:** The accent engine (`src/lib/accent.ts`) is platform-neutral and already shipped; native computes `theme` from the same `useHeroDetail().heroRow` and threads it through the parallax header glow, StatDial tints, section accents, and percentile badge. Two Pass-2 components built on pure RN primitives (`PullQuoteBio`, `SignaturePowers`) move from `src/components/web/character/` to the shared `src/components/character/` folder and are consumed by both platforms. The shared `RelatedHeroStrip` already supports `edgeTint`/`monogramTiles` — native just passes them.

**Tech Stack:** React Native (Expo SDK 56), react-native-reanimated 4, react-native-svg (StatDial arcs), jest-expo.

**Spec:** `docs/superpowers/specs/2026-07-02-character-dossier-redesign-design.md` (§10 native parity is the open item).

## Global Constraints

- yarn only; `yarn tsc --noEmit` + `yarn test:ci` green before each commit; pre-push hook runs prettier — run `npx prettier --write` on touched files before committing.
- **Native screen only** (`app/character/[id].tsx`) plus the two relocated shared components. The web screen (`[id].web.tsx`) changes ONLY its import paths for the two relocated components — no behavior change.
- **Respect existing native spacing.** The layout is a tight phone column: sheet content is `paddingHorizontal: 20`, sections `paddingTop: 20 / paddingBottom: 12`, StatDials a 3×2 grid. Additions must fit this rhythm; do not introduce wide desktop-style tiles or merge well-spaced sections into cramped cards.
- Accent replaces *atmospheric* color only (glows, tints, washes, section accents, percentile/score badges). Semantic alignment colors (Hero/Villain, alignment chip, StatDial per-stat tints) stay as they are.
- Never Flame-Bold; clamped Flame needs lineHeight ≥ 1.22× fontSize.
- Commit to `main` after each task; push at the end.

## Deliberate scope decisions (spacing-driven, YAGNI)

- **No Legend-band merge on native.** Web merged debut + Did You Know + Portrayed By into one wide two-column band; native has these as three separate, well-spaced sections and a phone column is too narrow to merge them without cramming. Native instead gets the accent *treatment* on the existing debut/trivia/portrayal sections. A physical merge is explicitly out of scope for this pass.
- **Keep StatDials; no median ticks.** Web bars had horizontal room for a catalog-median tick; a dial arc does not. The percentile badge carries the "context" role instead. Dials keep their per-stat tints and their existing 1800ms sweep.
- **No dot-rail.** Native already has its own section-anchor nav (`registerAnchor`); the web dot-rail is desktop-only.

---

### Task 1: Relocate the two cross-platform components to the shared folder

Two Pass-2 components live under `src/components/web/character/` but use only RN primitives (`View`/`Text`/`Pressable`/`@expo/vector-icons`), so they are safe on native. Move them to the shared `src/components/character/` folder (where `TraitBand`, `DidYouKnowDeck` already live) so native can import them without reaching into a `web/` path.

**Files:**
- Move: `src/components/web/character/PullQuoteBio.tsx` → `src/components/character/PullQuoteBio.tsx`
- Move: `src/components/web/character/SignaturePowers.tsx` → `src/components/character/SignaturePowers.tsx`
- Modify: `app/character/[id].web.tsx` (two import paths)
- Modify: `__tests__/components/pullQuoteBio.test.ts`, `__tests__/components/signaturePowers.test.ts` (import paths)

**Interfaces:**
- Produces (unchanged signatures, new location): `splitLeadSentence(text: string): { lead: string; rest: string }`, `PullQuoteBio` (`{ summary: string; accent: string; hasBiography: boolean; onReadMore: () => void; onEdit?: () => void }`), `pickSignaturePowers(powers, explainers): { name: string; blurb: string }[]`, `SignaturePowerTiles` (`{ powers; explainers; accent }`).

- [ ] **Step 1: Move the files with git**

```bash
git mv src/components/web/character/PullQuoteBio.tsx src/components/character/PullQuoteBio.tsx
git mv src/components/web/character/SignaturePowers.tsx src/components/character/SignaturePowers.tsx
```

- [ ] **Step 2: Fix the relative imports inside the moved files**

Both files import `COLORS` (and SignaturePowers imports `getPowerIcon`, `PowerExplainer`) via `../../../constants/...` / `../../../lib/...` (three levels up from `web/character/`). From `src/components/character/` it is two levels. Update each import in both files: `../../../constants/colors` → `../../constants/colors`, `../../../constants/powerIcons` → `../../constants/powerIcons`, `../../../lib/db/heroFacts` → `../../lib/db/heroFacts`. (Grep each file for `../../../` and drop one `../`.)

- [ ] **Step 3: Repoint the web screen + tests**

In `app/character/[id].web.tsx`:
`../../src/components/web/character/PullQuoteBio` → `../../src/components/character/PullQuoteBio`
`../../src/components/web/character/SignaturePowers` → `../../src/components/character/SignaturePowers`
In `__tests__/components/pullQuoteBio.test.ts` and `__tests__/components/signaturePowers.test.ts`: `../../src/components/web/character/…` → `../../src/components/character/…`.

- [ ] **Step 4: Verify nothing else referenced the old paths**

Run: `rg -n "web/character/(PullQuoteBio|SignaturePowers)" src app __tests__`
Expected: no matches.

- [ ] **Step 5: Verify + commit**

Run: `yarn tsc --noEmit && yarn test:ci` → clean; 569+ tests pass. `npx prettier --write` the touched files.

```bash
git add -A
git commit -m "refactor(character): PullQuoteBio + SignaturePowers are cross-platform, move to shared folder"
```

---

### Task 2: Native accent theme + header glow + on-ink trait band

**Files:**
- Modify: `app/character/[id].tsx`

**Interfaces:**
- Consumes: `deriveCharacterTheme` from `src/lib/accent`; `heroRow` from `useHeroDetail`.
- Produces: `const theme` (`{ accent; accentDeep; accentWash }`) in `CharacterScreen` scope — Tasks 3–6 reference `theme.accent` etc.

- [ ] **Step 1: Import + memoize the theme**

Add `import { useMemo } from 'react'` (or extend the existing react import) and `import { deriveCharacterTheme } from '../../src/lib/accent';`. After the `useHeroDetail` destructure (~line 624), add:

```tsx
// Ambient per-character palette — blurhash average color → publisher → teal.
const theme = useMemo(
  () =>
    deriveCharacterTheme({
      portrait_blurhash: heroRow?.portrait_blurhash,
      publisher: heroRow?.publisher ?? data?.stats.biography.publisher ?? null,
    }),
  [heroRow, data],
);
```

- [ ] **Step 2: Accent glow in the parallax hero header**

The hero image sits behind a scrim, with the name overlaid near its bottom (`NAME_TOP`). Add a bottom-anchored accent bloom just above the sheet so the character's color washes up from where the beige sheet meets the image. Find the hero-image/scrim block (the `ReAnimated.View`/`Animated.View` holding the image + scrims, ~lines 927–960) and add, as the last child before the identity overlay:

```tsx
{/* Character accent bloom rising into the sheet seam */}
<LinearGradient
  colors={['transparent', theme.accentDeep + '55']}
  locations={[0.55, 1]}
  style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }] as object}
/>
```

Confirm `LinearGradient` is imported from `expo-linear-gradient` (native uses it elsewhere; `rg -n "expo-linear-gradient" "app/character/[id].tsx"` — add the import if missing). Keep it subtle: it must not fight the existing scrim that keeps the name legible.

Trait band: leave it unchanged. Native's chips render on the beige sheet (`traitBandWrap`, ~line 1062) with the light `TraitBand`, which is correct for a light ground — `onInk` is for dark stages only. Moving chips onto the portrait image (to mirror web's in-header placement) would clutter the art in the narrow phone header, so the accent glow from Step 2 carries the header identity instead. No edit here.

- [ ] **Step 3: Verify + commit**

Run: `yarn tsc --noEmit && yarn test:ci` → clean/green. Prettier the file.

```bash
git add "app/character/[id].tsx"
git commit -m "feat(character/native): ambient accent theme + header accent bloom"
```

---

### Task 3: Native Power Stats — accent framing + percentile badge

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Wash the stats card crown with the accent**

The stats live in `styles.statsCard` (a surface card, ~line 2013). Give the non-editing card the same crown-wash grammar as web (accent fading to the card surface), applied inline so it stays dynamic. Change the non-editing `<View style={styles.statsCard}>` (~line 1159) to:

```tsx
<View
  style={
    [
      styles.statsCard,
      { borderColor: theme.accent + '2b' },
    ] as object
  }
>
```

Read `statsCard`'s current entry first (`rg -n "statsCard:" -A 6`); if it has no `borderWidth`, add `borderWidth: 1` to the static style so the accent border renders. Do not add a background gradient if the card already has a solid surface color that would clash — a hairline accent border is the spacing-safe minimum.

- [ ] **Step 2: Percentile badge replaces the plain percentile line**

The current `statTotalRow` shows `Total N / 600` + a plain `Stronger than N%` text (~lines 1170–1178). Replace the percentile `Text` with an accent badge matching web's `percentileBadge`:

```tsx
{percentile != null && percentile > 0 ? (
  <View
    style={
      [
        styles.statPercentileBadge,
        { backgroundColor: theme.accent + '14', borderColor: theme.accent + '3d' },
      ] as object
    }
  >
    <Ionicons name="flash" size={11} color={theme.accent} />
    <Text style={[styles.statPercentileBadgeText, { color: theme.accent }] as object}>
      Stronger than {percentile}% of heroes
    </Text>
  </View>
) : null}
```

Add styles near `statPercentile`:

```ts
statPercentileBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  borderWidth: 1,
  borderRadius: 999,
  paddingHorizontal: 12,
  paddingVertical: 5,
},
statPercentileBadgeText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12 },
```

If `statTotalRow` is a `flexDirection: 'row'` with `Total` and the percentile side by side, verify the badge fits the row on a narrow phone; if it wraps awkwardly, set `statTotalRow` to `flexWrap: 'wrap'` with `gap: 8` (check its style first, keep the `Total N / 600` text unchanged). Delete the old `statPercentile` text style only if now unreferenced.

- [ ] **Step 3: Verify + commit**

Run: `yarn tsc --noEmit && yarn test:ci` → clean/green. Prettier.

```bash
git add "app/character/[id].tsx"
git commit -m "feat(character/native): Power Stats accent framing + percentile badge"
```

---

### Task 4: Native pull-quote bio + signature-power tiles

**Files:**
- Modify: `app/character/[id].tsx`

**Interfaces:**
- Consumes: `PullQuoteBio`, `SignaturePowerTiles` from `src/components/character/…` (Task 1); `theme` (Task 2).

- [ ] **Step 1: Import the shared components**

```tsx
import { PullQuoteBio } from '../../src/components/character/PullQuoteBio';
import { SignaturePowerTiles } from '../../src/components/character/SignaturePowers';
```

- [ ] **Step 2: Replace the native summary block with the pull-quote bio**

Swap the summary content branch (~lines 1089–1119, the `data.details.summary || data.details.description` case) for:

```tsx
) : data.details.summary || data.details.description ? (
  <View style={styles.summaryBlock}>
    <PullQuoteBio
      summary={data.details.summary ?? ''}
      accent={theme.accent}
      hasBiography={!!data.details.description}
      onReadMore={() => router.push(`/biography/${id}`)}
      onEdit={() =>
        setEditTarget({ field: SUMMARY_FIELD, current: data.details.summary ?? null })
      }
    />
  </View>
) : null}
```

`PullQuoteBio` wraps itself in card chrome (accent-edged card). `summaryBlock` currently adds `paddingHorizontal: 20 / paddingTop: 14` — keep the wrapper so the card sits in the 20px gutter, but if the card's own padding + the block padding double up visually, drop `summaryBlock`'s `paddingTop`/`paddingBottom` to `paddingVertical: 12` (read it first, adjust to keep one comfortable gap, not two). Delete the old `summary`/`biographyLink`/`biographyLinkText` styles only if `rg` shows no remaining references.

- [ ] **Step 3: Add signature-power tiles above the abilities grid**

Signature tiles need horizontal room; on a phone they wrap to one or two per row (the component uses `flex: 1; minWidth: 200`, so on a ~335px-wide content column they stack to one column — acceptable and readable). Insert directly inside the Abilities `View` (~line 1187), before `<AbilitiesSection>`, gated so it only appears when blurb-backed powers exist:

```tsx
{!comicVineLoading &&
pickSignaturePowers(data.details.powers, narrative?.powerExplainers ?? []).length > 0 ? (
  <View style={styles.signatureWrap}>
    <SignaturePowerTiles
      powers={data.details.powers}
      explainers={narrative?.powerExplainers ?? []}
      accent={theme.accent}
    />
  </View>
) : null}
```

There is no `pickSignaturePowersHasAny` helper — that placeholder in the snippet above is shorthand. Import `pickSignaturePowers` alongside the component and use it directly as the guard:

```tsx
import { SignaturePowerTiles, pickSignaturePowers } from '../../src/components/character/SignaturePowers';
```

so the gate condition reads `pickSignaturePowers(data.details.powers, narrative?.powerExplainers ?? []).length > 0`. Add style `signatureWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }` (matches the section gutter; keeps it snug above the abilities header without a doubled gap).

- [ ] **Step 4: Verify + commit**

Run: `yarn tsc --noEmit && yarn test:ci` → clean/green. Prettier.

```bash
git add "app/character/[id].tsx"
git commit -m "feat(character/native): pull-quote bio + signature-power tiles"
```

---

### Task 5: Native relationship shelves + section accents

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Pass the dossier props to the three RelatedHeroStrip calls**

At the three native `RelatedHeroStrip` call sites (~lines 1271, 1282, 1293) add `edgeTint monogramTiles` (the shared component already supports them; portrait-less relations become in-shelf monogram tiles with a kind-tinted edge instead of dropping to a separate chip row). Example for the Enemies call:

```tsx
<RelatedHeroStrip
  label="Enemies"
  names={enemyNames}
  heroMap={relatedHeroMap}
  kind="enemy"
  edgeTint
  monogramTiles
  onPressHero={(h) =>
    router.push(`/character/${h.id}?name=${encodeURIComponent(h.name)}`)
  }
/>
```

Repeat for Allies and Teammates. No new styles; the component owns the tile look.

- [ ] **Step 2: Debut card accent (In Print)**

The native debut card (`debutCard`/`debutCover`/`debutBadge`, ~lines 1423–1456) uses a gold badge. Leave the "1st Appearance" gold badge (it's a deliberate keepsake accent) but tint the card's border with the character accent so it belongs to the themed page. Read `debutCard:`/`debutCover:` styles; add an inline `{ borderColor: theme.accent + '2b' }` to the `debutCard` View if it has a border, else wrap the cover in a 1px accent hairline via inline style on `debutCover`. Keep it a hairline — no heavy frame in the tight card.

- [ ] **Step 3: Verify + commit**

Run: `yarn tsc --noEmit && yarn test:ci` → clean/green. Prettier.

```bash
git add "app/character/[id].tsx"
git commit -m "feat(character/native): relationship monogram tiles + accented debut card"
```

---

### Task 6: Verify, push, screenshot handoff

**Files:** none (verification only).

- [ ] **Step 1: Full gate**

Run: `yarn test:ci && yarn tsc --noEmit && yarn lint` (errors-only) → all green. `rg -n "summary:|biographyLink|statPercentile\b" "app/character/[id].tsx"` → confirm no orphaned styles remain; delete any.

- [ ] **Step 2: Prettier + push**

```bash
npx prettier --write "app/character/[id].tsx" "app/character/[id].web.tsx" src/components/character/PullQuoteBio.tsx src/components/character/SignaturePowers.tsx
git add -A && git commit -m "style: prettier pass (character native parity)"   # only if prettier changed anything
git push
```

- [ ] **Step 3: Hand off for device screenshots**

Do NOT start a dev server (native needs Expo Go / a dev client, which the user drives). Ask the user to open the app on their device and check `/character/643` (Supergirl — warm accent), a villain (Joker/Lex — accent shift), and one hero with no portrayals/facts (sections collapse cleanly): accent bloom under the hero image, pull-quote bio card, signature tiles above abilities, accent percentile badge on the dials, monogram tiles in the relationship shelves. Iterate on their feedback.
