import { supabase } from '../supabase';

// Presence heartbeat. Stamps the signed-in user's last_seen_at server-side via
// the touch_last_seen() RPC (no-op for anon). Fire-and-forget: presence is a
// nice-to-have signal, never worth surfacing an error or blocking the UI.
export async function touchLastSeen(): Promise<void> {
  // NOTE: `touch_last_seen` is absent from database.generated.ts until the
  // migration is applied and types are regenerated (Supabase MCP). The name cast
  // keeps this compiling in the meantime; drop it after regeneration.
  const { error } = await supabase.rpc('touch_last_seen' as never);
  if (error) {
    // Swallow — heartbeat failures are non-fatal.
  }
}
