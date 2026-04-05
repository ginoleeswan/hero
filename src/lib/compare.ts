import { COLORS } from '../constants/colors';

export interface StatResult {
  key: string;
  label: string;
  color: string;
  valueA: number;
  valueB: number;
  winner: 'A' | 'B' | 'tie';
}

export interface CompareResult {
  stats: StatResult[];
  winsA: number;
  winsB: number;
  verdict: string;
}

const STAT_CONFIG: { key: string; label: string; color: string }[] = [
  { key: 'intelligence', label: 'Intelligence', color: COLORS.blue },
  { key: 'strength',     label: 'Strength',     color: COLORS.red },
  { key: 'speed',        label: 'Speed',         color: COLORS.yellow },
  { key: 'durability',   label: 'Durability',    color: COLORS.green },
  { key: 'power',        label: 'Power',         color: COLORS.orange },
  { key: 'combat',       label: 'Combat',        color: COLORS.brown },
];

export function compareStats(
  nameA: string,
  powerstatsA: Record<string, string>,
  nameB: string,
  powerstatsB: Record<string, string>,
): CompareResult {
  const stats: StatResult[] = STAT_CONFIG.map(({ key, label, color }) => {
    const valueA = parseInt(powerstatsA[key] ?? '0', 10) || 0;
    const valueB = parseInt(powerstatsB[key] ?? '0', 10) || 0;
    const winner: 'A' | 'B' | 'tie' = valueA > valueB ? 'A' : valueB > valueA ? 'B' : 'tie';
    return { key, label, color, valueA, valueB, winner };
  });

  const winsA = stats.filter((s) => s.winner === 'A').length;
  const winsB = stats.filter((s) => s.winner === 'B').length;

  const verdict =
    winsA > winsB
      ? `${nameA} has the edge on ${winsA} of 6 stats`
      : winsB > winsA
      ? `${nameB} has the edge on ${winsB} of 6 stats`
      : 'These two are evenly matched';

  return { stats, winsA, winsB, verdict };
}
