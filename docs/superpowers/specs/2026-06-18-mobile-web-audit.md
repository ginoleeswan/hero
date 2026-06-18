# Mobile-web audit — 2026-06-18

Driven live in a real browser at a phone viewport (390×844) against the running
dev server. Goal: find what reads broken on mobile web before a web-community
launch (most community clicks are phones).

## Headline

**Mobile web is in good shape and launch-ready.** Every publicly-reachable
surface renders correctly — no broken layouts, no overflow, no collapsed
components. The core cold-launch loop works on mobile: **land → arena → vote →
share.** The one thing I initially flagged as broken turned out to be a working
feature (see false alarms).

## Surfaces audited live (anonymous)

| Surface | Verdict |
| --- | --- |
| Landing `/` | ✅ Polished; one launch-lane note (CTA priority, below) |
| Explore `/explore` | ✅ Long scroll, ~16 shelves, structurally intact |
| Compare arena `/compare/a/b` | ✅ Solid — clash card, **ArenaVote** ("Who would win?" + buttons), verdict, share, stat rows all compose well |
| Character `/character/644` | ✅ Dense & strong — header + Compare CTA, stat bars, abilities/decoded, real "Did You Know", family tree, enemies/allies, On-Screen + trailer, TV, Portrayed By, In Print |
| Search `/search` | ✅ Clean — field, Marvel/DC/Other filters, Recent, Trending with strong portraits |
| Versus/Arena `/versus` | ✅ Today's Matchup, Surprise Me, Greatest Rivalries, Build Your Own |
| Profile (logged-out) | ✅ "Join the community" + Sign In / Create Account / Ko-fi + disclaimer |
| Login / Signup | ✅ Apple/Google/email, hero art, "Browse without signing in" |
| Family tree (character) | ✅ Pannable canvas w/ zoom controls, typed nodes, legend, variants |

## Findings (prioritized)

### P1 — worth a look before launch
1. **Landing CTA priority is backwards for a web launch.** The primary buttons
   are **App Store** and **Google Play**; **"Try on Web →"** is the de-emphasized
   tertiary link. For a friction-free web-community launch, web should be at least
   co-primary — a stranger from Reddit shouldn't be nudged to install first.
   *Low effort (reorder/restyle the CTAs).* **Mitigation:** mostly moot if shared
   links go deep to `/compare/...` (they do), so most community traffic skips the
   landing entirely. Decide based on whether you'll also share the bare domain.

### P2 — known / already addressed
2. **AI verdicts are off (Gemini spend cap).** Every fresh matchup shows the stat
   fallback ("X takes it — N of 6 stats."), not the punchy AI line. Restore the cap
   and pre-warm verdicts for ~50 marquee pairs so the "wow" is live at launch.
   (Diagnosed earlier; affects every surface that shows a verdict.)
3. **Anon crowd tally** — fixed this session (granted `get_matchup_tally` to
   `anon`); logged-out visitors now see the crowd split instead of a 401.

### False alarms (verified NOT bugs)
- **Family "white box."** Actually the working pannable **family-tree canvas**
  (light dotted background) — renders correctly with zoom controls, kin nodes,
  legend, and the Superboy variant. The tiny full-page thumbnail just made its
  light background look blank.
- **Explore "dark cards"** in the full-page capture — lazy images not yet loaded
  in the instant screenshot, not a real defect; they load on scroll.
- **Search "Recent" odd queries** — leftover dev searches; empty for a fresh user.

## Not verified (out of reach for browser automation)
- **Authed Profile** (favourites, My Contributions, battle record) — the
  automated browser has no Google session, and I won't enter your credentials.
  Needs a quick check on your own logged-in device.
- **Command Center** `/admin/health` — correctly **admin-gated** (redirects anon
  to `/explore`); width-aware in code (`useWindowDimensions`). Not a cold-launch
  surface; verify on your admin login if you care about its mobile layout.
- **Native share image** (`react-native-view-shot`) — can't be driven via the web
  browser; needs a device/TestFlight check.
- **Real mobile Web Share sheet** (`navigator.share({files})`) — works on real
  iOS/Android; desktop automation falls back to the download path (which also
  works, verified).

## Bottom line
No mobile-web blockers. The only genuine pre-launch tweak is the **landing CTA
priority** (and it's conditional on whether you share the bare domain vs deep
matchup links). Everything else is polish or already handled. The app is more
launch-ready on mobile than the original audit's raw DB counts implied.
