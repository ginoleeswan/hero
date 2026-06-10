// src/lib/family/types.ts
export type FamilyRelation =
  | 'parent' | 'child' | 'sibling' | 'spouse'
  | 'grandparent' | 'grandchild' | 'aunt_uncle' | 'niece_nephew'
  | 'cousin' | 'in_law' | 'ancestor' | 'clone' | 'other';

export type RelativeStatus = 'deceased' | 'estranged' | 'formerly' | 'alleged' | null;

/** One entry extracted from the raw `relatives` string, before classification. */
export interface ParsedRelative {
  name: string;
  alias: string | null;
  role: string;        // raw role text inside parens, '' if none
  position: number;    // source order
}

/** Result of classifying a role string. */
export interface Classification {
  relation: FamilyRelation;
  tier: number;        // +2..-2, or 9 for clone/aside
  modifiers: string[]; // adoptive | step | foster | half
  status: RelativeStatus;
}

/** Enriched row returned by getHeroFamily (after the heroes join). */
export interface FamilyMember {
  id: string;
  name: string;
  alias: string | null;
  role: string;
  relation: FamilyRelation;
  tier: number;
  modifiers: string[];
  status: RelativeStatus;
  position: number;
  heroId: string | null;       // related_hero_id, if it resolved to a page
  heroImage: string | null;    // portrait for linked nodes
  heroPower: number | null;    // power badge for linked nodes
  heroAlignment: string | null;
}

export interface FamilyTier {
  tier: number;
  label: string;
  members: FamilyMember[];
}

export interface FamilyModel {
  tiers: FamilyTier[];        // ordered 2 → -2; empty tiers omitted
  asides: FamilyMember[];     // clones / variants
  footnotes: FamilyMember[];  // non-family entries (girlfriend, fiancé…)
}
