// src/lib/family/rowToMember.ts
import type { FamilyMember, FamilyRelation, RelativeStatus } from './types';
import type { BranchSide } from './resolveKinship';

export interface FamilyRow {
  id: string;
  name: string;
  alias: string | null;
  role: string;
  relation: FamilyRelation;
  tier: number;
  modifiers: string[] | null;
  status: RelativeStatus;
  position: number;
  tree_parent_id: string | null;
  branch_side: BranchSide;
  related: {
    id: string;
    portrait_url: string | null;
    image_md_url: string | null;
    image_url: string | null;
    power: number | null;
    alignment: string | null;
  } | null;
}

export function rowToMember(row: FamilyRow): FamilyMember {
  return {
    id: row.id,
    name: row.name,
    alias: row.alias,
    role: row.role,
    relation: row.relation,
    tier: row.tier,
    modifiers: row.modifiers ?? [],
    status: row.status,
    position: row.position,
    heroId: row.related?.id ?? null,
    heroImage: row.related
      ? (row.related.portrait_url ?? row.related.image_md_url ?? row.related.image_url ?? null)
      : null,
    heroPower: row.related?.power ?? null,
    heroAlignment: row.related?.alignment ?? null,
    treeParentId: row.tree_parent_id,
    branchSide: row.branch_side,
  };
}
