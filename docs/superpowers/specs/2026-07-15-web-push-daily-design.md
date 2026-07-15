# Web push — daily-debate re-engagement channel

**Status:** spec, ready to execute
**Priority:** 2 of 4 in the 2026-07-15 hardening batch (see `2026-07-15-hardening-execution-plan.md`)
**Size:** large (1 PR + owner setup). Execute AFTER the Sentry PR (push failures should be observable).

## Problem

All of Mythique's retention mechanics are daily — daily debate/matchup, daily
team battle — but there is **no re-engagement channel**: no push (no
`expo-notifications`, no service worker), no email. Nothing brings a user back
tomorrow.

## Scope decisions (made deliberately — don't relitigate during execution)

- **Web push only, v1.** Mobile-web is the product surface; native push needs
  `expo-notifications` + store-build round-trips — later phase.
- **Signed-in subscribers only, v1.** The opt-in lives in Settings (already
  auth-gated: `settings.web.tsx:144` redirects guests). This keeps the table on
  the standard RLS owner pattern and enables personalization. Anonymous
  subscriptions (the `voter_key` pattern) are a later phase.
- **Daily debate only, v1.** It is the one daily surface that is
  server-authoritative (`daily_debate` table, row guaranteed by the
  `daily-debate-roll` cron at 00:05 UTC). The daily team battle is client-only
  (in-JS `dailySeed()` over featured teams — `src/lib/db/teams.ts`) and is
  excluded until it gets a server-side pick.
- **One send per day at 15:00 UTC** (morning US / evening EU), well after the
  00:05 UTC roll. Cron name: `send-daily-push`.

## Known platform facts (from research; verified 2026-07-15)

- `public/manifest.json` is already a valid standalone PWA manifest with
  192/512 icons — copied to `dist/`. No `gcm_sender_id` needed (VAPID).
- **No service worker exists anywhere**; Expo static export does not emit one.
- `app/+html.tsx` is the document shell (Expo `output: 'static'`) — already
  injects the manifest link; inline scripts use `dangerouslySetInnerHTML`
  (see its existing `rootStyle` pattern). This is where SW registration goes.
- `vercel.json`: real files in `dist/` are served ahead of the SPA catch-all
  rewrite, so `public/sw.js` → `dist/sw.js` → served at `/sw.js` correctly.
  The `Permissions-Policy` header does NOT restrict push/notifications — no
  header change needed.
- Cron pattern (canonical example
  `supabase/migrations/20260712100000_schedule_pull_social_stats.sql`):
  `cron.schedule(name, sched, $$ select net.http_post(url := '<fn url>',
  headers := …anon bearer…, body := …) $$)`. Functions do privileged work via
  their own `SUPABASE_SERVICE_ROLE_KEY`; browser-facing functions need the
  CORS pattern from `ig-sync/index.ts`, cron-only ones don't.
- iOS Safari limitation: web push requires the PWA to be installed to the home
  screen (iOS 16.4+). Accept it; the settings row copy should not promise
  more than the platform can deliver.

## Design

### 1. Migration: `push_subscriptions` (+ cron)

New migration (via `mcp__supabase__apply_migration`, then regenerate
`database.generated.ts`):

```sql
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz,          -- stamped by the sender on success
  failed_at   timestamptz           -- stamped on transient failure; 404/410 rows are DELETED
);
alter table public.push_subscriptions enable row level security;
-- Owner pattern, same as user_favourites (20260404000000_create_heroes_favourites_profiles.sql):
create policy "push_select" on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);
create policy "push_insert" on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "push_delete" on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
```

Same migration schedules the cron (mirror the pull-social-stats file verbatim,
new name/url/time):

```sql
select cron.schedule('send-daily-push', '0 15 * * *', $cron$ … net.http_post to
  https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/send-daily-push … $cron$);
```

(Copy the anon-bearer header block exactly from the pull-social-stats
migration — same key, same shape.)

### 2. Service worker: `public/sw.js`

Plain JS (it's served verbatim, not bundled):

```js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Mythique', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url ?? '/versus' },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      const existing = tabs.find((t) => 'focus' in t);
      return existing ? (existing.navigate(url), existing.focus()) : clients.openWindow(url);
    }),
  );
});
```

No fetch handler, no caching — this SW exists solely for push (don't
accidentally become an offline cache with stale-bundle problems).

### 3. Registration in `app/+html.tsx`

Inline script via `dangerouslySetInnerHTML` (same pattern as `rootStyle`):
`if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')`
wrapped in a `load` listener. Registration alone shows no prompt — permission
is only requested from the settings toggle.

### 4. Client: `src/lib/push.ts` (platform-neutral API, web implementation)

```
isPushSupported(): boolean            // 'serviceWorker' in navigator && 'PushManager' in window
getSubscriptionState(): Promise<'subscribed' | 'unsubscribed' | 'denied' | 'unsupported'>
subscribeToPush(userId: string): Promise<{ error: string | null }>
unsubscribeFromPush(): Promise<{ error: string | null }>
```

`subscribeToPush`: `Notification.requestPermission()` →
`registration.pushManager.subscribe({ userVisibleOnly: true,
applicationServerKey: urlBase64ToUint8Array(process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY!) })`
→ upsert `{ user_id, endpoint, p256dh, auth }` into `push_subscriptions`
**directly via supabase-js** (RLS owner policy — no edge function needed for
subscribe; screens-never-import-supabase rule satisfied because this is
`src/lib/`). `unsubscribeFromPush`: `subscription.unsubscribe()` + delete the
row by endpoint. Include the standard `urlBase64ToUint8Array` helper. Guard
every browser API behind `isPushSupported()`; on native the module's functions
return `'unsupported'`/no-op (keep the file platform-neutral — no `.web.tsx`
split needed since it's a lib, not a view).

### 5. Settings UI

`app/settings.web.tsx` (sections at `:150-218`): new **Notifications**
`SectionShell` between Account and Support, one row: "Daily matchup alert" with
a `Switch` (RN's `Switch` works on web). `SettingRow` currently has no toggle
variant — add an optional `toggle`/`onToggle` prop pair to it rather than a new
component. States: unsupported → row hidden; permission denied → row disabled
with sub-copy "Notifications are blocked in your browser settings"; otherwise
reflect `getSubscriptionState()` (fetch in an effect with a cancelled flag —
house style). `app/settings.tsx` (native): hide the section entirely
(`isPushSupported()` false).

### 6. Edge function: `supabase/functions/send-daily-push/index.ts`

Cron-invoked (no CORS — mirror `pull-social-stats`); service-role client at
module scope (mirror `ig-sync`). Uses `npm:web-push` (Supabase Deno runtime
supports npm specifiers) with `Deno.env.get('VAPID_PUBLIC_KEY')`,
`VAPID_PRIVATE_KEY`, subject `mailto:ginoswanepoel@gmail.com`.

Flow:
1. `select hero_a_id, hero_b_id, hook_text from daily_debate where debate_date = current_date`
   — if absent (shouldn't be; the roll guarantees it), return
   `{ skipped: 'no debate row' }`.
2. Join `heroes` for the two names.
3. Personalization: `select uf.user_id from user_favourites uf where uf.hero_id
   in (a, b)` → a Set. Favourite-holders get title
   `"<FavName> is in today's matchup"`, everyone else
   `"Today's matchup: <A> vs <B>"`; body = `hook_text ?? 'Cast your vote'`;
   `url: '/versus'`.
4. Load all `push_subscriptions`; send each with `webpush.sendNotification`.
   On success stamp `last_ok_at`; on **404/410 delete the row** (endpoint
   gone); other errors stamp `failed_at` and count.
5. Return `{ sent, pruned, failed }` (the cron log line).

Deploy via `mcp__supabase__deploy_edge_function`.

### 7. Env / secrets

- Generate VAPID keys once: `npx web-push generate-vapid-keys`.
- Public key → `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (Vercel env + `.env.example` +
  `.env.local`).
- Private + public → Supabase function secrets:
  `supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=…` (or via
  dashboard). **Owner action.**

## Non-goals (v1)

- Native push (expo-notifications), anonymous subscribers, per-user send-time
  preferences, notification categories/preferences beyond the single toggle,
  team-battle notifications, any offline caching in the SW.

## Tests

- `__tests__/lib/push.test.ts`: `urlBase64ToUint8Array` round-trip;
  `getSubscriptionState()` returns `'unsupported'` when `navigator.serviceWorker`
  is absent (jsdom default); subscribe short-circuits on denied permission.
  Mock the supabase module as other db tests do.
- The edge function is exercised by a manual invoke (below), not jest.

## Acceptance criteria

1. Chrome desktop/Android: toggle on in Settings → permission prompt → row in
   `push_subscriptions`; toggle off → row gone + browser subscription gone.
2. Manual invoke of `send-daily-push` (curl with anon bearer) → notification
   arrives; clicking it opens/focuses `/versus`; response counts match.
3. A favourite-holder of a debated hero receives the personalized title.
4. Deleting the subscription in the browser then invoking → row pruned (410).
5. Settings on native and on unsupported browsers: no Notifications section.
6. Existing pages unaffected: `yarn expo export -p web` output serves `/sw.js`;
   `yarn test:ci` green; tsc clean.
7. Cron visible in `select * from cron.job` and fires at 15:00 UTC.
