// Builds the persistent "case file" clue under the daily card: the opening of
// the hero's bio with their name, real name and known aliases redacted to ████,
// so it reads like a redacted dossier and never gives the answer away outright.
// Pure + tested.

export interface DossierInput {
  summary: string | null;
  name: string;
  fullName: string | null;
  aliases: string[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Distinctive word-tokens of a name (drops short connecting words). */
function tokenize(s: string | null): string[] {
  if (!s) return [];
  return s.split(/[^A-Za-z0-9]+/).filter((t) => t.length >= 3);
}

/** Replace every occurrence of the hero's name / aliases / real name with █s. */
export function redactName(summary: string, names: Omit<DossierInput, 'summary'>): string {
  const phrases = [names.name, names.fullName ?? '', ...names.aliases];
  const tokens = [...tokenize(names.name), ...tokenize(names.fullName)];
  const terms = Array.from(new Set([...phrases, ...tokens]))
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  if (terms.length === 0) return summary;
  // Longest first so multi-word phrases redact before their parts.
  terms.sort((a, b) => b.length - a.length);
  const re = new RegExp(`\\b(${terms.map(escapeRegExp).join('|')})\\b`, 'gi');
  return summary.replace(re, (m) => m.replace(/\S/g, '█'));
}

/** First sentence(s) of `text`, up to roughly `maxLen` characters. */
export function firstSentences(text: string, maxLen = 180): string {
  const parts = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  let out = '';
  for (const part of parts) {
    const t = part.trim();
    if (out && (out + ' ' + t).length > maxLen) break;
    out = out ? out + ' ' + t : t;
    if (out.length >= maxLen) break;
  }
  return (out || text).trim();
}

export function buildDossier(input: DossierInput): string | null {
  const summary = input.summary?.trim();
  if (!summary) return null;
  const line = firstSentences(redactName(summary, input));
  return line.length > 0 ? line : null;
}
