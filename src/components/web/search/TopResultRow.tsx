import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
import { HeroAvatar } from '../../HeroAvatar';
import { BrandLogoView } from '../../PublisherBadge';
import { brandForPublisher } from '../../../constants/publishers';
import { teamLogo } from '../../../constants/teamBrands';
import type { TopResult } from '../../../lib/search/topResult';

// The featured "Top result" — one prominent, type-agnostic row for the single
// confident answer. Both surfaces are dark:
//   • 'palette' — a row inside the command-palette dropdown; keyboard-driven, so
//     it shows the ↵ Enter hint and the pre-selected look when `active`.
//   • 'page' — the /search results page (touch); a raised featured card with the
//     thumbnail glowing in its universe's brand colour and a forward arrow.
export function TopResultRow({
  top,
  active,
  onPress,
  surface = 'palette',
}: {
  top: TopResult;
  active: boolean;
  onPress: () => void;
  surface?: 'palette' | 'page';
}) {
  const page = surface === 'page';
  const { name, typeLabel, subtitle, thumb, glowColor } = describe(top, page ? 56 : 48);
  // The signature: on the results page the featured thumbnail casts a soft glow in
  // its own universe's brand colour (Spider-Man → a Marvel-red halo) — which reads
  // even stronger on the dark ground. Box-shadow isn't clipped by the thumb's
  // overflow:hidden, so it blooms outside the rounded art.
  const glowStyle = page ? ({ boxShadow: `0 8px 26px -6px ${glowColor}80` } as object) : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.row,
          page && (styles.rowPage as object),
          (active || hovered) && ((page ? styles.rowActivePage : styles.rowActive) as object),
        ] as object
      }
    >
      <View
        style={
          [
            styles.thumb,
            page && (styles.thumbPage as object),
            top.kind === 'hero' && ((page ? styles.thumbRoundPage : styles.thumbRound) as object),
            // A cut-out head needs no container behind it.
            top.kind === 'hero' && top.hero.avatar_url ? (styles.thumbBare as object) : null,
            glowStyle,
          ] as object
        }
      >
        {thumb}
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.name, page && (styles.namePage as object)] as object}
            numberOfLines={1}
          >
            {name}
          </Text>
          {/* Only tag the surprising types — a character with a face needs no
              "CHARACTER" chip, and tagging it would clash with the alignment
              (Hero/Villain) badge the character rows use. */}
          {typeLabel ? (
            <View style={styles.tag as object}>
              <Text style={styles.tagText as object}>{typeLabel}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle as object} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {page ? (
        <Ionicons name="arrow-forward" size={18} color={COLORS.orange} />
      ) : (
        <View style={styles.enter as object}>
          <Text style={styles.enterKey as object}>↵</Text>
        </View>
      )}
    </Pressable>
  );
}

function describe(
  top: TopResult,
  /** Rendered edge of the thumb, so a head can be sized to fill it. */
  faceSize: number,
): {
  name: string;
  typeLabel: string | null;
  subtitle: string | null;
  glowColor: string;
  thumb: React.ReactNode;
} {
  switch (top.kind) {
    case 'universe': {
      const u = top.universe;
      return {
        name: u.name,
        typeLabel: 'Universe',
        subtitle: null,
        glowColor: u.color,
        thumb: (
          <View
            style={
              [styles.tile, { backgroundColor: u.logoOnLight ? COLORS.beige : u.color }] as object
            }
          >
            {u.logo && u.badgeSize ? (
              <BrandLogoView
                logo={u.logo}
                width={u.badgeSize.width}
                height={u.badgeSize.height}
                tint={u.logoTint}
              />
            ) : (
              <Text style={styles.mono as object}>{u.name.slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
        ),
      };
    }
    case 'team': {
      const t = top.team;
      const tl = teamLogo(t);
      const meta = [`${t.member_count} member${t.member_count === 1 ? '' : 's'}`, t.publisher]
        .filter(Boolean)
        .join(' · ');
      return {
        name: t.name,
        typeLabel: 'Team',
        subtitle: meta,
        glowColor: brandForPublisher(t.publisher)?.color ?? COLORS.orange,
        thumb: (
          <View style={[styles.tile, tl && (styles.tileDark as object)] as object}>
            {tl ? (
              <BrandLogoView
                logo={tl.logo}
                width={Math.min(40, 30 * (tl.badgeSize.width / tl.badgeSize.height))}
                height={30}
                tint={tl.logoTint}
              />
            ) : (
              <Text style={styles.monoOrange as object}>{t.name.slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
        ),
      };
    }
    case 'hero': {
      const h = top.hero;
      return {
        name: h.name,
        typeLabel: null, // a character with a face needs no chip (and it'd clash with the Hero/Villain badge)
        subtitle: h.full_name && h.full_name !== h.name ? h.full_name : h.publisher,
        glowColor: brandForPublisher(h.publisher)?.color ?? COLORS.orange,
        // The hero thumb is already circular here; the avatar is an actual
        // head, so it lands where a portrait crop could only approximate.
        thumb: h.avatar_url ? (
          <HeroAvatar id={h.id} name={h.name} avatarUrl={h.avatar_url} size={faceSize} bare />
        ) : (
          <HeroImage
            id={h.id}
            name={h.name}
            imageUrl={h.image_url}
            portraitUrl={h.portrait_url}
            imageMdUrl={h.image_md_url}
            grid
            contentFit="cover"
            contentPosition={{ top: '14%', left: '50%' }}
            style={styles.heroImg as object}
          />
        ),
      };
    }
    case 'title': {
      const t = top.title;
      const MEDIA: Record<string, string> = { film: 'Film', tv: 'TV', game: 'Game' };
      return {
        name: t.title,
        typeLabel: MEDIA[t.media_type] ?? 'Title',
        subtitle: t.year ? String(t.year) : null,
        glowColor: COLORS.orange,
        thumb: (
          <View style={[styles.tile, styles.tileDark as object] as object}>
            {t.poster_url ? (
              <Image
                source={{ uri: t.poster_url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            ) : null}
          </View>
        ),
      };
    }
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 6,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  rowActive: { backgroundColor: 'rgba(231,115,51,0.14)' } as object,
  // Page variant: a raised dark card on the deep-ink canvas — a faintly lifted
  // panel so the answer reads as featured; the thumbnail's brand glow gives colour.
  rowPage: {
    marginHorizontal: 0,
    gap: 15,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 18,
    backgroundColor: 'rgba(245,235,220,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.1)',
    boxShadow: '0 10px 30px -14px rgba(0,0,0,0.6)',
  } as object,
  rowActivePage: { backgroundColor: 'rgba(245,235,220,0.08)' } as object,
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 11,
    overflow: 'hidden',
    flexShrink: 0,
  } as object,
  thumbBare: { backgroundColor: 'transparent', overflow: 'visible' } as object,
  thumbPage: { width: 56, height: 56, borderRadius: 13 } as object,
  thumbRound: { borderRadius: 24 } as object, // characters read as circular avatars
  thumbRoundPage: { borderRadius: 28 } as object,
  tile: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,115,51,0.18)',
  } as object,
  tileDark: { backgroundColor: COLORS.navy } as object,
  heroImg: { width: '100%', height: '100%' } as object,
  mono: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.navy } as object,
  monoOrange: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.orange } as object,
  text: { flex: 1, minWidth: 0, flexDirection: 'column', gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.beige, flexShrink: 1 } as object,
  namePage: { fontSize: 20 } as object,
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245,235,220,0.10)',
    flexShrink: 0,
  } as object,
  tagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.6)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  } as object,
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12.5,
    color: 'rgba(245,235,220,0.5)',
  } as object,
  enter: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
    flexShrink: 0,
  } as object,
  enterKey: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.6)',
  } as object,
});
