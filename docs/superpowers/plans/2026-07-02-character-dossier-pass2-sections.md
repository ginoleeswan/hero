# Character Dossier — Pass 2: Sections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the character page's content sections per spec §4–§7: pull-quote biography, tiered abilities with signature-power tiles, upgraded relationship shelves, a merged "Legend" band (debut + trivia + portrayals), gallery filmstrip fade, and Links demoted to a quiet footer register.

**Architecture:** New web-only presentational components live in `src/components/web/character/`; pure selection/splitting logic is exported for unit tests. `app/character/[id].web.tsx` swaps its section blocks to use them (desktop + mobile branches). Shared components used by native (`RelatedHeroStrip`, `AbilitiesSection`) are only touched via opt-in props so native rendering is unchanged.

**Tech Stack:** React Native Web (Expo SDK 56), StyleSheet, jest-expo.

**Spec:** `docs/superpowers/specs/2026-07-02-character-dossier-redesign-design.md`

## Global Constraints

- yarn only; `yarn test:ci` / `yarn jest <path>`; `yarn tsc --noEmit` must stay clean.
- TypeScript, no `any`. `StyleSheet.create` for static styles; dynamic accent values as inline members of style arrays (established file pattern).
- Never `Flame-Bold`. Flame-Regular display / FlameSans-Regular body / Nunito UI. **Clamped Flame text needs `lineHeight ≥ 1.22× fontSize`.**
- Web screen only (`app/character/[id].web.tsx`, desktop + mobile branches). Native `[id].tsx` untouched; shared components change behavior only behind new optional props.
- The `theme: CharacterTheme` object (accent/accentDeep/accentWash) from Pass 1 is in scope in `WebCharacterScreen`; components receive `accent: string` as a prop, never re-derive.
- Commit directly to `main` after each task. No dev server; user verifies via device screenshots.

## Scope deviations from spec (deliberate, YAGNI)

- §5 "collapsed past ~2 rows with expander": the existing categorized chip grid is already compact; signature tier + filtering signature powers out of the grid ships, the per-category expander does not.
- §6 team wordmarks in shelves: only 3 curated `TEAM_LOGOS` exist and affiliations resolve to ids, not logo_urls — linked chips stay; wordmarks deferred.
- §7 "larger lead image" in the gallery: `GalleryStrip` is shared with native; web gets the edge-fade filmstrip treatment only.

---

### Task 1: Pull-quote biography

**Files:**
- Create: `src/components/web/character/PullQuoteBio.tsx`
- Test: `__tests__/components/pullQuoteBio.test.ts`
- Modify: `app/character/[id].web.tsx` (desktop "Story" block ~L1154–1204; mobile summary block in `mSheet`; delete `summaryBox`/`summaryText` styles if unused after)

**Interfaces:**
- Produces: `splitLeadSentence(text: string): { lead: string; rest: string }` (exported pure fn) and `PullQuoteBio` component with props `{ summary: string; accent: string; hasBiography: boolean; onReadMore: () => void; onEdit?: () => void }`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/components/pullQuoteBio.test.ts
import { splitLeadSentence } from '../../src/components/web/character/PullQuoteBio';

describe('splitLeadSentence', () => {
  it('splits on the first sentence boundary', () => {
    const r = splitLeadSentence('Kara is brash. She fights crime. The end.');
    expect(r.lead).toBe('Kara is brash.');
    expect(r.rest).toBe('She fights crime. The end.');
  });
  it('keeps abbreviations like D.E.O. inside the lead (boundary needs space + capital)', () => {
    const r = splitLeadSentence('She works at the D.E.O. building daily. More text here.');
    // "D.E.O. building" is not a boundary (lowercase follows); "daily. More" is.
    expect(r.lead).toBe('She works at the D.E.O. building daily.');
    expect(r.rest).toBe('More text here.');
  });
  it('returns the whole text as lead when there is no boundary', () => {
    const r = splitLeadSentence('One long unpunctuated line');
    expect(r.lead).toBe('One long unpunctuated line');
    expect(r.rest).toBe('');
  });
  it('refuses oversized leads (>220 chars) and falls back to whole-text lead', () => {
    const long = `${'x'.repeat(230)}. Short tail.`;
    const r = splitLeadSentence(long);
    expect(r.rest).toBe('');
  });
});
```

- [ ] **Step 2: Run it** — `yarn jest __tests__/components/pullQuoteBio.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement the component**

```tsx
// src/components/web/character/PullQuoteBio.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';

/**
 * First sentence of a bio teaser, for the pull-quote treatment. A boundary is
 * sentence punctuation followed by whitespace and a capital — so "D.E.O. "
 * mid-sentence doesn't split. Leads over 220 chars don't quote well; fall back
 * to rendering the whole teaser at body size.
 */
export function splitLeadSentence(text: string): { lead: string; rest: string } {
  const m = /[.!?]["')\]]?\s+(?=[A-Z0-9"'(])/.exec(text);
  if (!m) return { lead: text, rest: '' };
  const cut = m.index + m[0].length;
  const lead = text.slice(0, cut).trim();
  if (lead.length > 220) return { lead: text, rest: '' };
  return { lead, rest: text.slice(cut).trim() };
}

// The page's breathing moment: an accent quote-bar, the first sentence set
// large in Flame, the remaining teaser in FlameSans — no card chrome.
export function PullQuoteBio({
  summary,
  accent,
  hasBiography,
  onReadMore,
  onEdit,
}: {
  summary: string;
  accent: string;
  hasBiography: boolean;
  onReadMore: () => void;
  onEdit?: () => void;
}) {
  const { lead, rest } = splitLeadSentence(summary);
  const quotable = rest.length > 0;
  return (
    <View style={styles.wrap}>
      <View style={[styles.quoteBar, { backgroundColor: accent }] as object} />
      <View style={styles.body}>
        <Text style={quotable ? styles.lead : styles.plain}>
          {lead}
          {onEdit && !quotable ? (
            <>
              {'  '}
              <MaterialCommunityIcons
                name="pencil"
                size={15}
                color="rgba(41,60,67,0.5)"
                onPress={onEdit}
              />
            </>
          ) : null}
        </Text>
        {quotable ? (
          <Text style={styles.plain}>
            {rest}
            {onEdit ? (
              <>
                {'  '}
                <MaterialCommunityIcons
                  name="pencil"
                  size={15}
                  color="rgba(41,60,67,0.5)"
                  onPress={onEdit}
                />
              </>
            ) : null}
          </Text>
        ) : null}
        {hasBiography ? (
          <Pressable
            onPress={onReadMore}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [styles.readMore, hovered && styles.readMoreHover] as object
            }
          >
            <Text style={[styles.readMoreText, { color: accent }] as object}>Read biography</Text>
            <Ionicons name="chevron-forward" size={13} color={accent} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 16, paddingVertical: 6 },
  quoteBar: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  body: { flex: 1, gap: 10, maxWidth: 720 },
  // Non-clamped Flame display — free-wrapping, so no descender clipping risk.
  lead: { fontFamily: 'Flame-Regular', fontSize: 23, lineHeight: 32, color: COLORS.navy },
  plain: { fontFamily: 'FlameSans-Regular', fontSize: 15, lineHeight: 24, color: COLORS.navy },
  readMore: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' },
  readMoreHover: { opacity: 0.75 } as object,
  readMoreText: { fontFamily: 'Nunito_700Bold', fontSize: 13 },
});
```

- [ ] **Step 4: Run the test** — PASS (4 tests).

- [ ] **Step 5: Wire into the screen**

Desktop (~L1170–1204): replace the `summaryBox` content branch with:

```tsx
) : details.summary || details.description ? (
  <PullQuoteBio
    summary={details.summary ?? ''}
    accent={theme.accent}
    hasBiography={!!details.description}
    onReadMore={() => router.push(`/biography/${id}`)}
    onEdit={() => setEditTarget({ field: SUMMARY_FIELD, current: details.summary ?? null })}
  />
) : null}
```

Guard: when `details.summary` is empty but `description` exists, the old block showed only the link — keep that by passing `summary={details.summary ?? ''}` and having `PullQuoteBio` render nothing for an empty lead (add `if (!summary && !hasBiography) return null;` and skip the Text when `summary === ''`). Mobile: same swap in the `mBlock` summary branch (wrap in `<View style={styles.mBlock}>` to keep the sheet gutter). Import `PullQuoteBio` at top. The loading-skeleton branches stay untouched. Delete `summaryText`/`biographyLink*` styles only if `rg` shows no remaining references.

- [ ] **Step 6: Verify + commit**

`yarn tsc --noEmit && yarn test:ci` → clean/green.

```bash
git add src/components/web/character/PullQuoteBio.tsx __tests__/components/pullQuoteBio.test.ts "app/character/[id].web.tsx"
git commit -m "feat(character): biography becomes a pull-quote editorial moment"
```

---

### Task 2: Tiered abilities — signature power tiles

**Files:**
- Create: `src/components/web/character/SignaturePowers.tsx`
- Test: `__tests__/components/signaturePowers.test.ts`
- Modify: `app/character/[id].web.tsx` (desktop `WebAbilitiesCard` ~L2490+; mobile branch renders `SignaturePowerTiles` above `AbilitiesSection`)

**Interfaces:**
- Consumes: `PowerExplainer { power: string; text: string }` from `src/lib/db/heroFacts`; `getPowerIcon(name)` from `src/constants/powerIcons`.
- Produces: `pickSignaturePowers(powers: string[] | null | undefined, explainers: PowerExplainer[]): { name: string; blurb: string | null }[]` and `SignaturePowerTiles` component `{ powers: string[] | null | undefined; explainers: PowerExplainer[]; accent: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/components/signaturePowers.test.ts
import { pickSignaturePowers } from '../../src/components/web/character/SignaturePowers';

const EXPL = [
  { power: 'Flight', text: 'Defies gravity.' },
  { power: 'Heat Vision', text: 'Eyes like lasers.' },
];

describe('pickSignaturePowers', () => {
  it('puts explainer-backed powers first, then fills in list order, capped at 5', () => {
    const powers = ['Agility', 'Flight', 'Stamina', 'Heat Vision', 'Healing', 'Super Sight'];
    const r = pickSignaturePowers(powers, EXPL);
    expect(r.map((p) => p.name)).toEqual(['Flight', 'Heat Vision', 'Agility', 'Stamina', 'Healing']);
    expect(r[0].blurb).toBe('Defies gravity.');
    expect(r[2].blurb).toBeNull();
  });
  it('matches explainers case-insensitively', () => {
    const r = pickSignaturePowers(['flight'], [{ power: 'FLIGHT', text: 'Zoom.' }]);
    expect(r[0].blurb).toBe('Zoom.');
  });
  it('returns [] when there are fewer than 3 powers (no tier for tiny sets)', () => {
    expect(pickSignaturePowers(['Flight', 'Agility'], EXPL)).toEqual([]);
    expect(pickSignaturePowers(null, EXPL)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it** — FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// src/components/web/character/SignaturePowers.tsx
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { getPowerIcon } from '../../../constants/powerIcons';
import type { PowerExplainer } from '../../../lib/db/heroFacts';

const MAX_SIGNATURE = 5;

/**
 * The powers that headline the Abilities section: explainer-backed powers
 * first (they carry a one-line blurb), then the leading powers in list order.
 * Sets under 3 powers get no tier — a tier of everything is a tier of nothing.
 */
export function pickSignaturePowers(
  powers: string[] | null | undefined,
  explainers: PowerExplainer[],
): { name: string; blurb: string | null }[] {
  if (!powers || powers.length < 3) return [];
  const blurbByPower = new Map(explainers.map((e) => [e.power.toLowerCase(), e.text]));
  const explained = powers.filter((p) => blurbByPower.has(p.toLowerCase()));
  const rest = powers.filter((p) => !blurbByPower.has(p.toLowerCase()));
  return [...explained, ...rest]
    .slice(0, MAX_SIGNATURE)
    .map((name) => ({ name, blurb: blurbByPower.get(name.toLowerCase()) ?? null }));
}

// Headline tiles for the signature tier — icon, name, one-line decoded blurb.
export function SignaturePowerTiles({
  powers,
  explainers,
  accent,
}: {
  powers: string[] | null | undefined;
  explainers: PowerExplainer[];
  accent: string;
}) {
  const signature = pickSignaturePowers(powers, explainers);
  if (signature.length === 0) return null;
  return (
    <View style={styles.row}>
      {signature.map((p) => {
        const icon = getPowerIcon(p.name);
        return (
          <View
            key={p.name}
            style={[styles.tile, { borderColor: accent + '2b', backgroundColor: accent + '0a' }] as object}
          >
            <MaterialCommunityIcons name={icon.name} size={18} color={accent} />
            <Text style={styles.tileName} numberOfLines={1}>
              {p.name}
            </Text>
            {p.blurb ? (
              <Text style={styles.tileBlurb} numberOfLines={2}>
                {p.blurb}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    maxWidth: 220,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  // Clamped FlameSans/Nunito — no Flame descender risk.
  tileName: { fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: COLORS.navy },
  tileBlurb: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(41,60,67,0.7)',
  },
});
```

Check `getPowerIcon`'s return shape first (`rg -n "export function getPowerIcon" -A 4 src/constants/powerIcons.ts`) — if it returns a name string rather than `{ name }`, adjust the icon usage to match; if its icon set is Ionicons not MaterialCommunityIcons, use that component.

- [ ] **Step 4: Run the test** — PASS (3 tests).

- [ ] **Step 5: Wire into the screen**

Desktop: inside `WebAbilitiesCard` (it already receives `powers` and `explainers`), render `<SignaturePowerTiles powers={powers} explainers={explainers} accent={accent} />` between the card header and the categorized groups, and filter signature names out of the grouped grid so they don't repeat: compute `const signatureNames = new Set(pickSignaturePowers(powers, explainers).map((p) => p.name));` and pass `powers?.filter((p) => !signatureNames.has(p))` into the existing `groupPowers` call. `WebAbilitiesCard` needs a new `accent: string` prop threaded from `theme.accent` at its call site. If explainers previously rendered as a separate "Decoded" strip inside the card, remove that strip — the blurbs now live on the tiles (check for a `PowersDecoded` usage inside `WebAbilitiesCard` and drop it there only; mobile `AbilitiesSection` keeps its own behavior).

Mobile: in the mobile branch, immediately before `<AbilitiesSection …/>`, add:

```tsx
{details.powers && details.powers.length > 0 ? (
  <View style={styles.mBlock}>
    <SignaturePowerTiles
      powers={details.powers}
      explainers={narrative?.powerExplainers ?? []}
      accent={theme.accent}
    />
  </View>
) : null}
```

(`AbilitiesSection` is shared with native — do not modify it; duplication of the signature powers in its grid on mobile web is acceptable for this pass if filtering requires touching the shared component; otherwise pass its existing props unchanged.)

- [ ] **Step 6: Verify + commit**

`yarn tsc --noEmit && yarn test:ci` → clean/green.

```bash
git add src/components/web/character/SignaturePowers.tsx __tests__/components/signaturePowers.test.ts "app/character/[id].web.tsx"
git commit -m "feat(character): abilities get a signature-power headline tier"
```

---

### Task 3: Legend band — debut + trivia + portrayals

**Files:**
- Create: `src/components/web/character/LegendBand.tsx`
- Modify: `app/character/[id].web.tsx` — desktop: remove the "Did You Know" card (~L1220–1227) and "Portrayed By" card (~L1409–1417), remove the debut block from "In Print" (~L1484–1532), insert `<LegendBand …/>` after the relationships card; mobile: same consolidation in `mSheet`.

**Interfaces:**
- Consumes: `DidYouKnowDeck` (`facts: string[]`, `contentInset?`), `PortrayedBySection` (`portrayals: HeroPortrayals`, `contentInset?`), `data.firstIssue` (`{ id, name, imageUrl, coverDate } | null`-ish — confirm exact field names with `rg -n "firstIssue" src/types/index.ts src/lib/api.ts`).
- Produces: `LegendBand` component:

```ts
{
  accent: string;
  accentWash: string;
  firstIssue: { id: string | number; name: string | null; imageUrl: string | null; coverDate: string | null } | null;
  facts: string[];
  portrayals: HeroPortrayals | null;
  onPressDebut: () => void;
}
```

- [ ] **Step 1: Build the component** (presentational — no unit test; screenshot-verified)

```tsx
// src/components/web/character/LegendBand.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { DidYouKnowDeck } from '../../character/DidYouKnowDeck';
import { PortrayedBySection } from '../../PortrayedBySection';
import type { HeroPortrayals } from '../../../lib/db/people';

interface FirstIssueMoment {
  id: string | number;
  name: string | null;
  imageUrl: string | null;
  coverDate: string | null;
}

// One editorial band for the character's story-through-time: the debut cover
// anchors the left, a timeline spine threads Did You Know moments and the
// actors who carried the role. Crown-washed card, same grammar as PowerProfile.
export function LegendBand({
  accent,
  accentWash,
  firstIssue,
  facts,
  portrayals,
  onPressDebut,
}: {
  accent: string;
  accentWash: string;
  firstIssue: FirstIssueMoment | null;
  facts: string[];
  portrayals: HeroPortrayals | null;
  onPressDebut: () => void;
}) {
  const hasPortrayals =
    !!portrayals && (portrayals.performers.length > 0 || portrayals.voiceActors.length > 0);
  const hasDebut = !!firstIssue?.imageUrl;
  if (!hasDebut && facts.length === 0 && !hasPortrayals) return null;
  const year = firstIssue?.coverDate ? firstIssue.coverDate.slice(0, 4) : null;
  return (
    <View
      style={
        [
          styles.band,
          {
            backgroundImage: `linear-gradient(180deg, ${accentWash} 0%, rgba(255,255,255,0) 65%)`,
            borderColor: accent + '33',
          },
        ] as object
      }
    >
      <Text style={styles.title}>Legend</Text>
      <View style={[styles.titleRule, { backgroundColor: accent + '22' }] as object} />

      <View style={styles.columns}>
        {hasDebut ? (
          <Pressable
            onPress={onPressDebut}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [styles.debut, hovered && styles.debutHover] as object
            }
          >
            <View style={styles.debutCover}>
              <img
                src={firstIssue!.imageUrl!}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </View>
            {year ? (
              <Text style={[styles.debutYear, { color: accent }] as object}>{year}</Text>
            ) : null}
            <Text style={styles.debutLabel}>First appearance</Text>
            {firstIssue!.name ? (
              <Text style={styles.debutName} numberOfLines={2}>
                {firstIssue!.name.split(';')[0].trim()}
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        <View style={styles.flow}>
          {/* Timeline spine — a hairline the moments hang from */}
          <View style={[styles.spine, { backgroundColor: accent + '2b' }] as object} />
          {facts.length > 0 ? (
            <View style={styles.moment}>
              <View style={[styles.momentDot, { backgroundColor: accent }] as object} />
              <View style={styles.momentBody}>
                <Text style={styles.momentLabel}>Did you know</Text>
                <View style={styles.deckBleed}>
                  <DidYouKnowDeck facts={facts} contentInset={0} />
                </View>
              </View>
            </View>
          ) : null}
          {hasPortrayals ? (
            <View style={styles.moment}>
              <View style={[styles.momentDot, { backgroundColor: accent }] as object} />
              <View style={styles.momentBody}>
                <Text style={styles.momentLabel}>Portrayed by</Text>
                <PortrayedBySection portrayals={portrayals!} contentInset={0} />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    boxShadow: '0 6px 22px rgba(41,60,67,0.06)',
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  titleRule: { height: 1, marginBottom: 16 },
  columns: { flexDirection: 'row', gap: 22, flexWrap: 'wrap' },
  debut: { width: 150, gap: 4 },
  debutHover: { opacity: 0.9 } as object,
  debutCover: {
    width: 150,
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy + '10',
  } as object,
  // Non-clamped Flame display.
  debutYear: { fontFamily: 'Flame-Regular', fontSize: 26, lineHeight: 30, marginTop: 8 },
  debutLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.55)',
  },
  debutName: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: COLORS.navy, lineHeight: 18 },
  flow: { flex: 1, minWidth: 260, gap: 20, position: 'relative', paddingLeft: 18 } as object,
  spine: { position: 'absolute', left: 3, top: 6, bottom: 6, width: 1 } as object,
  moment: { gap: 8 },
  momentDot: {
    position: 'absolute',
    left: -18,
    top: 3,
    width: 7,
    height: 7,
    borderRadius: 4,
  } as object,
  momentBody: { gap: 8 },
  momentLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.55)',
  },
  deckBleed: { marginHorizontal: 0 },
});
```

Note: `DidYouKnowDeck` sizes cards from `Dimensions` — inside the narrower flow column verify it doesn't overflow; if it does, wrap `deckBleed` with `overflow: 'hidden'` and negative margins matching the band padding (`marginHorizontal: -20`, `paddingHorizontal: 20`).

- [ ] **Step 2: Wire desktop** — delete the standalone "Did You Know" and "Portrayed By" cards; delete the debut Pressable inside "In Print" (leave `ComicCoverRail` + gallery; drop the now-unused `debutBlock*` styles if `rg` confirms). Insert after the relationships card:

```tsx
<LegendBand
  accent={theme.accent}
  accentWash={theme.accentWash}
  firstIssue={data.firstIssue ?? null}
  facts={narrative?.didYouKnow ?? []}
  portrayals={portrayals}
  onPressDebut={() =>
    data.firstIssue &&
    router.push(`/issue/cvi:${data.firstIssue.id}` as Parameters<typeof router.push>[0])
  }
/>
```

- [ ] **Step 3: Wire mobile** — same consolidation in `mSheet`: remove the mobile Did You Know block, Portrayed By block, and First Appearance block (find them via `rg -n "mSectionTitle}>"`), insert `<View style={styles.mBlock}><LegendBand …/></View>` in their place (first of the three positions).

- [ ] **Step 4: Verify + commit**

`yarn tsc --noEmit && yarn test:ci` → clean/green.

```bash
git add src/components/web/character/LegendBand.tsx "app/character/[id].web.tsx"
git commit -m "feat(character): Legend band — debut, trivia, portrayals on one timeline"
```

---

### Task 4: Relationship shelves — accent edges + monogram fallbacks

**Files:**
- Modify: `src/components/RelatedHeroStrip.tsx` (opt-in props only — native rendering unchanged)
- Modify: `app/character/[id].web.tsx` (pass the new props at the three call sites; accent-tint the section divider)
- Test: `__tests__/components/relatedHeroStrip.test.ts` (monogram helper)

**Interfaces:**
- Produces: `RelatedHeroStrip` gains `{ edgeTint?: boolean; monogramTiles?: boolean }`; exported helper `monogram(name: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/components/relatedHeroStrip.test.ts
import { monogram } from '../../src/components/RelatedHeroStrip';

describe('monogram', () => {
  it('takes the initials of the first two words', () => {
    expect(monogram('Lex Luthor')).toBe('LL');
    expect(monogram('Doctor Victor Von Doom')).toBe('DV');
  });
  it('single word → first two letters', () => {
    expect(monogram('Darkseid')).toBe('DA');
  });
  it('handles punctuation-heavy names', () => {
    expect(monogram('Two-Face')).toBe('TF');
  });
});
```

- [ ] **Step 2: Run it** — FAIL (`monogram` not exported).

- [ ] **Step 3: Implement in `RelatedHeroStrip.tsx`**

```ts
/** Initials for a hero without a resolvable portrait — "Lex Luthor" → "LL". */
export function monogram(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
}
```

Props: add `edgeTint?: boolean; monogramTiles?: boolean` to the component signature. Card wrapper: when `edgeTint`, add `{ borderWidth: 1, borderColor: accent + '4d' }` to the card's style array. Unresolved names: when `monogramTiles`, render each as a card-sized tile instead of a text chip:

```tsx
{monogramTiles ? (
  visibleChips.map((name) => (
    <View key={name} style={[styles.card, styles.monoTile] as object}>
      <Text style={[styles.monoText, { color: accent }] as object}>{monogram(name)}</Text>
      <Text style={styles.cardName} numberOfLines={2}>
        {name}
      </Text>
    </View>
  ))
) : (
  /* existing chip rendering unchanged */
)}
```

Render monogram tiles inside the same horizontal ScrollView as the portrait cards (append after `cards.map`) so shelves read as one row; keep the `+N more` behavior by keeping the slice/expand logic. New styles:

```ts
monoTile: {
  backgroundColor: COLORS.navy + '0d',
  alignItems: 'center',
  justifyContent: 'center',
} as object,
monoText: { fontFamily: 'Flame-Regular', fontSize: 30, lineHeight: 38 },
```

(Flame with no clamp on the monogram — two caps, no descenders; `cardName` is the existing overlay style — check it renders on light ground, otherwise add a translucent navy footer strip behind it in the tile.)

Dedupe guard: unresolved names can repeat in raw data — build `unresolved` through a `Set` to keep keys unique.

- [ ] **Step 4: Run the test** — PASS.

- [ ] **Step 5: Wire the screen** — at the three `RelatedHeroStrip` call sites in `[id].web.tsx`, add `edgeTint monogramTiles`. Native `[id].tsx` untouched.

- [ ] **Step 6: Verify + commit**

`yarn tsc --noEmit && yarn test:ci` → clean/green.

```bash
git add src/components/RelatedHeroStrip.tsx __tests__/components/relatedHeroStrip.test.ts "app/character/[id].web.tsx"
git commit -m "feat(character): relationship shelves — accent edges + monogram tiles"
```

---

### Task 5: Gallery filmstrip fade + Links footer register

**Files:**
- Modify: `app/character/[id].web.tsx` only.

- [ ] **Step 1: Filmstrip fade** — the gallery wrapper (desktop `inPrintGallery` block, `<View style={{ marginRight: -20 }}>`) gets an edge fade so the strip reads as film running off-frame:

```tsx
<View
  style={
    [
      { marginRight: -20 },
      {
        maskImage: 'linear-gradient(90deg, black 82%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(90deg, black 82%, transparent 100%)',
      },
    ] as object
  }
>
```

Mobile: apply the same pair to the mobile gallery wrapper (find via `rg -n "GalleryStrip" "app/character/[id].web.tsx"`).

- [ ] **Step 2: Links → footer register** — desktop: move the Links block below the In Print card (make it the last child of `mainCol`) and swap the card chrome for a quiet register:

```tsx
{heroLinksHasContent(links) ? (
  <View style={styles.linksFooter}>
    <Text style={styles.linksFooterLabel}>Elsewhere</Text>
    <HeroLinksRow links={links!} contentInset={0} />
  </View>
) : null}
```

```ts
linksFooter: {
  borderTopWidth: 1,
  borderTopColor: 'rgba(41,60,67,0.12)',
  paddingTop: 18,
  marginTop: 4,
  gap: 12,
},
linksFooterLabel: {
  fontFamily: 'Nunito_700Bold',
  fontSize: 10,
  letterSpacing: 1.6,
  textTransform: 'uppercase',
  color: 'rgba(41,60,67,0.5)',
},
```

Mobile: find the mobile Links block (`rg -n "Links" "app/character/[id].web.tsx"` in the mSheet region), apply the same footer treatment inside an `mBlock`, and move it to the end of the sheet (before any bottom spacer).

- [ ] **Step 3: Verify + commit**

`yarn tsc --noEmit && yarn test:ci` → clean/green.

```bash
git add "app/character/[id].web.tsx"
git commit -m "tweak(character): gallery filmstrip fade, links drop to a footer register"
```

---

### Task 6: Pass-2 verification sweep

- [ ] **Step 1:** `yarn test:ci && yarn tsc --noEmit` → all green; `rg -n "summaryBox|debutBlock|percentileText" "app/character/[id].web.tsx"` → confirm no orphaned styles remain (delete any).
- [ ] **Step 2:** Hand off for device screenshots (desktop + iOS Safari): `/character/643`, `/character/370`, and one hero with no portrayals/facts (Legend band must collapse gracefully). Do NOT start a dev server. Iterate on feedback before Pass 3.
