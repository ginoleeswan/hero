// api/aasa.ts — the apple-app-site-association document.
//
// Served at /.well-known/apple-app-site-association via a vercel.json rewrite.
// Apple fetches it over HTTPS with NO redirects allowed and requires
// `application/json` WITHOUT a .json extension on the path, which is exactly
// why this is a function rather than a static file: a file in public/ would
// need the extension to get the right content type, and then the path is wrong.
//
// WHY THIS MATTERS HERE: every share the app sends is a mythique.app link. With
// no association, iOS opens them in Safari — including for people who already
// have the app — so the whole share loop hands its traffic to the website
// instead of the product.
//
// THE TEAM ID COMES FROM THE ENVIRONMENT. `APPLE_TEAM_ID` must be set on the
// Vercel project (Settings → Environment Variables); it is the 10-character
// identifier from developer.apple.com → Membership. Without it this returns 503
// rather than a document with a placeholder in it — a malformed association is
// worse than none, because iOS caches the failure and the retry schedule is
// entirely Apple's.
type Res = {
  setHeader: (k: string, v: string) => void;
  status: (code: number) => { send: (body: string) => void };
};

const BUNDLE_IDS = ['com.ginoswanepoel.mythique', 'com.ginoswanepoel.mythique.dev'];

/**
 * Paths the app can handle. Anything NOT listed opens in Safari, which is the
 * correct outcome for pages the app has no route for — sending someone into the
 * app only to show them a dead end is worse than the website.
 *
 * Kept in step with shareLink in src/lib/share.ts: every path the app shares
 * must appear here, or the link it sends will not open the app that sent it.
 */
const PATHS = [
  '/character/*',
  '/compare/*',
  '/social-web/*',
  '/house/*',
  '/event/*',
  '/title/*',
  '/team/*',
  '/issue/*',
  '/category/*',
  '/universe/*',
  '/franchise/*',
  '/play',
  '/versus',
  '/explore',
  // Deliberately excluded: '/', '/privacy', '/terms', '/support', '/admin/*'.
  // The marketing root and the legal pages read better on the web, and admin is
  // web-only — opening those in the app would strand the reader.
  'NOT /admin/*',
];

export default function handler(_req: unknown, res: Res) {
  const teamId = process.env.APPLE_TEAM_ID;
  res.setHeader('content-type', 'application/json');

  if (!teamId) {
    // Fail loudly rather than serve a document Apple will cache as broken.
    res.setHeader('cache-control', 'no-store');
    res.status(503).send(JSON.stringify({ error: 'APPLE_TEAM_ID is not set' }));
    return;
  }

  // Apple re-fetches this rarely; a day at the edge is plenty and keeps a
  // Team ID correction from taking a week to propagate.
  res.setHeader('cache-control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).send(
    JSON.stringify({
      applinks: {
        details: BUNDLE_IDS.map((id) => ({
          appIDs: [`${teamId}.${id}`],
          components: PATHS.map((p) =>
            p.startsWith('NOT ')
              ? { '/': p.slice(4), exclude: true, comment: 'web-only surface' }
              : { '/': p, comment: p },
          ),
        })),
      },
      // Handoff and shared web credentials both key off the same association
      // document; declaring the app here lets Passwords offer the saved
      // mythique.app login inside the app's own sign-in form.
      webcredentials: { apps: BUNDLE_IDS.map((id) => `${teamId}.${id}`) },
    }),
  );
}
