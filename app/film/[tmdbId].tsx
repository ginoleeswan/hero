import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy film route — kept so existing /film/<tmdbId> links resolve to the
 *  generalized /title/<source:id> detail screen. */
export default function FilmRedirect() {
  const { tmdbId } = useLocalSearchParams<{ tmdbId: string }>();
  if (!tmdbId) return <Redirect href="/" />;
  return <Redirect href={`/title/tmdb:${tmdbId}`} />;
}
