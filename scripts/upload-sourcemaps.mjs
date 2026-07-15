// Fail-soft Sentry source-map upload for the web export. Runs after
// `expo export -p web` (see vercel.json buildCommand). If the Sentry env isn't
// configured (SENTRY_AUTH_TOKEN / org / project), it logs and exits 0 — a
// missing token or a Sentry hiccup must NEVER break a deploy (same posture as
// generate-sitemap.mjs).
//
// The build emits .map files (expo export --source-maps). With the Sentry env
// set: injects debug-ids into dist/ and uploads the maps under a release keyed
// to the app version + the Vercel commit SHA, so minified web stacks
// symbolicate in Sentry. EITHER WAY, the .map files are deleted from dist/ at
// the end so they're never served publicly (they live only in Sentry).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { globSync } from 'node:fs';
import { rmSync } from 'node:fs';

const require = createRequire(import.meta.url);

const AUTH = process.env.SENTRY_AUTH_TOKEN;
const ORG = process.env.SENTRY_ORG;
const PROJECT = process.env.SENTRY_PROJECT;
const DIST = 'dist';

/** Remove every .map under dist/ so source maps are never publicly served. */
function stripMaps() {
  try {
    for (const f of globSync(`${DIST}/**/*.map`)) rmSync(f, { force: true });
  } catch (e) {
    console.warn('[sourcemaps] cleanup skipped:', e?.message ?? e);
  }
}

if (!AUTH || !ORG || !PROJECT) {
  console.log('[sourcemaps] SENTRY_AUTH_TOKEN/ORG/PROJECT not set — skipping upload (ok).');
  stripMaps();
  process.exit(0);
}

// Release name: app version + short commit SHA (Vercel provides the SHA).
const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local';
let version = '0.0.0';
try {
  version = require('../app.json')?.expo?.version ?? version;
} catch {
  // app.config.ts is dynamic; fall back to package.json version.
  try {
    version = require('../package.json')?.version ?? version;
  } catch {
    /* keep default */
  }
}
const release = `mythique@${version}+${sha}`;

// Resolve the sentry-cli binary shipped with @sentry/cli (a dep of the SDK).
let bin;
try {
  const SentryCli = require('@sentry/cli');
  bin = typeof SentryCli.getPath === 'function' ? SentryCli.getPath() : 'sentry-cli';
} catch {
  bin = 'sentry-cli';
}

const env = { ...process.env, SENTRY_AUTH_TOKEN: AUTH, SENTRY_ORG: ORG, SENTRY_PROJECT: PROJECT };
const run = (args) => execFileSync(bin, args, { stdio: 'inherit', env });

try {
  run(['sourcemaps', 'inject', DIST]);
  run(['sourcemaps', 'upload', '--release', release, DIST]);
  console.log(`[sourcemaps] uploaded for release ${release}.`);
} catch (e) {
  // Upload failure is non-fatal — ship the deploy, just without symbolication.
  console.warn('[sourcemaps] upload failed (non-fatal):', e?.message ?? e);
} finally {
  stripMaps();
}
