# /explore Web Home — Phase 1 Overhaul Design Spec

**Date:** 2026-06-09  
**Branch:** master  
**Phase:** 1 of 2 — Polish & Elevate

---

## Design Philosophy

**Do not retheme. Elevate what's already there.**

The existing design language — warm beige + deep navy + orange — is a genuine differentiator. The VS Arena and Pick page are already world-class: vibrant illustrated portraits against warm surfaces, with the navy stage / beige sheet split creating natural hierarchy. The `/explore` home needs to inherit that same drama, not be replaced with a generic glass/dark aesthetic.

The illustrated portrait art has rich, saturated backgrounds (Spider-Man red, Wolverine yellow, Batman black). These pop against beige. A dark canvas would compete with them. Beige is neutral and defers to the artwork — that's a feature.

**Glass is used selectively, not globally:**
- The top nav: tighten existing blur treatment
- The spotlight info panel overlay: one glass surface, high impact

Everything else stays within the existing palette.

---

## Core Pattern: Dark Stage → Beige Canvas

The Pick page and VS Arena already nail this: navy at the top (the dramatic "stage"), beige below (the informational "sheet"). This pattern comes to `/explore`:

- **Top section** (nav + spotlight + stat pods + ticker): dark navy stage
- **Carousels and content below**: existing beige canvas, existing dark/light alternating rhythm preserved

---

## Phase 1 Scope

Seven changes, in implementation order:

1. **Glass Nav** — tighten TopNav blur, move publisher pills inline, darken bg
2. **Dark stage section** — top area of explore gets navy bg before transitioning to beige
3. **Cinematic Spotlight redesign** — taller, glass info overlay, atmospheric orbs
4. **Stat Pods** — 4 cards on the dark stage
5. **Pulse Ticker** — orange strip as the transition between dark stage and beige canvas
6. **Ranking Cards with stat bars** — new card variant for strength/intelligence rows
7. **New DB queries** — `getTopHeroByStat`, `getPublisherCounts`

---

## 1. Glass Nav

**File:** `src/components/web/TopNav.tsx`

### Visual changes

- **Background:** darken from `rgba(41,60,67,0.92)` → `rgba(11,24,32,0.88)`. Deeper, more premium. Blur stays at `blur(24px)`.
- **Border bottom:** `rgba(255,255,255,0.09)` (slightly more visible against deeper bg).
- **Publisher pills** (desktop only, new): rendered inline between logo and search field. Only shown when `pathname === '/explore'`. Uses existing `setPublisher` / `router.push` logic from the `filterStrip` block in `explore.web.tsx`.
  - Inactive pill: `background: rgba(255,255,255,0.05)`, `border: 1px solid rgba(255,255,255,0.1)`, `color: rgba(245,235,220,0.5)`, `borderRadius: 20`, `paddingHorizontal: 14`, `paddingVertical: 6`, `fontSize: 11`.
  - Active pill: `background: rgba(231,115,51,0.18)`, `border: 1px solid rgba(231,115,51,0.45)`, `color: COLORS.orange`.
  - Hover: `background: rgba(255,255,255,0.09)`.
- **Avatar dropdown:** `backgroundColor: '#0b1820'` instead of `COLORS.navy`.

### Behaviour — unchanged

All existing search logic, outside-click handling, mobile search icon, sign-in button remain identical.

---

## 2. Dark Stage Section

**File:** `app/(tabs)/explore.web.tsx`

The root background stays `COLORS.beige` — the carousels own that surface. The dark stage is a **wrapper View** that wraps the Spotlight + StatPods. It sits between the nav and the Pulse Ticker.

```tsx
<View style={styles.darkStage}>
  <PortraitStripSpotlight … />
  <StatPods … />
</View>
<PulseTicker … />
{/* Beige carousel content below */}
```

`darkStage` style:
- `backgroundColor: '#0b1820'`
- `paddingBottom: 32`
- No border radius — it meets the ticker flush

**Remove `filterStrip`** from `explore.web.tsx` entirely. Publisher filter moves into TopNav.

**`DarkHomeRow` stays** — the alternating dark/light rhythm in the carousel section is preserved exactly as-is. The only change is the top of the page before the carousels.

---

## 3. Cinematic Spotlight Redesign

**Component:** `PortraitStripSpotlight` inside `app/(tabs)/explore.web.tsx`

### Desktop changes

**Height:** increase from current `Math.min(320, windowHeight * 0.6)` → `Math.min(460, windowHeight * 0.58)`. More cinematic.

**Background:** the dark stage wraps it, so the spotlight itself can be transparent or use a subtle gradient overlay — `background: linear-gradient(135deg, rgba(20,48,65,0.5), transparent)` as an orb layer.

**Atmospheric orbs** (absolutely positioned `pointerEvents: 'none'` Views inside the spotlight):
- Orb A: `width: 320, height: 320`, `background: 'radial-gradient(circle, rgba(231,115,51,0.10), transparent 70%)'`, `top: -60, left: 140`
- Orb B: `width: 220, height: 220`, `background: 'radial-gradient(circle, rgba(21,161,171,0.07), transparent 70%)'`, `top: 80, right: 180`

**Glass info panel** replaces the current solid-navy `panel` View:
- `position: 'absolute'`, `bottom: 24`, `right: 24` (on desktop)
- `background: 'rgba(11,24,32,0.75)'`
- `backdropFilter: 'blur(18px)'`, `WebkitBackdropFilter: 'blur(18px)'`
- `border: '1px solid rgba(255,255,255,0.12)'`
- `borderRadius: 16`
- `padding: { vertical: 20, horizontal: 24 }`
- `minWidth: 240`, `maxWidth: Math.min(340, width * 0.32)`

Panel contents (top to bottom):
1. Eyebrow: `"Featured Hero"` — `fontSize: 8, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.orange, fontFamily: 'Nunito_700Bold'`
2. Hero name — `fontFamily: 'Flame-Regular', fontSize: 28, color: COLORS.beige, lineHeight: 32, marginBottom: 4`
3. Publisher — `fontSize: 9, color: 'rgba(245,235,220,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: 'Nunito_700Bold', marginBottom: 10`
4. Summary — if `hero.summary`, `fontSize: 12, color: 'rgba(245,235,220,0.65)', lineHeight: 19, fontFamily: 'Nunito_400Regular', numberOfLines: 3, marginBottom: 14`
5. Mini stat row — if any stat present, show 3 pills: Intelligence / Strength / Speed. Each pill: `background: 'rgba(255,255,255,0.07)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5`. Stat value: `fontSize: 14, fontWeight: '700', color: COLORS.orange`. Stat key: `fontSize: 7, color: 'rgba(245,235,220,0.4)', textTransform: 'uppercase', letterSpacing: 0.8`. Display as `flexDirection: 'row', gap: 8, marginBottom: 14`.
6. "View Profile →" CTA — existing orange pill style, unchanged.
7. Dot navigation row — existing, unchanged.

The existing `panel`, `panelLabel`, `panelName`, `panelPub`, `panelSummary`, `panelFooter`, `ctaBtn`, `ctaBtnText`, `dots`, `dot`, `dotActive` styles are **replaced** by the glass panel styles above.

### Mobile layout — unchanged

The existing mobile layout (portrait + info side by side in a 240px row) is adequate for Phase 1. It does not move onto the dark stage; mobile keeps `paddingHorizontal` wrapping.

---

## 4. Stat Pods

**New file:** `src/components/web/home/StatPods.tsx`

Four cards on the dark stage, below the spotlight. They tell data stories about the encyclopedia.

### Cards

| Card | Eyebrow | Primary value | Subline | Data | Nav |
|---|---|---|---|---|---|
| 1 | Encyclopedia | hero count | Publisher split (e.g. "1,340 Marvel · 906 DC") | `heroCount`, `publisherCounts` | `/search` |
| 2 | Strongest | hero name | `"Strength: 100"` | `strongestHero` | `/character/{id}` |
| 3 | Brightest Mind | hero name | `"Intelligence: {val}"` | `smartestHero` | `/character/{id}` |
| 4 | Fastest | hero name | `"Speed: {val}"` | `fastestHero` | `/character/{id}` |

### Visual

Cards sit on the dark stage — their surface is a slightly lighter dark glass:
- `background: 'rgba(255,255,255,0.05)'`
- `border: '1px solid rgba(255,255,255,0.08)'`
- `borderRadius: 14`
- `padding: 18`
- Hover: `background: 'rgba(255,255,255,0.08)'`, `transition: 'background 150ms ease'`, `cursor: 'pointer'`

Eyebrow: `fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(245,235,220,0.35)', fontFamily: 'Nunito_700Bold', marginBottom: 8`

Primary value: `fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.beige, marginBottom: 4`

Subline: `fontSize: 10, color: 'rgba(245,235,220,0.45)', fontFamily: 'Nunito_400Regular'`

Layout: `flexDirection: 'row', gap: 10` on desktop (4 columns), `flexWrap: 'wrap'` on tablet (2×2), single column on mobile.

### Props

```ts
interface StatPodsProps {
  heroCount: number | null;
  publisherCounts: { marvel: number; dc: number; other: number } | null;
  strongestHero: { id: string; name: string; strength: number | null } | null;
  smartestHero: { id: string; name: string; intelligence: number | null } | null;
  fastestHero: { id: string; name: string; speed: number | null } | null;
  onNavigate: (path: string) => void;
}
```

All nullable — renders gracefully with placeholder dashes when data is loading.

---

## 5. Pulse Ticker

**New file:** `src/components/web/home/PulseTicker.tsx`

The visual transition between dark stage and beige canvas. Orange background strip — same as the landing page marquee. Auto-scrolling text.

### Content

```
{heroCount} Heroes & Villains  ·  Marvel, DC & Beyond  ·  Powers, Origins & First Appearances  ·  500+ Teams & Affiliations  ·  {newlyAddedCount} Recently Added  ·
```

Duplicated once in the DOM for seamless looping. Animation via `Animated.loop` + `Animated.timing` on `translateX`, `toValue: -50%` of measured content width, 28s duration, linear. Same pattern as `LandingPage.tsx`.

### Props

```ts
interface PulseTickerProps {
  heroCount: number;
  newlyAddedCount: number;
}
```

### Styles

- `backgroundColor: COLORS.orange`
- `paddingVertical: 10`
- Text: `fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.88)'`

---

## 6. Ranking Cards with Stat Bars

**New file:** `src/components/web/home/RankingCard.tsx`

A variant of `RowCard` with a stat bar at the bottom. Used only in the "Strongest Heroes" and "Brightest Minds" rows.

### Props

```ts
interface RankingCardProps {
  hero: Hero;
  statKey: 'strength' | 'intelligence' | 'speed';
  onPress: () => void;
}
```

### Visual

Same dimensions as `RowCard` (220×310). The name overlay shifts up by 20px to make room for the bar area at the bottom of the card:

- Stat bar container: `height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginHorizontal: 10, marginBottom: 6, overflow: 'hidden'`
- Filled bar: `width: \`${hero[statKey] ?? 0}%\``, `background: COLORS.orange`, `height: 3`, `borderRadius: 2`
- Stat label below bar: `fontSize: 9, color: 'rgba(245,235,220,0.5)', fontFamily: 'Nunito_700Bold', textAlign: 'center', marginBottom: 6` — e.g. `"STR 100"`

`HomeRow` gains an optional `statKey` prop. When present, it renders `RankingCard` instead of `RowCard`. The two ranking rows ("Strongest Heroes" and "Brightest Minds") pass `statKey='strength'` and `statKey='intelligence'` respectively. All other rows use `RowCard` unchanged.

---

## 7. New DB Queries

**File:** `src/lib/db/heroes.ts`

```ts
// Single hero with highest value for the given stat field
export async function getTopHeroByStat(
  stat: 'strength' | 'intelligence' | 'speed',
): Promise<Pick<Hero, 'id' | 'name' | 'strength' | 'intelligence' | 'speed'> | null>
// Implementation: .select('id,name,strength,intelligence,speed')
//   .not(stat, 'is', null).order(stat, { ascending: false }).limit(1)

// Hero counts grouped by publisher
export interface PublisherCounts { marvel: number; dc: number; other: number }
export async function getPublisherCounts(): Promise<PublisherCounts>
// Implementation: 3 parallel count queries
//   Marvel: .ilike('publisher', '%marvel%')
//   DC:     .ilike('publisher', '%dc%')
//   Other:  total - marvel - dc
```

---

## Data loading in explore.web.tsx

Add to the existing parallel fetch waterfall in `useEffect`:

```ts
getTopHeroByStat('strength').then(set('strongestHero')).catch(() => {});
getTopHeroByStat('intelligence').then(set('smartestHero')).catch(() => {});
getTopHeroByStat('speed').then(set('fastestHero')).catch(() => {});
getPublisherCounts().then(set('publisherCounts')).catch(() => {});
```

Add to `HomeData` interface:
```ts
strongestHero: Pick<Hero, 'id' | 'name' | 'strength' | 'intelligence' | 'speed'> | null;
smartestHero:  Pick<Hero, 'id' | 'name' | 'strength' | 'intelligence' | 'speed'> | null;
fastestHero:   Pick<Hero, 'id' | 'name' | 'strength' | 'intelligence' | 'speed'> | null;
publisherCounts: PublisherCounts | null;
```

---

## Final Page Layout (Phase 1)

```
[Glass TopNav — sticky, blur(24px), deepNavy bg, publisher pills]
──────────────────────────────────────────── dark stage (#0b1820)
[Cinematic Spotlight — taller, glass info overlay, atmospheric orbs]
[Stat Pods — 4 glass cards]
──────────────────────────────────────────── orange ticker strip
──────────────────────────────────────────── beige canvas (unchanged)
[Jump Back In — personal, if logged in]
[Your Favourites — personal, if logged in]
[Most Iconic carousel]                       ← beige HomeRow
[Villains carousel]                          ← dark DarkHomeRow (unchanged)
[Marvel Universe carousel]                   ← beige HomeRow
[DC Universe carousel]                       ← beige HomeRow
[Anti-Heroes carousel]                       ← dark DarkHomeRow (unchanged)
[Strongest Heroes — RankingCard, stat bars]  ← beige HomeRow
[X-Men carousel]                             ← dark DarkHomeRow (unchanged)
[Brightest Minds — RankingCard, stat bars]   ← beige HomeRow
[Recently Added carousel]                    ← beige HomeRow
[Footer rule]
```

---

## What does NOT change

- `RowCard` — unchanged
- Carousel scroll logic, `useCarouselScroll`, arrow buttons — unchanged
- `DarkHomeRow` and its dark/light alternating rhythm — unchanged
- `SearchSuggestions`, search context, search behaviour — unchanged
- Mobile web layouts throughout — unchanged
- Auth flow, `WebHomeSkeleton` — unchanged
- All existing `src/lib/db/` functions except the two new ones added

---

## Files changed summary

| File | Change |
|---|---|
| `src/constants/colors.ts` | Add `deepNavy: '#0b1820'` |
| `src/components/web/TopNav.tsx` | Darken bg, add publisher pills, dropdown bg update |
| `app/(tabs)/explore.web.tsx` | Dark stage wrapper, remove filterStrip, spotlight redesign, wire new sections and data |
| `src/lib/db/heroes.ts` | Add `getTopHeroByStat`, `getPublisherCounts` |
| `src/components/web/home/PulseTicker.tsx` | New |
| `src/components/web/home/StatPods.tsx` | New |
| `src/components/web/home/RankingCard.tsx` | New |
