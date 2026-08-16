-- Twelve of the twenty-one scheduled jobs do nothing but `net.http_post` at an
-- edge function. They return in about 60 milliseconds and pg_cron records
-- 'succeeded' — which is true, and useless. It means the POST was queued. The
-- function may have 500'd, timed out, or not been deployed at all, and the
-- command center would still show a green dot. Over seven days those twelve jobs
-- reported zero failures, which is not evidence of anything.
--
-- The response does exist: pg_net writes it to net._http_response. Two things
-- stopped anyone using it. There is no way back from a response to the job that
-- caused it — _http_response carries an id and no url, and http_request_queue,
-- which does carry the url, is drained as requests complete. And the response is
-- deleted after roughly six hours, so by morning the night's outcomes are gone.
--
-- So the request id is kept at the moment it is created, when the job name is
-- still in scope, and the outcome is copied across before pg_net discards it.
-- Reconciliation is not a new cron: invoke_edge_function reconciles pending rows
-- on its way in, and since at least one job posts every hour, nothing pending
-- can age past the six-hour window before being read.

create table if not exists public.edge_invocations (
  id          bigserial primary key,
  jobname     text        not null,
  fn          text        not null,
  request_id  bigint,
  queued_at   timestamptz not null default now(),
  -- Filled in by reconcile_edge_invocations, from net._http_response.
  status_code int,
  timed_out   boolean,
  error_msg   text,
  settled_at  timestamptz
);

create index if not exists edge_invocations_pending_idx
  on public.edge_invocations (request_id)
  where settled_at is null;

create index if not exists edge_invocations_recent_idx
  on public.edge_invocations (jobname, queued_at desc);

alter table public.edge_invocations enable row level security;
-- No policy: this is operational telemetry read through an admin RPC only.
-- Without one, anon and authenticated read zero rows, which is intended.

comment on table public.edge_invocations is
  'One row per cron-triggered edge-function POST, with the outcome copied from net._http_response before pg_net drops it. Pruned at 30 days by prune_operational_logs.';

create or replace function public.reconcile_edge_invocations()
returns integer
language sql
security definer
set search_path to 'public'
as $function$
  with settled as (
    update public.edge_invocations i
    set status_code = r.status_code,
        timed_out   = r.timed_out,
        -- Only the first line: a 500 from an edge function can carry a whole
        -- stack trace, and this table is a signal, not a log sink.
        error_msg   = left(r.error_msg, 200),
        settled_at  = now()
    from net._http_response r
    where r.id = i.request_id
      and i.settled_at is null
    returning 1
  )
  select count(*)::int from settled;
$function$;

create or replace function public.invoke_edge_function(
  p_fn         text,
  p_body       jsonb   default '{}'::jsonb,
  p_jobname    text    default null,
  p_timeout_ms integer default 120000
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_url text;
  v_key text;
  v_req bigint;
begin
  -- Settle whatever is outstanding while the responses still exist. Cheap: the
  -- pending index makes this a handful of rows, and it costs one statement on a
  -- job that is about to make a network call anyway.
  perform public.reconcile_edge_invocations();

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY';
  if v_url is null or v_key is null then
    raise exception 'invoke_edge_function: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from vault';
  end if;

  select net.http_post(
    url     := v_url || '/functions/v1/' || p_fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := p_body || jsonb_build_object('triggeredBy', 'cron'),
    timeout_milliseconds := p_timeout_ms
  ) into v_req;

  insert into public.edge_invocations (jobname, fn, request_id)
  values (coalesce(p_jobname, p_fn), p_fn, v_req);

  return v_req;
end;
$function$;

revoke execute on function public.invoke_edge_function(text, jsonb, text, integer) from anon, authenticated, public;
revoke execute on function public.reconcile_edge_invocations() from anon, authenticated, public;
grant execute on function public.invoke_edge_function(text, jsonb, text, integer) to service_role;
grant execute on function public.reconcile_edge_invocations() to service_role;;
