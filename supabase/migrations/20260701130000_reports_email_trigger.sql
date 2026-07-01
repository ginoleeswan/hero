-- Fire an admin email on each new report. pg_net queues the request inside the
-- txn, so a rolled-back report sends no email and a failed email never blocks
-- the insert. Mirrors the cron net.http_post pattern (anon bearer as in the
-- pipeline crons); the report-alert edge function uses the service role.
create extension if not exists pg_net;

create or replace function public._notify_report_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/report-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('id', NEW.id),
    timeout_milliseconds := 20000
  );
  return NEW;
end;
$$;

drop trigger if exists reports_notify_insert on public.reports;
create trigger reports_notify_insert
  after insert on public.reports
  for each row execute function public._notify_report_insert();
