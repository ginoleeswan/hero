# Notifications and push

> Mythique's only re-engagement channel: a once-daily Web Push promoting the
> daily debate, with personalized titles for favourite-holders and
> streak-at-risk players. Read this before adding any notification, and before
> assuming the system is even live — it is deliberately inert until VAPID
> secrets are set.

## Mental model

There is exactly **one channel** (browser Web Push), **one message a day** (the
daily matchup, 15:00 UTC), and **one audience** (signed-in users who flipped
the toggle on the web settings screen). No native push — `expo-notifications`
is not installed — and no email channel. Everything else you might expect from
a "notifications system" (preferences matrix, per-event fan-out, badges) does
not exist, on purpose: the retention mechanics are all daily, so one
well-personalized daily nudge is the whole design.

The moving parts:

| Piece | Path | Role |
| --- | --- | --- |
| Subscription store | `push_subscriptions` table (`supabase/migrations/20260715150000_push_subscriptions.sql`) | endpoint + VAPID keys per browser, owner-scoped RLS |
| Client lib | `src/lib/push.ts` | support check, subscribe/unsubscribe, state for the toggle |
| Service worker | `public/sw.js` | push-only SW — receives the push, opens the app on click |
| Toggle UI | `NotificationsSection` in `app/settings.web.tsx` | the only place a user can opt in |
| Sender | `supabase/functions/send-daily-push/index.ts` | cron-invoked fan-out via `web-push` |
| Schedule | `supabase/migrations/20260715151000_schedule_send_daily_push.sql` | pg_cron, `0 15 * * *` |
| Streak audience | `get_streaks_at_risk` RPC (`supabase/migrations/20260716090000_daily_streaks.sql`) | service-role only |

## Subscribing

`src/lib/push.ts` guards every function on browser support **and** on
`EXPO_PUBLIC_VAPID_PUBLIC_KEY` being set, no-oping elsewhere — so it is
platform-neutral by design and needs no `.web` split. Subscribe requests
permission, subscribes through the service worker, and upserts the row straight
to `push_subscriptions` via supabase-js — **no edge function in the subscribe
path**; the owner-write RLS policy is the whole authorization story. The cron
sender reads all rows with the service-role key, which bypasses RLS.

`public/sw.js` is deliberately push-only: no fetch handler, no caching (a cache
here would risk serving a stale app bundle). It is registered in
`app/+html.tsx` and shows the notification with a click-through URL
(default `/versus`).

**Known gap:** the toggle exists only in `app/settings.web.tsx`. The native
settings screen (`app/settings.tsx`) has no notifications row at all — correct
today (there is nothing a native app could subscribe to), but the row must be
added there if native push ever ships, and until then iOS/Android users have no
notification surface whatsoever.

## Sending

`send-daily-push` runs on pg_cron at 15:00 UTC — well after the daily-debate
roll cron (00:05 UTC), so today's `daily_debate` row is guaranteed present. Per
subscription it picks the sharpest applicable message:

1. **Streak at risk** (wins): users whose daily streak of ≥ 3 ended exactly
   yesterday with nothing today — from the service-role-only
   `get_streaks_at_risk(p_min := 3)` — get "Your N-day streak is on the line".
2. **Favourite-holder**: users who favourited either debated hero get
   "<Hero> is in today's matchup".
3. **Generic**: "Today's matchup: A vs B", body from the debate's `hook_text`.

Delivery hygiene is built in: a successful send stamps `last_ok_at`; a 404/410
means the endpoint is gone and the row is **deleted**; other failures stamp
`failed_at` and the row is retried tomorrow. The function returns
`{ sent, pruned, failed }`.

## The critical gotcha: inert until VAPID secrets exist

The entire system is dormant until the **function secrets**
`VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set on the Supabase project —
`send-daily-push` returns `{ skipped: 'VAPID keys not set' }` and the cron
happily "succeeds" forever. On the client, the matching
`EXPO_PUBLIC_VAPID_PUBLIC_KEY` build-time env is what makes
`isPushSupported()` true; without it the settings toggle silently absents
itself (it renders nothing on unsupported states rather than a dead switch).

So "push is broken" triages in this order: (1) are both function secrets set —
check the function's response body, not the cron status; (2) is the public key
in the web build; (3) only then look at subscriptions and the sender. The
fail-soft posture is intentional (the schedule shipped ahead of key setup),
which is exactly why nothing alarms when the keys are missing.

## History

- `docs/superpowers/specs/2026-07-15-web-push-daily-design.md` — the design.
  Status line says "spec, ready to execute"; it is shipped. The scope
  decisions there (web-only, one message/day, signed-in only, no email) are
  the ones documented above — don't relitigate them without reading it.
- `docs/superpowers/specs/2026-07-15-hardening-execution-plan.md` — the batch
  it shipped in (after Sentry, so push failures are observable).
- `docs/superpowers/specs/2026-07-11-matchup-takes-daily-debate-design.md` —
  the daily debate the push promotes; the streak calendar it nudges is
  `supabase/migrations/20260716090000_daily_streaks.sql`.
