import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import { usePresetTeams } from '../../src/hooks/usePresetTeams';
import { getFeaturedTeams, type FeaturedTeam } from '../../src/lib/db/teams';

jest.mock('../../src/lib/db/teams', () => ({
  getFeaturedTeams: jest.fn(),
}));

const mockGetFeaturedTeams = getFeaturedTeams as jest.MockedFunction<typeof getFeaturedTeams>;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const team = (id: string): FeaturedTeam => ({
  id,
  name: id,
  publisher: 'Marvel',
  logo_url: null,
  popularity: 1,
});

describe('usePresetTeams', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the featured teams once resolved', async () => {
    mockGetFeaturedTeams.mockResolvedValue([team('avengers'), team('jla')]);
    const { result } = renderHook(() => usePresetTeams(), { wrapper });
    await waitFor(() => expect(result.current.teams).toHaveLength(2));
    expect(result.current.teams.map((t) => t.id)).toEqual(['avengers', 'jla']);
  });

  it('degrades to an empty list', async () => {
    mockGetFeaturedTeams.mockResolvedValue([]);
    const { result } = renderHook(() => usePresetTeams(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams).toEqual([]);
  });
});
