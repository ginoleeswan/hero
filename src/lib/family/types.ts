// src/lib/family/types.ts
import type { BranchSide } from './resolveKinship';

export type FamilyRelation =
  | 'parent'
  | 'child'
  | 'sibling'
  | 'spouse'
  | 'grandparent'
  | 'grandchild'
  | 'aunt_uncle'
  | 'niece_nephew'
  | 'cousin'
  | 'in_law'
  | 'ancestor'
  | 'descendant'
  | 'clone'
  | 'other';

export type RelativeStatus = 'deceased' | 'estranged' | 'formerly' | 'alleged' | null;

/** One entry extracted from the raw `relatives` string, before classification. */
export interface ParsedRelative {
  name: string;
  alias: string | null;
  role: string; // raw role text inside parens, '' if none
  position: number; // source order
}

/** Result of classifying a role string. */
export interface Classification {
  relation: FamilyRelation;
  tier: number; // +2..-2, or 9 for clone/aside
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
  heroId: string | null; // related_hero_id, if it resolved to a page
  heroImage: string | null; // portrait for linked nodes
  heroAvatar: string | null; // flat icon avatar, preferred at node size (famous heroes only)
  heroPower: number | null; // power badge for linked nodes
  heroAlignment: string | null;
  treeParentId: string | null; // the member this node hangs from (null = hero spine)
  branchSide: BranchSide; // paternal | maternal | spouse | null
}

/** Where a node's connector attaches: the hero spine, or a specific parent node. */
export type ConnTarget = { kind: 'hero' } | { kind: 'parent'; id: string };

export interface GraphNode {
  member: FamilyMember;
  connectTo: ConnTarget;
}

export interface GraphTier {
  tier: number;
  label: string;
  nodes: GraphNode[];
  collapsedByDefault: boolean;
}

export interface FamilyGraph {
  tiers: GraphTier[]; // deepest ancestor → deepest descendant; empty omitted
  asides: FamilyMember[]; // clones / variants
  footnotes: FamilyMember[]; // non-family entries (girlfriend, fiancé…)
  /**
   * Forebears with no generation anyone recorded — a bare list of names the
   * source called "ancestor" and nothing more. They cannot be placed in a
   * generational chart honestly, so they are listed rather than drawn.
   */
  unplaced: FamilyMember[];
  spouse: FamilyMember | null; // extracted for the hero's gold tie
}
