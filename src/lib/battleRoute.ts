/**
 * Decide where a built matchup goes. A 1-v-1 reuses the proven single-pair arena
 * at /compare/[hero]/[opponent]; anything larger (or asymmetric) becomes a drafted
 * team battle whose two rosters travel in the URL so it is reload-safe and
 * shareable. Returns null when a side is empty.
 */
export function resolveBattleRoute(aIds: string[], bIds: string[]): string | null {
  if (aIds.length === 0 || bIds.length === 0) return null;
  if (aIds.length === 1 && bIds.length === 1) {
    return `/compare/${aIds[0]}/${bIds[0]}`;
  }
  const a = encodeURIComponent(aIds.join(','));
  const b = encodeURIComponent(bIds.join(','));
  return `/versus/team/draft?a=${a}&b=${b}`;
}
