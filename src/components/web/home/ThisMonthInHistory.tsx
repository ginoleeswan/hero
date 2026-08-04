import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { COLORS, EYEBROW, pageGutter, INK_TEXT } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
import { HeroAvatar } from '../../HeroAvatar';
import type { DebutIssue, DebutCharacter } from '../../../lib/db/anniversaries';

const MONTH = new Date().toLocaleString('en-US', { month: 'long' });

type CharWithYear = DebutCharacter & { yearsAgo: number };

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
  const pagePad = pageGutter(width);
  const isDesktop = width >= 860;

  if (debuts.length === 0) return null;

  const lead = debuts[0];
  const leadChar = lead.characters[0];
  const openLead = () => leadChar && onHeroPress(leadChar.id);

  // All debut characters flattened, deduped — fill the character strip
  const seen = new Set<string>();
  const allChars: CharWithYear[] = [];
  for (const d of debuts) {
    for (const c of d.characters) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        allChars.push({ ...c, yearsAgo: d.yearsAgo });
      }
    }
  }

  const COVER_W = isDesktop ? 190 : 130;
  const COVER_H = Math.round(COVER_W * 1.5);
  const AVATAR = isDesktop ? 52 : 44;

  return (
    <View style={[s.section, { paddingHorizontal: pagePad }] as object}>
      <View style={s.rule as object} />

      {/* Section header */}
      <View style={s.head}>
        <Text style={s.kicker as object}>From the Vault</Text>
        <Text style={s.title as object}>This Month in History</Text>
      </View>

      {/* Content: cover thumbnail + editorial column */}
      <View style={[s.layout, !isDesktop && (s.layoutStack as object)] as object}>
        {/* Cover — proper thumbnail at 2:3 */}
        <Pressable
          onPress={openLead}
          style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
            [
              s.cover,
              { width: COVER_W, height: COVER_H },
              (hovered || pressed) && (s.coverHover as object),
            ] as object
          }
        >
          <Image
            source={coverUri(lead) ? { uri: coverUri(lead) } : undefined}
            contentFit="cover"
            style={{ position: 'absolute', inset: 0 } as object}
          />
        </Pressable>

        {/* Editorial column — headline + copy + character strip.
            The column fills all remaining width; the ghost year anchors
            top-right behind the content so there's no empty zone.        */}
        <View style={[s.editorial, !isDesktop && { overflow: 'visible' }] as object}>
          {/* Ghost year — structural backdrop, behind everything */}
          {isDesktop && !!lead.year && (
            <Text
              style={s.yearWatermark as object}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              numberOfLines={1}
            >
              {lead.year}
            </Text>
          )}

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
              style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
                [s.cta, (hovered || pressed) && (s.ctaHover as object)] as object
              }
            >
              <Text style={s.ctaText as object}>Meet {leadChar.name} →</Text>
            </Pressable>
          )}

          {/* Character strip — fills the lower half of the editorial column */}
          {allChars.length > 0 && (
            <View style={s.charBlock as object}>
              <View style={s.charRule as object} />
              <Text style={s.charLabel as object}>Also debuted in {MONTH}</Text>
              {(() => {
                const chips = allChars.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => onHeroPress(c.id)}
                    style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
                      [s.charChip, (hovered || pressed) && (s.charChipHover as object)] as object
                    }
                  >
                    <View
                      style={
                        [
                          s.charAvatar,
                          c.avatar_url && (s.faceBare as object),
                          { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
                        ] as object
                      }
                    >
                      {c.avatar_url ? (
                        <HeroAvatar
                          id={c.id}
                          name={c.name}
                          avatarUrl={c.avatar_url}
                          size={AVATAR}
                          bare
                        />
                      ) : (
                        <>
                          <HeroImage
                            id={c.id}
                            name={c.name}
                            imageUrl={c.image_url}
                            portraitUrl={c.portrait_url}
                            grid
                            contentFit="cover"
                            contentPosition={{ top: '10%', left: '50%' }}
                            style={
                              {
                                position: 'absolute',
                                inset: 0,
                                borderRadius: AVATAR / 2,
                              } as object
                            }
                            recyclingKey={c.id}
                          />
                          {/* The ring frames a cropped rectangle into a face. A
                              head is already one, so it goes unringed. */}
                          <View
                            style={[s.charAvatarRing, { borderRadius: AVATAR / 2 }] as object}
                          />
                        </>
                      )}
                    </View>
                    <Text style={s.charName as object} numberOfLines={1}>
                      {c.name}
                    </Text>
                  </Pressable>
                ));

                // Desktop wraps into a grid; mobile scrolls horizontally so the
                // roster never forces the page wider than the viewport.
                return isDesktop ? (
                  <View style={s.charStrip}>{chips}</View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    // Bleed the strip out to the screen edges: cancel the
                    // section gutter with a negative margin, then restore it as
                    // content padding so chips rest aligned but scroll edge-to-edge.
                    style={{ marginHorizontal: -pagePad } as object}
                    contentContainerStyle={
                      [s.charStripScrollContent, { paddingHorizontal: pagePad }] as object
                    }
                  >
                    {chips}
                  </ScrollView>
                );
              })()}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    marginTop: 8,
    marginBottom: 12,
  },
  rule: {
    height: 1,
    marginBottom: 24,
    backgroundImage: `linear-gradient(to right, transparent, ${COLORS.orange}55, transparent)`,
  } as object,

  head: { marginBottom: 18 },
  kicker: {
    ...EYEBROW,
    marginBottom: 2,
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 28,
    color: COLORS.beige,
    lineHeight: 30,
  } as object,

  layout: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  // Column stack must stretch children — the base row style sets
  // alignItems:'flex-start', which in a column sizes the editorial column to
  // its content's min-width (the nowrap roster), overflowing the viewport.
  layoutStack: { flexDirection: 'column', alignItems: 'stretch', gap: 20 } as object,

  // Rests at a slight collector's tilt; straightens and lifts on hover, like
  // picking the issue up off the table.
  cover: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    boxShadow: '0 20px 48px rgba(0,0,0,0.55)',
    cursor: 'pointer',
    transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms ease',
    flexShrink: 0,
    transform: [{ rotate: '-2.5deg' }],
  } as object,
  coverHover: {
    transform: [{ rotate: '0deg' }, { translateY: -6 }],
    boxShadow: '0 28px 60px rgba(0,0,0,0.65)',
  } as object,

  // The editorial column fills remaining width and anchors the ghost year
  editorial: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    overflow: 'hidden',
    paddingTop: 4,
  } as object,

  // Ghost year — top-right of the editorial column, barely visible backdrop
  // Same ink-on-ink splash treatment as the spotlight's name backdrop.
  yearWatermark: {
    position: 'absolute',
    right: -12,
    top: -28,
    fontFamily: 'Flame-Regular',
    fontSize: 210,
    lineHeight: 210,
    letterSpacing: 4,
    color: 'rgba(245,235,220,0.055)',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: 0,
  } as object,

  anniv: {
    fontFamily: 'Flame-Regular',
    fontSize: 56,
    color: COLORS.orange,
    lineHeight: 58,
    marginBottom: 6,
    position: 'relative',
    zIndex: 1,
  } as object,
  issue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
    marginBottom: 12,
    position: 'relative',
    zIndex: 1,
  } as object,
  intro: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: 'rgba(245,235,220,0.8)',
    lineHeight: 22,
    marginBottom: 18,
    position: 'relative',
    zIndex: 1,
  } as object,
  introName: { fontFamily: 'Nunito_700Bold', color: COLORS.beige } as object,
  // The section's one action — full primary weight, same pill language as
  // the spotlight's View Profile.
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.orange,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 22,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
    position: 'relative',
    zIndex: 1,
  } as object,
  ctaHover: { opacity: 0.85 } as object,
  ctaText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  } as object,

  // Character strip — below the editorial copy, fills the column bottom
  charBlock: {
    marginTop: 24,
    position: 'relative',
    zIndex: 1,
  } as object,
  charRule: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
  } as object,
  charLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.55)',
    marginBottom: 12,
  } as object,
  charStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  charStripScrollContent: {
    flexDirection: 'row',
    gap: 16,
  } as object,
  charChip: {
    alignItems: 'center',
    gap: 5,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
    width: 74,
    flexShrink: 0,
  } as object,
  charChipHover: { opacity: 0.7 } as object,
  // A cut-out head needs neither fill nor ring, and HeroAvatar renders a
  // sized image rather than an absolute fill — so the slot centres it.
  faceBare: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  } as object,
  charAvatar: {
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  } as object,
  charAvatarRing: {
    position: 'absolute',
    inset: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(245,235,220,0.1)',
  } as object,
  charName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.7)',
    textAlign: 'center',
    letterSpacing: 0.1,
  } as object,
});
