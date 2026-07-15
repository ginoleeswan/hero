-- TikTok access tokens expire ~24h and must be refreshed with a refresh_token
-- (~1yr). Instagram's long-lived token never needed one, so the column didn't
-- exist. Additive + nullable — no impact on the existing instagram row.
alter table public.platform_credentials add column if not exists refresh_token text;
