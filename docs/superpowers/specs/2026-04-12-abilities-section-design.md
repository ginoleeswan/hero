# Abilities Section — Design Spec

**Date:** 2026-04-12
**Status:** Approved

---

## Overview

Add a visual Abilities section to the character detail screen that displays a hero's named powers sourced from the ComicVine API. Powers are stored in Supabase for enriched heroes (instant load) and fetched live from ComicVine for unenriched heroes (same fallback pattern as `summary`).

---

## Data Layer

### Migration

New file: `supabase/migrations/YYYYMMDDHHMMSS_add_hero_powers.sql`

```sql
ALTER TABLE heroes ADD COLUMN powers text[] NULL;
```

After applying, regenerate `src/types/database.generated.ts` via the Supabase MCP tool.

### Type changes

**`src/types/index.ts`** — extend `HeroDetails`:
```ts
export interface HeroDetails {
  summary: string | null;
  publisher: string | null;
  firstIssueId: string | null;
  powers: string[] | null;       // ← new
}
```

**`src/lib/api.ts`** — `fetchHeroDetails`:
- Add `powers` to ComicVine `field_list`
- ComicVine returns `powers` as `Array<{ name: string }>` — map to `string[]`
- Return `powers: result.powers?.map((p: { name: string }) => p.name) ?? null`

**`src/lib/db/heroes.ts`** — `heroRowToCharacterData`:
- Map `hero.powers` into `details.powers`

### Data flow

```
Character opens
  → getHeroById()
      enriched + has powers  → details.powers from DB   (instant)
      enriched, no powers    → fetchHeroDetails() in bg (skeleton shown)
      not enriched           → fetchHeroDetails() via API fallback
  → fetchHeroDetails() (ComicVine)
      → details.powers = string[] | null
```

No new write-back logic is needed on the client — the enrichment pipeline (existing) will populate `heroes.powers` when it enriches heroes.

---

## Icon Mapping

New file: `src/constants/powerIcons.ts`

```ts
export interface PowerIconDef {
  icon: string;   // Ionicons icon name
  color: string;  // orb gradient accent colour (from COLORS or hex)
}

export const POWER_ICONS: Record<string, PowerIconDef> = { ... };
export const POWER_ICON_FALLBACK: PowerIconDef = { icon: 'star', color: COLORS.orange };
```

**Matching strategy:** case-insensitive substring match against the keys. "Enhanced Strength" matches key `"strength"`. First match wins.

**Coverage target:** ~60 entries covering the most common ComicVine power names across categories:

| Category | Example keys |
|---|---|
| Physical | strength, speed, flight, agility, stamina, reflexes, durability |
| Mental | telepathy, telekinesis, mind control, precognition, intelligence |
| Energy | energy projection, heat vision, laser, electricity, fire, ice, freeze |
| Defensive | invulnerability, healing, regeneration, immortality, force field |
| Sensory | x-ray vision, super senses, night vision, sonar |
| Transformation | shapeshifting, size manipulation, intangibility, invisibility |
| Misc | time manipulation, teleportation, magic, stealth, web, symbiote |

Unmapped powers use the fallback (`star` icon, orange).

---

## UI Component

### `src/components/AbilitiesSection.tsx`

**Props:**
```ts
interface Props {
  powers: string[] | null;
  loading: boolean;
}
```

**Behaviour:**
- `loading === true` → render 4 skeleton orbs (same skeleton style as rest of app)
- `powers === null || powers.length === 0` → render nothing (section hidden)
- `powers.length > 0` → render section

**Layout — collapsed (default):**
- Section header matching existing `Section` component pattern (`"Abilities"` title + divider)
- Horizontal `ScrollView` (no scroll indicator) showing first 8 orbs
- If `powers.length > 8`, a `+N` orb at position 9 styled identically to power orbs but with a count label instead of an icon

**Layout — expanded (after tapping +N):**
- Replace horizontal scroll with a wrapped flex grid (`flexWrap: 'wrap'`, 4 columns)
- Shows all powers
- A `"Show less"` link collapses back to scroll view

**Orb spec:**
- 64×64px circle
- Radial gradient background: sphere-style — light tint at centre, saturated accent colour at edge (e.g. `radial-gradient(135deg, #ff8a8a 0%, #c0392b 100%)`)
- Bold filled white SVG icon centred (26×26px, `fill: white`)
- Power name label below (9px, uppercase, `Flame-Regular`, `COLORS.navy`, max 2 lines)
- Orb item width: 72px (orb + label)

**Gradient colours** come from the power's `PowerIconDef.color`. Each colour maps to a two-stop radial gradient: `light variant → saturated variant`.

---

## Character Screen Integration

**`app/character/[id].tsx`**

- Import `AbilitiesSection`
- Slot between the Power Stats `Section` and the Overview `Section`
- Pass `powers={data.details.powers}` and `loading={comicVineLoading}`

```tsx
<Section title="Power Stats">...</Section>

<AbilitiesSection
  powers={data.details.powers}
  loading={comicVineLoading}
/>

<Section title="Overview">...</Section>
```

No other changes to the character screen are needed.

---

## What is NOT in scope

- Writing powers back to Supabase from the client (handled by enrichment pipeline)
- Enrichment pipeline changes (separate concern)
- Web support (ComicVine calls are already native-only in the codebase)
- Ability descriptions or detail views

---

## Files changed

| File | Change |
|---|---|
| `supabase/migrations/YYYYMMDDHHMMSS_add_hero_powers.sql` | New — add `powers text[]` column |
| `src/types/database.generated.ts` | Regenerated — never edit manually |
| `src/types/index.ts` | Add `powers` to `HeroDetails` |
| `src/lib/api.ts` | Fetch + parse powers from ComicVine |
| `src/lib/db/heroes.ts` | Map `hero.powers` in `heroRowToCharacterData` |
| `src/constants/powerIcons.ts` | New — icon map + fallback |
| `src/components/AbilitiesSection.tsx` | New — orb row component |
| `app/character/[id].tsx` | Add `AbilitiesSection` between stats and overview |
