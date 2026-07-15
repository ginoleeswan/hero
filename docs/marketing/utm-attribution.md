# UTM attribution — measuring what paid social actually does for the app

TikTok Promote tells you views, likes, comments, followers and **profile views**.
What it can't tell you is the step that matters: of the people who tapped your
profile, how many reached the app and signed up. That step happens on
**mythique.app**, off TikTok — so we measure it ourselves.

This doc is the link-tagging convention that makes that measurement work. Tag a
link once and every visit, event and signup it produces is bucketed by campaign
in the admin **Traffic → Acquisition** panel.

## Why this matters (from the July promotes)

Across ~R690 of Promote spend (28 days): **38.8K views → 409 profile views → 30
new followers.** Those 409 profile views are the real top-of-funnel — the profile
is where the bio link lives, and the bio link is the only door to the app. Right
now that door is **untagged**, so we can't see how many of the 409 walked through
it. Tagging it turns "409 profile views" into "N app visits, M signups, by
campaign."

## How it works

- `src/lib/attribution.ts` captures **first-touch** attribution on landing — the
  `utm_*` params on the URL (or the referring host if untagged) — and pins it for
  the browser session.
- Every conversion event (`sign_up`, `log_in`, `matchup_vote`, …) is tagged with
  that source (`src/lib/analytics.ts`).
- One row per session is written to `session_attribution` and joined to page
  views server-side, surfacing in **admin → Traffic → Acquisition**
  (`admin_traffic_overview`).

First-touch wins: if someone arrives from the TikTok bio today and returns direct
next week, they stay attributed to `bio`.

> **One-time setup:** apply the migration
> `supabase/migrations/20260715170000_session_attribution.sql`
> (`mcp__supabase__apply_migration`), then regenerate `database.generated.ts`.
> Until it's applied the client degrades cleanly — events still carry UTM tags;
> the Acquisition panel just stays empty and the write retries harmlessly.

## The links to use

Base everything on the production origin `https://mythique.app`. Convention:
lowercase, no spaces, hyphens not underscores in values.

### 1. The bio link (most important — do this first)

Every profile view funnels through it. Put this in the TikTok profile's website
field:

```
https://mythique.app/?utm_source=tiktok&utm_medium=social&utm_campaign=bio
```

### 2. Per-post / per-promote links

When a specific post or Promote drives to a specific place, give it its own
`utm_campaign` so you can compare creatives. Match the campaign name to the
creative:

```
# "Name ONE who beats Aquaman" — deep-link straight into the matchup
https://mythique.app/compare/<aquaman-id>/<opponent-id>?utm_source=tiktok&utm_medium=paid&utm_campaign=aquaman-challenge

# "Top 10 Most Famous Villains" ranking
https://mythique.app/?utm_source=tiktok&utm_medium=paid&utm_campaign=villains-top10
```

Use `utm_medium=paid` for anything behind Promote/ad spend and `utm_medium=social`
for organic posts — so you can separate paid from organic acquisition at a glance.

### Parameter cheatsheet

| Param          | Use                       | Examples                                     |
| -------------- | ------------------------- | -------------------------------------------- |
| `utm_source`   | the platform              | `tiktok`, `instagram`, `reddit`              |
| `utm_medium`   | paid vs organic           | `paid`, `social`, `referral`                 |
| `utm_campaign` | the creative / initiative | `bio`, `aquaman-challenge`, `villains-top10` |
| `utm_content`  | A/B variant (optional)    | `hook-a`, `hook-b`                           |

## Reading the results

- **Admin → Traffic → Acquisition** — first-touch visitors and how many signed in,
  per campaign. This is the money view: `aquaman-challenge → 120 visitors, 14
signed in`.
- **Top referrers** (same tab) still catches untagged organic clicks by host.
- Keep the campaign vocabulary small and consistent — every distinct spelling is
  a separate row.

## Tips

- Tag the link **before** the next Promote so the batch is measurable end to end.
- Shorten the long deep-links with any link shortener for the caption; the `utm_*`
  params must survive the redirect (most shorteners preserve query strings).
- Don't tag internal links between app pages — first-touch already covers the
  whole session, and internal tags would overwrite the real source.
