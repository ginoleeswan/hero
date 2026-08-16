-- What a campaign cost, and whether it bought an audience.
--
-- Measured 2026-08-16, and the reason both of these are missing: the July TikTok
-- spend bought 1,896 sessions of which 93% bounced and 15 reached a character
-- page. The channel CSV could show views, likes, comments and shares — enough to
-- prove the paid days ran at a 0.05% like rate against 9.19% organic — but not
-- enough to answer either question that decides whether to spend again:
--
--   Did it grow the ACCOUNT? Followers are the only thing a campaign buys that
--     does not evaporate when the spend stops. Traffic is rented: TikTok
--     referrals went to zero the day after the budget ended. A follower can be
--     posted to for free, forever, so it is the asset and sessions are the
--     receipt.
--
--   What did it COST? Nothing in this database knew. Cost-per-anything had to be
--     supplied by hand every time somebody asked, which in practice means nobody
--     asks.
--
-- Two changes, because these arrive in two different files. Followers are in
-- TikTok Studio's Overview export alongside the metrics already imported. Spend
-- is in Ads Manager, a separate export with a separate shape — hence a table
-- rather than another column.

alter table public.social_channel_stats
  add column if not exists followers integer,
  add column if not exists follower_change integer;

comment on column public.social_channel_stats.followers is
  'Total account followers at end of day, when the export reports a running total. NULL for exports that only report the daily change.';
comment on column public.social_channel_stats.follower_change is
  'Net new followers that day ("New followers" in TikTok Studio). The column that actually shows whether a campaign bought an audience.';

-- Spend, keyed so it can be joined to session_attribution.utm_campaign and
-- therefore to real sessions. One row per campaign per day: campaigns are tuned
-- daily and a single total hides the day a creative stopped working.
create table if not exists public.ad_spend (
  platform      text not null,
  campaign      text not null,
  day           date not null,
  -- Minor units (cents) in the account's own currency, because storing money as
  -- a float is how rounding errors become invoices nobody can reconcile.
  spend_minor   bigint not null check (spend_minor >= 0),
  currency      text not null default 'ZAR',
  impressions   bigint,
  clicks        bigint,
  note          text,
  imported_at   timestamptz not null default now(),
  primary key (platform, campaign, day)
);

comment on table public.ad_spend is
  'Advertising spend by campaign and day. `campaign` is matched against session_attribution.utm_campaign, so a campaign tagged in its destination URL can be costed per session. Populated from an Ads Manager CSV or by hand.';
comment on column public.ad_spend.spend_minor is
  'Cents, not a decimal. R1 234.56 is 123456.';

alter table public.ad_spend enable row level security;

-- Admin-only: spend is commercial data and nothing in the app renders it. No
-- public read policy on purpose — a new table with RLS on and no policy returns
-- zero rows to anon, which is the intended behaviour here rather than a bug.
create policy "ad_spend is service-role only"
  on public.ad_spend for all
  using (false) with check (false);
