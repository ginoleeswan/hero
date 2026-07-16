# Design audit — command-center screenshot history

`capture.mjs` logs into the command center as an admin, walks **every lane and
sub-lane** at mobile (390×844) and desktop (1440×900), and writes a full-page
screenshot of each view plus a machine-readable horizontal-overflow report into
a dated folder: `history/YYYY-MM-DD/`.

Two jobs:

1. **Regression gate.** The script exits non-zero if any view scrolls
   horizontally (an element pokes past the viewport) or fails to capture, and
   `report.json` names the offending elements. Run it after any command-center
   layout change.
2. **Living history (Mobbin-style).** Each dated folder is a frozen snapshot of
   every admin flow. Commit a snapshot whenever a design pass lands and you get
   a browsable timeline of how the flows evolved — diff any two dates by eye.
   (A proper viewer UI over these folders is a planned follow-up.)

## Running

```sh
MYTHIQUE_AUDIT_EMAIL=… MYTHIQUE_AUDIT_PASSWORD=… node scripts/design-audit/capture.mjs
```

Credentials must belong to an admin account (the command center 404s
otherwise). Use a dedicated audit user, not your personal login, and remove it
when it's no longer needed.

Options (env vars):

| Var | Default | Purpose |
| --- | --- | --- |
| `AUDIT_BASE_URL` | `https://mythique.app` | Target origin (point at a preview deploy or `http://localhost:8081`) |
| `AUDIT_VIEWPORT` | both | `mobile` or `desktop` only |
| `AUDIT_VIEWS` | all 24 | Comma list of `tab` / `tab.sub`, e.g. `command,publish.promote` |
| `AUDIT_SETTLE_MS` | `10000` | Per-page settle before capture — admin queries are slow; below ~10 s you screenshot skeletons |
| `PW_CHROME` | Chrome channel | Explicit Chrome binary path |

Requires `playwright-core` (already a dev dependency) and an installed Chrome.

## Keeping it honest

The view matrix at the top of `capture.mjs` must stay in sync with the
`DOMAINS` registry in `src/components/admin/health/format.ts` — when you add a
lane or sub-tab, add it to the matrix in the same PR.
