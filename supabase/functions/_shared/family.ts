// supabase/functions/_shared/family.ts
// Self-contained copy of src/lib/family/types.ts + classifyRole.ts + parseRelatives.ts
// for use in Deno edge functions. No imports from src/.
// Keep in sync with the src/ originals — parity test enforces this.

// ---------------------------------------------------------------------------
// Types (from src/lib/family/types.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// classifyRole (from src/lib/family/classifyRole.ts)
// ---------------------------------------------------------------------------

const STATUS_PATTERNS: [RegExp, NonNullable<RelativeStatus>][] = [
  [/deceased|\bdead\b/, 'deceased'],
  [/estranged/, 'estranged'],
  [/\bex[- ]|former|divorced/, 'formerly'],
  [/alleged|presum|reported|possibl/, 'alleged'],
];

const MODIFIER_PATTERNS: [RegExp, string][] = [
  [/adoptive|adopted/, 'adoptive'],
  [/\bstep[- ]?/, 'step'],
  [/foster/, 'foster'],
  [/\bhalf[- ]/, 'half'],
];

// First match wins — order is significant (specific before general).
const RELATION_RULES: [RegExp, FamilyRelation, number][] = [
  [/great[- ]?grand|ancestor/, 'ancestor', 2],
  [/grandparent|grandfather|grandmother|grandad|grandma/, 'grandparent', 2],
  [/grandchild|grandson|granddaughter/, 'grandchild', -2],
  [/descendant/, 'grandchild', -2],
  [/in[- ]law/, 'in_law', 0],
  [/father|mother|\bparent|\bmom\b|\bdad\b/, 'parent', 1],
  [/aunt|uncle/, 'aunt_uncle', 1],
  [/wife|husband|spouse|widow/, 'spouse', 0],
  [/brother|sister|sibling/, 'sibling', 0],
  [/cousin/, 'cousin', 0],
  [/niece|nephew/, 'niece_nephew', -1],
  [/\bson\b|daughter|child/, 'child', -1],
  [/clone|duplicate|genetic|alternate|counterpart/, 'clone', 9],
];

export function classifyRole(role: string): Classification {
  const r = role.toLowerCase();
  const modifiers = MODIFIER_PATTERNS.filter(([re]) => re.test(r)).map(([, m]) => m);
  const statusHit = STATUS_PATTERNS.find(([re]) => re.test(r));
  const status: RelativeStatus = statusHit ? statusHit[1] : null;
  for (const [re, relation, tier] of RELATION_RULES) {
    if (re.test(r)) return { relation, tier, modifiers, status };
  }
  return { relation: 'other', tier: 0, modifiers, status };
}

// ---------------------------------------------------------------------------
// parseRelatives (from src/lib/family/parseRelatives.ts)
// ---------------------------------------------------------------------------

const JUNK = new Set(['', '-', 'null', 'n/a', 'none', 'unknown']);

/** Split on top-level commas/semicolons, ignoring delimiters inside parentheses. */
function splitTopLevel(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of raw) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * A leading paren segment is an alias (not the relationship) when it carries no
 * relationship or status keyword of its own — e.g. "Kara Zor-El" in
 * "(Kara Zor-El, cousin)", but NOT "father" in "(father, deceased)".
 */
function isAliasSegment(seg: string): boolean {
  const c = classifyRole(seg);
  return c.relation === 'other' && c.status === null;
}

export function parseRelatives(raw: string | null | undefined): ParsedRelative[] {
  if (!raw) return [];
  const result: ParsedRelative[] = [];
  let position = 0;
  for (const entry of splitTopLevel(raw)) {
    const trimmed = entry.trim();
    if (JUNK.has(trimmed.toLowerCase())) continue;

    const open = trimmed.indexOf('(');
    let name = trimmed;
    let alias: string | null = null;
    let role = '';

    if (open !== -1) {
      name = trimmed.slice(0, open).trim();
      const close = trimmed.lastIndexOf(')');
      const inner = (
        close > open ? trimmed.slice(open + 1, close) : trimmed.slice(open + 1)
      ).trim();
      const parts = inner
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 1 && isAliasSegment(parts[0])) {
        alias = parts[0];
        role = parts.slice(1).join(', ');
      } else {
        role = parts.join(', ');
      }
    }

    if (name === '' || JUNK.has(name.toLowerCase())) continue;
    result.push({ name, alias, role, position: position++ });
  }
  return result;
}

// ---------------------------------------------------------------------------
// resolveKinship (from src/lib/family/resolveKinship.ts)
// ---------------------------------------------------------------------------

export type BranchSide = 'paternal' | 'maternal' | 'spouse' | null;

export interface KinNode {
  id: string;
  relation: FamilyRelation;
  role: string;
  modifiers: string[];
}

export interface KinAttachment {
  treeParentId: string | null;
  branchSide: BranchSide;
}

const isFather = (r: string) => /\bfather\b|\bdad\b/.test(r) && !/in[- ]law/.test(r);
const isMother = (r: string) => /\bmother\b|\bmom\b/.test(r) && !/in[- ]law/.test(r);

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
