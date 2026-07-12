// Publish › OG Cards — a QA gallery for the live Open Graph share cards that
// /api/og renders (see api/og.tsx). Nothing is stored: each card is generated
// on demand from a hero id / matchup, so this panel is a live preview of every
// variant a shared Mythique link can produce —
//   • brand   → /api/og                         (site-wide card, also public/og.png)
//   • character→ /api/og?hero=<id>
//   • versus  → /api/og?a=<id>&b=<id>
//   • debate  → /api/og?type=debate&a=<id>&b=<id>
// Pick a hero (and an optional opponent) to preview the character/VS/debate
// cards; the brand card always shows. Open ↗ or copy the URL for each.
import { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Panel } from '../Panel';
import { COLORS } from '../../../../constants/colors';
import type { HeroSearchResult } from '../../../../lib/db/heroes';
import { HeroField } from './DebatePickerPanel';

// Same-origin relative paths resolve against the deployed site; the absolute
// form (window.origin) is only needed for copy-to-clipboard / open-in-tab.
const origin = () => (typeof window !== 'undefined' ? window.location.origin : '');
const abs = (path: string) => `${origin()}${path}`;

function OgPreview({ label, hint, path }: { label: string; hint: string; path: string }) {
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(abs(path))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => {});
  };
  const open = () => {
    if (typeof window !== 'undefined') window.open(abs(path), '_blank', 'noopener');
  };

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardLabel}>{label}</Text>
        <Text style={s.cardHint} numberOfLines={1}>
          {hint}
        </Text>
      </View>
      <View style={s.frame}>
        {failed ? (
          <View style={s.fallback}>
            <Text style={s.fallbackText}>
              Preview unavailable here — /api/og only renders on the deployed site.
            </Text>
          </View>
        ) : (
          <Image
            // 1200×630 OG canvas, scaled to the frame width.
            source={{ uri: path }}
            style={s.img}
            resizeMode="cover"
            onError={() => setFailed(true)}
          />
        )}
      </View>
      <View style={s.actions}>
        <Pressable onPress={open} style={s.actionBtn}>
          <Text style={s.actionText}>Open ↗</Text>
        </Pressable>
        <Pressable onPress={copy} style={s.actionBtn}>
          <Text style={s.actionText}>{copied ? 'Copied ✓' : 'Copy URL'}</Text>
        </Pressable>
        <Text style={s.pathText} numberOfLines={1}>
          {path}
        </Text>
      </View>
    </View>
  );
}

export function OgCardsDomain() {
  const [heroA, setHeroA] = useState<HeroSearchResult | null>(null);
  const [heroB, setHeroB] = useState<HeroSearchResult | null>(null);

  return (
    <Panel
      title="OG share cards"
      hint="Live preview of the Open Graph cards /api/og renders for every shared link. Pick a hero to preview the character card; add an opponent for the versus + daily-debate cards."
    >
      <View style={s.formGrid}>
        <HeroField label="Hero" picked={heroA} onPick={setHeroA} />
        <HeroField label="Opponent (optional)" picked={heroB} onPick={setHeroB} />
      </View>

      <View style={s.gallery}>
        <OgPreview
          label="Brand card"
          hint="Site-wide default · shared links with no hero"
          path="/api/og"
        />

        {heroA ? (
          <OgPreview
            label="Character card"
            hint={heroA.name}
            path={`/api/og?hero=${encodeURIComponent(heroA.id)}`}
          />
        ) : null}

        {heroA && heroB && heroA.id !== heroB.id ? (
          <>
            <OgPreview
              label="Versus card"
              hint={`${heroA.name} vs ${heroB.name}`}
              path={`/api/og?a=${encodeURIComponent(heroA.id)}&b=${encodeURIComponent(heroB.id)}`}
            />
            <OgPreview
              label="Debate card"
              hint={`${heroA.name} vs ${heroB.name} · live split + top take`}
              path={`/api/og?type=debate&a=${encodeURIComponent(heroA.id)}&b=${encodeURIComponent(
                heroB.id,
              )}`}
            />
          </>
        ) : null}
      </View>
    </Panel>
  );
}

const s = StyleSheet.create({
  formGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 6 },
  gallery: { gap: 16, marginTop: 4 },
  card: { gap: 8, maxWidth: 560 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cardLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.navy,
  },
  cardHint: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
  // 1200:630 aspect canvas; explicit width:100% keeps WebKit from collapsing the
  // aspect-ratio box to 0 height.
  frame: {
    width: '100%',
    aspectRatio: 1200 / 630,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(20,32,40,0.12)',
    backgroundColor: '#0b1820',
  },
  img: { width: '100%', height: '100%' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  fallbackText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#9db4c4',
    textAlign: 'center',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#efe6d6',
    cursor: 'pointer',
  } as object,
  actionText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  pathText: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: COLORS.grey,
  },
});
