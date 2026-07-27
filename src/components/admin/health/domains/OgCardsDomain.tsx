// Publish › OG Cards — a QA gallery for the live Open Graph share cards that
// /api/og renders (see api/og/index.tsx). Nothing is stored: each card is generated
// on demand from a hero id / matchup, so this panel is a live preview of every
// variant a shared Mythique link can produce —
//   • brand   → /api/og                         (site-wide card, also public/og.png)
//   • character→ /api/og?hero=<id>
//   • versus  → /api/og?a=<id>&b=<id>
//   • debate  → /api/og?type=debate&a=<id>&b=<id>
// Pick a hero (and an optional opponent) to preview the character/VS/debate
// cards; the brand card always shows. Open ↗ or copy the URL for each.
import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Panel } from '../Panel';
import { COLORS } from '../../../../constants/colors';
import { getHeroesByIds, type HeroSearchResult } from '../../../../lib/db/heroes';
import { getDailyDebate, todayIso } from '../../../../lib/db/dailyDebate';
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
      {failed ? (
        // No inline render (e.g. /api/og is deploy-only) — collapse to a slim
        // strip instead of holding the full 1200:630 frame as a dead dark box
        // (three of those buried the mobile page in ~550px of empty ink).
        <View style={s.fallbackRow}>
          <Text style={s.fallbackText}>
            Preview can’t render inline — Open ↗ shows the live card.
          </Text>
        </View>
      ) : (
        <View style={s.frame}>
          <Image
            // 1200×630 OG canvas, scaled to the frame width.
            source={{ uri: path }}
            style={s.img}
            resizeMode="cover"
            onError={() => setFailed(true)}
          />
        </View>
      )}
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

  // Seed the pickers from today's daily-debate pair so every card variant
  // (character / versus / debate) renders on open instead of only after a
  // search. The pickers stay fully editable — this is just a live default.
  useEffect(() => {
    let active = true;
    (async () => {
      const debate = await getDailyDebate(todayIso());
      if (!debate) return;
      const heroes = await getHeroesByIds([debate.heroAId, debate.heroBId]);
      if (!active) return;
      const a = heroes.find((h) => h.id === debate.heroAId) ?? null;
      const b = heroes.find((h) => h.id === debate.heroBId) ?? null;
      // Only seed empty slots — never clobber a pick the user already made.
      setHeroA((prev) => prev ?? a);
      setHeroB((prev) => prev ?? b);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Panel
      title="OG share cards"
      hint="Live preview of every Open Graph card /api/og renders for shared links — seeded with today's debate pair. Change the hero or opponent to preview any card."
    >
      <View style={s.formGrid}>
        <HeroField label="Hero" picked={heroA} onPick={setHeroA} />
        <HeroField label="Opponent (optional)" picked={heroB} onPick={setHeroB} />
      </View>

      <View style={s.gallery}>
        <OgPreview
          label="Brand card"
          hint="Site-wide default · shared links with no hero"
          // The static snapshot (public/og.png) — served everywhere incl. local
          // dev, unlike the edge-only /api/og that renders the same card live.
          path="/og.png"
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
  fallbackRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(20,32,40,0.12)',
    backgroundColor: '#0b1820',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fallbackText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#9db4c4',
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
