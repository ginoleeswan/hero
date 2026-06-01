import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { CategorySlug } from '../../../lib/db/heroes';
import {
  type CategoryFilters, type FacetCounts, type FacetKey,
  visibleFacets,
} from '../../../lib/db/categoryFilters';

type SetFilter = <K extends keyof CategoryFilters>(k: K, v: CategoryFilters[K]) => void;

interface Props {
  slug: CategorySlug;
  filters: CategoryFilters;
  counts: FacetCounts | null;
  setFilter: SetFilter;
}

interface Opt { value: string; label: string; count?: number; }

function Group({ title, options, selected, onSelect }: {
  title: string; options: Opt[]; selected: string; onSelect: (v: string) => void;
}) {
  return (
    <View style={s.group}>
      <Text style={s.groupTitle as object}>{title}</Text>
      <View style={s.optionWrap as object}>
        {options.map((o) => {
          const active = o.value === selected;
          const disabled = o.count === 0 && !active;
          return (
            <Pressable
              key={o.value}
              disabled={disabled}
              onPress={() => onSelect(o.value)}
              style={[s.option, active && (s.optionActive as object), disabled && (s.optionDisabled as object)] as object}
            >
              <Text style={[s.optionText, active && (s.optionTextActive as object)] as object}>{o.label}</Text>
              {typeof o.count === 'number' && (
                <Text style={[s.count, active && (s.countActive as object)] as object}>{o.count}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function FilterControls({ slug, filters, counts, setFilter }: Props) {
  const visible = visibleFacets(slug);
  const has = (f: FacetKey) => visible.includes(f);

  return (
    <View style={s.root}>
      <Group
        title="Sort"
        selected={filters.sort}
        onSelect={(v) => setFilter('sort', v as CategoryFilters['sort'])}
        options={[
          { value: 'popular', label: 'Popular' },
          { value: 'az', label: 'A–Z' },
          { value: 'power', label: 'Power' },
        ]}
      />

      {has('publisher') && (
        <Group
          title="Publisher"
          selected={filters.publisher}
          onSelect={(v) => setFilter('publisher', v as CategoryFilters['publisher'])}
          options={[
            { value: 'all', label: 'All', count: counts?.publisher.all },
            { value: 'marvel', label: 'Marvel', count: counts?.publisher.marvel },
            { value: 'dc', label: 'DC', count: counts?.publisher.dc },
            { value: 'other', label: 'Other', count: counts?.publisher.other },
          ]}
        />
      )}

      {has('alignment') && (
        <Group
          title="Alignment"
          selected={filters.alignment}
          onSelect={(v) => setFilter('alignment', v as CategoryFilters['alignment'])}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'good', label: 'Good', count: counts?.alignment.good },
            { value: 'bad', label: 'Bad', count: counts?.alignment.bad },
            { value: 'neutral', label: 'Neutral', count: counts?.alignment.neutral },
          ]}
        />
      )}

      {has('gender') && (
        <Group
          title="Gender"
          selected={filters.gender}
          onSelect={(v) => setFilter('gender', v as CategoryFilters['gender'])}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'male', label: 'Male', count: counts?.gender.male },
            { value: 'female', label: 'Female', count: counts?.gender.female },
          ]}
        />
      )}

      {has('hasStats') && (
        <Group
          title="Powerstats"
          selected={filters.hasStats ? 'yes' : 'any'}
          onSelect={(v) => setFilter('hasStats', v === 'yes')}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'yes', label: 'Has stats', count: counts?.has_stats },
          ]}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 18 },
  group: { gap: 8 },
  groupTitle: {
    fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 0.6,
    textTransform: 'uppercase', color: 'rgba(245,235,220,0.5)',
  } as object,
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 } as object,
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', cursor: 'pointer',
  } as object,
  optionActive: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.32)' } as object,
  optionDisabled: { opacity: 0.35, cursor: 'default' } as object,
  optionText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.6)' } as object,
  optionTextActive: { color: COLORS.beige } as object,
  count: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.35)' } as object,
  countActive: { color: 'rgba(245,235,220,0.7)' } as object,
});
