// Share copy AND share links, shared by the native app, the web app and the
// bot-facing share-meta function (api/_lib/shareMeta.ts). Pure string logic only.
//
// The links live here because native was not sending any. Every native share
// except the universe button put a bare sentence in the share sheet — no URL —
// so the OG cards in api/og could never render for a share that came from the
// app, and a recipient had nothing to tap. The character share went further and
// named the product "Hero", which is the repo slug, not the app.
//
// A share URL is a growth surface, so it is worth stating the rule: every share
// carries a link, the link is canonical (it resolves to a page a crawler can
// unfurl), and the product is called Mythique.
import { SITE_URL } from '../constants/site';

/** Canonical, crawler-resolvable links for everything the app can share. */
export const shareLink = {
  character: (id: string) => `${SITE_URL}/character/${encodeURIComponent(id)}`,
  versus: (a: string, b: string) =>
    `${SITE_URL}/compare/${encodeURIComponent(a)}/${encodeURIComponent(b)}`,
  /**
   * Today's curated debate. Same page as `versus`, marked so the crawler
   * rewrite can pick the richer debate card (live split + the crowned take)
   * instead of the plain head-to-head one. The app ignores the extra param.
   */
  debate: (a: string, b: string) =>
    `${SITE_URL}/compare/${encodeURIComponent(a)}/${encodeURIComponent(b)}?debate=1`,
  universe: (id: string) => `${SITE_URL}/social-web/${encodeURIComponent(id)}`,
  house: (slug: string) => `${SITE_URL}/house/${encodeURIComponent(slug)}`,
  event: (slug: string) => `${SITE_URL}/event/${encodeURIComponent(slug)}`,
  title: (id: string) => `${SITE_URL}/title/${encodeURIComponent(id)}`,
  daily: () => `${SITE_URL}/play`,
} as const;

/** The bare domain, for print on a poster where a full URL would be noise. */
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, '');

/** "Goku vs Superman — 78% say Goku. You?" (falls back cleanly with no votes). */
export function vsShareLine(nameA: string, nameB: string, votesA: number, votesB: number): string {
  const total = votesA + votesB;
  if (total > 0) {
    const aLeads = votesA >= votesB;
    const pct = Math.round(((aLeads ? votesA : votesB) / total) * 100);
    return `${nameA} vs ${nameB} — ${pct}% say ${aLeads ? nameA : nameB}. You?`;
  }
  return `${nameA} vs ${nameB} — who wins? Cast your vote on Mythique.`;
}

/** The line that goes out with a character page. */
export function characterShareLine(name: string, publisher?: string | null): string {
  return publisher
    ? `${name} — ${publisher} — on Mythique.`
    : `${name}, on Mythique — powers, stats, allies and every appearance.`;
}

/** The line that goes out with a house page. */
export function houseShareLine(name: string, universe?: string | null): string {
  const where = universe ? ` of ${universe}` : '';
  return `House ${name}${where} — the bloodline, the marriages and the feuds, charted on Mythique.`;
}

/** The line that goes out with an event dossier. */
export function eventShareLine(headline: string, ongoing: boolean): string {
  return ongoing
    ? `${headline} is happening now — Mythique caught it from the readership, not a calendar.`
    : `${headline} — Mythique caught it from the readership, not a calendar.`;
}

/** The line that goes out with a film/TV page. */
export function titleShareLine(title: string, year?: number | null): string {
  return `${title}${year ? ` (${year})` : ''} — every character in it, and who plays them, on Mythique.`;
}

/**
 * Compose a native share payload.
 *
 * iOS takes `message` and `url` as two activity items: Messages renders the
 * sentence AND unfurls the link, Twitter concatenates them. Android has no
 * `url` field at all — passing one silently drops it, which is half of why the
 * app's shares were linkless — so the URL is appended to the message there.
 */
export function nativeShare(
  message: string,
  url: string,
  ios: boolean,
): { message: string; url?: string } {
  return ios ? { message, url } : { message: `${message}\n${url}` };
}
