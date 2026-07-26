// src/lib/family/lifespan.ts
// Turning stored dates into the lines a chart and a console can carry.
//
// The columns are free text because each setting keeps its own calendar
// ("48 AC", "19 BBY", "c. 132 AC"). So everything here degrades: a value that
// parses gets a collapsed range and a duration, a value that doesn't still gets
// printed verbatim rather than dropped. Nothing is ever invented — an unknown
// end is shown as an open range, not guessed at.

export interface LifeDates {
  born?: string | null;
  died?: string | null;
  reign_start?: string | null;
  reign_end?: string | null;
}

interface Stamp {
  raw: string;
  year: number | null;
  /** "AC", "BBY", … — whatever trails the number. */
  era: string | null;
}

const YEAR = /^\s*(?:c\.\s*|circa\s+)?(-?\d+)\s*([A-Za-z.]+)?\s*$/;

function read(value: string | null | undefined): Stamp | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const m = YEAR.exec(raw);
  if (!m) return { raw, year: null, era: null };
  const era = (m[2] ?? '').replace(/\.$/, '').toUpperCase() || null;
  const n = parseInt(m[1], 10);
  // Counting-back eras (BC, BBY) run toward zero, so they have to go negative or
  // a range across the epoch reads backwards and durations come out wrong.
  const descending = era === 'BC' || era === 'BBY';
  return { raw, year: descending ? -n : n, era };
}

/** Numeric year on a single axis, negative for counting-back eras. Null if unparseable. */
export function parseYear(value: string | null | undefined): number | null {
  return read(value)?.year ?? null;
}

function range(a: Stamp, b: Stamp): string {
  // Same era on both ends: say it once. "48–103 AC", not "48 AC – 103 AC".
  if (a.era && a.era === b.era && a.year !== null && b.year !== null) {
    return `${Math.abs(a.year)}–${Math.abs(b.year)} ${a.era}`;
  }
  return `${a.raw} – ${b.raw}`;
}

function span(a: Stamp, b: Stamp): number | null {
  if (a.year === null || b.year === null) return null;
  const years = b.year - a.year;
  return years > 0 ? years : null;
}

/**
 * The console's reign line: "Reigned 48–103 AC · 55 years".
 *
 * A one-year reign says "1 year"; a reign whose end nobody recorded says
 * "Reigned from 129 AC" rather than pretending to a span.
 */
export function reignLine(d: LifeDates): string | null {
  const from = read(d.reign_start);
  const to = read(d.reign_end);
  if (!from && !to) return null;
  if (from && !to) return `Reigned from ${from.raw}`;
  if (!from && to) return `Reigned until ${to!.raw}`;
  const years = span(from!, to!);
  const duration = years === null ? '' : ` · ${years} ${years === 1 ? 'year' : 'years'}`;
  return `Reigned ${range(from!, to!)}${duration}`;
}

/** Lifespan for the console: "245–284 AC", or a half-known "b. 245 AC". */
export function lifeLine(d: LifeDates): string | null {
  const born = read(d.born);
  const died = read(d.died);
  if (born && died) return range(born, died);
  if (born) return `b. ${born.raw}`;
  if (died) return `d. ${died.raw}`;
  return null;
}

/**
 * The outer bounds of every date a group of people carries: "1–305 AC".
 *
 * Mixed eras return null rather than a range across an epoch nobody named the
 * same way — "48 BC – 103 AC" is arithmetic, not a fact the catalogue holds.
 */
export function recordedSpan(people: LifeDates[]): string | null {
  const stamps: Stamp[] = [];
  for (const p of people) {
    for (const v of [p.born, p.died, p.reign_start, p.reign_end]) {
      const s = read(v);
      if (s?.year !== null && s !== null) stamps.push(s);
    }
  }
  if (stamps.length < 2) return null;
  let lo = stamps[0];
  let hi = stamps[0];
  for (const s of stamps) {
    if (s.year! < lo.year!) lo = s;
    if (s.year! > hi.year!) hi = s;
  }
  if (lo.year === hi.year) return null;
  if (!lo.era || lo.era !== hi.era) return null;
  return range(lo, hi);
}

/**
 * The single compact line a chart node can carry under a name — no verb, no
 * duration, because at 104px wide there is room for a date and nothing else.
 * A reign wins over a lifespan: in a dynasty it is the more telling fact, and
 * it is the one the catalogue actually holds.
 */
export function nodeDates(d: LifeDates): string | null {
  const from = read(d.reign_start);
  const to = read(d.reign_end);
  if (from && to) return range(from, to);
  if (from) return `${from.raw}–`;
  const born = read(d.born);
  const died = read(d.died);
  if (born && died) return range(born, died);
  if (born) return `b. ${born.raw}`;
  if (died) return `d. ${died.raw}`;
  return null;
}
