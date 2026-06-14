# Mythique Command Center — Design

**Date:** 2026-06-14
**Status:** Approved (design phase)
**Scope:** Complete overhaul of the admin Catalog Health page (`app/admin/health.web.tsx`)
into a dense, multi-domain command center for the Mythique application.

## Goal

Reframe the existing Catalog Health dashboard as a true operational **command center**:
a single, high-density console where an operator sees every live signal at a glance and
drills into any domain without hunting. Architected for the **hybrid** scope — redesign
today's catalog/enrichment ops now, with first-class room to drop in future app-wide
domains (Users, Traffic) later.

This is a **presentation + architecture** overhaul. The data layer
(`src/lib/db/catalogHealth.ts`, `hooks.ts`) is correct and stays untouched; we rearrange
and re-skin how it is shown, and we break up the oversized screen file.

## Decisions (settled during brainstorming)

1. **Scope:** Hybrid — redesign existing ops, architect for future app-wide signals.
2. **Layout:** A+B hybrid — a persistent command **rail** switches domains; each domain
   renders as a dense **bento** canvas; a vitals **ribbon** is pinned across all domains.
3. **Density:** Maximum. Data-ink over chrome; tight type/spacing scale.
4. **Skin:** Dark chrome (rail + top bar + ribbon) framing warm light paper data panels.

## 1. Information architecture

Today's three tabs (Overview / Backfill / Operations) become **four domains** on a
persistent left rail, plus dimmed future slots and a pinned refresh:

| Rail icon | Domain | Contents |
|-----------|--------|----------|
| ⌂ | **Command** (home) | Read-only glance: overall completeness gauge + coverage bars, completeness trend sparkline, top-of-queue preview, alignment donut, spend sparkline. Each tile deep-links into its domain. |
| ▤ | **Catalog** | Full coverage list (tap a metric → loads its queue), paginated backfill queue with publisher filter, publisher coverage heatmap, distributions (alignment + power). |
| ⚙ | **Operations** | Run controls (batch size · run · retry failed · auto-drain toggle), active run + stop, run history, activity log, hero console (search + re-enrich). |
| $ | **Spend** | Full Gemini/GCP spend detail (month-to-date, 28-day, per-service, daily bars). |
| ◔ / ◷ | **Users / Traffic** (dimmed, below a divider) | Placeholder domains rendering a "coming soon" empty state. Expansion room for the hybrid plan. |
| ↻ | Refresh | Pinned at the rail bottom. |

**Pinned chrome (visible in every domain):**
- **Top bar** — brand (`MYTHIQUE · Command Center`) + a small overall completeness gauge.
- **Vitals ribbon** — live ops signals: Backlog (+ETA) · ComicVine (usage + health) ·
  Run (active/idle + stop) · Auto-drain (on/off) · Spend MTD. This is the existing
  `VitalsBar`, restyled for the dark ribbon.

**Alerts** (rate-limit, failed heroes, last-run error) render directly under the ribbon,
visible in every domain, exactly as today (collapsed worst-first on mobile).

### Calls made
- **Spend** is its own rail domain rather than nested under Operations.
- **Command** home is read-only; all mutating actions live in Operations, keeping the
  glance calm and safe.

## 2. Visual skin

- **Chrome (dark):** rail, top bar, and vitals ribbon use `#0b1a22`/`#10242e`
  (`COLORS.deepNavy` family). Active rail item = `COLORS.orange`. Dimmed future items at
  ~35% opacity.
- **Data panels (light):** warm paper (`#fffdf8`) cards on the beige canvas
  (`COLORS.beige` `#f5ebdc`), hairline borders `rgba(41,60,67,0.06–0.08)`. Dark-on-light
  for maximum number scan-ability.
- **Accents retained:** orange (portraits), blue (summaries/publishers), gold (first
  issue), green (powerstats/healthy), red (failures/limited).
- Fonts per project rules: `Flame-Regular` for display figures, `FlameSans-Regular` /
  `Nunito_*` for UI text. **Never `Flame-Bold`.**

## 3. Density system

A shared compact scale (new `density.ts` or constants block in `format.ts`):
- Panel padding `10–12px`, radius `10`, hairline borders.
- Label type `10–11px` (Nunito bold, letter-spaced); values via `Flame-Regular`.
- Queue/list row height ~`28px`; sub-rows ~`22px`.
- Bento gaps `8–10px`.
- Goal: the Command home fits its glance above the fold on a typical desktop viewport.

## 4. Component architecture

`app/admin/health.web.tsx` is currently **1,741 lines** — too large to reason about or
edit reliably. Decompose into focused units:

```
app/admin/health.web.tsx          thin shell: admin gate, top-level state,
                                   useCatalogQueries/Actions wiring, domain router

src/components/admin/health/
  CommandShell.tsx                 dark chrome: TopBar (brand + mini gauge) +
                                   Rail (desktop) / BottomTabBar (mobile) +
                                   pinned vitals ribbon slot + alerts slot
  Panel.tsx                        shared dense card primitive (title/hint/children)
  Bento.tsx                        responsive bento grid wrapper (cols → 1 on narrow)
  domains/CommandHome.tsx          the glance bento (read-only, deep-links)
  domains/CatalogDomain.tsx        coverage + backfill queue + publisher heatmap + distributions
  domains/OperationsDomain.tsx     run controls + active run + history + activity log + hero console
  domains/SpendDomain.tsx          spend detail (from current SpendCard)
  domains/PlaceholderDomain.tsx    "coming soon" empty state for Users/Traffic

  VitalsBar.tsx                    reused, restyled into the dark pinned ribbon
  charts.tsx                       reused (Gauge, Donut, BarRow, CompletenessChart)
  RunHistory.tsx                   reused
  atoms.tsx                        reused (Chip, etc.)
  format.ts                        reused; DOMAINS replaces TABS; density constants
  hooks.ts                         reused UNCHANGED (queries/actions/log)
  Masthead.tsx                     RETIRED (replaced by CommandShell TopBar + CommandHome)
```

**State:** `tab: TabKey` becomes `domain: DomainKey`. `metric` / `page` / `pubFilter`
still drive the Catalog domain; `batchSize` drives Operations. Existing deep-link helpers
(`pickPublisher`, `goToBackfill`) are preserved and re-pointed at the Catalog domain.

**Data flow:** unchanged. `useCatalogQueries`, `useCatalogActions`, `useActivityLog` are
lifted into the shell and their outputs passed down to domain panels as props. The
run→activity-log streaming effect, fast-poll-while-running, and realtime
`enrichment_runs` invalidation all move with the shell verbatim.

## 5. Responsive behaviour

Breakpoint stays `narrow < 760`:
- **Rail → bottom tab bar** (reuse the existing `BottomTabBar` pattern, extended to the
  four domains; the pending badge stays on Catalog).
- **Bento → single prioritized vertical scroll** per domain.
- **Vitals ribbon → horizontal scroll / wrap** so all cells stay reachable.
- Top bar shrinks (mini gauge, condensed brand), matching today's narrow masthead.

## 6. Preserved capabilities

All current behaviour is retained, relocated into the correct domain:
drain, retry failed, stop run, snapshot now, re-enrich hero, auto-drain cron toggle,
scoped manual refresh, alerts (rate-limit / failed / last-run error), activity log with
live run streaming, realtime run invalidation, publisher drill-down, coverage→queue
deep-links, completeness snapshots, alignment + power distributions, publisher heatmap,
Gemini/GCP spend.

## Out of scope (YAGNI)

- No new backend/RPCs, no schema changes, no new data sources. Users/Traffic domains ship
  as empty placeholders only.
- No change to the admin auth gate or routing beyond the in-page domain router.
- Native (iOS/Android) parity beyond the existing web-first `.web.tsx` is not addressed
  here; this file is web-targeted as today.

## Success criteria

- Single-screen command center: every live ops signal visible without switching domains.
- Command home reads at a glance and deep-links into each domain.
- No screen file over ~400 lines; data layer untouched; all existing actions work.
- Fully responsive to one column at `< 760`.
- Visual: dark chrome + light dense panels, on-brand, no `Flame-Bold`.
