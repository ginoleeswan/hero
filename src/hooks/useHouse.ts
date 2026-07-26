// src/hooks/useHouse.ts
// Everything the house page needs, in one call, shared by the web and native
// views so neither owns the fetching.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  buildKinshipGraph,
  findKinshipPath,
  describeKinship,
  type KinshipDescription,
} from '../lib/family/kinshipPath';
import type { FamilyMember, FamilyRelation, RelativeStatus } from '../lib/family/types';
import type { BranchSide } from '../lib/family/resolveKinship';

export interface House {
  slug: string;
  name: string;
  universe: string;
  words: string | null;
  seat: string | null;
  sigil_tint: string | null;
  blurb: string | null;
}

export interface HouseMember {
  id: string;
  name: string;
  portrait_url: string | null;
  avatar_url: string | null;
  image_url: string | null;
  image_md_url: string | null;
  alignment: string | null;
  gender: string | null;
  fame_score: number | null;
  summary: string | null;
  via: string;
}

interface HouseEdge {
  hero_id: string;
  related_hero_id: string;
  relation: string;
  role: string | null;
  tier: number;
  branch_side: string | null;
  tree_parent_id: string | null;
  position: number;
  modifiers: string[] | null;
  status: string | null;
}

interface HousePayload {
  house: House;
  members: HouseMember[];
  edges: HouseEdge[];
}

/**
 * The relatives of one member, in the shape FamilyCanvas already speaks.
 *
 * The canvas is rooted on a person, so the house payload — which is a flat graph
 * — is re-projected around whoever is in focus. Doing it here rather than in the
 * view is what lets both platform views stay thin.
 */
export function relativesOf(payload: HousePayload, focusId: string): FamilyMember[] {
  const byId = new Map(payload.members.map((m) => [m.id, m]));
  return payload.edges
    .filter((e) => e.hero_id === focusId && byId.has(e.related_hero_id))
    .map((e) => {
      const other = byId.get(e.related_hero_id)!;
      return {
        id: `${e.hero_id}:${e.related_hero_id}`,
        name: other.name,
        alias: null,
        role: e.role ?? e.relation,
        relation: e.relation as FamilyRelation,
        tier: e.tier,
        modifiers: e.modifiers ?? [],
        status: (e.status ?? null) as RelativeStatus,
        position: e.position,
        heroId: other.id,
        heroImage: other.portrait_url ?? other.image_md_url ?? other.image_url,
        heroAvatar: other.avatar_url,
        heroPower: null,
        heroAlignment: other.alignment,
        // tree_parent_id points at a hero_relatives row id, but the canvas
        // matches against the ids in THIS list — which are edge-scoped. Remap it
        // so the lineage chaining survives the re-projection.
        treeParentId: null,
        branchSide: (e.branch_side ?? null) as BranchSide,
      };
    });
}

export interface UseHouseResult {
  house: House | null;
  members: HouseMember[];
  /** Relatives of the focused member, ready for FamilyCanvas. */
  relatives: FamilyMember[];
  focusId: string | null;
  /** The kinship answer, when a second person is named. */
  kinship: KinshipDescription | null;
  /** Hero ids on the lit path, focus and target included. */
  pathIds: Set<string>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * @param slug   house to load
 * @param focus  member the tree is rooted on; defaults to the most famous
 * @param withId second member, for "how are these two related?"
 */
export function useHouse(
  slug: string | undefined,
  focus?: string | null,
  withId?: string | null,
): UseHouseResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['house', slug],
    enabled: !!slug,
    // The graph is small and never changes between deploys, so it is worth
    // holding: every re-root and pathfind after the first load is free.
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<HousePayload | null> => {
      const { data: payload, error: rpcError } = await supabase.rpc('get_house', {
        p_slug: slug!,
      });
      if (rpcError) throw new Error(rpcError.message);
      return (payload as unknown as HousePayload) ?? null;
    },
  });

  return useMemo(() => {
    const empty: UseHouseResult = {
      house: null,
      members: [],
      relatives: [],
      focusId: null,
      kinship: null,
      pathIds: new Set(),
      isLoading,
      error: (error as Error) ?? null,
    };
    if (!data?.house) return empty;

    // An unknown ?focus is ignored rather than shown empty — a stale or hand-
    // edited link should still land on the house.
    const known = new Set(data.members.map((m) => m.id));
    const focusId =
      (focus && known.has(focus) ? focus : null) ?? data.members[0]?.id ?? null;
    if (!focusId) return { ...empty, house: data.house, members: data.members };

    let kinship: KinshipDescription | null = null;
    const pathIds = new Set<string>();
    if (withId && known.has(withId) && withId !== focusId) {
      const graph = buildKinshipGraph(
        data.edges.map((e) => ({
          from: e.hero_id,
          to: e.related_hero_id,
          relation: e.relation,
          role: e.role,
        })),
      );
      const steps = findKinshipPath(graph, focusId, withId);
      if (steps) {
        const nameOf = (id: string) => data.members.find((m) => m.id === id)?.name ?? id;
        const genderOf = (id: string) =>
          data.members.find((m) => m.id === id)?.gender as 'Male' | 'Female' | null;
        kinship = describeKinship(steps, focusId, nameOf, genderOf);
        pathIds.add(focusId);
        for (const s of steps) pathIds.add(s.toId);
      }
    }

    return {
      house: data.house,
      members: data.members,
      relatives: relativesOf(data, focusId),
      focusId,
      kinship,
      pathIds,
      isLoading,
      error: (error as Error) ?? null,
    };
  }, [data, focus, withId, isLoading, error]);
}
