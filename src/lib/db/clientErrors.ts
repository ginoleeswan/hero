import { Platform } from 'react-native';
import { supabase } from '../supabase';
import { captureException } from '../sentry';

// Self-hosted client error collection (web only). Fed by the web ErrorBoundary
// and global window error / unhandledrejection handlers. Fire-and-forget so
// reporting can never throw back into the thing that failed.
//
// client_errors is insert-only + RLS-locked (reads go through
// admin_recent_client_errors). session_id reuses the page_views visitor id so an
// error correlates with that visitor's session.

const MAX_MESSAGE = 1000;
const MAX_STACK = 4000;
const MAX_PER_LOAD = 25; // cap floods from an error loop hammering the handler

let sentThisLoad = 0;
const seen = new Set<string>(); // dedupe identical signatures within a page load

export type ClientErrorKind = 'boundary' | 'error' | 'unhandledrejection';

// Read (never create) the page_views session id so errors correlate with views.
function sessionId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem('mythique_sid');
  } catch {
    return null;
  }
}

/** Record one client error. Web only; deduped + throttled; no-ops on failure. */
export function recordClientError(
  kind: ClientErrorKind,
  message: string,
  opts?: { stack?: string | null; source?: string | null },
): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!message) return;

  const msg = String(message).slice(0, MAX_MESSAGE);
  const signature = `${kind}|${msg}`;
  if (seen.has(signature) || sentThisLoad >= MAX_PER_LOAD) return;
  seen.add(signature);
  sentThisLoad += 1;

  const stack = opts?.stack ? String(opts.stack).slice(0, MAX_STACK) : null;
  const source =
    opts?.source ?? (typeof location !== 'undefined' ? location.pathname + location.search : null);
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null;

  // Mirror the same deduped/throttled stream into Sentry for aggregation +
  // alerting (no-op when no DSN). The self-hosted insert below stays the
  // in-app admin feed — Sentry is additive, not a replacement.
  const forwarded = new Error(msg);
  if (stack) forwarded.stack = stack;
  captureException(forwarded, { kind, source });

  void (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await supabase.from('client_errors').insert({
        kind,
        message: msg,
        stack,
        source,
        user_agent: userAgent,
        user_id: session?.user?.id ?? null,
        session_id: sessionId(),
      });
    } catch {
      // Error reporting must never throw into the caller / handler.
    }
  })();
}

// Attaches global handlers once per page load. Returns a cleanup fn. Call from
// the web root layout so uncaught errors and rejected promises are captured even
// when they never reach a React ErrorBoundary.
export function installGlobalErrorCapture(): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => {};

  const onError = (e: ErrorEvent) => {
    recordClientError('error', e.message || 'Uncaught error', {
      stack: e.error instanceof Error ? e.error.stack : null,
      source: e.filename || undefined,
    });
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    const message =
      reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection');
    recordClientError('unhandledrejection', message, {
      stack: reason instanceof Error ? reason.stack : null,
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

// ── Admin read side ───────────────────────────────────────────────────────────
// Aggregation happens server-side in the admin-guarded admin_recent_client_errors
// RPC (client_errors is RLS-locked to inserts); this wrapper invokes it and
// shapes the loose JSON for the command-center "Errors" domain.

/** A recurring error signature (rows collapsed on message). */
export interface ClientErrorSignature {
  message: string;
  count: number;
  last_seen: string;
  kind: string;
  source: string | null;
}

/** A single raw error row, for drill-down. */
export interface ClientErrorRow {
  id: number;
  kind: string;
  message: string;
  source: string | null;
  stack: string | null;
  created_at: string;
}

export interface ClientErrorOverview {
  rangeDays: number;
  total: number;
  byKind: Record<string, number>;
  top: ClientErrorSignature[];
  recent: ClientErrorRow[];
}

type OverviewJson = ({ authorized: false } | ({ authorized: true } & ClientErrorOverview)) | null;

/**
 * Fetch the error overview for the last `days`. Returns `null` when the caller
 * isn't an admin or on error, so the UI shows a locked/empty state.
 */
export async function fetchClientErrorOverview(days = 7): Promise<ClientErrorOverview | null> {
  const { data, error } = await supabase.rpc('admin_recent_client_errors', { p_days: days });
  if (error) {
    console.warn('[fetchClientErrorOverview] error:', error.message);
    return null;
  }
  const json = data as unknown as OverviewJson;
  if (!json || json.authorized !== true) return null;
  return {
    rangeDays: json.rangeDays,
    total: json.total,
    byKind: json.byKind,
    top: json.top,
    recent: json.recent,
  };
}
