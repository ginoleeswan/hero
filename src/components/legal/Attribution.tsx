// src/components/legal/Attribution.tsx — the source credits, as a licence
// obligation rather than a courtesy.
//
// TMDB's API terms require the acknowledgement below, in these words, wherever
// their data is used. It is not a nice-to-have and it is not paraphrasable:
// "not endorsed or certified by TMDB" is the part that does the work, because
// the whole point is that a reader must not think TMDB vouched for this app.
// The app had none of it, which is a licence breach and — separately — a thing
// App Review checks for on any app whose content obviously comes from a
// third-party catalogue.
//
// ComicVine is credited on the same principle. The catalogue is theirs; a fan
// app built on someone else's data should say so where a reader can see it,
// not only in a terms page nobody opens.
//
// STILL OUTSTANDING: TMDB's brand guidelines also ask for their logo alongside
// this text. That needs the official asset — drawing their mark from memory
// would be worse than omitting it, since an inaccurate trademark is its own
// problem. Drop `assets/brand/tmdb.svg` in and render it beside `TMDB_CREDIT`.
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { PAPER_TEXT } from '../../constants/colors';

/** The exact wording TMDB's terms require. Do not reword. */
export const TMDB_CREDIT =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.';

/** ComicVine, on the same principle: the catalogue is theirs. */
export const COMICVINE_CREDIT = 'Comic data from Comic Vine.';

/**
 * The full credit block, for a settings or about surface.
 *
 * `tone="dark"` for the navy canvases; the default reads on beige.
 */
export function Attribution({ tone = 'paper' }: { tone?: 'paper' | 'dark' }) {
  const dark = tone === 'dark';
  return (
    <View style={styles.wrap}>
      <Text style={[styles.line, dark && styles.lineDark]}>{TMDB_CREDIT}</Text>
      <Text style={[styles.line, dark && styles.lineDark]}>{COMICVINE_CREDIT}</Text>
    </View>
  );
}

/**
 * One line, for the foot of a page that shows TMDB data.
 *
 * Separate from the block because a film page needs the credit where the data
 * is, and a second full block there would read as boilerplate rather than as a
 * source note.
 */
export function TmdbCreditLine({ tone = 'paper' }: { tone?: 'paper' | 'dark' }) {
  return (
    <Text style={[styles.line, styles.inline, tone === 'dark' && styles.lineDark]}>
      {TMDB_CREDIT}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, paddingHorizontal: 12, marginTop: 10 },
  line: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    lineHeight: 15,
    color: PAPER_TEXT.faint,
    textAlign: 'center',
  },
  lineDark: { color: 'rgba(245,235,220,0.55)' },
  inline: { paddingHorizontal: 20, marginTop: 14 },
});
