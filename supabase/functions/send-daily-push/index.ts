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

interface SubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async () => {
  try {
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPublic || !vapidPrivate) return json({ skipped: 'VAPID keys not set' });
    webpush.setVapidDetails('mailto:ginoswanepoel@gmail.com', vapidPublic, vapidPrivate);

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

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth');
    if (!subs || subs.length === 0) return json({ sent: 0, pruned: 0, failed: 0 });

    let sent = 0;
    let pruned = 0;
    let failed = 0;
    for (const s of subs as SubRow[]) {
      const atRiskStreak = streakByUser.get(s.user_id);
      const payload = JSON.stringify(
        atRiskStreak
          ? {
              title: `Your ${atRiskStreak}-day streak is on the line`,
              body: 'Play any of today’s dailies to keep it alive',
              url: '/versus',
            }
          : {
              title: favTitleByUser.get(s.user_id) ?? genericTitle,
              body,
              url: '/versus',
            },
      );
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

    return json({ sent, pruned, failed, matchup: `${nameA} vs ${nameB}` });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'send-daily-push failed' }, 500);
  }
});
