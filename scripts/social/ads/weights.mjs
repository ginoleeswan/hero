// The rebias engine — closes the generate → post → measure → REBIAS loop.
// Turns measured per-post results (social_post_results, imported via the
// Insights CSV button or the sync functions) into a weighted plan cycle, so
// the next batch automatically makes more of what worked.
//
// Principles, in code rather than convention:
//  • MEDIAN views per angle family, never the mean — the sample is tiny and
//    one viral outlier must not own the whole plan.
//  • Every angle keeps at least one slot (exploration floor) and no angle can
//    take more than `maxShare` of the cycle — the plan steers, it never
//    collapses into a single format.
//  • Unmeasured angles get a neutral prior (the median of the measured
//    medians): being new is not evidence of being bad.
//  • Reads need the service-role key (the results table is admin-RLS); when
//    the read fails or there is no data, callers fall back to their static
//    rotation and SAY SO — never a silent behaviour switch.

// Angle → family. Results carry fine-grained organic angles (gauntlet,
// thisorthat, covers…); plans think in the coarser families they steer.
export const FAMILY = {
  matchup: 'matchup',
  thisorthat: 'matchup',
  showdown: 'matchup',
  gauntlet: 'matchup',
  versus: 'matchup',
  ranking: 'ranking',
  leaderboard: 'ranking',
  guess: 'guess',
  fact: 'fact',
  didyouknow: 'fact',
  trailer: 'fact',
  lore: 'lore',
  bloodline: 'lore',
  covers: 'lore',
  legend: 'lore',
  bio: 'lore',
  onscreen: 'lore',
  brand: 'brand',
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : 0;
};

/** rows: [{ angle, views }] (latest snapshot per post) → { family: medianViews }.
 *  Rows with an unknown angle or null views are ignored. */
export function medianViewsByFamily(rows) {
  const byFam = {};
  for (const r of rows ?? []) {
    const fam = FAMILY[r?.angle];
    if (!fam || typeof r.views !== 'number') continue;
    (byFam[fam] ??= []).push(r.views);
  }
  return Object.fromEntries(Object.entries(byFam).map(([f, xs]) => [f, median(xs)]));
}

/** Allocate `slots` plan slots across `families` from measured scores.
 *  Floor of 1 each, cap of `maxShare` each, remainder by score proportion
 *  (largest remainder). Deterministic; ties break by base-list order. Returns
 *  a cycle array with repeats spread out (round-robin, highest count first). */
export function weightedCycle(families, scores, { slots = 7, maxShare = 3 } = {}) {
  const n = families.length;
  if (slots < n) slots = n; // floor guarantee needs one slot each
  const measured = families.map((f) => scores?.[f]).filter((v) => typeof v === 'number');
  const prior = median(measured); // neutral prior for unmeasured families
  const score = (f) => (typeof scores?.[f] === 'number' ? scores[f] : prior);
  const counts = Object.fromEntries(families.map((f) => [f, 1]));
  let extra = slots - n;
  // Largest-remainder over the score distribution, respecting the cap.
  const total = families.reduce((a, f) => a + score(f), 0);
  if (extra > 0 && total > 0) {
    const ideal = families.map((f) => ({ f, want: (extra * score(f)) / total }));
    for (const e of ideal) {
      const take = Math.min(Math.floor(e.want), maxShare - counts[e.f]);
      counts[e.f] += Math.max(0, take);
      e.want -= take;
    }
    let left = slots - families.reduce((a, f) => a + counts[f], 0);
    for (const e of [...ideal].sort((a, b) => b.want - a.want)) {
      if (left <= 0) break;
      if (counts[e.f] < maxShare) {
        counts[e.f] += 1;
        left -= 1;
      }
    }
    // If caps left slots over, hand them to the least-loaded families.
    while (left > 0) {
      const f = families.reduce((a, b) => (counts[a] <= counts[b] ? a : b));
      counts[f] += 1;
      left -= 1;
    }
  }
  // Spread repeats: round-robin passes over families ordered by count desc.
  const order = [...families].sort((a, b) => counts[b] - counts[a]);
  const cycle = [];
  const left = { ...counts };
  while (cycle.length < slots) {
    for (const f of order) {
      if (left[f] > 0) {
        cycle.push(f);
        left[f] -= 1;
      }
    }
  }
  return cycle;
}

/** Latest snapshot per (post, platform) → [{ angle, views }]. Pure so it's
 *  testable; feed it raw social_post_results rows joined to their post angle. */
export function latestAngleViews(results) {
  const seen = new Map(); // post|platform → { recorded_at, angle, views }
  for (const r of results ?? []) {
    const key = `${r.post_id}|${r.platform}`;
    const prev = seen.get(key);
    if (!prev || String(r.recorded_at) > String(prev.recorded_at)) seen.set(key, r);
  }
  return [...seen.values()].map((r) => ({ angle: r.angle, views: r.views }));
}

/** Fetch measured angle views via the shared REST helper (service-role key —
 *  see lib.mjs loadEnv). Returns null when unreadable/empty so callers fall
 *  back to their static rotation. */
export async function fetchAngleViews(sb) {
  try {
    const posts = await sb.rest('social_posts?select=id,angle,kind');
    const results = await sb.rest(
      'social_post_results?select=post_id,platform,views,recorded_at&views=not.is.null',
    );
    if (!Array.isArray(posts) || !Array.isArray(results) || results.length === 0) return null;
    const angleById = new Map(posts.map((p) => [p.id, p.angle ?? p.kind]));
    const rows = latestAngleViews(results.map((r) => ({ ...r, angle: angleById.get(r.post_id) })));
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

/** One-line human summary of a cycle, for plan logs: "matchup×3 ranking×3 brand×1". */
export function describeCycle(cycle) {
  const counts = {};
  for (const f of cycle) counts[f] = (counts[f] ?? 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([f, c]) => `${f}×${c}`)
    .join(' ');
}
