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
// Badge colour per target — mirrors the command-center ReportsDomain palette
// (all brand tokens: blue / orange / red).
const TARGET_COLOR: Record<string, string> = {
  page: '#15A1AB',
  image: '#E77333',
  ai_portrait: '#B5302B',
};

// Brand assets (public `brand` storage bucket) + fonts. The wordmark is Google
// Font Righteous, headers are the app's Flame face (self-hosted @font-face),
// body is Nunito — all with web-safe fallbacks for clients that block webfonts.
const A = 'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/brand';
// The full logo lockup (mask + "mythique" in Righteous) baked into one PNG, so
// the identity is pixel-perfect in every client (incl. Outlook/Gmail, which
// strip webfonts). Rendered from the real Righteous webfont.
const LOCKUP = `${A}/mythique-lockup.png`;
const MASK_INK = `${A}/mythique-mask-ink.png`;
const FLAME_TTF = `${A}/Flame-Regular.ttf`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Reports come from untrusted signed-in users, so every dynamic value rendered
// into the email must be HTML-escaped, and image_url (free text on the row)
// must be validated as an http(s) URL before it's used — else a crafted value
// could break out of an attribute and inject markup.
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

// Mythique-branded transactional email — a sibling of the signup template:
// navy dot-grid letterhead (mask + Righteous wordmark) → orange seam → white
// body → beige footer. Palette is 100% brand tokens. All dynamic fields arrive
// already escaped.
function reportEmailHtml(o: {
  heroName: string;
  reasonText: string;
  targetType: string;
  targetText: string;
  detail: string | null;
  imgUrl: string | null;
  meta: string;
  heroUrl: string;
  adminUrl: string;
}): string {
  const font = "'Nunito',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const flame = "'Flame',Georgia,'Times New Roman',serif";
  const righteous = "'Righteous','Trebuchet MS',Verdana,sans-serif";
  const badge = TARGET_COLOR[o.targetType] ?? '#293C43';

  const thumbCell = o.imgUrl
    ? `<td valign="top" width="132" style="width:132px;padding-left:20px;"><img src="${o.imgUrl}" width="112" height="140" alt="Reported image" style="display:block;width:112px;height:140px;border-radius:12px;object-fit:cover;border:1px solid rgba(41,60,67,0.12);"></td>`
    : '';

  const detailBlock = o.detail
    ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:26px;"><tr><td style="background-color:#f5ebdc;border-left:3px solid #e77333;border-radius:0 12px 12px 0;padding:16px 18px;font-family:${font};font-size:15px;font-weight:400;color:#293c43;line-height:1.6;">&ldquo;${o.detail}&rdquo;</td></tr></table>`
    : '';

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>New report — Mythique</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Righteous&display=swap');
  @font-face { font-family:'Flame'; src:url('${FLAME_TTF}') format('truetype'); font-weight:400; font-style:normal; font-display:swap; }
  * { box-sizing:border-box; }
  body { margin:0; padding:0; background-color:#ffffff; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }
  img { border:0; display:block; -ms-interpolation-mode:bicubic; }
  a { text-decoration:none; }
  @media (max-width:600px) {
    .email-container { width:100% !important; }
    .inner-pad { padding-left:28px !important; padding-right:28px !important; }
    .heading-size { font-size:38px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#ffffff;">${o.heroName} &mdash; ${o.reasonText}</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#ffffff;">
<tr><td align="center" style="padding:40px 16px 48px;">
<table class="email-container" width="580" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;width:100%;border-radius:20px;overflow:hidden;border:1px solid rgba(41,60,67,0.06);box-shadow:0 6px 26px rgba(41,60,67,0.10);">

  <tr><td style="background-color:#293c43;padding:40px 48px 42px;text-align:center;background-image:radial-gradient(circle, rgba(245,235,220,0.09) 1.5px, transparent 1.5px);background-size:22px 22px;">
    <img src="${LOCKUP}" width="156" height="27" alt="mythique" style="display:block;width:156px;height:27px;margin:0 auto;">
    <div style="font-family:${font};font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:rgba(245,235,220,0.42);margin-top:16px;">Moderation desk</div>
  </td></tr>

  <tr><td style="background-color:#e77333;height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr><td class="inner-pad" style="background-color:#ffffff;padding:46px 56px 44px;">
    <p style="margin:0 0 18px;"><span style="font-family:${font};font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#e77333;background-color:rgba(231,115,51,0.10);border-radius:100px;padding:5px 12px;display:inline-block;">New report</span></p>
    <h1 class="heading-size" style="margin:0 0 8px;font-family:${flame};font-size:42px;font-weight:400;color:#293c43;line-height:1.05;letter-spacing:-0.3px;">${o.heroName}</h1>
    <p style="margin:0 0 30px;font-family:${font};font-size:13px;font-weight:600;letter-spacing:0.3px;color:#a2a19b;">${o.meta}</p>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td valign="top">
        <p style="margin:0 0 8px;font-family:${font};font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#a2a19b;">Flagged</p>
        <span style="font-family:${font};font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#ffffff;background-color:${badge};border-radius:100px;padding:6px 13px;display:inline-block;">${o.targetText}</span>
        <p style="margin:22px 0 8px;font-family:${font};font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#a2a19b;">Reason</p>
        <p style="margin:0;font-family:${font};font-size:18px;font-weight:700;color:#293c43;line-height:1.3;">${o.reasonText}</p>
      </td>
      ${thumbCell}
    </tr></table>

    ${detailBlock}

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:32px;"><tr><td>
      <a href="${o.adminUrl}" style="display:block;background-color:#e77333;color:#ffffff;font-family:${font};font-size:15px;font-weight:800;letter-spacing:0.3px;text-align:center;padding:16px 24px;border-radius:12px;box-shadow:0 8px 24px rgba(231,115,51,0.28);">Review in the command centre</a>
    </td></tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:12px;"><tr><td>
      <a href="${o.heroUrl}" style="display:block;color:#293c43;font-family:${font};font-size:15px;font-weight:700;text-align:center;padding:15px 24px;border-radius:12px;border:1.5px solid rgba(41,60,67,0.22);">Open the character page</a>
    </td></tr></table>
  </td></tr>

  <tr><td style="background-color:#f5ebdc;padding:24px 56px 28px;border-top:1px solid rgba(41,60,67,0.08);">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td valign="middle">
        <table cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td valign="middle" style="padding-right:8px;line-height:0;"><img src="${MASK_INK}" width="44" height="17" alt="" style="display:block;width:44px;height:17px;opacity:0.5;"></td>
          <td valign="middle" style="line-height:0;"><span style="font-family:${righteous};font-size:15px;color:#293c43;opacity:0.42;">mythique</span></td>
        </tr></table>
      </td>
      <td valign="middle" align="right" style="font-family:${font};font-size:12px;font-weight:400;color:#a2a19b;line-height:1.5;text-align:right;">You moderate Mythique.<br>Resolving happens in the command centre.</td>
    </tr></table>
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

    const d = new Date(String(rep.created_at).replace(' ', 'T'));
    const when = isNaN(d.getTime())
      ? ''
      : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
    const meta = `Report #${rep.id}${when ? ` · ${when}` : ''}`;

    const html = reportEmailHtml({
      heroName: esc(heroName),
      reasonText: esc(reasonText),
      targetType: rep.target_type,
      targetText: esc(targetText),
      detail: rep.detail ? esc(String(rep.detail)) : null,
      imgUrl: imgUrl ? esc(imgUrl) : null,
      meta: esc(meta),
      heroUrl,
      adminUrl: 'https://mythique.app/admin/health',
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
