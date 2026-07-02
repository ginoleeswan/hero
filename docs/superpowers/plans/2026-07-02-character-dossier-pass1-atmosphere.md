# Character Dossier — Pass 1: Atmosphere — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-character ambient theming on the web character page — accent color derived from `portrait_blurhash`, an accent-alive hero band with in-band trait chips, and the Power Stats card rebuilt as an accent-washed Power Profile band with median-tick context.

**Architecture:** A new pure util `src/lib/accent.ts` decodes the blurhash DC component into a per-character theme `{accent, accentDeep, accentWash}` (fallbacks: publisher brand color → `COLORS.blue`). `app/character/[id].web.tsx` computes the theme once (memoized on `heroRow`) and threads it into the desktop stage, mobile hero header, power band, and Quick Facts. No data-layer changes; native `[id].tsx` untouched.

**Tech Stack:** React Native Web (Expo SDK 56), StyleSheet, jest-expo.

**Spec:** `docs/superpowers/specs/2026-07-02-character-dossier-redesign-design.md`

## Global Constraints

- Package manager: **yarn** only. Tests: `yarn test:ci` (or `yarn jest <path>` for one file).
- TypeScript, no `any`; `StyleSheet.create` for static styles (dynamic accent values go in inline style-array members alongside static entries, matching existing file patterns like `{ backgroundColor: alignmentColor + '22' }`).
- Never `Flame-Bold`. Fonts: Flame-Regular (display), FlameSans-Regular (body), Nunito (UI).
- Web screen only: `app/character/[id].web.tsx`. Do not touch `app/character/[id].tsx`.
- Alignment chip colors (Hero/Villain semantic blue/red) stay semantic — the accent replaces alignment color only in *atmospheric* elements (orbs, glows, band accents), never in the alignment chip itself.
- Commit directly to `main` after each task (user preference: no feature branches).
- Visual verification is via the user's device screenshots — do NOT start a dev server.

---

### Task 1: Accent engine (`src/lib/accent.ts`)

**Files:**
- Create: `src/lib/accent.ts`
- Test: `__tests__/lib/accent.test.ts`

**Interfaces:**
- Produces: `blurhashAverageColor(blurhash: string | null | undefined): { r: number; g: number; b: number } | null`
- Produces: `interface CharacterTheme { accent: string; accentDeep: string; accentWash: string }`
- Produces: `deriveCharacterTheme(hero: { portrait_blurhash?: string | null; publisher?: string | null }): CharacterTheme`
- Consumes: `brandForPublisher` from `src/constants/publishers.ts`, `COLORS` from `src/constants/colors.ts`.

Blurhash background: char 0 = size flag, char 1 = max-AC quantizer, chars 2–5 = the DC (average color) packed as 24-bit sRGB in base83. Decoding only those 4 chars gives the portrait's average color with no dependency.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/accent.test.ts
import { blurhashAverageColor, deriveCharacterTheme } from '../../src/lib/accent';
import { COLORS } from '../../src/constants/colors';

// Build test hashes programmatically: chars 0-1 (size flag / max AC) are
// irrelevant to the DC decode; chars 2-5 encode the DC as base83.
const B83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';
const hashWithDc = (r: number, g: number, b: number) => {
  const dc = (r << 16) | (g << 8) | b;
  const enc = [3, 2, 1, 0].map((p) => B83[Math.floor(dc / 83 ** p) % 83]).join('');
  return `L5${enc}`;
};
const RED_HASH = hashWithDc(200, 30, 40);
// Grey (saturation ≈ 0) → must fall through to the publisher brand color.
const GREY_HASH = hashWithDc(120, 120, 120);

describe('blurhashAverageColor', () => {
  it('decodes the DC component to average sRGB', () => {
    expect(blurhashAverageColor(RED_HASH)).toEqual({ r: 200, g: 30, b: 40 });
  });
  it('returns null for empty-string sentinel, null, and short/garbage input', () => {
    expect(blurhashAverageColor('')).toBeNull();
    expect(blurhashAverageColor(null)).toBeNull();
    expect(blurhashAverageColor('L5M')).toBeNull();
    expect(blurhashAverageColor('L5"("(')).toBeNull(); // invalid base83 chars
  });
});

describe('deriveCharacterTheme', () => {
  it('derives a red-family accent from a red portrait hash', () => {
    const t = deriveCharacterTheme({ portrait_blurhash: RED_HASH, publisher: null });
    expect(t.accent).toMatch(/^#[0-9a-f]{6}$/);
    const r = parseInt(t.accent.slice(1, 3), 16);
    const g = parseInt(t.accent.slice(3, 5), 16);
    const b = parseInt(t.accent.slice(5, 7), 16);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    expect(t.accentWash.startsWith('rgba(')).toBe(true);
  });
  it('falls back to the publisher brand color for a grey (desaturated) hash', () => {
    const t = deriveCharacterTheme({ portrait_blurhash: GREY_HASH, publisher: 'DC Comics' });
    // DC brand is blue (#0476F2): blue channel dominates.
    const r = parseInt(t.accent.slice(1, 3), 16);
    const b = parseInt(t.accent.slice(5, 7), 16);
    expect(b).toBeGreaterThan(r);
  });
  it('falls back to COLORS.blue with no hash and no known publisher', () => {
    const t = deriveCharacterTheme({ portrait_blurhash: null, publisher: 'Nobody Comics Ltd' });
    expect(t.accent).toBeTruthy();
    expect(t.accentDeep).toBeTruthy();
    // Base is COLORS.blue; hue must stay in the cyan family (g,b > r).
    const r = parseInt(t.accent.slice(1, 3), 16);
    const b = parseInt(t.accent.slice(5, 7), 16);
    expect(b).toBeGreaterThan(r);
    void COLORS;
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest __tests__/lib/accent.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/accent'`.

- [ ] **Step 3: Implement `src/lib/accent.ts`**

```ts
import { COLORS } from '../constants/colors';
import { brandForPublisher } from '../constants/publishers';

/**
 * Per-character ambient palette for the Character Dossier page, derived from
 * the portrait's blurhash average color. See spec:
 * docs/superpowers/specs/2026-07-02-character-dossier-redesign-design.md §1.
 */
export interface CharacterTheme {
  /** Chroma-boosted, lightness-clamped hue for chips, icons, badges on paper. */
  accent: string;
  /** Darker variant for glows on the ink band. */
  accentDeep: string;
  /** ~7% alpha wash for paper-side band backgrounds. */
  accentWash: string;
}

const B83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

function decode83(str: string): number | null {
  let value = 0;
  for (const c of str) {
    const digit = B83.indexOf(c);
    if (digit === -1) return null;
    value = value * 83 + digit;
  }
  return value;
}

/**
 * Average color of a blurhash — decodes only the DC component (chars 2-5),
 * which the format stores as packed 24-bit sRGB. '' is the app's
 * attempted-no-hash sentinel and returns null like any invalid input.
 */
export function blurhashAverageColor(
  blurhash: string | null | undefined,
): { r: number; g: number; b: number } | null {
  if (!blurhash || blurhash.length < 6) return null;
  const dc = decode83(blurhash.slice(2, 6));
  if (dc === null) return null;
  return { r: dc >> 16, g: (dc >> 8) & 255, b: dc & 255 };
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const to255 = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  if (s === 0) return `#${to255(l)}${to255(l)}${to255(l)}`;
  return `#${to255(hue(h + 1 / 3))}${to255(hue(h))}${to255(hue(h - 1 / 3))}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A portrait this desaturated has no usable hue — fall through to the brand. */
const MIN_USABLE_SATURATION = 0.08;

/**
 * Derive the page theme. Fallback chain: blurhash DC color (if saturated
 * enough) → publisher brand color → COLORS.blue. Chroma is boosted and
 * lightness clamped so muddy portraits still yield a legible accent.
 */
export function deriveCharacterTheme(hero: {
  portrait_blurhash?: string | null;
  publisher?: string | null;
}): CharacterTheme {
  let base: { r: number; g: number; b: number } | null = null;
  const avg = blurhashAverageColor(hero.portrait_blurhash);
  if (avg && rgbToHsl(avg.r, avg.g, avg.b)[1] >= MIN_USABLE_SATURATION) base = avg;
  if (!base) {
    const brand = brandForPublisher(hero.publisher)?.color ?? COLORS.blue;
    base = hexToRgb(brand);
  }
  const [h, s, l] = rgbToHsl(base.r, base.g, base.b);
  const accentS = clamp(s * 1.35, 0.42, 0.85);
  const accent = hslToHex(h, accentS, clamp(l, 0.34, 0.56));
  const accentDeep = hslToHex(h, accentS, 0.3);
  const { r, g, b } = hexToRgb(accent);
  const accentWash = `rgba(${r},${g},${b},0.07)`;
  return { accent, accentDeep, accentWash };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn jest __tests__/lib/accent.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/accent.ts __tests__/lib/accent.test.ts
git commit -m "feat(character): blurhash-derived ambient accent engine"
```

---

### Task 2: Theme wiring + hero band atmosphere (desktop + mobile)

**Files:**
- Modify: `app/character/[id].web.tsx`

**Interfaces:**
- Consumes: `deriveCharacterTheme`, `CharacterTheme` from Task 1.
- Produces: `const theme: CharacterTheme` in `WebCharacterScreen` scope — Tasks 3–5 reference `theme.accent` / `theme.accentDeep` / `theme.accentWash`.

- [ ] **Step 1: Import + memoize the theme**

Add to imports: `import { deriveCharacterTheme } from '../../src/lib/accent';` and ensure `useMemo` is imported from react. Inside `WebCharacterScreen`, right after the `useHeroDetail` destructure (~line 539):

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

(Hooks must run before the early returns at ~line 602 — this spot qualifies.)

- [ ] **Step 2: Desktop stage — accent glow replaces alignment tint in atmospheric elements**

At ~line 786, `orbA`'s gradient: `${alignmentColor}2e` → `${theme.accent}40`. At ~line 873–884, `stageAccent`: `backgroundColor: alignmentColor` → `theme.accent`, `boxShadow: \`0 0 18px ${alignmentColor}\`` → `` `0 0 22px ${theme.accentDeep}` ``. Add a name-side bloom as the first child inside the stage (after the scrim View at ~line 779):

```tsx
{/* Name-side accent bloom — the character's own color owns the band */}
<View
  style={
    [
      StyleSheet.absoluteFill,
      {
        backgroundImage: `radial-gradient(55% 90% at 16% 35%, ${theme.accentDeep}59, transparent 70%)`,
        pointerEvents: 'none',
      },
    ] as object
  }
/>
```

The alignment chip (`alignChip`, ~line 838) keeps `alignmentColor` — semantic, per Global Constraints.

- [ ] **Step 3: Desktop stage — merge the meta pills into one accent-divided stat-strip**

Replace the `metaRow` block (~lines 836–866: alignChip + two `metaPill`s) with one strip. Keep the alignment chip as-is, then a single pill-strip View:

```tsx
<View style={styles.metaRow}>
  {alignmentLabel ? (
    /* existing alignChip block unchanged */
  ) : null}
  <View style={[styles.statStrip, { borderColor: theme.accent + '44' }] as object}>
    {powerScore !== null ? (
      <View style={styles.statStripItem}>
        <Text style={styles.metaPillVal}>{powerScore}</Text>
        <Text style={styles.metaPillKey}>Power</Text>
      </View>
    ) : null}
    {powerScore !== null && (details.issueCount ?? 0) > 0 ? (
      <View style={[styles.statStripDiv, { backgroundColor: theme.accent + '55' }] as object} />
    ) : null}
    {(details.issueCount ?? 0) > 0 ? (
      <View style={styles.statStripItem}>
        <Text style={styles.metaPillVal}>{details.issueCount!.toLocaleString()}</Text>
        <Text style={styles.metaPillKey}>Issues</Text>
      </View>
    ) : null}
  </View>
</View>
```

New static styles (add near `metaPill` in the StyleSheet; copy `metaPill`'s padding/background values so the strip visually matches the old pills, single border around the whole strip):

```ts
statStrip: {
  flexDirection: 'row',
  alignItems: 'center',
  borderWidth: 1,
  borderRadius: 999,
  backgroundColor: 'rgba(245,235,220,0.06)',
},
statStripItem: { flexDirection: 'row', alignItems: 'baseline', gap: 5, paddingHorizontal: 14, paddingVertical: 7 },
statStripDiv: { width: 1, alignSelf: 'stretch', marginVertical: 7 },
```

Delete the now-unused `metaPill` style if nothing else references it (`rg -n "metaPill\b"` first; `metaPillVal`/`metaPillKey` stay).

- [ ] **Step 4: Portrait halo (desktop side column)**

`portraitCard` render (~line 1438): add a dynamic accent halo to the card:

```tsx
<View style={[styles.portraitCard, { boxShadow: `0 0 0 1px ${theme.accent}33, 0 18px 60px -18px ${theme.accentDeep}bb` }] as object}>
```

(If `portraitCard`'s StyleSheet entry already sets `boxShadow`, the inline member overrides it — fold the old elevation shadow into the new string instead of losing it: check the style first with `rg -n "portraitCard:" app/character/\[id\].web.tsx`.)

- [ ] **Step 5: Mobile hero header — accent bloom**

In the mobile branch, after `mScrimBottom` (~line 1661) add the same kind of bloom so the phone header carries the character's color:

```tsx
<View
  style={
    [
      StyleSheet.absoluteFill,
      {
        backgroundImage: `radial-gradient(90% 55% at 50% 100%, ${theme.accentDeep}66, transparent 72%)`,
        pointerEvents: 'none',
      },
    ] as object
  }
/>
```

And the mobile alignment badge row stays semantic (no change).

- [ ] **Step 6: Typecheck + visual sanity**

Run: `yarn tsc --noEmit`
Expected: clean (pre-existing warnings only). Then `yarn test:ci` — all green.

- [ ] **Step 7: Commit**

```bash
git add "app/character/[id].web.tsx"
git commit -m "feat(character): ambient accent hero band — bloom, halo, stat-strip"
```

---

### Task 3: Trait chips move into the band

**Files:**
- Modify: `src/components/character/TraitBand.tsx`
- Modify: `app/character/[id].web.tsx`

**Interfaces:**
- Consumes: `theme` from Task 2.
- Produces: `TraitBand` gains optional `onInk?: boolean` prop (translucent dark-stage variant). Existing light usage elsewhere unaffected.

- [ ] **Step 1: Add the `onInk` variant to TraitBand**

```tsx
interface Props {
  tags: HeroTagChip[];
  /** Dark-stage variant: translucent pills tuned for the ink band. */
  onInk?: boolean;
}

export function TraitBand({ tags, onInk }: Props) {
  if (tags.length === 0) return null;
  return (
    <View style={styles.row}>
      {tags.map((t) => {
        const c = traitColor(t.category);
        return (
          <View
            key={t.slug}
            style={[
              styles.pill,
              onInk
                ? { backgroundColor: withAlpha(c, 0.16), borderColor: withAlpha(c, 0.45) }
                : { backgroundColor: withAlpha(c, 0.1), borderColor: withAlpha(c, 0.35) },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: c }]} />
            <Text style={[styles.label, { color: onInk ? withAlpha(c, 0.95) : c }]}>{t.label}</Text>
          </View>
        );
      })}
    </View>
  );
}
```

Note: trait category colors are mid-tone; verify on-ink legibility in the screenshot step — if any category reads dim on deepNavy, lighten via `withAlpha` on a white-mixed tone in a follow-up tweak, not in this task.

- [ ] **Step 2: Desktop — render inside the stage, remove from the paper body**

In `[id].web.tsx`: inside the stage's `identityCol` (~after the closing `</View>` of `identityRow`, ~line 868), add:

```tsx
{narrative && narrative.tags.length > 0 ? (
  <View style={styles.stageTraits}>
    <TraitBand tags={narrative.tags} onInk />
  </View>
) : null}
```

Add style `stageTraits: { marginTop: 14 }`. Delete the desktop paper-side block (~lines 896–900, `webTraitBand`) and its `webTraitBand` style.

- [ ] **Step 3: Mobile — move traits into the hero header**

In `mIdentity` (~line 1691), after the `mName`/`mAlias` lines and before `mVitals`, add:

```tsx
{narrative && narrative.tags.length > 0 ? (
  <View style={styles.mStageTraits}>
    <TraitBand tags={narrative.tags} onInk />
  </View>
) : null}
```

Style: `mStageTraits: { marginTop: 10 }`. Delete the `mSheet` trait block (~lines 1759–1764) and the `mTraitBand` style.

- [ ] **Step 4: Verify + commit**

Run: `yarn tsc --noEmit && yarn test:ci` — clean/green.

```bash
git add src/components/character/TraitBand.tsx "app/character/[id].web.tsx"
git commit -m "feat(character): trait chips join the identity band (onInk variant)"
```

---

### Task 4: Power Profile band

**Files:**
- Modify: `app/character/[id].web.tsx`

**Interfaces:**
- Consumes: `theme` from Task 2.
- Produces: module-level `STAT_MEDIANS: Record<string, number>` (used again in Pass 3's animated variant).

- [ ] **Step 1: Add the catalog medians constant**

Next to `STAT_CONFIG` (~line 49). Values are the live catalog medians (computed 2026-07-02 over heroes with real stats; refresh only if the catalog changes shape drastically):

```ts
// Catalog median per stat (heroes with non-zero stats, 2026-07-02) — the faint
// tick on each Power Profile bar that makes "94 intelligence" mean something.
const STAT_MEDIANS: Record<string, number> = {
  intelligence: 50,
  strength: 24,
  speed: 30,
  durability: 36,
  power: 30,
  combat: 40,
};
```

- [ ] **Step 2: Desktop — card → accent-washed band, median ticks, percentile badge**

At ~line 903, change the container: `<View style={styles.card}>` → `<View style={[styles.powerBand, { backgroundColor: theme.accentWash, borderColor: theme.accent + '2b' }] as object}>`.

In the `STAT_CONFIG.map` cell (~line 993–1011), add the median tick inside `bandTrack` after `bandFill`:

```tsx
<View style={styles.bandTrack}>
  <View style={[styles.bandFill, { width: `${fill}%` as unknown as number, backgroundColor: color }]} />
  {STAT_MEDIANS[key] != null ? (
    <View
      style={[styles.bandMedianTick, { left: `${STAT_MEDIANS[key]}%` as unknown as number }] as object}
    />
  ) : null}
</View>
```

Replace the trailing percentile text (~lines 1015–1019) with an accent badge:

```tsx
{percentile != null && percentile > 0 ? (
  <View style={styles.percentileRow}>
    <View style={[styles.percentileBadge, { backgroundColor: theme.accent + '1a', borderColor: theme.accent + '40' }] as object}>
      <Ionicons name="flash" size={11} color={theme.accent} />
      <Text style={[styles.percentileBadgeText, { color: theme.accent }] as object}>
        Stronger than {percentile}% of heroes
      </Text>
    </View>
  </View>
) : null}
```

Compare button: in `compareBtn`'s render (~line 929–939), swap the two hardcoded `COLORS.orange` (icon color + keep text style) for `theme.accent`, and pass the accent into the text via inline `{ color: theme.accent }`.

New static styles (near `bandTrack` in the StyleSheet):

```ts
powerBand: {
  borderRadius: 18,
  borderWidth: 1,
  paddingHorizontal: 22,
  paddingVertical: 18,
},
bandMedianTick: {
  position: 'absolute',
  top: -2,
  bottom: -2,
  width: 2,
  borderRadius: 1,
  backgroundColor: 'rgba(41,60,67,0.30)',
},
percentileRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
percentileBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  borderWidth: 1,
  borderRadius: 999,
  paddingHorizontal: 12,
  paddingVertical: 5,
},
percentileBadgeText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12 },
```

`bandTrack` needs `position: 'relative'` and `overflow: 'visible'` for the tick — check its current entry and add if missing. Copy `powerBand`'s padding values from the current `card` style so section rhythm doesn't jump (check `card:` entry first and mirror its metrics; the *change* is wash background + accent hairline instead of white + grey).

The old `percentileText` style: delete if now unused **desktop-side only if** the mobile branch still uses it — mobile gets the same badge in Step 3, after which delete the style.

- [ ] **Step 3: Mobile — same treatment**

Mobile Power Stats block (~lines 1817–1942): give the `mBlock` container for stats the same wash (`<View style={[styles.mBlock, styles.mPowerBand, { backgroundColor: theme.accentWash, borderColor: theme.accent + '2b' }] as object}>`, with `mPowerBand: { borderRadius: 18, borderWidth: 1, marginHorizontal: 12, paddingHorizontal: 16, paddingVertical: 16 }` — adjust `marginHorizontal` to sit inside `mSheet`'s existing gutter: read `mBlock`'s current padding and compensate so text alignment doesn't shift). Add the identical median tick inside the mobile stat track and replace the mobile percentile text (~lines 1900–1903) with the same badge markup.

- [ ] **Step 4: Verify + commit**

Run: `yarn tsc --noEmit && yarn test:ci` — clean/green.

```bash
git add "app/character/[id].web.tsx"
git commit -m "feat(character): Power Profile band — accent wash, median ticks, percentile badge"
```

---

### Task 5: Quick Facts — accent icons, flatter tiles

**Files:**
- Modify: `app/character/[id].web.tsx` (the `FactTile` component, ~lines 431–461, and its call sites)

**Interfaces:**
- Consumes: `theme` from Task 2.
- Produces: `FactTile` gains `iconTint?: string` prop.

- [ ] **Step 1: Thread the accent into FactTile**

`FactTile` is module-level (no access to `theme`) — add a prop:

```tsx
function FactTile({ icon, label, value, wide, accent, iconTint }: {
  icon: IoniconName;
  label: string;
  value: string | null | undefined;
  wide?: boolean;
  accent?: string;
  iconTint?: string;
}) {
  const v = cleanFact(value);
  if (!v) return null;
  const tint = accent ? { backgroundColor: accent + '14', borderColor: accent + '33' } : null;
  return (
    <View style={[styles.factTile, wide && styles.factTileWide, tint] as object}>
      <Text style={styles.factLabel}>{label}</Text>
      <View style={styles.factValueRow}>
        <Ionicons name={icon} size={12} color={accent ?? iconTint ?? COLORS.navy + '70'} />
        <Text style={[styles.factValue, accent ? { color: accent } : null] as object} numberOfLines={2}>
          {v}
        </Text>
      </View>
    </View>
  );
}
```

At every `<FactTile` call site that does **not** already pass `accent` (the alignment tile keeps its semantic `accent`), add `iconTint={theme.accent}` (find them: `rg -n "<FactTile" "app/character/[id].web.tsx"`).

- [ ] **Step 2: Flatten the tile chrome**

In the `factTile` StyleSheet entry: reduce border presence to a hairline — set `borderWidth: 1` → keep, `borderColor` → `'rgba(41,60,67,0.10)'`, and drop any `boxShadow` if present (read the entry first). Goal per spec §8: one level less border-noise.

- [ ] **Step 3: Verify + commit**

Run: `yarn tsc --noEmit && yarn test:ci` — clean/green.

```bash
git add "app/character/[id].web.tsx"
git commit -m "tweak(character): Quick Facts — accent icons, hairline tiles"
```

---

### Task 6: Pass-1 verification sweep

**Files:** none (verification only).

- [ ] **Step 1: Full test + typecheck + lint gate**

Run: `yarn test:ci && yarn tsc --noEmit`
Expected: all green (the lint gate is errors-only; run `yarn lint` if configured and fix new *errors* only).

- [ ] **Step 2: Hand off for device screenshots**

Do NOT start a dev server. Tell the user Pass 1 is committed and ask them to screenshot `/character/643` (Supergirl — warm/red accent expected), a villain (e.g. Joker — green family), and one hero with no `portrait_blurhash` (publisher-color fallback) on both desktop and iOS Safari. Adjust alphas/clamps from their feedback before starting Pass 2.
