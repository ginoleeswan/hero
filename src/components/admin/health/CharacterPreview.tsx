// Inline detail shown when a search result is expanded — real name, first
// appearance, origin, powers, teams and deck pulled live from ComicVine, plus a
// one-tap "Add". Lets you add a character with confidence instead of by name alone.
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { HeroThumb } from './atoms';
import type { CvCharacterDetail } from '../../../lib/db/cvIngest';

export function CharacterPreview({
  detail,
  loading,
  fallbackImage,
  inCat,
  busy,
  onAdd,
}: {
  detail: CvCharacterDetail | null | undefined;
  loading: boolean;
  fallbackImage: string | null;
  inCat: boolean;
  busy: boolean;
  onAdd: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={COLORS.orange} />
      </View>
    );
  }
  if (!detail) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.muted}>Couldn't load ComicVine details for this character.</Text>
      </View>
    );
  }

  const fa = detail.firstAppearance;
  const firstSeen = fa
    ? [fa.name, fa.issueNumber ? `#${fa.issueNumber}` : null].filter(Boolean).join(' ')
    : null;
  const facts: { label: string; value: string }[] = [];
  if (detail.realName) facts.push({ label: 'Real name', value: detail.realName });
  if (detail.appearances != null)
    facts.push({ label: 'Appearances', value: detail.appearances.toLocaleString() });
  if (firstSeen) facts.push({ label: 'First seen', value: firstSeen });
  if (detail.origin) facts.push({ label: 'Origin', value: detail.origin });
  if (detail.publisher) facts.push({ label: 'Publisher', value: detail.publisher });

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <HeroThumb uri={detail.image ?? fallbackImage} width={66} height={88} radius={9} />
        <View style={styles.facts}>
          {facts.map((f) => (
            <View key={f.label} style={styles.factRow}>
              <Text style={styles.factLabel}>{f.label}</Text>
              <Text style={styles.factValue} numberOfLines={1}>
                {f.value}
              </Text>
            </View>
          ))}
          {detail.aliases.length > 0 ? (
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Aliases</Text>
              <Text style={styles.factValue} numberOfLines={1}>
                {detail.aliases.slice(0, 4).join(', ')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {detail.deck ? (
        <Text style={styles.deck} numberOfLines={4}>
          {detail.deck}
        </Text>
      ) : null}

      {detail.powers.length > 0 ? <TagRow label="Powers" tags={detail.powers} max={8} /> : null}
      {detail.teams.length > 0 ? <TagRow label="Teams" tags={detail.teams} max={5} /> : null}

      <Pressable
        onPress={onAdd}
        disabled={inCat || busy}
        style={[styles.addBtn, inCat ? styles.addBtnIn : null, busy && styles.dim]}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons
            name={inCat ? 'checkmark' : 'add'}
            size={15}
            color={inCat ? COLORS.green : '#fff'}
          />
        )}
        <Text style={[styles.addBtnText, inCat && styles.addBtnTextIn]}>
          {inCat ? 'In catalogue' : 'Add to catalogue'}
        </Text>
      </Pressable>
    </View>
  );
}

function TagRow({ label, tags, max }: { label: string; tags: string[]; max: number }) {
  const extra = tags.length - max;
  return (
    <View style={styles.tagBlock}>
      <Text style={styles.tagLabel}>{label}</Text>
      <View style={styles.tags}>
        {tags.slice(0, max).map((t) => (
          <View key={t} style={styles.tag}>
            <Text style={styles.tagText} numberOfLines={1}>
              {t}
            </Text>
          </View>
        ))}
        {extra > 0 ? <Text style={styles.tagMore}>+{extra}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 16, alignItems: 'center' },
  wrap: { gap: 10, paddingTop: 4, paddingBottom: 12, paddingLeft: 42, paddingRight: 4 },
  muted: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: COLORS.grey },

  top: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  facts: { flex: 1, minWidth: 0, gap: 3 },
  factRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  factLabel: {
    width: 86,
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  factValue: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    color: COLORS.black,
  },

  deck: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: COLORS.navy, lineHeight: 18 },

  tagBlock: { gap: 5 },
  tagLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  tag: {
    backgroundColor: COLORS.orange + '14',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.orange },
  tagMore: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.grey },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.orange,
    borderRadius: 9,
    paddingVertical: 9,
    marginTop: 2,
  },
  addBtnIn: { backgroundColor: COLORS.green + '1a' },
  addBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
  addBtnTextIn: { color: COLORS.green },
  dim: { opacity: 0.5 },
});
