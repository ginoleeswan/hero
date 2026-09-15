// Coarse visitor geo for the self-hosted page_views collector (command-center
// Audience lane). Vercel stamps every request with the edge's IP lookup as
// headers; this function just echoes the four coarse ones back as JSON so the
// client can attach country / region / city / timezone to its page-view rows.
//
// Privacy: the IP itself is never read or returned — only the resolved coarse
// location, which is the same granularity a timezone reveals. The client
// caches the answer per browser session so this is one request per visit.
// Outside Vercel (local dev, `yarn smoke` against a preview) the headers are
// absent and every field is null, which the collector treats as "unknown".
//
// Deliberately imports nothing — see api/health.ts for why that matters here.

type Req = { headers: Record<string, string | string[] | undefined> };
type Res = {
  setHeader: (k: string, v: string) => void;
  send: (body: string) => void;
};

function header(req: Req, name: string): string | null {
  const v = req.headers[name];
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return null;
  // Vercel URL-encodes city names with non-ASCII characters (e.g. "S%C3%A3o%20Paulo").
  try {
    return decodeURIComponent(raw).slice(0, 80);
  } catch {
    return raw.slice(0, 80);
  }
}

export default function handler(req: Req, res: Res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  // Per-visitor answer: must never be served from a shared cache.
  res.setHeader('cache-control', 'private, no-store');
  res.send(
    JSON.stringify({
      country: header(req, 'x-vercel-ip-country'),
      region: header(req, 'x-vercel-ip-country-region'),
      city: header(req, 'x-vercel-ip-city'),
      timezone: header(req, 'x-vercel-ip-timezone'),
    }),
  );
}
