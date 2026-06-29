// src/components/home/ThisMonthInHistory.tsx
// "This Month in History" — the authored treatment of the debut-issues rail.
// Leads with ONE notable anniversary shown large (cover + "X years ago" + the
// cast it introduced), with the rest of the month's vault scrolling beneath.
// Inventory → editorial moment. Boxed in lighter-navy glass; native sibling of
// the web module. Reuses getDebutsThisMonth data untouched.
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import type { DebutIssue, DebutCharacter } from '../../lib/db/anniversaries';

const MONTH = new Date().toLocaleString('en-US', { month: 'long' });

function castLine(chars: DebutCharacter[]): string {
  if (chars.length === 0) return '';
  if (chars.length === 1) return chars[0].name;
  if (chars.length === 2) return `${chars[0].name} & ${chars[1].name}`;
  return `${chars[0].name}, ${chars[1].name} +${chars.length - 2}`;
}

function coverUri(issue: DebutIssue): string | undefined {
  const c = issue.characters[0];
  return issue.cover_url ?? c?.image_url ?? c?.portrait_url ?? undefined;
}

export function ThisMonthInHistory({
  debuts,
  onHeroPress,
}: {
  debuts: DebutIssue[];
  onHeroPress: (id: string) => void;
}) {
  if (debuts.length === 0) return null;
  const lead = debuts[0];
  const leadChar = lead.characters[0];
  const rest = debuts.slice(1, 9);
  const openLead = () => leadChar && onHeroPress(leadChar.id);
  const leadCover = coverUri(lead);

  return (
    <View style={s.section}>
      <View style={s.head}>
        <Text style={s.kicker}>From the Vault</Text>
        <Text style={s.title}>This Month in History</Text>
      </View>

      <View style={s.feature}>
        <Pressable onPress={openLead} style={s.cover} disabled={!leadChar}>
          <Image
            source={leadCover ? { uri: leadCover } : undefined}
            contentFit="cover"
            style={StyleSheet.absoluteFill as object}
          />
        </Pressable>

        <View style={s.featureBody}>
          <Text style={s.anniv} numberOfLines={1}>
            {lead.yearsAgo} {lead.yearsAgo === 1 ? 'year' : 'years'} ago
          </Text>
          <Text style={s.issue} numberOfLines={1}>
            {lead.seriesName}
            {lead.issueNumber ? ` #${lead.issueNumber}` : ''} · {lead.year}
          </Text>
          {lead.characters.length > 0 && (
            <Text style={s.intro} numberOfLines={2}>
              First appearance of <Text style={s.introName}>{castLine(lead.characters)}</Text>
            </Text>
          )}
          {!!leadChar && (
            <Pressable onPress={openLead} style={s.cta}>
              <Text style={s.ctaText} numberOfLines={1}>
                Meet {leadChar.name} →
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {rest.length > 0 && (
        <View style={s.vault}>
          <Text style={s.vaultLabel}>More from {MONTH}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.vaultRow}
          >
            {rest.map((d) => {
              const c = d.characters[0];
              const cover = coverUri(d);
              return (
                <Pressable key={d.issueId} onPress={() => c && onHeroPress(c.id)} style={s.mini}>
                  <Image
                    source={cover ? { uri: cover } : undefined}
                    contentFit="cover"
                    style={StyleSheet.absoluteFill as object}
                  />
                  <View style={s.miniBadge}>
                    <Text style={s.miniBadgeText}>{d.yearsAgo}y</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const COVER_W = 104;
const MINI_W = 62;

const s = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  head: { marginBottom: 14 },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 2,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige, lineHeight: 28 },

  feature: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cover: {
    width: COVER_W,
    height: Math.round(COVER_W * 1.5),
    borderRadius: 10,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  featureBody: { flex: 1, minWidth: 0 },
  anniv: {
    fontFamily: 'Flame-Regular',
    fontSize: 27,
    color: COLORS.orange,
    lineHeight: 31,
    marginBottom: 3,
  },
  issue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.55)',
    marginBottom: 10,
  },
  intro: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.8)',
    lineHeight: 19,
    marginBottom: 12,
  },
  introName: { fontFamily: 'Nunito_700Bold', color: COLORS.beige },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  ctaText: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.beige },

  vault: { marginTop: 18 },
  vaultLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.4)',
    marginBottom: 10,
  },
  vaultRow: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  mini: {
    width: MINI_W,
    height: Math.round(MINI_W * 1.5),
    borderRadius: 8,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  miniBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(11,24,32,0.82)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  miniBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 0.5,
  },
});
