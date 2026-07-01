// report-alert: emails the admin when a new report is filed. Invoked by an
// AFTER INSERT trigger on public.reports (via pg_net) with { id }. Loads the
// report via the service role and sends one email through Resend. No-ops
// gracefully if RESEND_API_KEY is unset, so reports never depend on email.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

const REASON_LABEL: Record<string, string> = {
  inaccurate: 'Incorrect information',
  ai_inaccurate: 'AI portrait looks wrong',
  offensive: 'Offensive or inappropriate',
  duplicate: 'Duplicate character',
  spam: 'Spam',
  wrong_subject: 'Wrong character',
  low_quality: 'Low quality image',
  other: 'Something else',
};
const TARGET_LABEL: Record<string, string> = {
  page: 'Page',
  image: 'Gallery image',
  ai_portrait: 'AI portrait',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id);
    if (!Number.isFinite(id)) return json({ error: 'bad id' }, 400);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { data: rep, error } = await sb
      .from('reports')
      .select('id, hero_id, target_type, image_url, reason, detail, created_at')
      .eq('id', id)
      .single();
    if (error || !rep) return json({ error: 'report not found' }, 404);

    const { data: hero } = await sb.from('heroes').select('name').eq('id', rep.hero_id).single();
    const heroName = hero?.name ?? rep.hero_id;

    const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    if (!apiKey) return json({ status: 'skipped', reason: 'no RESEND_API_KEY' });

    const to = Deno.env.get('REPORT_ALERT_TO') ?? 'ginoswanepoel@gmail.com';
    const from = Deno.env.get('REPORT_ALERT_FROM') ?? 'Mythique <reports@mythique.app>';
    const reasonText = REASON_LABEL[rep.reason] ?? rep.reason;
    const targetText = TARGET_LABEL[rep.target_type] ?? rep.target_type;
    const heroUrl = `https://mythique.app/character/${rep.hero_id}`;

    const html = `
      <h2>New report: ${reasonText}</h2>
      <p><strong>${heroName}</strong> — ${targetText}</p>
      ${rep.detail ? `<p>${String(rep.detail).replace(/</g, '&lt;')}</p>` : ''}
      ${rep.image_url ? `<p><a href="${rep.image_url}">Reported image</a></p>` : ''}
      <p><a href="${heroUrl}">Open the character page</a> · <a href="https://mythique.app/admin/health">Command center → Reports</a></p>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: `New report: ${reasonText} — ${heroName}`, html }),
    });
    if (!res.ok) return json({ status: 'error', http: res.status, detail: await res.text() }, 502);
    return json({ status: 'sent' });
  } catch (err) {
    return json({ status: 'error', message: err instanceof Error ? err.message : 'unknown' }, 500);
  }
});
