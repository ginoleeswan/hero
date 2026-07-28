// TikTok Studio CSV parsing — the no-API analytics route.
// TikTok Studio › Analytics › Download data offers two exports and we accept
// both, auto-detected by header shape:
//   • Overview — daily account totals (Date, Video Views, Profile Views, …)
//   • Content  — per-post rows (title/caption, link, views/likes/comments/shares)
// Pure module (no I/O) so it stays unit-testable; the Insights lane feeds a
// picked file through here, then routes rows to social_channel_stats (overview)
// or caption-matches them into social_post_results (content).

export type TiktokOverviewRow = {
  day: string; // ISO yyyy-mm-dd
  views: number;
  profileViews: number;
  likes: number;
  comments: number;
  shares: number;
};

export type TiktokContentRow = {
  caption: string;
  postUrl: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
};

export type ParsedTiktokCsv =
  { kind: 'overview'; rows: TiktokOverviewRow[] } | { kind: 'content'; rows: TiktokContentRow[] };

/** Same caption normalisation ig-sync / tiktok-sync use: lowercase,
 *  letters+digits only, first 40 chars — robust to emoji, punctuation,
 *  trailing hashtags. Must stay in lockstep with the edge functions. */
export const capKey = (s: string | null | undefined): string =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);

/** Minimal RFC-4180-ish parser: quoted fields, "" escapes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

/** TikTok's Overview dates carry no year ("28 May"). The export window ends
 *  today and spans at most a year back, so: assume the current year, and if
 *  that lands in the future, it was last year. */
export function parseTiktokDay(raw: string, today: Date): string | null {
  const m = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined || day < 1 || day > 31) return null;
  let year = m[3] ? Number(m[3]) : today.getFullYear();
  if (!m[3]) {
    const candidate = new Date(Date.UTC(year, month, day));
    const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    if (candidate.getTime() > todayUtc.getTime()) year -= 1;
  }
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

const toNum = (raw: string | undefined): number | null => {
  const cleaned = (raw ?? '').replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** Find the first header index whose lowercased text matches the pattern. */
const findCol = (headers: string[], pattern: RegExp): number =>
  headers.findIndex((h) => pattern.test(h.toLowerCase().trim()));

/** Parse either TikTok Studio export. Throws on an unrecognised shape so the
 *  UI can say "wrong file" instead of silently importing nothing. */
export function parseTiktokCsv(text: string, today: Date = new Date()): ParsedTiktokCsv {
  const grid = parseCsv(text);
  if (grid.length < 2) throw new Error('CSV has no data rows');
  const headers = grid[0];
  const body = grid.slice(1);

  // Content export: has a per-post identity column (title/caption/description).
  const capCol = findCol(headers, /title|caption|description/);
  if (capCol >= 0) {
    const linkCol = findCol(headers, /link|url/);
    // Prefer "total …" metric columns when both totals and windowed ("… in the
    // last 7 days") variants exist; fall back to any column naming the metric.
    const metricCol = (word: string) => {
      const total = findCol(headers, new RegExp(`total.*${word}|all.*${word}`));
      return total >= 0 ? total : findCol(headers, new RegExp(word));
    };
    const viewsCol = metricCol('view');
    const likesCol = metricCol('like');
    const commentsCol = metricCol('comment');
    const sharesCol = metricCol('share');
    const rows: TiktokContentRow[] = body
      .map((r) => ({
        caption: (r[capCol] ?? '').trim(),
        postUrl: linkCol >= 0 ? (r[linkCol] ?? '').trim() || null : null,
        views: viewsCol >= 0 ? toNum(r[viewsCol]) : null,
        likes: likesCol >= 0 ? toNum(r[likesCol]) : null,
        comments: commentsCol >= 0 ? toNum(r[commentsCol]) : null,
        shares: sharesCol >= 0 ? toNum(r[sharesCol]) : null,
      }))
      .filter((r) => r.caption !== '');
    return { kind: 'content', rows };
  }

  // Overview export: Date + daily account totals.
  const dateCol = findCol(headers, /^date$/);
  if (dateCol >= 0) {
    const viewsCol = findCol(headers, /video views|^views$/);
    const profileCol = findCol(headers, /profile views/);
    const likesCol = findCol(headers, /like/);
    const commentsCol = findCol(headers, /comment/);
    const sharesCol = findCol(headers, /share/);
    const rows: TiktokOverviewRow[] = [];
    for (const r of body) {
      const day = parseTiktokDay(r[dateCol] ?? '', today);
      if (!day) continue;
      rows.push({
        day,
        views: toNum(r[viewsCol]) ?? 0,
        profileViews: toNum(r[profileCol]) ?? 0,
        likes: toNum(r[likesCol]) ?? 0,
        comments: toNum(r[commentsCol]) ?? 0,
        shares: toNum(r[sharesCol]) ?? 0,
      });
    }
    return { kind: 'overview', rows };
  }

  throw new Error(
    'Unrecognised CSV — expected a TikTok Studio Overview or Content export (Analytics › Download data)',
  );
}
