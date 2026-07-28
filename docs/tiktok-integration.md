# TikTok integration

Mirrors the Instagram insights pipeline (`ig-sync` → `social_post_results` →
Publish › Insights). **Phase 1 (analytics) is built and deployed** but dormant
until the one-time connect below is done — the `tiktok-sync` function returns
`{ error: "TikTok not connected" }` and the "Pull TikTok" button surfaces that.

## The CSV route (LIVE — no developer account needed)

The primary analytics path is now the **TikTok Studio CSV import** — it needs
no app registration, review, OAuth, or secrets, and can't be revoked or
rate-limited. TikTok Studio › Analytics › **Download data** (set the range to
60 days first) offers two exports; Publish › Insights › **Import CSV** accepts
both, auto-detected by header shape:

- **Overview** (daily account totals: views / profile views / likes / comments
  / shares) → upserted into `social_channel_stats`, rendered as the "Channel —
  TikTok daily views" trend panel.
- **Content** (per-post rows) → matched to queue posts **by caption** — the
  same normalised caption key `tiktok-sync` and `ig-sync` use — and written as
  `social_post_results` snapshots (platform=`tiktok`, source=`manual`).

Parser (pure, unit-tested): `src/lib/social/tiktokCsv.ts` · import functions:
`src/lib/db/socialPosts.ts` · tests: `__tests__/lib/social/tiktokCsv.test.ts`.
Cost: ~2 minutes a week. The API connect below remains an **optional upgrade**
(one-click freshness instead of a weekly export) — nothing else on the roadmap
depends on it.

## The hard reality (why comments aren't auto-replied)

TikTok exposes **no reply-to-comments write API** to third-party apps. Reading
comment threads requires the Research API (gated to approved academic
researchers). So the roadmap is:

- **Phase 1 — analytics (DONE, dormant):** pull your videos' views / likes /
  comments / shares via the Display API into `social_post_results`. Feeds the
  Insights tab's per-platform split, best-format, top-posts.
- **Phase 2 — comment triage (planned):** an inbox that lists comments needing
  a reply and **deep-links into the TikTok app** to post the reply. Compliant,
  no account risk. Not auto-reply.
- **Phase 3 — viral-gap explorer (spike):** trending sounds/hashtags cross-
  referenced against the catalog. Trending data is gated/limited — a research
  spike, not a commitment.

## One-time connect (the optional API upgrade)

1. **Register an app** at <https://developers.tiktok.com> (Manage apps → Connect
   an app). Product: **Login Kit** + **Display API**. Request scopes
   `user.info.basic` and `video.list`.
2. **Submit for review.** Provide the app URL, a demo covering each scope, and a
   privacy policy. Approval is typically **1–2 weeks** (first-pass audits are
   clean if every requested scope is demoed and correspondence is answered).
3. **Complete OAuth once** for the Mythique TikTok creator account (any minimal
   OAuth helper works — the redirect returns `access_token`, `refresh_token`,
   `open_id`, `expires_in`).
4. **Store the credential** — insert one row:
   ```sql
   insert into platform_credentials (platform, access_token, refresh_token, external_id, expires_at)
   values ('tiktok', '<access_token>', '<refresh_token>', '<open_id>',
           now() + interval '24 hours');
   ```
5. **Set function secrets** (for the 24h token auto-refresh):
   `supabase secrets set TIKTOK_CLIENT_KEY=… TIKTOK_CLIENT_SECRET=…`

Then "Pull TikTok" in Publish › Insights works exactly like "Pull Instagram" —
and captions are matched the same way (we already generate distinctive captions
you paste verbatim, so no manual linking).

## What's in the repo

- `supabase/functions/tiktok-sync/index.ts` — Display API `video.list` +
  token refresh → `social_post_results` (platform=`tiktok`). Deployed (v1).
- `src/lib/db/socialPosts.ts` → `syncTiktok()`.
- `SocialInsightsDomain` — "Pull TikTok" button; the per-platform split already
  renders any `platform` value generically.
- Migration `…_platform_credentials_refresh_token` — adds `refresh_token`
  (TikTok tokens expire ~24h; Instagram's never needed it).
