// src/lib/family/buildTiers.ts
import type { FamilyMember, FamilyModel, FamilyTier } from './types';

const TIER_LABELS: Record<number, string> = {
  2: 'Grandparents · Ancestors',
  1: 'Parents · Aunts & Uncles',
  0: 'Same generation',
  [-1]: 'Children',
  [-2]: 'Grandchildren',
};

const NONFAMILY = /girlfriend|boyfriend|fianc|lover|paramour/i;

export function buildTiers(members: FamilyMember[]): FamilyModel {
  const asides: FamilyMember[] = [];
  const footnotes: FamilyMember[] = [];
  const byTier = new Map<number, FamilyMember[]>();

  for (const m of members) {
    if (m.tier === 9 || m.relation === 'clone') {
      asides.push(m);
    } else if (m.relation === 'other' && NONFAMILY.test(m.role)) {
      footnotes.push(m);
    } else {
      const list = byTier.get(m.tier) ?? [];
      list.push(m);
      byTier.set(m.tier, list);
    }
  }

  const tiers: FamilyTier[] = [];
  for (const t of [2, 1, 0, -1, -2]) {
    const list = byTier.get(t);
    if (list && list.length) {
      list.sort((a, b) => a.position - b.position);
      tiers.push({ tier: t, label: TIER_LABELS[t], members: list });
    }
  }

  return { tiers, asides, footnotes };
}
