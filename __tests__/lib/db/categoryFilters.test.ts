import {
  DEFAULT_FILTERS,
  defaultSort,
  visibleFacets,
  filtersToParams,
  paramsToFilters,
  activeFilterList,
  type CategoryFilters,
} from '../../../src/lib/db/categoryFilters';

describe('defaultSort', () => {
  it('defaults strongest and most-intelligent to power', () => {
    expect(defaultSort('strongest')).toBe('power');
    expect(defaultSort('most-intelligent')).toBe('power');
  });
  it('defaults other slugs to popular', () => {
    expect(defaultSort('villain')).toBe('popular');
    expect(defaultSort('marvel')).toBe('popular');
  });
});

describe('visibleFacets', () => {
  it('hides alignment for villain and anti-heroes', () => {
    expect(visibleFacets('villain')).not.toContain('alignment');
    expect(visibleFacets('anti-heroes')).not.toContain('alignment');
  });
  it('hides publisher for marvel and dc', () => {
    expect(visibleFacets('marvel')).not.toContain('publisher');
    expect(visibleFacets('dc')).not.toContain('publisher');
  });
  it('hides hasStats for strongest and most-intelligent', () => {
    expect(visibleFacets('strongest')).not.toContain('hasStats');
  });
  it('shows all four for popular', () => {
    expect(visibleFacets('popular').sort()).toEqual([
      'alignment',
      'gender',
      'hasStats',
      'publisher',
    ]);
  });
});

describe('filtersToParams / paramsToFilters round-trip', () => {
  it('omits defaults from params', () => {
    const params = filtersToParams('popular', DEFAULT_FILTERS);
    expect(params).toEqual({});
  });
  it('serializes non-default values', () => {
    const f: CategoryFilters = {
      publisher: 'marvel',
      alignment: 'bad',
      gender: 'female',
      hasStats: true,
      sort: 'az',
      search: 'man',
    };
    expect(filtersToParams('popular', f)).toEqual({
      publisher: 'marvel',
      alignment: 'bad',
      gender: 'female',
      stats: '1',
      sort: 'az',
      q: 'man',
    });
  });
  it('omits sort when it equals the slug default', () => {
    const f: CategoryFilters = { ...DEFAULT_FILTERS, sort: 'power' };
    expect(filtersToParams('strongest', f).sort).toBeUndefined();
  });
  it('round-trips back to the same filters', () => {
    const f: CategoryFilters = {
      publisher: 'dc',
      alignment: 'good',
      gender: 'male',
      hasStats: true,
      sort: 'power',
      search: 'bat',
    };
    expect(paramsToFilters('popular', filtersToParams('popular', f))).toEqual(f);
  });
  it('applies the slug default sort when no sort param present', () => {
    expect(paramsToFilters('strongest', {}).sort).toBe('power');
    expect(paramsToFilters('villain', {}).sort).toBe('popular');
  });
});

describe('activeFilterList', () => {
  it('lists only non-default, visible filters as removable chips', () => {
    const f: CategoryFilters = { ...DEFAULT_FILTERS, alignment: 'bad', gender: 'female' };
    // On villain, alignment facet is hidden, so it must not appear as a chip.
    const chips = activeFilterList('villain', f);
    expect(chips.map((c) => c.key)).toEqual(['gender']);
    expect(chips[0]).toEqual({ key: 'gender', label: 'Female' });
  });
});
