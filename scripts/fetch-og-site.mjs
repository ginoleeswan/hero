// Snapshot the site-wide OG brand card from the deployed /api/og renderer into
// public/og.png (the static default card must never depend on a function being
// up). Run once after each deploy that changes the card design, then commit:
//   node scripts/fetch-og-site.mjs [origin]   (default: production SITE_URL)
import { writeFile } from 'node:fs/promises';

const origin = process.argv[2] ?? 'https://mythique.app';
const url = `${origin}/api/og`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`[og-site] ${url} → HTTP ${res.status}`);
  process.exit(1);
}
const buf = new Uint8Array(await res.arrayBuffer());
if (buf.length < 10_000) {
  console.error(`[og-site] suspiciously small response (${buf.length} bytes) — not saving`);
  process.exit(1);
}
await writeFile(new URL('../public/og.png', import.meta.url), buf);
console.log(`[og-site] wrote public/og.png (${(buf.length / 1024).toFixed(0)} KB) from ${url}`);
