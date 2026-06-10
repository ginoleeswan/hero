// src/lib/family/rowToMember.ts
import type { FamilyMember, RelationKind, RelativeStatus } from './types';

export interface FamilyRow {
  id: string;
  name: string;
  alias: string | null;
  role: string;
  relation: RelationKind;
  tier: number;
  modifiers: string[] | null;
  status: RelativeStatus;
  position: number;
  related: {
    id: string;
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
    heroImage: row.related ? row.related.image_md_url ?? row.related.image_url ?? null : null,
    heroPower: row.related?.power ?? null,
    heroAlignment: row.related?.alignment ?? null,
  };
}
