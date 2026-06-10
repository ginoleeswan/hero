// src/lib/family/classifyRole.ts
import type { Classification, RelationKind, RelativeStatus } from './types';

const STATUS_PATTERNS: [RegExp, NonNullable<RelativeStatus>][] = [
  [/deceased|\bdead\b/, 'deceased'],
  [/estranged/, 'estranged'],
  [/\bex[- ]|former|divorced/, 'formerly'],
  [/alleged|presum|reported|possibl/, 'alleged'],
];

const MODIFIER_PATTERNS: [RegExp, string][] = [
  [/adoptive|adopted/, 'adoptive'],
  [/step[- ]?/, 'step'],
  [/foster/, 'foster'],
  [/half[- ]/, 'half'],
];

// First match wins — order is significant (specific before general).
const RELATION_RULES: [RegExp, RelationKind, number][] = [
  [/great[- ]?grand|ancestor|descendant/, 'ancestor', 2],
  [/grandparent|grandfather|grandmother|grandad|grandma/, 'grandparent', 2],
  [/grandchild|grandson|granddaughter/, 'grandchild', -2],
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
