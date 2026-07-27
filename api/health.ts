// Liveness probe for the Node serverless runtime. Deliberately imports NOTHING.
//
// Added 2026-07-27 as a discriminator, and kept because it earned its place.
//
// Every Node function in api/ — bot-page, share-meta, battle — was returning
// FUNCTION_INVOCATION_FAILED on every route, including query-less paths that
// never touch the database, while the Edge function was fine. This file was the
// experiment: strip a function down to nothing and see whether it dies too. It
// did, which ruled out everything about what the bundle CONTAINS and left only
// how it was built. The deployment log then named it exactly —
//
//     Failed to load the ES module: /var/task/api/health.js.
//     Make sure to set "type": "module" in the nearest package.json
//
// — because api/tsconfig.json was compiling this folder to ESM for the sake of
// one file. See api/tsconfig.json for the fix and the two ways not to redo it.
//
// Keep it: `yarn smoke` asks whether the Node runtime starts at all, and this is
// the cheapest possible thing for it to ask. A function with no imports and no
// database call can only fail for the reason above.

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
