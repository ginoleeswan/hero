-- Request context (IP + user agent) on page_views, and bot classification.
--
-- WHY: on 2026-09-15 an undeclared crawler walked the sitemap overnight and
-- booked 1,123 "visitors" against a ~12/day baseline, making every audience
-- headline meaningless. We could not identify it, because the only thing we
-- stored about a visit was a random session id. Two changes fix that:
--
--   1. Capture what the server already sees on every insert — the client IP
--      and the user-agent string — so a crawl is attributable.
--   2. Classify each view as bot/not, so the read RPCs can exclude them by
--      default without deleting anything.
--
-- PRIVACY. This is a deliberate reversal of the earlier "no IP is ever stored"
-- stance (see 20260915141447). An IP is personal data in most jurisdictions,
-- so three things keep it proportionate, and they are load-bearing:
--   * page_views stays insert-only and RLS-locked; `ip` is readable ONLY through
--     the admin-guarded RPCs, never by the client that wrote it.
--   * Raw IPs are purged after PAGE_VIEW_IP_RETENTION_DAYS (30) by the
--     purge_page_view_ips() cron below. Aggregates are unaffected: they key on
--     session_id, which is not purged.
--   * OUTSTANDING: the privacy policy (src/lib/legal.ts) still describes the
--     analytics as "privacy-friendly, aggregate" and does not mention an IP.
--     That copy MUST be updated before this ships to production traffic, and
--     the open question is whether to keep the full address at all or store
--     only a /24 (IPv4) / /48 (IPv6) prefix, which detects the session
--     rotation this was built for without retaining a per-person identifier.
--
-- The IP is taken from the request headers server-side, NOT from the client
-- payload, and it always overwrites whatever the client sent. A client cannot
-- forge the value stored here (it can forge its user-agent, as always).

alter table public.page_views
  add column if not exists ip         text,    -- client IP from x-forwarded-for; purged after 30 days
  add column if not exists user_agent text,    -- raw UA string, as the server saw it
  add column if not exists is_bot     boolean not null default false,
  add column if not exists bot_reason text;    -- which rule flagged it, for auditability

create index if not exists page_views_is_bot_created_idx
  on public.page_views (is_bot, created_at desc);
create index if not exists page_views_ip_idx
  on public.page_views (ip) where ip is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Pure UA classifier. Returns a bot_reason, or null for "looks like a person".
-- Immutable + pure so it can be unit-tested and used in a backfill.
--
-- Ordering matters only for which label wins; every branch means "bot".
-- Note the app's NATIVE build never writes page_views (recordPageView is
-- web-only), so mobile-SDK agents like okhttp/java are unambiguously bots here.
create or replace function public.classify_user_agent(p_ua text)
returns text
language sql
immutable
as $function$
  select case
    -- A browser always sends one. Absent means a script that did not bother.
    when p_ua is null or btrim(p_ua) = '' then 'no-user-agent'
    -- Automation that does not hide: headless runtimes and driver stacks.
    when p_ua ~* '(headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver|electron/)'
      then 'headless-browser'
    -- Raw HTTP clients and scraping frameworks.
    when p_ua ~* '(python-requests|python-urllib|curl/|wget|go-http-client|node-fetch|axios|okhttp|java/|libwww|scrapy|httpx|aiohttp|guzzle|postman)'
      then 'http-client'
    -- Self-declared crawlers, including every engine in the vercel.json
    -- user-agent rewrites plus the SEO suites.
    when p_ua ~* '(bot|crawl|spider|slurp|scrape|feedfetcher|ahrefs|semrush|mj12|dotbot|bytespider|petalbot|gptbot|claudebot|perplexity|diffbot)'
      then 'declared-bot'
    else null
  end;
$function$;

comment on function public.classify_user_agent(text) is
  'Bot reason for a user-agent string, or null when it looks like a real browser. Pure.';

-- ─────────────────────────────────────────────────────────────────────────────
-- BEFORE INSERT trigger: stamp the request context and classify.
--
-- current_setting('request.headers') is populated by PostgREST for every REST
-- call. It is absent on a direct psql/pooler connection (a migration, a cron
-- job), hence the `true` missing_ok and the null guards — a server-side insert
-- simply records no IP rather than failing.
create or replace function public.page_views_stamp_request()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_headers json;
  v_ua text;
  v_ip text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;  -- malformed/absent GUC must never block the insert
  end;

  if v_headers is not null then
    v_ua := v_headers ->> 'user-agent';
    -- x-forwarded-for is a chain "client, proxy1, proxy2" — the client is first.
    v_ip := nullif(btrim(split_part(coalesce(
              v_headers ->> 'x-forwarded-for',
              v_headers ->> 'cf-connecting-ip',
              v_headers ->> 'x-real-ip',
              ''), ',', 1)), '');
  end if;

  -- Server truth wins, and a client-supplied `ip` is always discarded: without
  -- this assignment anyone could POST a fabricated address into the table.
  new.ip := v_ip;
  new.user_agent := coalesce(v_ua, new.user_agent);

  new.bot_reason := public.classify_user_agent(new.user_agent);
  new.is_bot := new.bot_reason is not null;

  return new;
end;
$function$;

drop trigger if exists page_views_stamp_request_trg on public.page_views;
create trigger page_views_stamp_request_trg
  before insert on public.page_views
  for each row execute function public.page_views_stamp_request();

-- ─────────────────────────────────────────────────────────────────────────────
-- Behavioural pass, for crawlers that present a normal browser UA.
--
-- The 2026-09-15 crawl rotated session ids: 1,080 sessions averaging 1.9 views
-- each, so no per-session "visited 50 pages" rule would have caught it. What it
-- could not hide was the IP. Two IP-level signals, both admin-tunable:
--
--   * session rotation — one IP behind many distinct session ids in a day
--   * request rate     — one IP making an implausible number of views in an hour
--
-- Marks matching rows is_bot, and never un-marks: a row already flagged by its
-- user-agent keeps that (more specific) reason. Returns the number of rows
-- newly flagged. Idempotent, so the cron can re-run it freely.
create or replace function public.classify_bot_traffic(
  p_days           integer default 2,
  p_max_sessions   integer default 8,    -- distinct sessions per IP per day
  p_max_views_hour integer default 120   -- views per IP per hour
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_since timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 2), 1));
  v_flagged integer := 0;
begin
  with candidates as (
    select ip, date_trunc('day', created_at) as day
    from public.page_views
    where created_at >= v_since and ip is not null and not is_bot
    group by 1, 2
    having count(distinct session_id) > p_max_sessions
  ),
  rate as (
    select ip, date_trunc('hour', created_at) as hour
    from public.page_views
    where created_at >= v_since and ip is not null and not is_bot
    group by 1, 2
    having count(*) > p_max_views_hour
  ),
  updated as (
    update public.page_views pv
    set is_bot = true,
        bot_reason = case
          when exists (select 1 from candidates c
                        where c.ip = pv.ip and c.day = date_trunc('day', pv.created_at))
            then 'ip-session-rotation'
          else 'ip-request-rate'
        end
    where pv.created_at >= v_since
      and not pv.is_bot
      and pv.ip is not null
      and (exists (select 1 from candidates c
                    where c.ip = pv.ip and c.day = date_trunc('day', pv.created_at))
        or exists (select 1 from rate r
                    where r.ip = pv.ip and r.hour = date_trunc('hour', pv.created_at)))
    returning 1
  )
  select count(*) into v_flagged from updated;

  return v_flagged;
end;
$function$;

revoke all on function public.classify_bot_traffic(int, int, int) from public, anon;
grant execute on function public.classify_bot_traffic(int, int, int) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Retention: drop raw IPs older than 30 days. Everything the audience panels
-- compute keys on session_id, so purging costs no analytics — it only removes
-- the ability to attribute a months-old visit to an address.
create or replace function public.purge_page_view_ips(p_keep_days integer default 30)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_purged integer;
begin
  with cleared as (
    update public.page_views
    set ip = null
    where ip is not null
      and created_at < now() - make_interval(days => greatest(coalesce(p_keep_days, 30), 1))
    returning 1
  )
  select count(*) into v_purged from cleared;
  return v_purged;
end;
$function$;

revoke all on function public.purge_page_view_ips(int) from public, anon;
grant execute on function public.purge_page_view_ips(int) to service_role;

-- Hourly behavioural sweep; nightly IP purge. Re-running cron.schedule with the
-- same job name replaces the existing schedule.
select cron.schedule(
  'classify-bot-traffic',
  '17 * * * *',
  $cron$ select public.classify_bot_traffic(2); $cron$
);
select cron.schedule(
  'purge-page-view-ips',
  '23 3 * * *',
  $cron$ select public.purge_page_view_ips(30); $cron$
);
