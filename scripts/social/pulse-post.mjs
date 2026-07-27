#!/usr/bin/env node
// Pulse → social. Composes at most ONE post a day from whatever the Pulse feed
// says actually happened, and queues it for review. It never publishes.
//
//   node scripts/social/pulse-post.mjs            # compose + queue today's post
//   node scripts/social/pulse-post.mjs --dry-run  # compose + print, write nothing
//   node scripts/social/pulse-post.mjs --force    # recompose even if today has one
//
// Design: docs/superpowers/specs/2026-07-27-pulse-reach-design.md §2
//
// The Social Studio factory already composes posts; what it lacked was a reason
// to fire TODAY. It draws from a catalogue that is the same on Tuesday as it was
// in March. The Pulse is dated by construction — a trailer that dropped, a
// character being read ten times more than usual, a convention that is running —
// so it is exactly the trigger the factory was missing.
//
// Three hard rules, all from the spec, all enforced here rather than by
// convention:
//
//   1. The gate is mandatory. Nothing reaches the queue without assertSafeClaim.
//   2. One post a day, and NONE on a day where nothing happened. Silence is a
//      valid and frequent outcome — most days the honest answer is nothing.
//   3. Queue, never publish. `posted_at` stays null and there is no publish path
//      in this file. A human decides.
//
// Writes need the service role: social_posts has no insert policy for anon.
import { loadEnv, makeSb, REAL_PERSON_FILTER } from './lib.mjs';
import { portraitPlan } from './safety.mjs';
import {
  pickPost,
  composePost,
  assertSafeClaim,
  sourceKeyFor,
  isLive,
  parseTs,
  REPEAT_LOOKBACK_DAYS,
  MAX_AGE_HOURS,
  POST_KINDS,
} from './pulse-claim.mjs';

const dry = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Characters from a trailer's title that have a page here — the one thing this
 *  account can say that a film-news account cannot. Fame-ordered so the names a
 *  reader recognises come first. */
async function trailerCast(sb, titleId, limit = 6) {
  const links = await sb.rest(
    `hero_media_appearances?title_id=eq.${encodeURIComponent(titleId)}&select=hero_id&limit=60`,
  );
  const ids = [...new Set(links.map((l) => l.hero_id).filter(Boolean))];
  if (!ids.length) return [];
  const inList = ids.map((id) => `"${id}"`).join(',');
  return sb.rest(
    `heroes?id=in.(${encodeURIComponent(inList)})` +
      `&select=id,name,fame_score,publisher,portrait_url,image_url,image_md_url` +
      `${REAL_PERSON_FILTER}&order=fame_score.desc.nullslast&limit=${limit}`,
  );
}

/** The image a reviewer attaches. Goes through portraitPlan so the ad-safety
 *  tier system governs it even here — organic is unrestricted today, but the
 *  policy lives in one place and this follows it rather than reimplementing it. */
function pickImage(hero, fallback) {
  if (!hero) return fallback;
  for (const f of portraitPlan(hero, 'organic').fields) if (hero[f]) return hero[f];
  return fallback;
}

async function main() {
  const env = loadEnv();
  const sb = makeSb(env);
  const now = Date.now();
  const today = isoDay(now);
  const batch = `pulse-${today}`;

  // Rule 2, first half: one post a day. The unique (batch, ord) key would make a
  // second run an upsert rather than a duplicate, but overwriting a post a human
  // may already be reviewing is its own bug — so check, don't clobber.
  const existing = await sb.rest(
    `social_posts?batch=eq.${batch}&select=id,title,source_key&limit=1`,
  );
  if (existing.length && !force) {
    console.log(`Today already has a Pulse post: "${existing[0].title}". --force to recompose.`);
    return;
  }

  const candidates = await sb.rpc('get_pulse_candidates', { p_per_kind: 20 });

  // Rule 2, second half: never post about the same event twice. Events outlive a
  // day — a trailer stays a candidate for a fortnight — so without this the
  // composer would happily post the same drop every morning until it decayed.
  const since = new Date(now - REPEAT_LOOKBACK_DAYS * 86_400_000).toISOString();
  const recent = await sb.rest(
    `social_posts?source_key=not.is.null&created_at=gte.${since}&select=source_key&limit=200`,
  );
  const posted = new Set(recent.map((r) => r.source_key));

  const pick = pickPost(candidates, now, posted);
  if (!pick) {
    // Not a failure. Most days nothing happened, and the alternative — posting
    // the weekly comic shipment because the feed was quiet — is how an account
    // teaches people to ignore it.
    const kinds = candidates.reduce((a, c) => ({ ...a, [c.kind]: (a[c.kind] ?? 0) + 1 }), {});
    console.log(`Nothing worth posting today. Feed: ${JSON.stringify(kinds)}`);
    console.log(
      `(postable kinds ${POST_KINDS.join('/')}; max age trailer ${MAX_AGE_HOURS.trailer}h / surge ${MAX_AGE_HOURS.surge}h; ` +
        `${posted.size} event${posted.size === 1 ? '' : 's'} already covered in the last ${REPEAT_LOOKBACK_DAYS} days)`,
    );
    return;
  }

  // A live event's post is a digest of what the catalogue saw inside its window,
  // so it needs the rest of the feed rather than just its own row.
  const inWindow =
    pick.kind === 'live_event'
      ? candidates.filter(
          (c) =>
            c !== pick &&
            c.kind !== 'issue' &&
            c.occurred_at &&
            isoDay(parseTs(c.occurred_at)) >= pick.window_from,
        )
      : [];

  const cast = pick.kind === 'trailer' ? await trailerCast(sb, pick.entity_id) : [];

  let hero = null;
  if (pick.kind === 'surge') {
    const rows = await sb.rest(
      `heroes?id=eq.${encodeURIComponent(pick.entity_id)}` +
        `&select=id,name,publisher,portrait_url,image_url,image_md_url&limit=1`,
    );
    hero = rows[0] ?? null;
  }

  const post = composePost({ candidate: pick, cast, inWindow, nowMs: now });

  // Rule 1. Throws rather than softening: a blocked post costs a quiet day, a
  // wrong one costs the account.
  assertSafeClaim(post);

  const image = pickImage(hero, pick.image_url ?? null);
  const row = {
    batch,
    ord: 1,
    day: null,
    kind: 'pulse',
    angle: pick.kind,
    title: post.title,
    image_url: image,
    // NOT NULL. A news post is single-image by nature, so the "carousel" is the
    // one image — same shape publish-posts writes for every other single asset.
    slide_urls: image ? [image] : [],
    caption: post.caption,
    guide_where: 'X first — news moves there · IG feed · Threads',
    guide_when: 'Within a few hours. This one has a shelf life.',
    ad_safety: 'organic',
    media_type: 'image',
    source_key: sourceKeyFor(pick, now),
    // Rule 3. Queued, not published.
    posted_at: null,
  };

  console.log(`\n${'─'.repeat(64)}`);
  console.log(`${row.title}   [${pick.kind}]`);
  console.log(`${'─'.repeat(64)}\n${post.caption}\n`);
  console.log(`image     ${row.image_url ?? '(none)'}`);
  console.log(`source    ${row.source_key}`);
  if (pick.kind === 'trailer' && pick.media_key) {
    console.log(`trailer   https://www.youtube.com/watch?v=${pick.media_key}`);
  }
  if (pick.kind === 'live_event') {
    console.log(
      `window    ${pick.window_from} → ${pick.window_to ?? 'open'} (live: ${isLive(pick, now)})`,
    );
  }

  if (dry) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  const res = await fetch(`${env.url}/rest/v1/social_posts?on_conflict=batch,ord`, {
    method: 'POST',
    headers: { ...sb.headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([row]),
  });
  if (!res.ok) {
    console.error(`social_posts upsert failed: ${res.status} ${await res.text()}`);
    console.error(
      '(inserts need SUPABASE_SERVICE_ROLE_KEY in .env.local — anon has no insert policy)',
    );
    process.exit(1);
  }
  console.log(
    `\nQueued → social_posts (${batch} #1). Command center › Social to review and publish.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
