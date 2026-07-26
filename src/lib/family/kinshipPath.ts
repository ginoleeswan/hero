// src/lib/family/kinshipPath.ts
// "How are these two related?" — the shortest chain of kinship between two
// members of a house, and an honest English label for it.
//
// Pure and I/O-free. The whole Westeros graph is ~110 nodes and 1,666 edges, so
// the caller holds it in memory and this answers in a frame.

/** One recorded relation, in the direction it was recorded. */
export interface KinshipEdge {
  from: string;
  to: string;
  /** `to` is `from`'s ___ — 'parent', 'child', 'spouse', 'sibling', … */
  relation: string;
  /**
   * The label recorded alongside the edge, e.g. "8× great-grandfather". Only
   * meaningful in the recorded direction, so it is dropped when the edge is
   * walked backwards. `ancestor` and `descendant` carry no generation count in
   * the relation itself, and this is where the count already lives.
   */
  role?: string | null;
}

export interface KinshipStep {
  /** Whose relation this is. */
  fromId: string;
  /** The person reached. */
  toId: string;
  /** `toId` is `fromId`'s ___ */
  relation: string;
  /** Recorded label, forward direction only. */
  role?: string | null;
}

export interface KinshipGraph {
  /** Undirected adjacency: every edge appears from both ends. */
  adjacency: Map<string, KinshipStep[]>;
}

/** The inverse of a relation, used to walk an edge backwards. */
const INVERSE: Record<string, string> = {
  parent: 'child',
  child: 'parent',
  grandparent: 'grandchild',
  grandchild: 'grandparent',
  ancestor: 'descendant',
  descendant: 'ancestor',
  aunt_uncle: 'niece_nephew',
  niece_nephew: 'aunt_uncle',
  sibling: 'sibling',
  spouse: 'spouse',
  cousin: 'cousin',
  in_law: 'in_law',
};

const inverseOf = (relation: string): string => INVERSE[relation] ?? relation;

/**
 * Build the undirected adjacency once per house. Recorded edges are directional
 * ("Jon's parent is Rhaegar"), so each is added in both directions with the
 * relation inverted on the way back.
 */
export function buildKinshipGraph(edges: KinshipEdge[]): KinshipGraph {
  const adjacency = new Map<string, KinshipStep[]>();
  const push = (step: KinshipStep) => {
    const list = adjacency.get(step.fromId);
    if (list) list.push(step);
    else adjacency.set(step.fromId, [step]);
  };
  for (const e of edges) {
    if (!e.from || !e.to || e.from === e.to) continue;
    push({ fromId: e.from, toId: e.to, relation: e.relation, role: e.role });
    // No role on the way back: "8× great-grandfather" describes one direction
    // only, and reusing it would make the descendant the ancestor.
    push({ fromId: e.to, toId: e.from, relation: inverseOf(e.relation) });
  }

  // A derived dynasty records both directions as separate rows, so each pair
  // arrives up to four times: forward and reverse of "ancestor", forward and
  // reverse of "descendant". Whichever the search happened to reach first
  // decided the label, which is how Rhaenyra came out as Daenerys's bare
  // "ancestor" when the row going the other way knew "6× great-grandmother".
  // Keep one step per pair, preferring the one that carries a recorded label.
  for (const [id, steps] of adjacency) {
    const best = new Map<string, KinshipStep>();
    for (const step of steps) {
      const held = best.get(step.toId);
      if (!held || (!held.role && step.role)) best.set(step.toId, step);
    }
    adjacency.set(id, [...best.values()]);
  }
  return { adjacency };
}

/**
 * Shortest chain from one person to another, or null when the graph records no
 * connection. Breadth-first, so the first route found is the shortest — which
 * matters, because a dynasty that married its cousins offers many longer ones.
 */
export function findKinshipPath(
  graph: KinshipGraph,
  fromId: string,
  toId: string,
): KinshipStep[] | null {
  if (!fromId || !toId) return null;
  if (fromId === toId) return [];
  if (!graph.adjacency.has(fromId)) return null;

  const cameBy = new Map<string, KinshipStep>();
  const seen = new Set<string>([fromId]);
  let frontier = [fromId];

  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const step of graph.adjacency.get(id) ?? []) {
        if (seen.has(step.toId)) continue;
        seen.add(step.toId);
        cameBy.set(step.toId, step);
        if (step.toId === toId) {
          const path: KinshipStep[] = [];
          for (let at = toId; at !== fromId;) {
            const s = cameBy.get(at)!;
            path.unshift(s);
            at = s.fromId;
          }
          return path;
        }
        next.push(step.toId);
      }
    }
    frontier = next;
  }
  return null;
}

// ── Labelling ────────────────────────────────────────────────────────────────

type Gender = 'Male' | 'Female' | null | undefined;

const gendered = (g: Gender, male: string, female: string, neutral: string): string =>
  g === 'Male' ? male : g === 'Female' ? female : neutral;

const ordinal = (n: number): string => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
};

/**
 * A single relation for the short paths people actually have a word for.
 *
 * Composition is only attempted where a real word exists. A seven-step chain
 * does compose to *something*, but nobody says "first cousin twice removed by
 * marriage of my great-great-grandmother" — inventing that label would be worse
 * than admitting the distance, so past this table the headline degrades and the
 * chain carries the detail.
 */
function composeRelation(steps: KinshipStep[], targetGender: Gender): string | null {
  const rel = steps.map((s) => s.relation);
  const one = (m: string, f: string, n: string) => gendered(targetGender, m, f, n);

  if (rel.length === 1) {
    // A derived dynasty records depth on the edge, not in the relation word:
    // Aegon the Conqueror is one `ancestor` hop from Jon Snow but ten
    // generations up, and the recorded role already says so.
    if (rel[0] === 'ancestor' || rel[0] === 'descendant') {
      return steps[0].role?.trim() || rel[0];
    }
    switch (rel[0]) {
      case 'parent':
        return one('father', 'mother', 'parent');
      case 'child':
        return one('son', 'daughter', 'child');
      case 'sibling':
        return one('brother', 'sister', 'sibling');
      case 'spouse':
        return one('husband', 'wife', 'spouse');
      case 'grandparent':
        return one('grandfather', 'grandmother', 'grandparent');
      case 'grandchild':
        return one('grandson', 'granddaughter', 'grandchild');
      case 'aunt_uncle':
        return one('uncle', 'aunt', 'aunt or uncle');
      case 'niece_nephew':
        return one('nephew', 'niece', 'niece or nephew');
      case 'cousin':
        return 'cousin';
      default:
        return null;
    }
  }

  const key = rel.join('>');
  switch (key) {
    case 'parent>parent':
      return one('grandfather', 'grandmother', 'grandparent');
    case 'child>child':
      return one('grandson', 'granddaughter', 'grandchild');
    case 'parent>sibling':
      return one('uncle', 'aunt', 'aunt or uncle');
    case 'sibling>child':
      return one('nephew', 'niece', 'niece or nephew');
    // A derived dynasty records descent, not siblinghood: Daenerys is reached
    // from Jon as his father's father's child, never as his father's sister.
    // Without these, the feature's own headline case — "Daenerys is Jon Snow's
    // aunt" — came out as "distant kin, 3 steps".
    case 'parent>child':
      return one('brother', 'sister', 'sibling');
    case 'parent>parent>child':
      return one('uncle', 'aunt', 'aunt or uncle');
    case 'parent>child>child':
      return one('nephew', 'niece', 'niece or nephew');
    case 'parent>parent>child>child':
      return 'cousin';
    case 'parent>spouse':
      return one('step-father', 'step-mother', 'step-parent');
    case 'spouse>child':
      return one('step-son', 'step-daughter', 'step-child');
    case 'parent>sibling>child':
      return 'cousin';
    case 'parent>parent>parent':
      return one('great-grandfather', 'great-grandmother', 'great-grandparent');
    case 'child>child>child':
      return one('great-grandson', 'great-granddaughter', 'great-grandchild');
    case 'spouse>sibling':
      return one('brother-in-law', 'sister-in-law', 'sibling-in-law');
    case 'sibling>spouse':
      return one('brother-in-law', 'sister-in-law', 'sibling-in-law');
    default:
      break;
  }

  // An unbroken run in one direction is still nameable however long it gets.
  if (rel.every((r) => r === 'parent')) {
    const greats = rel.length - 2;
    return `${greats === 1 ? 'great-' : `${ordinal(greats)} great-`}${one(
      'grandfather',
      'grandmother',
      'grandparent',
    )}`;
  }
  if (rel.every((r) => r === 'child')) {
    const greats = rel.length - 2;
    return `${greats === 1 ? 'great-' : `${ordinal(greats)} great-`}${one(
      'grandson',
      'granddaughter',
      'grandchild',
    )}`;
  }
  return null;
}

export interface KinshipDescription {
  /** "Daenerys Targaryen is Jon Snow's aunt" — null when no word fits. */
  headline: string | null;
  /** Always present: the chain, step by step. */
  chain: string;
  steps: number;
}

/**
 * Put a path into words. `nameOf` and `genderOf` look up the people; keeping
 * them as callbacks is what lets this module stay free of the hero row shape.
 */
export function describeKinship(
  steps: KinshipStep[],
  fromId: string,
  nameOf: (id: string) => string,
  genderOf: (id: string) => Gender,
): KinshipDescription {
  if (steps.length === 0) {
    return { headline: null, chain: `${nameOf(fromId)} is the same person.`, steps: 0 };
  }

  const targetId = steps[steps.length - 1].toId;
  const relation = composeRelation(steps, genderOf(targetId));

  const headline = relation
    ? `${nameOf(targetId)} is ${nameOf(fromId)}'s ${relation}`
    : `${nameOf(targetId)} is distant kin to ${nameOf(fromId)} — ${steps.length} ${
        steps.length === 1 ? 'step' : 'steps'
      }`;

  const chain = [
    nameOf(fromId),
    ...steps.map((s) => {
      const word = composeRelation([s], genderOf(s.toId)) ?? s.relation.replace(/_/g, ' ');
      return `${word} ${nameOf(s.toId)}`;
    }),
  ].join(' → ');

  return { headline, chain, steps: steps.length };
}
