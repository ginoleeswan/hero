import { supabase } from '../supabase';
import type { HeroTagVocab } from '../../types';

export interface PowerExplainer {
  power: string;
  text: string;
}

export interface HeroTagChip {
  slug: string;
  label: string;
}

export interface HeroNarrative {
  didYouKnow: string[];
  powerExplainers: PowerExplainer[];
  eraSummary: string | null;
  tags: HeroTagChip[];
  isEmpty: boolean;
}

interface FactRow {
  kind: string;
  content: string;
  subject: string | null;
  position: number | null;
}

interface TagJoinRow {
  tag: string;
  hero_tag_vocab: { label: string } | null;
}

const emptyNarrative = (): HeroNarrative => ({
  didYouKnow: [],
  powerExplainers: [],
  eraSummary: null,
  tags: [],
  isEmpty: true,
});

/** Pure: fold raw hero_narrative_facts + hero_tags rows into the render-ready shape. */
export function buildNarrative(facts: FactRow[], tags: TagJoinRow[]): HeroNarrative {
  const didYouKnow = facts
    .filter((f) => f.kind === 'did_you_know')
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((f) => f.content);

  const powerExplainers = facts
    .filter((f) => f.kind === 'power_explainer')
    .map((f) => ({ power: f.subject ?? '', text: f.content }))
    .filter((p) => p.power.length > 0);

  const eraSummary = facts.find((f) => f.kind === 'era_summary')?.content ?? null;

  const tagChips: HeroTagChip[] = tags.map((t) => ({
    slug: t.tag,
    label: t.hero_tag_vocab?.label ?? t.tag,
  }));

  const isEmpty =
    didYouKnow.length === 0 &&
    powerExplainers.length === 0 &&
    eraSummary === null &&
    tagChips.length === 0;

  return { didYouKnow, powerExplainers, eraSummary, tags: tagChips, isEmpty };
}

/** Fetch the narrative for one hero. Returns empty shape when none exists. */
export async function getHeroNarrative(heroId: string): Promise<HeroNarrative> {
  if (!heroId) return emptyNarrative();

  const [factsRes, tagsRes] = await Promise.all([
    supabase
      .from('hero_narrative_facts')
      .select('kind, content, subject, position')
      .eq('hero_id', heroId),
    supabase.from('hero_tags').select('tag, hero_tag_vocab(label)').eq('hero_id', heroId),
  ]);

  if (factsRes.error) throw new Error(factsRes.error.message);
  if (tagsRes.error) throw new Error(tagsRes.error.message);

  return buildNarrative(
    (factsRes.data ?? []) as FactRow[],
    (tagsRes.data ?? []) as unknown as TagJoinRow[],
  );
}

/** Vocab options (slug + label) for the Search/Discover tag facet. */
export async function getTagVocab(): Promise<Pick<HeroTagVocab, 'slug' | 'label' | 'category'>[]> {
  const { data, error } = await supabase
    .from('hero_tag_vocab')
    .select('slug, label, category')
    .order('category')
    .order('label');
  if (error) throw new Error(error.message);
  return data ?? [];
}
