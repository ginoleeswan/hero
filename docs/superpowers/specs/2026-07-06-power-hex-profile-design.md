# Power Profile — Hex ⇄ Bars toggle

**Date:** 2026-07-06
**Status:** Approved design, pre-implementation
**Scope:** Web character screen Power Profile band (`app/character/[id].web.tsx`, desktop + mobile-web). One new shared visualization component. Native gets it in a follow-up pass. No schema or data-layer changes.

## Goal

Give the Power Profile a distinctive signature visualization: a **radar hexagon** of the six stats, toggleable with the existing animated bar list. The six-stat count is exactly a hexagon's six axes, so the shape is native to the data. This is Character Dossier improvement #8 (the "radar/hex" swing floated during the original brainstorm and deferred).

## The hexagon

- Six axes, one per stat, in the existing `STAT_CONFIG` order (Intelligence, Strength, Speed, Durability, Power, Combat), each running from center (value 0) to its vertex (value 100).
- The character's values form a **filled polygon**, accent-tinted (`theme.accent` fill at low alpha, accent stroke).
- A **median hexagon** sits ghosted behind it — a faint outline polygon built from `STAT_MEDIANS` (the same catalog-median constants the bars already use) — so the shape reads with context ("spiky intelligence, low strength") the way the bar median ticks do.
- Six **axis spokes** (hairline) from center to each vertex; a light concentric guide ring or two for scale.
- The **count-up numbers** already built label each vertex (stat value in its per-stat color; the small stat label beneath/beside).
- **Animation:** on first scroll-into-view the polygon springs open from center (radius 0 → full) via reanimated, once; numbers count up in sync (reuse the existing count-up logic). Respect `prefers-reduced-motion` — render the settled polygon immediately.

## The toggle

- A small segmented control in the Power Profile band header: `◇ Hex | ▬ Bars`. Accent-tinted active segment.
- Default view is **Hex** (the statement moment); **Bars** is the precise-readout alternate (the existing `PowerStatCell` rows, unchanged).
- Local component state only — no persistence, no URL param.
- Switching is instant (no cross-fade required; a short opacity cross-fade is acceptable polish but not required).

## Rendering & structure

- New component `src/components/character/HexProfile.tsx` (shared folder, pure `react-native-svg` so it works web + native from one file — mirrors how the native `StatDial` already uses `react-native-svg`).
- Props: `{ stats: { key: string; value: number; color: string }[]; medians: Record<string, number>; accent: string; animate: boolean }`.
- Pure geometry helper `hexPoints(values: number[], radius: number): { x: number; y: number }[]` — maps six 0–100 values to polygon vertex coordinates on a hexagon (first axis at 12 o'clock, clockwise). Exported and unit-tested.
- The Power Profile band header gains the toggle; the band body renders `<HexProfile>` or the existing bar `<PowerStatCell>` list based on `view` state. Percentile badge + Compare action + median legend stay in the band footer for both views (the legend text adapts: "catalog median" applies to both the ghost hexagon and the bar ticks).

## Placement / spacing

- Lives **inside** the existing Power Profile band — no new section. The hexagon occupies roughly the vertical space the six bars do, so switching views does not jump the page height materially. On mobile-web the hexagon centers in the band at a size that fits the column width.

## Edge / empty handling

- A stat missing/`0` plots at center on its axis (polygon pinches inward there) — correct and meaningful, no special case.
- `statsGenerating` / loading: keep the existing skeleton; the toggle + hexagon appear only once real stats resolve (same gate as today's bars).
- Admin edit mode (`statsEditing`) shows the existing editable list; the toggle is hidden while editing.

## Components / logic reused

`STAT_CONFIG`, `STAT_MEDIANS`, `theme` (accent), `PowerStatCell` (the Bars view), the existing percentile badge + Compare button + median legend, the reveal/reduced-motion pattern from `PowerStatCell`.

## Testing

Per `CLAUDE.md`, no full-screen render tests. Unit-test the pure geometry:

- `hexPoints` — six equal values → a regular hexagon (all vertices equidistant from center within tolerance); a zero value → that vertex at center; correct vertex count and first-axis orientation. Test in `__tests__/components/hexProfile.test.ts`.

## Guardrails

- Web screen only this pass; new component in `src/components/character/` (shared, RN-primitive + `react-native-svg` only — no web-only APIs, so native can adopt it later).
- Never Flame-Bold; clamped Flame needs lineHeight ≥ 1.22× fontSize (vertex number labels are Flame display — non-clamped, so safe).
- `StyleSheet.create`; canonical props only.

## Delivery

One pass: `hexPoints` + test → `HexProfile` component → wire the toggle into the Power Profile band (desktop + mobile-web) → screenshot verify. Native adoption is a later follow-up (the component is already cross-platform-safe).
