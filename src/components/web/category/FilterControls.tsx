import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../../constants/colors';
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
  slug: CategorySlug | null;
  filters: CategoryFilters;
  counts: FacetCounts | null;
  setFilter: SetFilter;
}

interface Opt {
  value: string;
  label: string;
  count?: number;
  icon?: string;
  // The neutral "no filter" choice (All / Any). When selected it gets a quiet
  // beige active state, not the orange brand accent — orange is reserved for
  // genuine narrowing so the page never *looks* filtered when it isn't.
  neutral?: boolean;
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
  const neutralActive = active && opt.neutral;
  const brandActive = active && !opt.neutral;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          s.chip,
          neutralActive && (s.chipActiveNeutral as object),
          brandActive && (s.chipActive as object),
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
    <View style={s.group as object}>
      <Text style={s.groupTitle as object}>{title}</Text>
      <View style={s.chips as object}>{children}</View>
    </View>
  );
}

// Themes can hold many tags — collapse to a preview row with a Show all/less
// toggle so the rail doesn't become a wall of chips.
const THEME_PREVIEW = 8;
function CollapsibleGroup({
  title,
  count,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={s.group as object}>
      <View style={s.groupHeaderRow as object}>
        <Text style={s.groupTitle as object}>{title}</Text>
        {count > THEME_PREVIEW && (
          <Pressable
            onPress={onToggle}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [s.toggle, hovered && (s.toggleHover as object)] as object
            }
          >
            <Text style={s.toggleText as object}>
              {collapsed ? `Show all ${count}` : 'Show less'}
            </Text>
            <Ionicons
              name={collapsed ? 'chevron-down' : 'chevron-up'}
              size={12}
              color={COLORS.orange}
            />
          </Pressable>
        )}
      </View>
      <View style={s.chips as object}>{children}</View>
    </View>
  );
}

export function FilterControls({ slug, filters, counts, setFilter }: Props) {
  const visible = visibleFacets(slug);
  const has = (f: FacetKey) => visible.includes(f);

  const [vocab, setVocab] = useState<TagOption[]>([]);
  const [themesOpen, setThemesOpen] = useState(false);
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
      <View style={s.groupFirst as object}>
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
              { value: 'all', label: 'All', neutral: true },
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
              { value: 'any', label: 'Any', neutral: true },
              { value: 'good', label: 'Good', count: counts?.alignment.good, icon: 'thumbs-up' },
              { value: 'bad', label: 'Bad', count: counts?.alignment.bad, icon: 'thumbs-down' },
              {
                value: 'neutral',
                label: 'Neutral',
                count: counts?.alignment.neutral,
                icon: 'remove-circle-outline',
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
              { value: 'any', label: 'Any', neutral: true },
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
              { value: 'any', label: 'Any', neutral: true },
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

      {vocab.length > 0 &&
        (() => {
          const selected = filters.tags ?? [];
          // When collapsed, always surface selected themes plus a preview of the
          // rest so active filters never hide behind the toggle.
          const shown = themesOpen
            ? vocab
            : vocab
                .filter((t) => selected.includes(t.slug))
                .concat(vocab.filter((t) => !selected.includes(t.slug)))
                .slice(0, Math.max(THEME_PREVIEW, selected.length));
          return (
            <CollapsibleGroup
              title="Themes"
              count={vocab.length}
              collapsed={!themesOpen}
              onToggle={() => setThemesOpen((v) => !v)}
            >
              {shown.map((t) => (
                <Chip
                  key={t.slug}
                  opt={{ value: t.slug, label: t.label }}
                  active={selected.includes(t.slug)}
                  onPress={() => toggleTag(t.slug)}
                />
              ))}
            </CollapsibleGroup>
          );
        })()}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 0 },
  groupFirst: { gap: 11 } as object,
  // Sort sits first with no hairline; faceted groups carry a top hairline so the
  // rail reads as distinct sections rather than one continuous stream.
  group: {
    gap: 11,
    paddingTop: 18,
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,235,220,0.08)',
  } as object,
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as object,
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  toggleHover: { opacity: 0.6 } as object,
  toggleText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    letterSpacing: 0.2,
  } as object,
  groupTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
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
    color: INK_TEXT.faint,
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
  // Neutral default (All / Any) selected: quiet beige fill, no brand accent.
  chipActiveNeutral: {
    backgroundColor: 'rgba(245,235,220,0.12)',
    borderColor: 'rgba(245,235,220,0.34)',
  } as object,
  chipDisabled: { opacity: 0.3, cursor: 'default' } as object,
  chipText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.72)',
    letterSpacing: 0.2,
  } as object,
  chipTextActive: { color: COLORS.beige } as object,
  count: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: INK_TEXT.faint } as object,
  countActive: { color: 'rgba(255,206,170,0.95)' } as object,
});
