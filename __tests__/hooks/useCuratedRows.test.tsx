import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import { useCuratedRows } from '../../src/hooks/useCuratedRows';
import { getRelatedHeroes } from '../../src/lib/db/heroes';
import type { RelatedHeroCard } from '../../src/lib/db/heroes/types';

jest.mock('../../src/lib/db/heroes', () => ({
  getRelatedHeroes: jest.fn(),
}));

const mockGetRelated = getRelatedHeroes as jest.MockedFunction<typeof getRelatedHeroes>;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const card = (id: string): RelatedHeroCard =>
  ({
    id,
    name: id,
    image_url: null,
    image_md_url: null,
    portrait_url: null,
    publisher: null,
    alignment: null,
  }) as RelatedHeroCard;

describe('useCuratedRows', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns teammates + rivals for a lead, excluding placed heroes', async () => {
    mockGetRelated.mockImplementation((_, kind) =>
      Promise.resolve(
        kind === 'teammate' ? [card('robin'), card('placed')] : [card('joker'), card('bane')],
      ),
    );
    const isPlaced = (id: string) => id === 'placed';
    const { result } = renderHook(() => useCuratedRows('batman', isPlaced), { wrapper });

    await waitFor(() => expect(result.current.teammates.length).toBe(1));
    expect(result.current.teammates.map((h) => h.id)).toEqual(['robin']); // 'placed' filtered out
    await waitFor(() => expect(result.current.rivals.length).toBe(2));
    expect(result.current.rivals.map((h) => h.id)).toEqual(['joker', 'bane']);
  });

  it('does not query and returns [] when there is no lead', () => {
    const { result } = renderHook(() => useCuratedRows(undefined, () => false), { wrapper });
    expect(result.current.teammates).toEqual([]);
    expect(result.current.rivals).toEqual([]);
    expect(mockGetRelated).not.toHaveBeenCalled();
  });

  it('degrades to [] when the query rejects', async () => {
    mockGetRelated.mockResolvedValue([]);
    const { result } = renderHook(() => useCuratedRows('batman', () => false), { wrapper });
    await waitFor(() => expect(mockGetRelated).toHaveBeenCalled());
    expect(result.current.rivals).toEqual([]);
  });
});
