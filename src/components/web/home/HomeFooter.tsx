import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { HeroLogo } from '../HeroLogo';

interface HomeFooterProps {
  heroCount: number | null;
  onNavigate: (path: string) => void;
}

interface FooterLink {
  label: string;
  path: string;
}

const BROWSE: FooterLink[] = [
  { label: 'Marvel Universe', path: '/category/marvel' },
  { label: 'DC Universe', path: '/category/dc' },
  { label: 'Villains', path: '/category/villain' },
  { label: 'Anti-Heroes', path: '/category/anti-heroes' },
];

const DISCOVER: FooterLink[] = [
  { label: 'Most Iconic', path: '/category/most-iconic' },
  { label: 'Strongest Heroes', path: '/category/strongest' },
  { label: 'Brightest Minds', path: '/category/most-intelligent' },
  { label: 'X-Men', path: '/category/xmen' },
];

function LinkColumn({
  title,
  links,
  onNavigate,
}: {
  title: string;
  links: FooterLink[];
  onNavigate: (path: string) => void;
}) {
  return (
    <View style={s.col}>
      <Text style={s.colTitle as object}>{title}</Text>
      {links.map((l) => (
        <Pressable
          key={l.path}
          onPress={() => onNavigate(l.path)}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [s.linkWrap, hovered && (s.linkWrapHover as object)] as object
          }
        >
          <Text style={s.link as object}>{l.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function HomeFooter({ heroCount, onNavigate }: HomeFooterProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const pagePad = width < 640 ? 16 : 32;

  return (
    <View style={[s.footer, { paddingHorizontal: pagePad }] as object}>
      <View style={s.inner}>
        <View style={[s.top, !isDesktop && (s.topStack as object)] as object}>
          <View style={s.brand}>
            <HeroLogo iconSize={26} fontSize={22} color={COLORS.beige} gap={9} />
            <Text style={s.tagline as object}>
              The living encyclopedia of heroes, villains, and everyone in between.
            </Text>
          </View>
          <View style={[s.columns, !isDesktop && (s.columnsStack as object)] as object}>
            <LinkColumn title="Browse" links={BROWSE} onNavigate={onNavigate} />
            <LinkColumn title="Discover" links={DISCOVER} onNavigate={onNavigate} />
          </View>
        </View>

        <View style={s.divider} />

        <View style={[s.bottom, !isDesktop && (s.bottomStack as object)] as object}>
          <Text style={s.copy as object}>© 2026 Mythique</Text>
          <View style={s.legalRow}>
            <Pressable onPress={() => onNavigate('/privacy')}>
              <Text style={s.legalLink as object}>Privacy</Text>
            </Pressable>
            <Pressable onPress={() => onNavigate('/terms')}>
              <Text style={s.legalLink as object}>Terms</Text>
            </Pressable>
          </View>
          <Text style={s.meta as object}>
            {heroCount != null ? `${heroCount.toLocaleString()} heroes & villains · ` : ''}
            Data from ComicVine & SuperheroAPI
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  footer: {
    backgroundColor: COLORS.deepNavy,
    paddingTop: 56,
    paddingBottom: 48,
  },
  inner: {
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 48,
  },
  topStack: { flexDirection: 'column', gap: 36 } as object,
  brand: { flex: 1, maxWidth: 360 },
  tagline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(245,235,220,0.5)',
    marginTop: 16,
  } as object,
  columns: { flexDirection: 'row', gap: 64 },
  columnsStack: { gap: 40 } as object,
  col: { gap: 12 },
  colTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.35)',
    marginBottom: 4,
  } as object,
  linkWrap: { transition: 'opacity 150ms ease' } as object,
  linkWrapHover: { opacity: 1 } as object,
  link: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.72)',
    cursor: 'pointer',
  } as object,
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 40,
    marginBottom: 24,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  bottomStack: { flexDirection: 'column', alignItems: 'flex-start', gap: 8 } as object,
  legalRow: { flexDirection: 'row', gap: 20 } as object,
  legalLink: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.6)',
    cursor: 'pointer',
  } as object,
  copy: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.6)',
    letterSpacing: 0.3,
  } as object,
  meta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.35)',
  } as object,
});
