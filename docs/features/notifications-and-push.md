# Notifications and push

> Mythique's only re-engagement channel: a once-daily Web Push promoting the
> daily debate, with personalized titles for favourite-holders and
> streak-at-risk players. Read this before adding any notification, and before
> assuming the system is even live — it is deliberately inert until VAPID
> secrets are set.

## Mental model

**One message a day, three surfaces.** The daily matchup goes out at 15:00 UTC
over Web Push (browsers) and Expo Push (devices) from one sender sharing one
message ladder — a reader with a phone and a browser must not be told two
different things about the same day. Beside it sits an on-device streak
reminder that needs no server at all, and an in-app Activity inbox for things
that happened while away.

Still no email, no preferences matrix beyond two switches, and no per-event
fan-out. The retention mechanics are daily, so one well-personalized nudge
remains the whole design.

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

The native settings screen now carries its own rows (`useNotificationSettings`),
and the three permission states are kept distinguishable because the right
control differs for each: **undetermined** gets a switch that raises the real
prompt, **granted** gets a switch we honour, **denied** gets a link into system
Settings — iOS will not re-prompt, and a switch that does nothing when flipped
is worse than no switch.

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

## Native (`expo-notifications`)

`src/lib/notifications/` is the device half. Every RULE lives in `policy.ts` as
pure functions, so what the app is allowed to ask and allowed to send is
testable without a device; `index.ts` beside it is the runtime, a no-op off
native, lazily `require`-ing the native module so a client without it still
boots.

**The ask is a scheduled event, not a mount side effect.** iOS grants exactly
one system prompt per install, and a denial cannot be undone from inside the
app — it needs a trip to Settings nobody makes. So a soft sheet
(`NotificationOptIn`) goes first, at one moment only: straight after a **first
daily win**, with the streak the reader just started on screen. Only a yes there
raises the real prompt; a no is recorded and can be asked again after 30 days.
The sheet states exactly what gets sent, because vague "stay updated" copy is
what trains people to decline by reflex.

**The streak reminder is cancelled as eagerly as it is scheduled.** Play state
syncs on every change, not only on a win: telling someone at 19:00 that their
streak is at risk when they played at 18:00 is the fastest way to lose the
channel, because it is provably wrong and they know it. It also refuses to roll
to tomorrow once its hour has passed — the streak would be gone by then.

**Two gates, always.** An OS grant is not consent to a particular message, so
`notificationsActive` requires the grant AND the in-app switch. Turning the
switch off cancels queued local schedules AND unregisters the device token;
cancelling only the former leaves the cron still arriving.

**Tap routing** (`useNotificationRouting`) handles both entry points — the
response listener for a running app, and the LAST response read once at startup
for a cold launch, which is the one that only shows up on a real device. The
payload is untrusted: it arrives through the OS, so only rooted in-app paths are
followed and absolute or protocol-relative URLs are refused.

**The Android status-bar icon is generated**, not hand-exported
(`scripts/brand/build-notification-icon.mjs`), from the same `MARK_PATH` the OG
cards use. Android masks that asset and discards the colour, so a full-colour
logo renders as a white blob; the generator asserts a real silhouette with
transparency around it.

### The Expo Push leg

`send-daily-push` reads `device_push_tokens` alongside `push_subscriptions` and
picks from the same ladder for both. Hygiene mirrors the web leg because the
failure modes are the same shape under different names: `DeviceNotRegistered` is
Expo's 404/410 and DELETES the row; anything else stamps `failed_at` for
tomorrow; a batch that never left stamps every token in it rather than guessing
which the service saw. Expo caps a request at 100 messages.

**VAPID gates the web leg only.** It used to return early for the whole
function, which was right when web was the only transport and wrong the moment a
second one existed — that early return would silence native forever on a project
that simply had not set the web keys.

### Not yet live

Two things outside this repo:

1. **`supabase/migrations/20260812180000_device_push_tokens.sql` is written but
   NOT applied.** Until it is, `database.generated.ts` does not know the table,
   so `deviceToken.ts` states the row contract explicitly and reaches it through
   a narrow typed view. **Regenerate the types and delete that shim** once the
   migration lands.
2. **APNs credentials and a native rebuild.** `expo-notifications` is a native
   module; none of this reaches a dev client over OTA.

## The Activity inbox

`app/notifications.tsx`, reached from the profile with an unread pill.

**Derived, not stored.** Every item is already a fact in another table — a
take's agree count, yesterday's resolved debate, the local streak — and a second
copy of a fact is a thing that can disagree with the first. The device keeps one
marker (`inbox_seen_v1`: when the inbox was last opened, plus the agree counts
seen then) and the items are the difference. The trade: nothing older than the
marker can be shown, and clearing app storage clears the inbox — fine for a feed
whose items expire within a day or two.

The rules worth knowing are the ones about **staying quiet**, all in
`lib/notifications/inbox.ts` with tests: agreement reports the DELTA (a take
sitting at twelve is not news every time the inbox opens), a withdrawn agree
reports nothing rather than a negative, a resolved debate reports once, and a
broken one-day streak is not a loss worth mentioning.

The marker is written when the list has **rendered**, not when it was fetched —
a badge that clears because something prefetched in the background is a badge
nobody trusts.

## The rating ask

`src/lib/review/` + `src/hooks/useReviewPrompt.ts`, same shape as the
notification system: a pure `policy.ts` with all the rules and tests, an
`index.ts` that is inert off native and `require`s `expo-store-review` lazily.

iOS silently rate-limits the in-app review sheet to **three appearances per app
per year and does not tell you when it swallowed one** — `requestReview()`
resolves identically either way. An app that asks eagerly therefore does not get
more reviews, it gets the same three asks spent on whoever happened to open the
app that week. So the ask is spent deliberately:

- **Two triggers, both earned:** a daily streak of 5, or a third finished arena
  battle (landing on a resolved verdict having already picked a side — arriving
  without a pick is browsing).
- **A week's grace** from the first open, stamped at the root by `noteAppOpened`
  so it measures a real install date.
- **120 days between asks**, and **two per rolling year** — under the OS's own
  three, so our ask is never the one iOS discards.
- **`blocked` is the caller's veto.** Policy cannot see whether a sheet is
  already on screen, so it takes that as input. The daily game passes
  `optIn.offering`: the notification pre-prompt and the rating ask must never
  stack. They are separated by construction anyway — the notification prompt
  fires at a streak of 1, this one at 5.

A raised ask is recorded as spent whether or not the sheet appeared, because
there is no way to tell. Treating a swallowed ask as unspent and retrying is how
an app burns all three slots in a fortnight.
