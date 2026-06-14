import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { CategorySlug } from '../../../lib/db/heroes';
import { getTagVocab } from '../../../lib/db/heroFacts';
import {
  type CategoryFilters,
  type FacetCounts,
  type FacetKey,
  visibleFacets,
} from '../../../lib/db/categoryFilters';

type TagOption = { slug: string; label: string; category: string };

type SetFilter = <K extends keyof CategoryFilters>(k: K, v: CategoryFilters[K]) => void;

interface Props {
  slug: CategorySlug;
  filters: CategoryFilters;
  counts: FacetCounts | null;
  setFilter: SetFilter;
}

interface Opt {
  value: string;
  label: string;
  count?: number;
  icon?: string;
}

// ── Sort: a true segmented control (solid beige active = primary hierarchy) ──────
function Segmented({
  options,
  selected,
  onSelect,
}: {
  options: Opt[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={s.segment as object}>
      {options.map((o) => {
        const active = o.value === selected;
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [
                s.seg,
                active && (s.segActive as object),
                !active && hovered && (s.segHover as object),
              ] as object
            }
          >
            <Text style={[s.segText, active && (s.segTextActive as object)] as object}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Facet chips: orange brand accent on active (secondary tier) ──────────────────
function Chip({ opt, active, onPress }: { opt: Opt; active: boolean; onPress: () => void }) {
  const disabled = opt.count === 0 && !active;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          s.chip,
          active && (s.chipActive as object),
          !active && !disabled && hovered && (s.chipHover as object),
          disabled && (s.chipDisabled as object),
        ] as object
      }
    >
      {opt.icon && (
        <Ionicons
          name={opt.icon as any}
          size={14}
          color={active ? COLORS.beige : 'rgba(245,235,220,0.5)'}
        />
      )}
      <Text style={[s.chipText, active && (s.chipTextActive as object)] as object}>
        {opt.label}
      </Text>
      {typeof opt.count === 'number' && (
        <Text style={[s.count, active && (s.countActive as object)] as object}>
          {opt.count.toLocaleString()}
        </Text>
      )}
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.group}>
      <Text style={s.groupTitle as object}>{title}</Text>
      <View style={s.chips as object}>{children}</View>
    </View>
  );
}

export function FilterControls({ slug, filters, counts, setFilter }: Props) {
  const visible = visibleFacets(slug);
  const has = (f: FacetKey) => visible.includes(f);

  const [vocab, setVocab] = useState<TagOption[]>([]);
  useEffect(() => {
    let active = true;
    getTagVocab()
      .then((v) => {
        if (active) setVocab(v);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const toggleTag = (slugValue: string) => {
    const current = filters.tags ?? [];
    setFilter(
      'tags',
      current.includes(slugValue)
        ? current.filter((t) => t !== slugValue)
        : [...current, slugValue],
    );
  };

  return (
    <View style={s.root}>
      <View style={s.group}>
        <Text style={s.groupTitle as object}>Sort by</Text>
        <Segmented
          selected={filters.sort}
          onSelect={(v) => setFilter('sort', v as CategoryFilters['sort'])}
          options={[
            { value: 'popular', label: 'Popular' },
            { value: 'az', label: 'A–Z' },
            { value: 'power', label: 'Power' },
          ]}
        />
      </View>

      {has('publisher') && (
        <Group title="Universe">
          {(
            [
              { value: 'all', label: 'All', count: counts?.publisher.all },
              { value: 'marvel', label: 'Marvel', count: counts?.publisher.marvel },
              { value: 'dc', label: 'DC', count: counts?.publisher.dc },
              { value: 'other', label: 'Other', count: counts?.publisher.other },
            ] as Opt[]
          ).map((o) => (
            <Chip
              key={o.value}
              opt={o}
              active={filters.publisher === o.value}
              onPress={() => setFilter('publisher', o.value as CategoryFilters['publisher'])}
            />
          ))}
        </Group>
      )}

      {has('alignment') && (
        <Group title="Alignment">
          {(
            [
              { value: 'any', label: 'Any' },
              { value: 'good', label: 'Good', count: counts?.alignment.good, icon: 'thumbs-up' },
              { value: 'bad', label: 'Bad', count: counts?.alignment.bad, icon: 'thumbs-down' },
              {
                value: 'neutral',
                label: 'Neutral',
                count: counts?.alignment.neutral,
                icon: 'minus-circle',
              },
            ] as Opt[]
          ).map((o) => (
            <Chip
              key={o.value}
              opt={o}
              active={filters.alignment === o.value}
              onPress={() => setFilter('alignment', o.value as CategoryFilters['alignment'])}
            />
          ))}
        </Group>
      )}

      {has('gender') && (
        <Group title="Gender">
          {(
            [
              { value: 'any', label: 'Any' },
              { value: 'male', label: 'Male', count: counts?.gender.male, icon: 'male' },
              { value: 'female', label: 'Female', count: counts?.gender.female, icon: 'female' },
            ] as Opt[]
          ).map((o) => (
            <Chip
              key={o.value}
              opt={o}
              active={filters.gender === o.value}
              onPress={() => setFilter('gender', o.value as CategoryFilters['gender'])}
            />
          ))}
        </Group>
      )}

      {has('hasStats') && (
        <Group title="Power stats">
          {(
            [
              { value: 'any', label: 'Any' },
              { value: 'yes', label: 'Rated only', count: counts?.has_stats },
            ] as Opt[]
          ).map((o) => (
            <Chip
              key={o.value}
              opt={o}
              active={(filters.hasStats ? 'yes' : 'any') === o.value}
              onPress={() => setFilter('hasStats', o.value === 'yes')}
            />
          ))}
        </Group>
      )}

      {vocab.length > 0 && (
        <Group title="Themes">
          {vocab.map((t) => (
            <Chip
              key={t.slug}
              opt={{ value: t.slug, label: t.label }}
              active={(filters.tags ?? []).includes(t.slug)}
              onPress={() => toggleTag(t.slug)}
            />
          ))}
        </Group>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 22 },
  group: { gap: 11 },
  groupTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.42)',
  } as object,

  // Segmented Sort control
  segment: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.08)',
  } as object,
  seg: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 160ms ease',
  } as object,
  segHover: { backgroundColor: 'rgba(245,235,220,0.06)' } as object,
  segActive: {
    backgroundColor: COLORS.beige,
    boxShadow: '0 2px 10px -2px rgba(0,0,0,0.45)',
  } as object,
  segText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    color: 'rgba(245,235,220,0.5)',
    letterSpacing: 0.2,
  } as object,
  segTextActive: { fontFamily: 'Nunito_900Black', color: COLORS.navy } as object,

  // Facet chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 } as object,
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: 'rgba(245,235,220,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.12)',
    cursor: 'pointer',
    transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
  } as object,
  chipHover: {
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderColor: 'rgba(245,235,220,0.26)',
  } as object,
  chipActive: {
    backgroundColor: 'rgba(231,115,51,0.16)',
    borderColor: 'rgba(231,115,51,0.6)',
    boxShadow: '0 4px 16px -4px rgba(231,115,51,0.5)',
  } as object,
  chipDisabled: { opacity: 0.3, cursor: 'default' } as object,
  chipText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.72)',
    letterSpacing: 0.2,
  } as object,
  chipTextActive: { color: COLORS.beige } as object,
  count: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(245,235,220,0.36)' } as object,
  countActive: { color: 'rgba(255,206,170,0.95)' } as object,
});
