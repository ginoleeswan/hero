// Pure helpers, presets and types shared by the Build ("Pipelines") sub-views.
// Kept free of JSX so the funnel / cron / review pieces can live in their own files.

export const pctOf = (have: number, total: number) =>
  total > 0 ? Math.round((have / total) * 100) : 0;

/** Turn a cron expression into a short human phrase for the common cases. */
export function humanizeCron(s: string): string {
  const parts = s.trim().split(/\s+/);
  if (parts.length !== 5) return s;
  const [min, hr] = parts;
  const everyMin = min.match(/^\*\/(\d+)$/);
  if (everyMin && hr === '*') return `every ${everyMin[1]} min`;
  if (min === '0' && hr === '*') return 'hourly';
  const everyHr = hr.match(/^\*\/(\d+)$/);
  if (min === '0' && everyHr) return `every ${everyHr[1]} h`;
  if (/^\d+$/.test(min) && /^\d+$/.test(hr))
    return `daily ${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
  return s;
}

/** Plain-English description of what a scheduled job does, by name. */
export function cronHelp(jobname: string): string {
  const n = jobname.toLowerCase();
  if (n.includes('comicvine'))
    return 'Automatically runs the ComicVine drain to keep core hero data (powers, bio, movies) filling in.';
  if (n.includes('tmdb'))
    return 'Automatically runs the TMDB drain to enrich film & TV media (posters, trailers, cast).';
  if (n.includes('wikidata') && n.includes('resolve'))
    return 'Automatically resolves heroes to their Wikidata identity (QID).';
  if (n.includes('wikidata'))
    return 'Automatically pulls cross-media appearances and cast from Wikidata for resolved heroes.';
  if (n.includes('snapshot'))
    return 'Captures a periodic catalogue-health snapshot that feeds the trend charts.';
  return 'A scheduled background job.';
}

// Cadence presets the cron editor offers (label → 5-field cron expression).
export const CADENCE: { label: string; expr: string }[] = [
  { label: '1m', expr: '* * * * *' },
  { label: '2m', expr: '*/2 * * * *' },
  { label: '3m', expr: '*/3 * * * *' },
  { label: '5m', expr: '*/5 * * * *' },
  { label: '15m', expr: '*/15 * * * *' },
  { label: 'hourly', expr: '0 * * * *' },
  { label: 'daily', expr: '5 0 * * *' },
];
export const BATCHES = [5, 10, 15, 25, 50];

// One row of the enrichment funnel.
export interface Stage {
  key: string;
  name: string;
  tip: string;
  reached: number; // heroes that have passed this stage
  total: number; // shared denominator (all heroes) so the funnel reads true
  pending: number; // still actionable at this stage
  // Heroes stuck here that need a human or can't proceed (failed / review / unresolvable).
  stuck?: { label: string; tone: string } | null;
  run?: { busyKey: string; onPress: () => void } | null; // per-stage drain (power user)
  auto?: boolean; // runs itself (TMDB)
}
