/**
 * Generates an Apple client secret JWT for Supabase OAuth.
 * Run once, paste output into Supabase → Auth → Providers → Apple → Secret Key.
 * Delete this file after use (or keep it — the key comes in via env, not hardcoded).
 *
 * Usage:
 *   APPLE_PRIVATE_KEY="$(cat /path/to/AuthKey_5WUQ2TY9NY.p8)" bun scripts/generate-apple-secret.ts
 */

import crypto from 'crypto';

const TEAM_ID = 'A85929B4HV';
const KEY_ID = '5WUQ2TY9NY';
const CLIENT_ID = 'com.mythique.app.siwa';

const privateKey = process.env.APPLE_PRIVATE_KEY;
if (!privateKey) {
  console.error('Set APPLE_PRIVATE_KEY env var to the contents of your .p8 file.');
  process.exit(1);
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const now = Math.floor(Date.now() / 1000);
const header = base64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID }));
const payload = base64url(
  JSON.stringify({
    iss: TEAM_ID,
    iat: now,
    exp: now + 15_777_000, // ~6 months — Apple's maximum
    aud: 'https://appleid.apple.com',
    sub: CLIENT_ID,
  }),
);

const signingInput = `${header}.${payload}`;
const signer = crypto.createSign('SHA256');
signer.update(signingInput);
// ieee-p1363 gives raw R||S format required by JWT (not DER)
const sig = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

console.log('\nPaste this into Supabase → Apple → Secret Key (for OAuth):\n');
console.log(`${signingInput}.${base64url(sig)}`);
console.log('\nThis JWT expires in ~6 months. Re-run this script to refresh it.\n');
