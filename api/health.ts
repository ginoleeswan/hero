// Liveness probe for the Node serverless runtime. Deliberately imports NOTHING.
//
// Added 2026-07-27 as a discriminator. Every Node function in api/ — bot-page,
// share-meta, battle — was returning FUNCTION_INVOCATION_FAILED in production,
// on every route, including query-less paths that never touch the database. The
// Edge function (api/og.tsx) was fine, and all five handler paths ran correctly
// when compiled and driven locally against production data. So the fault is in
// how the Node functions are BUILT or STARTED, not in what they do.
//
// That leaves two candidates, and they need opposite fixes:
//
//   1. The bundle. api/tsconfig.json sets `module: ESNext` (api/og.tsx needs it
//      for `import.meta`), and there is no `type: module` beside it — so ESM
//      output lands in a CommonJS package and dies at load.
//   2. The runtime itself — a Node version the platform no longer starts.
//
// This file cannot fail for reason 1: with no imports there is no import
// statement to mis-format, so its emitted JS is valid under both module systems.
// If /api/health answers and its neighbours do not, the fault is the bundle. If
// it fails too, the fault is the runtime and no code change will fix it.
//
// It is worth keeping afterwards regardless: `yarn smoke` now asserts the Node
// runtime is alive, and this is the cheapest possible thing for it to ask.

type Req = { query: Record<string, string | string[] | undefined> };
type Res = {
  setHeader: (k: string, v: string) => void;
  send: (body: string) => void;
};

export default function handler(_req: Req, res: Res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  // No caching: a liveness probe that answers from the edge cache is not one.
  res.setHeader('cache-control', 'no-store');
  res.send(JSON.stringify({ ok: true, runtime: 'node' }));
}
