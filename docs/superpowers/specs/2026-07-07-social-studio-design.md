# Social Studio — local GUI for the social content generators

**Date:** 2026-07-07 · **Status:** approved in-session · **Area:** `scripts/social/`

## Problem

Nine runnable generators (4 organic, 4 ad-safe, 1 batch week) are CLI-only — too
much to remember, and it makes weekly posting feel like a chore. The deployed web
command center cannot host this: the generators spawn local Chrome/ffmpeg and
write to local disk.

## Decision

A **local, zero-dependency Node server** (`scripts/social/studio.mjs`, run via
`yarn social` → `http://127.0.0.1:4747`), styled in the Mythique navy/gold so it
feels like part of the command-center family. Not integrated into the deployed
app; no posting APIs; no state beyond the filesystem (+ localStorage for
posted-checkboxes).

## Screen (one page, three zones)

1. **This Week strip** — batch-week button; if `out/social/week-<today>/` exists,
   its posts as thumbnails + a link to the `week.html` planner (served statically
   so its relative images resolve).
2. **Recipe gallery** — every generator as a card: live sample thumbnail from
   `out/social/` (styled placeholder if none yet), track badge (organic/ad-safe),
   one-line "what it makes", posting guidance (where/when).
3. **Generate panel** — clicking a recipe reveals friendly controls mapped to its
   CLI flags (style/size chips, matchup names, metric dropdown, count). One
   Generate button; live log (polled); on completion the new output images render
   inline with an "open folder" action (macOS `open`).

## Mechanics

- `node:http`, bound to 127.0.0.1 only. Routes: `GET /` (page), `GET /api/state`,
  `POST /api/generate` (single job at a time; 409 when busy), `GET /api/log`
  (poll), `GET /file?p=` (image server, path-traversal-safe, `out/social/` only),
  `GET /week/<f>` (this week's folder), `GET /api/open?dir=`.
- Generation **spawns the existing CLIs** as child processes — the CLIs remain
  the single source of truth; the studio duplicates zero rendering/safety logic.
- New outputs detected by mtime > job start under `out/social/`.

## Non-goals

Posting to platforms, auth, persistence, build step, new dependencies.
