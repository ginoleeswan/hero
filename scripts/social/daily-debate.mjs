#!/usr/bin/env node
// Daily-debate growth-loop asset — one post a day, fully self-contained:
// fetches today's server-curated pair (Task 1's `daily_debate` table),
// downloads the `type=debate` OG card from the deployed site (api/og.tsx),
// uploads it to Cloudinary, and upserts an unposted row into `social_posts`
// so it shows up in the command-center Publish tab queue — same upload +
// registration mechanics as publish-posts.mjs, run standalone because this
// is a single daily asset rather than a batch to collect later.
//
//   node scripts/social/daily-debate.mjs [origin]   (default: https://mythique.app)
//   node scripts/social/daily-debate.mjs --dry-run  # render + save locally only
//
// Requires SUPABASE_SERVICE_ROLE_KEY + CLOUDINARY_* in .env.local (local-only,
// same as publish-posts.mjs — social_posts has no insert RLS policy, so the
// upsert needs the service role to bypass RLS).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { loadEnv, makeSb, ROOT, OUT_DIR } from './lib.mjs';

const dry = process.argv.includes('--dry-run');
const origin = process.argv.find((a) => /^https?:\/\//.test(a)) ?? 'https://mythique.app';

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 30);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Cloudinary + service-role creds — read straight from .env.local like
// publish-posts.mjs's env() (loadEnv only carries the Supabase url/key pair).
function creds() {
  const out = {};
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  const need = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];
  for (const k of need) {
    out[k] = process.env[k] || out[k];
    if (!out[k] && !dry) {
      console.error(`Missing ${k} in .env.local`);
      process.exit(1);
    }
  }
  return out;
}

async function main() {
  const env = loadEnv();
  const sb = makeSb(env);

  const date = todayIso();
  const rows = await sb.rest(
    `daily_debate?debate_date=eq.${date}&select=hero_a_id,hero_b_id,hook_text&limit=1`,
  );
  const debate = rows[0];
  if (!debate) {
    console.error(
      `No daily_debate row for ${date}. Seed one (set_daily_debate / pick_daily_debate) first.`,
    );
    process.exit(1);
  }
  const { hero_a_id: aId, hero_b_id: bId, hook_text: hook } = debate;

  const heroes = await sb.rest(
    `heroes?id=in.(${encodeURIComponent(aId)},${encodeURIComponent(bId)})&select=id,name`,
  );
  const nameOf = (id) => heroes.find((h) => h.id === id)?.name ?? id;
  const nameA = nameOf(aId);
  const nameB = nameOf(bId);

  console.log(`Today's debate (${date}): ${nameA} vs ${nameB}`);

  const cardUrl = `${origin}/api/og?type=debate&a=${encodeURIComponent(aId)}&b=${encodeURIComponent(bId)}`;
  console.log(`Fetching card: ${cardUrl}`);
  const res = await fetch(cardUrl);
  if (!res.ok) {
    console.error(`Card fetch failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5_000) {
    console.error(`Suspiciously small card response (${buf.length} bytes) — not proceeding.`);
    process.exit(1);
  }

  const dir = join(OUT_DIR, 'daily-debate', date);
  mkdirSync(dir, { recursive: true });
  const cardPath = join(dir, 'card.png');
  writeFileSync(cardPath, buf);

  const matchupUrl = `mythique.app/compare/${aId}/${bId}`;
  const caption =
    `${hook || `${nameA} vs ${nameB} — the debate's live 🔥`}\n` +
    `Who wins? Vote now — link in bio.\n${matchupUrl}\n` +
    `#${slug(nameA)} #${slug(nameB)} #whowouldwin #versus #comics`;
  writeFileSync(join(dir, 'caption.txt'), caption);
  console.log(`Card saved → ${cardPath} (${(buf.length / 1024).toFixed(0)} KB)`);

  if (dry) {
    console.log('--dry-run: skipping Cloudinary upload + social_posts registration.');
    console.log(caption);
    return;
  }

  const E = creds();
  cloudinary.config({
    cloud_name: E.CLOUDINARY_CLOUD_NAME,
    api_key: E.CLOUDINARY_API_KEY,
    api_secret: E.CLOUDINARY_API_SECRET,
  });
  const batch = `daily-debate-${date}`;
  const upload = await cloudinary.uploader.upload(cardPath, {
    public_id: `mythique/social/${batch}/1-card`,
    overwrite: true,
    resource_type: 'image',
  });
  console.log(`Uploaded → ${upload.secure_url}`);

  const row = {
    batch,
    ord: 1,
    day: null,
    kind: 'debate',
    title: `Today's debate — ${nameA} vs ${nameB}`,
    image_url: upload.secure_url,
    slide_urls: [upload.secure_url],
    caption,
    guide_where: 'IG feed · X → story + poll',
    guide_when: '12:00–14:00',
    ad_safety: 'organic',
    media_type: 'image',
    angle: 'matchup',
  };

  const upsertRes = await fetch(`${env.url}/rest/v1/social_posts?on_conflict=batch,ord`, {
    method: 'POST',
    headers: {
      apikey: E.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${E.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([row]),
  });
  if (!upsertRes.ok) {
    console.error(`social_posts upsert failed: ${upsertRes.status} ${await upsertRes.text()}`);
    process.exit(1);
  }
  console.log(`Registered → social_posts (${batch} #1). Command center › Social will pick it up.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
