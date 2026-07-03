// Share copy shared by the web app (share buttons) and the bot-facing
// share-meta function (api/_lib/shareMeta.ts). Pure string logic only.

/** "Goku vs Superman — 78% say Goku. You?" (falls back cleanly with no votes). */
export function vsShareLine(
  nameA: string,
  nameB: string,
  votesA: number,
  votesB: number
): string {
  const total = votesA + votesB;
  if (total > 0) {
    const aLeads = votesA >= votesB;
    const pct = Math.round(((aLeads ? votesA : votesB) / total) * 100);
    return `${nameA} vs ${nameB} — ${pct}% say ${aLeads ? nameA : nameB}. You?`;
  }
  return `${nameA} vs ${nameB} — who wins? Cast your vote on Mythique.`;
}
