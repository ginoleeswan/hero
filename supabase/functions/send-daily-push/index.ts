// send-daily-push — the daily-debate re-engagement push. Cron-invoked (see the
// schedule migration); NOT browser-facing, so no CORS. Reads today's server-
// authoritative daily_debate row + heroes, then sends a Web Push to every
// push_subscriptions row via VAPID. Favourite-holders of either debated hero get
// a personalized title.
//
// Inert until the owner sets VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY function
// secrets (returns { skipped } otherwise) — same fail-soft posture as ig-sync.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

interface TokenRow {
  token: string;
  user_id: string;
}

type Message = { title: string; body: string; url: string };

/** Expo caps a push request at 100 messages. */
const EXPO_BATCH = 100;

/**
 * The native leg: Expo Push.
 *
 * No secret required — Expo addresses tokens directly — which is why this runs
 * even when VAPID is unset and the web leg is dormant.
 *
 * Hygiene mirrors the web leg exactly, because the failure modes are the same
 * shape under different names: `DeviceNotRegistered` is Expo's 404/410, and the
 * row must be DELETED rather than retried forever. Anything else stamps
 * failed_at and is tried again tomorrow.
 */
async function sendNative(
  supabase: ReturnType<typeof createClient>,
  messageFor: (userId: string) => Message,
): Promise<{ sent: number; pruned: number; failed: number }> {
  const out = { sent: 0, pruned: 0, failed: 0 };
  const { data: rows } = await supabase.from('device_push_tokens').select('token, user_id');
  const tokens = (rows ?? []) as TokenRow[];
  if (tokens.length === 0) return out;

  for (let i = 0; i < tokens.length; i += EXPO_BATCH) {
    const batch = tokens.slice(i, i + EXPO_BATCH);
    const messages = batch.map((t) => {
      const m = messageFor(t.user_id);
      return {
        to: t.token,
        title: m.title,
        body: m.body,
        // The key the app routes on — same contract as the local reminder.
        data: { url: m.url },
        sound: null,
        channelId: 'default',
      };
    });

    let receipts: { status?: string; details?: { error?: string } }[] = [];
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });
      const parsed = (await res.json()) as { data?: typeof receipts };
      receipts = parsed.data ?? [];
    } catch {
      // The whole batch failed to leave — stamp them all and retry tomorrow
      // rather than guessing which of them the service saw.
      out.failed += batch.length;
      const now = new Date().toISOString();
      for (const t of batch) {
        await supabase.from('device_push_tokens').update({ failed_at: now }).eq('token', t.token);
      }
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      const t = batch[j];
      const r = receipts[j];
      if (r?.status === 'ok') {
        out.sent++;
        await supabase
          .from('device_push_tokens')
          .update({ last_ok_at: new Date().toISOString(), failed_at: null })
          .eq('token', t.token);
      } else if (r?.details?.error === 'DeviceNotRegistered') {
        out.pruned++;
        await supabase.from('device_push_tokens').delete().eq('token', t.token);
      } else {
        out.failed++;
        await supabase
          .from('device_push_tokens')
          .update({ failed_at: new Date().toISOString() })
          .eq('token', t.token);
      }
    }
  }
  return out;
}

interface SubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async () => {
  try {
    // VAPID gates the WEB leg only. It used to return here, which was right
    // when web was the only channel — but with native tokens in the table that
    // early return would silence a transport that needs no VAPID at all.
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const webEnabled = !!vapidPublic && !!vapidPrivate;
    if (webEnabled) {
      webpush.setVapidDetails('mailto:ginoswanepoel@gmail.com', vapidPublic!, vapidPrivate!);
    }

    // Today's debate (UTC calendar — the roll cron stamps debate_date = current_date).
    const { data: debate } = await supabase
      .from('daily_debate')
      .select('hero_a_id, hero_b_id, hook_text')
      .eq('debate_date', new Date().toISOString().slice(0, 10))
      .maybeSingle();
    if (!debate) return json({ skipped: 'no debate row for today' });

    const { data: heroes } = await supabase
      .from('heroes')
      .select('id, name')
      .in('id', [debate.hero_a_id, debate.hero_b_id]);
    const nameOf = (id: string) => heroes?.find((h) => h.id === id)?.name ?? 'a hero';
    const nameA = nameOf(debate.hero_a_id);
    const nameB = nameOf(debate.hero_b_id);
    const genericTitle = `Today's matchup: ${nameA} vs ${nameB}`;
    const body = debate.hook_text || 'Cast your vote';

    // Users who favourited either debated hero → personalized title.
    const { data: favRows } = await supabase
      .from('user_favourites')
      .select('user_id, hero_id')
      .in('hero_id', [debate.hero_a_id, debate.hero_b_id]);
    const favTitleByUser = new Map<string, string>();
    for (const f of favRows ?? []) {
      if (!favTitleByUser.has(f.user_id)) {
        favTitleByUser.set(f.user_id, `${nameOf(f.hero_id)} is in today's matchup`);
      }
    }

    // Streak-at-risk overrides beat the favourite line: a user whose daily
    // streak (>=3) ended yesterday with nothing today gets the sharper nudge.
    // Service-role-only RPC; empty map on any failure.
    const streakByUser = new Map<string, number>();
    try {
      const { data: atRisk } = await supabase.rpc('get_streaks_at_risk', { p_min: 3 });
      for (const r of (atRisk ?? []) as { user_id: string; streak: number }[]) {
        streakByUser.set(r.user_id, r.streak);
      }
    } catch {
      /* streak nudge is best-effort */
    }

    // The message ladder, once. Both transports pick from the same rungs, in
    // the same order, so a reader with a phone and a browser cannot be told two
    // different things about the same day.
    const messageFor = (userId: string) => {
      const atRisk = streakByUser.get(userId);
      if (atRisk) {
        return {
          title: `Your ${atRisk}-day streak is on the line`,
          body: 'Play any of today’s dailies to keep it alive',
          url: '/versus',
        };
      }
      return { title: favTitleByUser.get(userId) ?? genericTitle, body, url: '/versus' };
    };

    const { data: subs } = webEnabled
      ? await supabase.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth')
      : { data: [] as SubRow[] };

    let sent = 0;
    let pruned = 0;
    let failed = 0;
    for (const s of (subs ?? []) as SubRow[]) {
      const payload = JSON.stringify(messageFor(s.user_id));
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
        await supabase
          .from('push_subscriptions')
          .update({ last_ok_at: new Date().toISOString(), failed_at: null })
          .eq('id', s.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Endpoint is gone — delete the dead subscription.
          pruned++;
          await supabase.from('push_subscriptions').delete().eq('id', s.id);
        } else {
          failed++;
          await supabase
            .from('push_subscriptions')
            .update({ failed_at: new Date().toISOString() })
            .eq('id', s.id);
        }
      }
    }

    const native = await sendNative(supabase, messageFor);

    return json({
      web: webEnabled ? { sent, pruned, failed } : { skipped: 'VAPID keys not set' },
      native,
      matchup: `${nameA} vs ${nameB}`,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'send-daily-push failed' }, 500);
  }
});
