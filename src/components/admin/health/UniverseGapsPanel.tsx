// Universe gaps: characters still parked in the 'Company-Licensed' catch-all with
// no real franchise. ComicVine gives the comic house, not the franchise, so there
// is no reliable auto-signal — assignment is editorial. This panel makes it
// actionable: assign a universe inline (pre-filled from team hints where we can
// guess), open ComicVine to identify the obscure ones, or copy the lot to hand
// over. Placing a hero also makes it fame-eligible. Renders nothing when clean.
import { useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { Panel } from './Panel';
import { InfoTip } from './InfoTip';
import { HeroThumb } from './atoms';
import { setHeroUniverse, type UnbrandedHero } from '../../../lib/db/catalogHealth';
import { refreshFameScores } from '../../../lib/db/build';

type Flash = (msg: string, tone?: 'info' | 'success' | 'error' | 'pending') => void;

// Best-effort franchise guess from ComicVine team membership — a pre-fill the
// admin accepts or overrides, never an auto-write (the Muppets/Sesame overlap and
// generic teams make it unreliable on its own).
const SUGGESTERS: [RegExp, string][] = [
  [/jedi|sith|rebel alliance|galactic republic|mandalor|ithorian|wookie|t'?surr|abednedo/i, 'Star Wars'],
  [/minbari|psi corps|grey council|narn|centauri/i, 'Babylon 5'],
  [/muppet/i, 'Sesame Street'],
  [/nests|k' team|kof/i, 'SNK'],
];
function suggestFranchise(teams: string[] | null): string {
  const hay = (teams ?? []).join(' ');
  for (const [re, franchise] of SUGGESTERS) if (re.test(hay)) return franchise;
  return '';
}

const cvUrl = (id: string | null) =>
  id ? `https://comicvine.gamespot.com/character/4005-${id}/` : null;

function GapRow({
  hero,
  onPlaced,
  flash,
}: {
  hero: UnbrandedHero;
  onPlaced: () => void;
  flash: Flash;
}) {
  const [value, setValue] = useState(() => suggestFranchise(hero.teams));
  const [busy, setBusy] = useState(false);
  const sub = (hero.teams ?? []).length > 0 ? (hero.teams ?? []).join(' · ') : hero.hint;
  const url = cvUrl(hero.comicvineId);

  const place = async () => {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      await setHeroUniverse(hero.id, v);
      await refreshFameScores(); // placed → now fame-eligible
      flash(`${hero.name} → ${v}`, 'success');
      onPlaced();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not set universe.', 'error');
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <HeroThumb uri={hero.image} size={34} />
      <View style={styles.info}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {hero.name}
          </Text>
          <Text style={styles.cv}>cv-{hero.comicvineId ?? '?'}</Text>
          {url ? (
            <Pressable onPress={() => Linking.openURL(url)} hitSlop={6} accessibilityLabel="Open in ComicVine">
              <Ionicons name="open-outline" size={13} color={COLORS.grey} />
            </Pressable>
          ) : null}
        </View>
        {sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : (
          <Text style={styles.subEmpty}>no team hint — identify via ComicVine</Text>
        )}
      </View>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Universe…"
        placeholderTextColor={COLORS.grey}
        style={styles.input}
        editable={!busy}
        onSubmitEditing={place}
        returnKeyType="done"
      />
      <Pressable
        onPress={place}
        disabled={busy || !value.trim()}
        style={[styles.setBtn, (busy || !value.trim()) && styles.setBtnOff]}
        accessibilityLabel={`Set ${hero.name}'s universe`}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.setText}>Set</Text>
        )}
      </Pressable>
    </View>
  );
}

export function UniverseGapsPanel({
  heroes,
  loading,
  flash,
  onChanged,
}: {
  heroes: UnbrandedHero[];
  loading: boolean;
  flash: Flash;
  onChanged: () => void;
}) {
  if (!loading && heroes.length === 0) return null;

  const copyList = async () => {
    const text = heroes
      .map((h) => `${h.name}\t${h.id}\tcv-${h.comicvineId ?? '?'}\t${(h.teams ?? []).join('/')}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      flash(`Copied ${heroes.length} unbranded characters.`, 'success');
    } catch {
      flash('Could not copy to clipboard.', 'error');
    }
  };

  return (
    <Panel
      title="Needs a universe"
      hint={`${heroes.length} character${heroes.length === 1 ? '' : 's'} still in the Company-Licensed catch-all`}
      action={
        <InfoTip text="ComicVine gives the comic publisher, not the franchise, so these can't be auto-placed. Type a universe and hit Set to place one (and make it fame-eligible) — the field pre-fills a guess from team hints where it can. Use the ComicVine link to identify the obscure ones, or Copy list to hand the hard ones over. Newly-ingested licensed characters land here." />
      }
    >
      {loading ? (
        <ActivityIndicator color={COLORS.orange} style={styles.loader} />
      ) : (
        <>
          <Pressable style={styles.copyBtn} onPress={copyList} accessibilityRole="button">
            <Ionicons name="copy-outline" size={14} color={COLORS.navy} />
            <Text style={styles.copyText}>Copy list</Text>
          </Pressable>
          <View style={styles.list}>
            {heroes.map((h) => (
              <GapRow key={h.id} hero={h} flash={flash} onPlaced={onChanged} />
            ))}
          </View>
        </>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  loader: { paddingVertical: 24 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 7,
    backgroundColor: 'rgba(41,60,67,0.06)',
    marginBottom: 8,
  },
  copyText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  list: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.06)',
  },
  info: { flex: 1, minWidth: 0, gap: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.black, flexShrink: 1 },
  cv: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey, fontVariant: ['tabular-nums'] },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  subEmpty: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey, fontStyle: 'italic', opacity: 0.7 },
  input: {
    width: 150,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.18)',
    backgroundColor: '#fff',
    fontFamily: 'Nunito_400Regular',
    fontSize: 12.5,
    color: COLORS.black,
  },
  setBtn: {
    minWidth: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 7,
    backgroundColor: COLORS.orange,
  },
  setBtnOff: { opacity: 0.4 },
  setText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: '#fff' },
});
