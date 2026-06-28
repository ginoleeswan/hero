// "This Month in History" — the authored treatment of the debut-issues rail.
// Instead of a 12-card scroll, it leads with ONE notable anniversary shown large
// (cover + "X years ago" + the cast it introduced), with the rest of the month's
// vault spread across the right so the feature uses the full width instead of
// leaving dead space. Inventory → editorial moment. Lives in the dark "Right Now"
// band; reuses getDebutsThisMonth data untouched.
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import type { DebutIssue, DebutCharacter } from '../../../lib/db/anniversaries';

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
  const { width } = useWindowDimensions();
  const pad = width < 640 ? 16 : 32;
  const isDesktop = width >= 860;

  if (debuts.length === 0) return null;
  const lead = debuts[0];
  const leadChar = lead.characters[0];
  const rest = debuts.slice(1, isDesktop ? 7 : 5);
  const miniW = isDesktop ? 84 : 64;

  const openLead = () => leadChar && onHeroPress(leadChar.id);

  return (
    <View style={[s.section, { marginHorizontal: pad, padding: width < 640 ? 18 : 28 }] as object}>
      <View style={s.head}>
        <Text style={s.kicker as object}>From the Vault</Text>
        <Text style={s.title as object}>This Month in History</Text>
      </View>

      <View style={[s.layout, !isDesktop && (s.layoutStack as object)] as object}>
        {/* Featured anniversary (left half) */}
        <View style={[s.feature, !isDesktop && (s.featureStack as object)] as object}>
          <Pressable
            onPress={openLead}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [s.cover, hovered && (s.coverHover as object)] as object
            }
          >
            <Image
              source={coverUri(lead) ? { uri: coverUri(lead) } : undefined}
              contentFit="cover"
              style={StyleSheet.absoluteFill as object}
            />
          </Pressable>

          <View style={s.featureBody}>
            <Text style={s.anniv as object}>
              {lead.yearsAgo} {lead.yearsAgo === 1 ? 'year' : 'years'} ago
            </Text>
            <Text style={s.issue as object} numberOfLines={1}>
              {lead.seriesName}
              {lead.issueNumber ? ` #${lead.issueNumber}` : ''} · {lead.year}
            </Text>
            {lead.characters.length > 0 && (
              <Text style={s.intro as object} numberOfLines={2}>
                First appearance of{' '}
                <Text style={s.introName as object}>{castLine(lead.characters)}</Text>
              </Text>
            )}
            {!!leadChar && (
              <Pressable
                onPress={openLead}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [s.cta, hovered && (s.ctaHover as object)] as object
                }
              >
                <Text style={s.ctaText as object}>Meet {leadChar.name} →</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* The rest of the month's vault — fills the right half. */}
        {rest.length > 0 && (
          <View style={[s.vault, isDesktop && (s.vaultRight as object)] as object}>
            {isDesktop && <Text style={s.vaultLabel as object}>More from {MONTH}</Text>}
            <View style={s.vaultRow}>
              {rest.map((d) => {
                const c = d.characters[0];
                return (
                  <Pressable
                    key={d.issueId}
                    onPress={() => c && onHeroPress(c.id)}
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                      [
                        s.mini,
                        { width: miniW, height: Math.round(miniW * 1.5) },
                        hovered && (s.miniHover as object),
                      ] as object
                    }
                  >
                    <Image
                      source={coverUri(d) ? { uri: coverUri(d) } : undefined}
                      contentFit="cover"
                      style={StyleSheet.absoluteFill as object}
                    />
                    <View style={s.miniBadge as object}>
                      <Text style={s.miniBadgeText as object}>{d.yearsAgo}y</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const COVER_W = 150;

const s = StyleSheet.create({
  // Boxed in a lighter-navy glass panel for containment + variation against the
  // bare full-width rails around it.
  section: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
  },
  head: { marginBottom: 16 },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 2,
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: COLORS.beige,
    lineHeight: 28,
  } as object,

  layout: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  layoutStack: { flexDirection: 'column', alignItems: 'stretch', gap: 22 } as object,

  feature: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 22 },
  featureStack: { flexDirection: 'column', alignItems: 'flex-start', gap: 16 } as object,
  cover: {
    width: COVER_W,
    height: Math.round(COVER_W * 1.5),
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
    cursor: 'pointer',
    transition: 'transform 200ms ease',
    flexShrink: 0,
  } as object,
  coverHover: { transform: [{ translateY: -4 }] } as object,
  featureBody: { flex: 1, minWidth: 0 },
  anniv: {
    fontFamily: 'Flame-Regular',
    fontSize: 40,
    color: COLORS.orange,
    lineHeight: 42,
    marginBottom: 4,
  } as object,
  issue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.55)',
    marginBottom: 12,
  } as object,
  intro: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: 'rgba(245,235,220,0.8)',
    lineHeight: 21,
    marginBottom: 16,
  } as object,
  introName: { fontFamily: 'Nunito_700Bold', color: COLORS.beige } as object,
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
    borderRadius: 22,
    paddingVertical: 9,
    paddingHorizontal: 18,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  ctaHover: { backgroundColor: 'rgba(245,235,220,0.14)' } as object,
  ctaText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.beige } as object,

  // Vault — the rest of the month.
  vault: {},
  vaultRight: { flex: 1, justifyContent: 'center' } as object,
  vaultLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.4)',
    marginBottom: 12,
  } as object,
  vaultRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  mini: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 180ms ease',
  } as object,
  miniHover: { transform: [{ translateY: -3 }] } as object,
  miniBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(11,24,32,0.82)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  } as object,
  miniBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 0.5,
  } as object,
});
