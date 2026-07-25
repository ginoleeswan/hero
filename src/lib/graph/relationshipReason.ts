export type RelKind = 'enemy' | 'ally' | 'teammate';

export interface RelationshipReason {
  /** Rosters both characters belong to — the concrete evidence for the tie. */
  sharedTeams: string[];
  /** Sentence explaining the relationship, or null when nothing honest can be said. */
  summary: string | null;
}

/**
 * Explain why two characters are connected, using only what the data can
 * actually support.
 *
 * ComicVine ships no reason text for a relationship — `hero_relationships` has
 * kind, source and rank and nothing else — so anything narrative would be
 * invented. What IS real is team membership: if two characters share rosters,
 * that's a specific, checkable answer to "why are these two teammates", and for
 * enemies and allies it's still useful context (rivals who served together read
 * very differently from rivals who never met).
 *
 * When there's no shared roster the summary falls back to how many mutual
 * connections they have in this web, and when there's nothing at all it returns
 * null so the card can stay quiet instead of padding with a platitude.
 */
export function describeRelationship(
  kind: RelKind | null,
  subjectName: string,
  subjectTeams: string[] | null,
  nodeTeams: string[] | null,
  mutualCount: number,
): RelationshipReason {
  const a = new Set((subjectTeams ?? []).filter(Boolean));
  const sharedTeams = (nodeTeams ?? []).filter((t) => t && a.has(t));

  if (sharedTeams.length > 0) {
    const list = formatList(sharedTeams.slice(0, 2));
    const extra = sharedTeams.length > 2 ? ` and ${sharedTeams.length - 2} more` : '';
    if (kind === 'enemy') {
      return {
        sharedTeams,
        summary: `Opposed to ${subjectName}, despite both serving in ${list}${extra}.`,
      };
    }
    return {
      sharedTeams,
      summary: `Served alongside ${subjectName} in ${list}${extra}.`,
    };
  }

  if (mutualCount > 0) {
    const people = `${mutualCount} mutual connection${mutualCount === 1 ? '' : 's'}`;
    if (kind === 'enemy') {
      return { sharedTeams, summary: `An enemy of ${subjectName}, with ${people} in common.` };
    }
    if (kind === 'ally') {
      return { sharedTeams, summary: `An ally of ${subjectName}, with ${people} in common.` };
    }
    if (kind === 'teammate') {
      return { sharedTeams, summary: `A teammate of ${subjectName}, with ${people} in common.` };
    }
  }

  return { sharedTeams, summary: null };
}

/** "A", "A and B", "A, B and C" — Oxford-free, matching the app's copy voice. */
function formatList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
