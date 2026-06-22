import { COLORS } from '../constants/colors';

export interface SynergyBreakdown {
  teammate_links: { count: number; max: number; pct: number };
  shared_affiliation: { team: string | null; coverage: number; pct: number };
  role_balance: { archetypes: number; pct: number };
  total_pct: number;
}
export interface RosterHero {
  id: string;
  name: string;
  portrait_url?: string | null;
  image_url?: string | null;
  intelligence: number | null;
  strength: number | null;
  speed: number | null;
  durability: number | null;
  power: number | null;
  combat: number | null;
}
export interface TeamSide {
  team: { id: string; name: string; publisher: string | null; logo_url: string | null } | null;
  roster: RosterHero[];
  synergy: SynergyBreakdown;
}
export interface TeamStatResult {
  key: string;
  label: string;
  color: string;
  avgA: number;
  avgB: number;
  winner: 'A' | 'B' | 'tie';
}
export interface TeamBattleResult {
  stats: TeamStatResult[];
  powerA: number;
  powerB: number;
  splitA: number;
  splitB: number;
  winsA: number;
  winsB: number;
  verdict: string;
}

const STAT_CONFIG = [
  { key: 'intelligence', label: 'Intelligence', color: COLORS.blue },
  { key: 'strength', label: 'Strength', color: COLORS.red },
  { key: 'speed', label: 'Speed', color: COLORS.yellow },
  { key: 'durability', label: 'Durability', color: COLORS.green },
  { key: 'power', label: 'Power', color: COLORS.orange },
  { key: 'combat', label: 'Combat', color: COLORS.brown },
] as const;

function avg(roster: RosterHero[], key: keyof RosterHero): number {
  if (roster.length === 0) return 0;
  const sum = roster.reduce((acc, h) => acc + (Number(h[key]) || 0), 0);
  return Math.round(sum / roster.length);
}

/** Size-neutral averaged composite + synergy boost → per-stat winners and the
 *  power split (the tug-of-war meter). Pure; no DB. */
export function resolveTeamBattle(a: TeamSide, b: TeamSide): TeamBattleResult {
  const stats: TeamStatResult[] = STAT_CONFIG.map(({ key, label, color }) => {
    const avgA = avg(a.roster, key as keyof RosterHero);
    const avgB = avg(b.roster, key as keyof RosterHero);
    const winner: 'A' | 'B' | 'tie' = avgA > avgB ? 'A' : avgB > avgA ? 'B' : 'tie';
    return { key, label, color, avgA, avgB, winner };
  });

  const winsA = stats.filter((s) => s.winner === 'A').length;
  const winsB = stats.filter((s) => s.winner === 'B').length;

  const baseA = stats.reduce((acc, s) => acc + s.avgA, 0);
  const baseB = stats.reduce((acc, s) => acc + s.avgB, 0);
  const powerA = baseA * (1 + a.synergy.total_pct);
  const powerB = baseB * (1 + b.synergy.total_pct);

  const tot = powerA + powerB;
  const splitA = tot > 0 ? Math.round((powerA / tot) * 100) : 50;
  const splitB = 100 - splitA;

  const nameA = a.team?.name ?? 'Team A';
  const nameB = b.team?.name ?? 'Team B';
  const verdict =
    splitA > splitB
      ? `${nameA} take it — synergy and stats favour them.`
      : splitB > splitA
        ? `${nameB} take it — synergy and stats favour them.`
        : `${nameA} and ${nameB} are dead even.`;

  return { stats, powerA, powerB, splitA, splitB, winsA, winsB, verdict };
}
