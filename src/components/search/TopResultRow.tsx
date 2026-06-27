// src/components/search/TopResultRow.tsx — the featured "Top result" card for the
// native Search tab. One prominent, type-agnostic row: a larger thumbnail, the
// name, a type tag for the surprising kinds (Universe/Team/Title), and a subtitle.
// It's the confident single answer from pickTopResult — the native sibling of the
// web TopResultRow (no hover/cursor/↵; press feedback via PressScale).
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { PressScale } from '../ui/PressScale';
import { COLORS } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { BrandLogoView } from '../PublisherBadge';
import { teamLogo } from '../../constants/teamBrands';
import type { TopResult } from '../../lib/search/topResult';

const MEDIA_LABEL: Record<string, string> = { film: 'Film', tv: 'TV', game: 'Game' };

export function TopResultRow({ top, onPress }: { top: TopResult; onPress: () => void }) {
  const { name, typeLabel, subtitle, thumb, round } = describe(top);
  return (
    <PressScale onPress={onPress} style={styles.card}>
      <View style={[styles.thumb, round && styles.thumbRound]}>{thumb}</View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {typeLabel ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{typeLabel}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="arrow-forward" size={18} color={COLORS.orange} />
    </PressScale>
  );
}

function describe(top: TopResult): {
  name: string;
  typeLabel: string | null;
  subtitle: string | null;
  round: boolean;
  thumb: React.ReactNode;
} {
  switch (top.kind) {
    case 'universe': {
      const u = top.universe;
      return {
        name: u.name,
        typeLabel: 'Universe',
        subtitle: null,
        round: false,
        thumb: (
          <View style={[styles.tile, { backgroundColor: u.logoOnLight ? COLORS.beige : u.color }]}>
            {u.logo && u.badgeSize ? (
              <BrandLogoView
                logo={u.logo}
                width={u.badgeSize.width}
                height={u.badgeSize.height}
                tint={u.logoTint}
              />
            ) : (
              <Text style={styles.mono}>{u.name.slice(0, 2).toUpperCase()}</Text>
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
        round: false,
        thumb: (
          <View style={[styles.tile, tl ? styles.tileDark : styles.tileTeam]}>
            {tl ? (
              <BrandLogoView
                logo={tl.logo}
                width={Math.min(44, 34 * (tl.badgeSize.width / tl.badgeSize.height))}
                height={34}
                tint={tl.logoTint}
              />
            ) : (
              <Text style={styles.monoOrange}>{t.name.slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
        ),
      };
    }
    case 'hero': {
      const h = top.hero;
      return {
        name: h.name,
        typeLabel: null,
        subtitle: h.full_name && h.full_name !== h.name ? h.full_name : h.publisher,
        round: true,
        thumb: (
          <HeroImage
            id={h.id}
            name={h.name}
            imageUrl={h.image_url}
            portraitUrl={h.portrait_url}
            imageMdUrl={h.image_md_url}
            grid
            contentFit="cover"
            contentPosition={{ top: '14%', left: '50%' }}
            style={styles.heroImg}
          />
        ),
      };
    }
    case 'title': {
      const t = top.title;
      return {
        name: t.title,
        typeLabel: MEDIA_LABEL[t.media_type] ?? 'Title',
        subtitle: t.year ? String(t.year) : null,
        round: false,
        thumb: (
          <View style={[styles.tile, styles.tileDark]}>
            {t.poster_url ? (
              <Image
                source={{ uri: t.poster_url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <Ionicons name="film-outline" size={20} color="rgba(245,235,220,0.3)" />
            )}
          </View>
        ),
      };
    }
  }
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(231,115,51,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.28)',
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 13,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  thumbRound: { borderRadius: 27 },
  tile: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTeam: { backgroundColor: 'rgba(231,115,51,0.18)' },
  tileDark: { backgroundColor: COLORS.navy },
  heroImg: { width: 54, height: 54 },
  mono: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.navy },
  monoOrange: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.orange },
  text: { flex: 1, flexDirection: 'column', gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: 'Flame-Regular', fontSize: 19, color: COLORS.beige, flexShrink: 1 },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245,235,220,0.10)',
  },
  tagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.6)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12.5,
    color: 'rgba(245,235,220,0.55)',
  },
});
