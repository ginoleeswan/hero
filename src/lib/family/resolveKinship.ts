// src/lib/family/resolveKinship.ts
// Deterministic inter-relative attachment resolver. Given a hero's relatives,
// assigns each one a `treeParentId` (the family member it hangs from, one step
// closer to the hero) and a `branchSide`. Resolves only when unambiguous —
// otherwise leaves treeParentId null (the node attaches to the hero spine).
import type { FamilyRelation } from './types';

export type BranchSide = 'paternal' | 'maternal' | 'spouse' | null;

export interface KinNode {
  id: string;
  relation: FamilyRelation;
  role: string; // paternal/maternal/father/mother hints live here
  modifiers: string[];
}

export interface KinAttachment {
  treeParentId: string | null;
  branchSide: BranchSide;
}

const isFather = (r: string) => /\bfather\b|\bdad\b/.test(r) && !/in[- ]law/.test(r);
const isMother = (r: string) => /\bmother\b|\bmom\b/.test(r) && !/in[- ]law/.test(r);

/** The one node matching a predicate, or null if zero or more than one. */
function uniqueBy(nodes: KinNode[], pred: (n: KinNode) => boolean): KinNode | null {
  const hits = nodes.filter(pred);
  return hits.length === 1 ? hits[0] : null;
}

export function resolveKinship(nodes: KinNode[]): Map<string, KinAttachment> {
  const out = new Map<string, KinAttachment>();
  const father = uniqueBy(nodes, (x) => x.relation === 'parent' && isFather(x.role.toLowerCase()));
  const mother = uniqueBy(nodes, (x) => x.relation === 'parent' && isMother(x.role.toLowerCase()));
  const spouse = uniqueBy(nodes, (x) => x.relation === 'spouse');
  const auntUncle = uniqueBy(nodes, (x) => x.relation === 'aunt_uncle');
  const sibling = uniqueBy(nodes, (x) => x.relation === 'sibling');
  const child = uniqueBy(nodes, (x) => x.relation === 'child');

  for (const node of nodes) {
    const r = node.role.toLowerCase();
    const paternal = /paternal/.test(r);
    const maternal = /maternal/.test(r);
    let treeParentId: string | null = null;
    let branchSide: BranchSide = null;

    switch (node.relation) {
      case 'grandparent':
      case 'ancestor': {
        if (paternal) {
          branchSide = 'paternal';
          if (father) treeParentId = father.id;
        } else if (maternal) {
          branchSide = 'maternal';
          if (mother) treeParentId = mother.id;
        }
        break;
      }
      case 'grandchild': {
        if (child) treeParentId = child.id;
        break;
      }
      case 'cousin': {
        if (auntUncle) treeParentId = auntUncle.id;
        break;
      }
      case 'niece_nephew': {
        if (sibling) treeParentId = sibling.id;
        break;
      }
      case 'in_law': {
        branchSide = 'spouse';
        if (spouse) treeParentId = spouse.id;
        break;
      }
      case 'parent': {
        if (isFather(r)) branchSide = 'paternal';
        else if (isMother(r)) branchSide = 'maternal';
        break;
      }
      default:
        break;
    }
    out.set(node.id, { treeParentId, branchSide });
  }
  return out;
}
