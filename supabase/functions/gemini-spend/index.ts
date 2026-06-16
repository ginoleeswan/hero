// supabase/functions/gemini-spend/index.ts
//
// Reads Google Cloud cost from the BigQuery billing export and returns a spend
// summary for the admin console (mirrors the AI Studio "Gemini API Spend" view:
// month-to-date total + a daily series + per-service breakdown).
//
// Auth: admin-only (verifies the caller's JWT → user_profiles.is_admin).
// Credentials: a service-account JSON stored in the GCP_SA_KEY secret. The SA
// needs BigQuery Data Viewer + Job User on the billing-export dataset.
//
// Returns { available:false, reason } until the BigQuery export has a table with
// data (the export is per-billing-account, ~24h to populate, no historical
// backfill), so the UI can show guidance instead of erroring.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

const DATASET = Deno.env.get('GCP_BILLING_DATASET') ?? 'billing_export';

// ── Service-account → OAuth access token (RS256 JWT, signed via Web Crypto) ───
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const strB64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

interface SA {
  client_email: string;
  private_key: string;
  token_uri: string;
  project_id: string;
}

async function accessToken(sa: SA): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = strB64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = strB64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/bigquery',
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const input = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  const jwt = `${input}.${b64url(new Uint8Array(sig))}`;
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`token exchange failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token as string;
}

async function bqGet(token: string, path: string) {
  const res = await fetch(`https://bigquery.googleapis.com/bigquery/v2/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
async function bqQuery(token: string, project: string, sql: string) {
  const res = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${project}/queries`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql, useLegacySql: false, timeoutMs: 30000 }),
    },
  );
  return res.json();
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // ── Admin gate ──────────────────────────────────────────────────────────────
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);
    const admin = createClient(url, service);
    const { data: prof } = await admin
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    if (!(prof as { is_admin?: boolean } | null)?.is_admin)
      return json({ error: 'forbidden' }, 403);

    // ── Credentials ─────────────────────────────────────────────────────────────
    const raw = Deno.env.get('GCP_SA_KEY');
    if (!raw) return json({ available: false, reason: 'GCP_SA_KEY secret not set' });
    const sa = JSON.parse(raw) as SA;
    const project = sa.project_id;
    const token = await accessToken(sa);

    // ── Find the billing export table ─────────────────────────────────────────
    const tabs = await bqGet(token, `projects/${project}/datasets/${DATASET}/tables`);
    if (tabs.error) return json({ available: false, reason: tabs.error.message });
    const exportTable = (tabs.tables ?? [])
      .map((t: { tableReference: { tableId: string } }) => t.tableReference.tableId)
      .find((id: string) => id.startsWith('gcp_billing_export_v1_'));
    if (!exportTable) {
      return json({
        available: false,
        reason: 'No billing-export table yet — enable Standard usage cost export and wait ~24h.',
      });
    }

    // ── Query: daily cost per service, last 28 days ─────────────────────────────
    const fq = `\`${project}.${DATASET}.${exportTable}\``;
    const sql = `
      SELECT FORMAT_DATE('%Y-%m-%d', DATE(usage_start_time)) AS day,
             service.description AS service,
             SUM(cost) AS cost,
             ANY_VALUE(currency) AS currency
      FROM ${fq}
      WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 28 DAY)
      GROUP BY day, service
      ORDER BY day`;
    const q = await bqQuery(token, project, sql);
    if (q.error) return json({ available: false, reason: q.error.message });

    const rows: { f: { v: string }[] }[] = q.rows ?? [];
    const byDay = new Map<string, number>();
    const byService = new Map<string, number>();
    let currency = 'USD';
    const monthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
    let total28 = 0;
    let monthToDate = 0;

    for (const r of rows) {
      const day = r.f[0]?.v ?? '';
      const service = r.f[1]?.v ?? 'Other';
      const cost = Number(r.f[2]?.v ?? 0);
      currency = r.f[3]?.v ?? currency;
      byDay.set(day, (byDay.get(day) ?? 0) + cost);
      byService.set(service, (byService.get(service) ?? 0) + cost);
      total28 += cost;
      if (day.startsWith(monthPrefix)) monthToDate += cost;
    }

    return json({
      available: true,
      currency,
      total28: Number(total28.toFixed(2)),
      monthToDate: Number(monthToDate.toFixed(2)),
      days: [...byDay.entries()].map(([day, cost]) => ({ day, cost: Number(cost.toFixed(2)) })),
      byService: [...byService.entries()]
        .map(([service, cost]) => ({ service, cost: Number(cost.toFixed(2)) }))
        .sort((a, b) => b.cost - a.cost),
    });
  } catch (err) {
    console.error('[gemini-spend]', err);
    return json({ available: false, reason: String(err) }, 200);
  }
});
