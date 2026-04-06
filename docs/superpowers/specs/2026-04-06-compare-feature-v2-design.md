# Compare Feature V2 — Design Spec

## Goal
Transform the hero vs hero compare experience into a dramatic, comic-book-style clash moment with animated portraits, a jagged yellow lightning bolt divider, AI-generated verdict narrative, and smart opponent suggestions.

## Visual Reference
Classic comic book VS panel: two coloured halves split by a thick yellow/gold jagged lightning bolt with black outline. Each half has radial speed lines radiating from its outer edge toward center. Halftone dot overlay denser near the divider. A yellow starburst explosion badge in the center carries the VS text (white, thick black outline). Small decorative lightning bolts and stars scatter around the badge.

---

## 1. Result Screen (`[opponent].tsx` + `[opponent].web.tsx`)

### Portrait Zone (replaces current side-by-side portraits)

**Layout:**
- Full-width, height ~280px native / 320px web
- Left half: hero A background — deep navy-blue (`#0a1a40`) with orange tint overlay
- Right half: hero B background — deep red (`#3a0a0a`) with red tint overlay
- Hero photos fill each half (`contentFit="cover"`, `contentPosition="top"`)
- Bottom gradient on each half fades to black for name legibility

**Speed lines (SVG, react-native-svg):**
- Left half: radial lines fanning from the left outer edge center point
- Right half: radial lines fanning from the right outer edge center point
- ~20–25 lines per side, white at 15–20% opacity
- Rendered as `<Svg>` with `<Line>` elements, positioned `absoluteFill` on each half

**Halftone overlay:**
- CSS `background-image: radial-gradient` repeating dot grid (14×14px spacing)
- Masked to be denser near the divider, fading outward
- Opacity 15–18%
- On native: rendered as a semi-transparent SVG dot pattern or skipped for performance

**Lightning bolt divider (SVG):**
- Positioned absolute, centered horizontally, full height of portrait zone
- Width ~56px
- Shape: thick jagged vertical zigzag path (5–6 zags top to bottom)
- Fill: `#f5a623` (yellow/gold), stroke: `#1a1a1a`, stroke-width 2.5
- Inner highlight path slightly narrower, fill `rgba(255,240,180,0.4)`
- Drop shadow: dark offset path behind main bolt

**VS starburst badge:**
- Centered on the bolt at vertical midpoint
- Yellow starburst SVG polygon (12-point star shape, ~80×80px)
- "VS" text: white, Impact/Flame-Bold, ~28px, thick black outline via text-shadow
- Small decorative lightning bolts (×3) scattered around badge
- Stars (×4–5) scattered around badge

**Hero labels:**
- Winner: top corner of their half — small "Winner" pill, white/translucent
- Loser: top corner — "Lost" pill, dimmed
- Hero name: bottom of their half, white, Flame-Regular 15px

---

## 2. Clash Animation Sequence (react-native-reanimated)

All timings use `withTiming` / `withSpring` / `withSequence`:

| Time | Event |
|------|-------|
| 0ms  | Screen mounts, portraits off-screen (left: `translateX(-110%)`, right: `translateX(+110%)`) |
| 60ms | Both portraits slam in simultaneously — `withTiming(0, { duration: 420, easing: Easing.out(Easing.poly(3)) })` |
| 630ms | Screen shake — `withSequence` of small translateX offsets (±5px, 3 cycles, ~200ms total) |
| 650ms | White flash overlay — opacity 0 → 0.9 → 0 over 200ms |
| 660ms | Lightning bolt crackles in — opacity 0→1, brightness flash via interpolated color |
| 760ms | VS starburst badge pops in — `withSpring(1, { damping: 10, stiffness: 180 })` from scale 0, slight rotation |
| 780ms | Decorative bolts + stars scatter in — staggered `withSpring` per element |
| 950ms | Hero names + winner/loser labels fade in |
| 1050ms | Verdict section rises up — `translateY(10→0)` + `opacity(0→1)` |
| 1200ms | Stat pills fade in |
| 1350ms | "Compare another" button fades in |

Total sequence: ~1.4 seconds

---

## 3. Verdict — AI-Generated Narrative

**Trigger:** Called in parallel with `loadHeroStats`, result awaited before screen renders verdict section.

**Route:** `POST /functions/v1/generate-verdict`

**Request body:**
```json
{
  "heroA": "Batman",
  "heroB": "Spider-Man",
  "winsA": 4,
  "winsB": 2,
  "statsA": { "intelligence": 81, "strength": 26, "speed": 27, "durability": 64, "power": 47, "combat": 64 },
  "statsB": { "intelligence": 75, "strength": 55, "speed": 23, "durability": 42, "power": 36, "combat": 42 }
}
```

**Edge function:** Calls Gemini Flash 2.0 (`gemini-2.0-flash`) with prompt:
```
Batman won 4 of 6 stats (intelligence, speed, durability, power).
Spider-Man won 2 (strength, combat).
Write one punchy sentence declaring Batman the winner. Be dramatic. Max 15 words. No hashtags. No emoji.
```

**Response:** `{ "verdict": "Batman dominates — sharper mind, tougher frame, Spider-Man's strength barely dents it." }`

**Fallback:** If edge function fails or times out (>3s), use local template:
`"${winnerName} takes it — ${winsA} stats to ${winsB}"`

**Loading state:** Verdict section shows a subtle shimmer/skeleton while generating. Does not block the clash animation.

**Environment:** `GEMINI_API_KEY` stored as Supabase Edge Function secret.

---

## 4. Pick Screen Improvements

### Suggested Sections (shown before search grid)

**Section 1 — Classic Rivals**
- Hardcoded map: `heroId → rivalIds[]` for ~30 famous matchups
- Examples: Batman → [Superman, Joker, Bane], Spider-Man → [Green Goblin, Venom, Wolverine]
- Shown as horizontal scrollable row of small portrait cards
- Only shown if current heroId is in the map
- Label: "Classic Rivals"

**Section 2 — Similar Power Level**
- DB query: heroes whose `total_powerstats` is within ±15% of current hero's total
- Sorted by closest total, limit 8
- Same horizontal scrollable row
- Label: "Similar Power Level"
- Only shown if hero has `enriched_at` (has real stats)

**Section 3 — All Heroes grid**
- Same as current 2-column FlatList, but:
  - Filters out the current `heroId` from results
  - Label: "All Heroes"

**Data:** `searchHeroes` already returns `powerstats_total` — use that for similarity query. Add a `getHeroesByPowerRange(min, max, excludeId)` function to `src/lib/db/heroes.ts`.

---

## 5. Files to Create/Modify

| File | Change |
|------|--------|
| `app/compare/[hero]/[opponent].tsx` | Full rewrite of portrait zone + animation sequence |
| `app/compare/[hero]/[opponent].web.tsx` | Same visual, CSS animations instead of reanimated |
| `app/compare/[hero]/pick.tsx` | Add rivals + similar power sections |
| `app/compare/[hero]/pick.web.tsx` | Same |
| `src/lib/db/heroes.ts` | Add `getHeroesByPowerRange()` |
| `src/lib/api.ts` | Add `generateVerdict()` — calls edge function, returns string |
| `src/constants/rivals.ts` | New file — hardcoded rivalId map |
| `src/components/compare/ClashPortraits.tsx` | New — portrait zone + animation (shared between native screens) |
| `src/components/compare/LightningBolt.tsx` | New — SVG lightning bolt divider |
| `src/components/compare/SpeedLines.tsx` | New — SVG speed lines for one panel |
| `src/components/compare/VsBadge.tsx` | New — starburst + VS text + decorations |
| `supabase/functions/generate-verdict/index.ts` | New edge function — Gemini Flash call |
| `supabase/migrations/YYYYMMDDHHMMSS_powerstats_total_index.sql` | Index on powerstats_total for fast range queries |

---

## 6. Not In Scope
- Saving/sharing compare results as images
- Compare history
- Compare from search results page
- Web pick screen suggested sections (native only for now)
