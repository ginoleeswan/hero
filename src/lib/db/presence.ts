import { supabase } from '../supabase';

// Presence heartbeat. Stamps the signed-in user's last_seen_at server-side via
// the touch_last_seen() RPC (no-op for anon). Fire-and-forget: presence is a
// nice-to-have signal, never worth surfacing an error or blocking the UI.
export async function touchLastSeen(): Promise<void> {
  const { error } = await supabase.rpc('touch_last_seen');
  if (error) {
    // Swallow — heartbeat failures are non-fatal.
  }
}
