// report-alert: emails the admin when a new report is filed. Invoked by an
// AFTER INSERT trigger on public.reports (via pg_net) with { id }. Loads the
// report via the service role and sends one branded email through Brevo. No-ops
// gracefully if BREVO_API_KEY is unset, so reports never depend on email.
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
// Badge colour per target — mirrors the command-center ReportsDomain palette.
const TARGET_COLOR: Record<string, string> = {
  page: '#15A1AB', // blue
  image: '#E77333', // orange
  ai_portrait: '#B5302B', // red
};

// Reports come from untrusted signed-in users, so every dynamic value rendered
// into the alert email must be HTML-escaped, and image_url (free text on the
// row) must be validated as an http(s) URL before it's used as a link — else a
// crafted value could break out of an attribute and inject markup.
const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeHttpUrl = (u: string | null | undefined): string | null => {
  if (!u) return null;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
};

// Mythique-branded transactional email. Table + inline styles (renders across
// Outlook.com / Gmail / Apple Mail); the app's signature ink band → orange seam
// → warm paper, orange uppercase eyebrows. All dynamic fields must arrive
// already HTML-escaped. Custom app fonts can't load in mail clients, so we use a
// warm, humanist web-safe stack as the closest stand-in.
function reportEmailHtml(o: {
  heroName: string;
  reasonText: string;
  targetType: string;
  targetText: string;
  detail: string | null;
  imgUrl: string | null;
  heroUrl: string;
  adminUrl: string;
  reportId: number;
}): string {
  const ink = '#0b1820';
  const navy = '#293C43';
  const beige = '#f5ebdc';
  const orange = '#E77333';
  const grey = '#A2A19B';
  const card = '#fffdf9';
  const hair = '#ece0cf';
  const badge = TARGET_COLOR[o.targetType] ?? navy;
  const font = "'Trebuchet MS','Segoe UI',Helvetica,Arial,sans-serif";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${beige};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${beige};">New ${o.reasonText} report — ${o.heroName}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${beige};padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:${card};border-radius:18px;overflow:hidden;box-shadow:0 6px 22px -12px rgba(11,24,32,0.32);">
<tr><td style="background:${ink};padding:22px 28px;">
  <div style="font-family:${font};font-size:20px;font-weight:bold;letter-spacing:3px;color:${beige};text-transform:uppercase;">Mythique<span style="color:${orange};">.</span></div>
  <div style="font-family:${font};font-size:10px;font-weight:bold;letter-spacing:2px;color:${orange};text-transform:uppercase;margin-top:4px;">Moderation desk</div>
</td></tr>
<tr><td style="height:3px;line-height:3px;font-size:0;background:${orange};">&nbsp;</td></tr>
<tr><td style="padding:30px 28px 6px;">
  <div style="font-family:${font};font-size:11px;font-weight:bold;letter-spacing:2px;color:${orange};text-transform:uppercase;">New report</div>
  <div style="font-family:${font};font-size:26px;font-weight:bold;color:${navy};margin:6px 0 14px;line-height:1.15;">${o.heroName}</div>
  <span style="display:inline-block;font-family:${font};font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#ffffff;background:${badge};padding:5px 12px;border-radius:20px;">${o.targetText}</span>
  <div style="font-family:${font};font-size:16px;font-weight:bold;color:${navy};margin:18px 0 0;">${o.reasonText}</div>
  ${
    o.detail
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;"><tr><td style="background:${beige};border-left:3px solid ${orange};border-radius:8px;padding:12px 14px;font-family:${font};font-size:14px;color:${navy};line-height:1.55;">${o.detail}</td></tr></table>`
      : ''
  }
  ${
    o.imgUrl
      ? `<div style="margin-top:18px;"><img src="${o.imgUrl}" alt="Reported image" width="120" style="width:120px;max-width:120px;height:auto;border-radius:10px;border:1px solid ${hair};display:block;"></div>`
      : ''
  }
</td></tr>
<tr><td style="padding:24px 28px 30px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="border-radius:24px;background:${orange};"><a href="${o.heroUrl}" style="display:inline-block;font-family:${font};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:24px;">Open character page</a></td>
    <td style="width:10px;">&nbsp;</td>
    <td style="border-radius:24px;border:1px solid ${navy};"><a href="${o.adminUrl}" style="display:inline-block;font-family:${font};font-size:14px;font-weight:bold;color:${navy};text-decoration:none;padding:12px 22px;border-radius:24px;">Review in command centre</a></td>
  </tr></table>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid ${hair};background:${card};">
  <div style="font-family:${font};font-size:12px;color:${grey};line-height:1.5;">You're receiving this because you moderate Mythique &middot; report #${o.reportId}</div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

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

    const apiKey = Deno.env.get('BREVO_API_KEY') ?? '';
    if (!apiKey) return json({ status: 'skipped', reason: 'no BREVO_API_KEY' });

    const to = Deno.env.get('REPORT_ALERT_TO') ?? 'ginoswanepoel@gmail.com';
    const senderEmail = Deno.env.get('REPORT_ALERT_FROM') ?? 'reports@mythique.app';
    const senderName = Deno.env.get('REPORT_ALERT_FROM_NAME') ?? 'Mythique';
    const reasonText = REASON_LABEL[rep.reason] ?? rep.reason;
    const targetText = TARGET_LABEL[rep.target_type] ?? rep.target_type;
    const heroUrl = `https://mythique.app/character/${encodeURIComponent(rep.hero_id)}`;
    const imgUrl = safeHttpUrl(rep.image_url);

    // Subject is plain text (not HTML); the body gets escaped values.
    const html = reportEmailHtml({
      heroName: esc(heroName),
      reasonText: esc(reasonText),
      targetType: rep.target_type,
      targetText: esc(targetText),
      detail: rep.detail ? esc(String(rep.detail)) : null,
      imgUrl: imgUrl ? esc(imgUrl) : null,
      heroUrl,
      adminUrl: 'https://mythique.app/admin/health',
      reportId: rep.id,
    });

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject: `New report: ${reasonText} — ${heroName}`,
        htmlContent: html,
      }),
    });
    if (!res.ok) return json({ status: 'error', http: res.status, detail: await res.text() }, 502);
    return json({ status: 'sent' });
  } catch (err) {
    return json({ status: 'error', message: err instanceof Error ? err.message : 'unknown' }, 500);
  }
});
