import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { FACTION_A, FACTION_B } from './factionColors';
import { MAX_SIDE, type PickedHero, type Side } from '../../lib/battleBuilderState';
import type { BattleBuilder } from '../../hooks/useBattleBuilder';

type Act = 'squad' | 'challenger';

interface Props {
  b: BattleBuilder;
  act: Act;
  expanded: boolean;
  onToggle: () => void;
  /** Next (squad) or Fight (challenger). */
  onPrimary: () => void;
  /** Back to the squad act (challenger only). */
  onBack: () => void;
  onRandom: (side: Side) => void;
}

const SAFE_BOTTOM = 'env(safe-area-inset-bottom)';

/** The guided duel's bottom dock. Act 1 ("Your Squad") shows just your side + a
 *  "Next" CTA; Act 2 ("Challenger") shows the full A-vs-B matchup + FIGHT. Tap to
 *  expand a manage sheet for the relevant side(s). */
export function DuelDock({ b, act, expanded, onToggle, onPrimary, onBack, onRandom }: Props) {
  const isSquad = act === 'squad';
  const primaryReady = isSquad ? b.aHeroes.length >= 1 : b.canBattle && !!b.battleHref;
  const primaryLabel = isSquad
    ? 'Next: Challenger →'
    : `FIGHT · ${b.aHeroes.length} v ${b.bHeroes.length}`;

  return (
    <>
      {expanded ? (
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onToggle} />
          <View style={s.sheet}>
            <Pressable onPress={onToggle} style={s.handleHit} hitSlop={10}>
              <View style={s.handle} />
            </Pressable>

            <ManageSide
              side="A"
              tint={FACTION_A}
              roster={b.aHeroes}
              synergy={b.synergyA}
              publisher={b.publisherA}
              active={b.active === 'A'}
              onActivate={() => b.setActive('A')}
              onRemove={b.removeHero}
              onRandom={() => onRandom('A')}
              onClear={() => b.clearSide('A')}
            />
            {!isSquad ? (
              <>
                <View style={s.vsRow}>
                  <View style={s.vsLine} />
                  <Text style={s.vsText}>VS</Text>
                  <View style={s.vsLine} />
                </View>
                <ManageSide
                  side="B"
                  tint={FACTION_B}
                  roster={b.bHeroes}
                  synergy={b.synergyB}
                  publisher={b.publisherB}
                  active={b.active === 'B'}
                  flip
                  onActivate={() => b.setActive('B')}
                  onRemove={b.removeHero}
                  onRandom={() => onRandom('B')}
                  onClear={() => b.clearSide('B')}
                />
              </>
            ) : null}

            <PrimaryCTA
              label={primaryLabel}
              ready={primaryReady}
              onPress={onPrimary}
              fight={!isSquad}
            />
          </View>
        </View>
      ) : null}

      {/* Collapsed dock */}
      <View style={s.bar}>
        <Pressable onPress={onToggle} style={s.summary} hitSlop={6}>
          {isSquad ? (
            <>
              <DeckStack roster={b.aHeroes} tint={FACTION_A} active spread />
              <Text style={s.tag}>Your squad · {b.aHeroes.length}</Text>
            </>
          ) : (
            <>
              <DeckStack roster={b.aHeroes} tint={FACTION_A} active={b.active === 'A'} />
              <MaterialCommunityIcons name="sword-cross" size={16} color={COLORS.goldAccent} />
              <DeckStack roster={b.bHeroes} tint={FACTION_B} active={b.active === 'B'} flip />
            </>
          )}
          <Ionicons name="chevron-up" size={18} color="rgba(245,235,220,0.6)" style={s.chev} />
        </Pressable>
        {!isSquad ? (
          <Pressable
            onPress={onBack}
            style={s.back}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Back to squad"
          >
            <Ionicons name="arrow-back" size={16} color="rgba(245,235,220,0.8)" />
          </Pressable>
        ) : null}
        <PrimaryCTA
          label={isSquad ? 'Next →' : 'FIGHT'}
          ready={primaryReady}
          onPress={onPrimary}
          fight={!isSquad}
          compact
        />
      </View>
    </>
  );
}

function PrimaryCTA({
  label,
  ready,
  onPress,
  compact,
  fight,
}: {
  label: string;
  ready: boolean;
  onPress: () => void;
  compact?: boolean;
  fight?: boolean;
}) {
  return (
    <Pressable
      onPress={ready ? onPress : undefined}
      disabled={!ready}
      style={[compact ? s.ctaCompact : s.ctaFull, ready ? null : s.ctaDim]}
    >
      {fight ? (
        <MaterialCommunityIcons
          name="sword-cross"
          size={16}
          color={ready ? '#1a130a' : 'rgba(245,235,220,0.55)'}
        />
      ) : null}
      <Text style={[s.ctaText, ready ? null : s.ctaTextDim]}>{label}</Text>
    </Pressable>
  );
}

function DeckStack({
  roster,
  tint,
  active,
  flip = false,
  spread = false,
}: {
  roster: PickedHero[];
  tint: string;
  active: boolean;
  flip?: boolean;
  /** Wider fan so each face is legible — used in the squad act, which has the
   *  horizontal room the two-sided challenger act doesn't. */
  spread?: boolean;
}) {
  const CARD = 28;
  const H = 38;
  const OFFSET = spread ? 21 : 13;
  const cards = roster.slice(0, MAX_SIDE);
  const n = Math.max(cards.length, 1);
  const w = CARD + (n - 1) * OFFSET;
  return (
    <View style={[s.stackWrap, active ? s.stackActive : null]}>
      <View style={[s.stack, { width: w, height: H }]}>
        {cards.length === 0 ? (
          <View style={[s.deckCard, s.deckEmpty, { width: CARD, height: H, left: 0 }]}>
            <Text style={s.deckQ}>?</Text>
          </View>
        ) : (
          cards.map((hero, i) => {
            const u = hero.portrait_url ?? hero.image_url ?? undefined;
            const pos = flip ? { right: i * OFFSET } : { left: i * OFFSET };
            return (
              <View
                key={hero.id}
                style={[s.deckCard, { width: CARD, height: H, borderColor: tint, zIndex: i }, pos]}
              >
                {u ? (
                  <Image
                    source={{ uri: u }}
                    style={[StyleSheet.absoluteFill, flip ? s.mirror : null]}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
                )}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

function ManageSide({
  side,
  tint,
  roster,
  synergy,
  publisher,
  active,
  flip = false,
  onActivate,
  onRemove,
  onRandom,
  onClear,
}: {
  side: Side;
  tint: string;
  roster: PickedHero[];
  synergy: number;
  publisher: 'marvel' | 'dc' | null;
  active: boolean;
  flip?: boolean;
  onActivate: () => void;
  onRemove: (id: string) => void;
  onRandom: () => void;
  onClear: () => void;
}) {
  return (
    <View style={[s.side, active ? { backgroundColor: `${tint}1f` } : null]}>
      <View style={s.sideHead}>
        <Pressable onPress={onActivate} style={s.sideLabelBtn} hitSlop={4}>
          <Text style={[s.sideLabel, { color: active ? tint : 'rgba(245,235,220,0.55)' }]}>
            {side === 'A' ? 'Your Squad' : 'Challenger'}
          </Text>
          {roster.length >= 2 ? (
            <Text style={[s.syn, { color: tint }]}>SYN +{synergy}%</Text>
          ) : null}
          {publisher ? (
            <Text style={s.pub}>{publisher === 'dc' ? 'all-DC' : 'all-Marvel'}</Text>
          ) : null}
        </Pressable>
        <View style={s.sideActs}>
          <Pressable
            onPress={onRandom}
            style={s.act}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Random fighters"
          >
            <Ionicons name="dice" size={16} color="rgba(245,235,220,0.85)" />
          </Pressable>
          {roster.length > 0 ? (
            <Pressable onPress={onClear} style={s.act} hitSlop={8}>
              <Text style={s.actText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={s.cards}>
        {roster.map((hero) => {
          const u = hero.portrait_url ?? hero.image_url ?? undefined;
          return (
            <Pressable
              key={hero.id}
              onPress={() => onRemove(hero.id)}
              style={[s.card, { borderColor: tint }]}
              hitSlop={2}
            >
              {u ? (
                <Image
                  source={{ uri: u }}
                  style={[StyleSheet.absoluteFill, flip ? s.mirror : null]}
                  contentFit="cover"
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
              )}
              <View style={s.rm}>
                <Text style={s.rmx}>×</Text>
              </View>
            </Pressable>
          );
        })}
        {roster.length < MAX_SIDE ? (
          <View style={[s.card, s.cardEmpty]}>
            <Text style={s.plus}>+</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 40,
    justifyContent: 'flex-end',
    // Real transform pins fixed elements on iOS under body{overflow:visible}.
    transform: 'translateZ(0)',
  } as object,
  sheet: {
    backgroundColor: '#101d24',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: `calc(${SAFE_BOTTOM} + 14px)` as unknown as number,
    gap: 10,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    boxShadow: '0 -16px 40px rgba(0,0,0,0.5)',
  } as object,
  handleHit: { alignItems: 'center', paddingVertical: 4 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },

  vsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  vsLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  vsText: { fontFamily: 'Flame-Regular', fontSize: 14, color: COLORS.goldAccent },

  side: { gap: 8, padding: 9, borderRadius: 14 },
  sideHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sideLabelBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  sideLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  syn: { fontFamily: 'Nunito_700Bold', fontSize: 10 },
  pub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.goldAccent,
    borderWidth: 1,
    borderColor: 'rgba(206,155,51,0.5)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  sideActs: { flexDirection: 'row', gap: 6 },
  act: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  actText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(245,235,220,0.85)' },

  cards: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  card: {
    width: 48,
    height: 62,
    borderRadius: 9,
    overflow: 'hidden',
    borderWidth: 1.5,
    backgroundColor: '#1b2a30',
  },
  cardEmpty: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: 'rgba(255,255,255,0.6)' },
  mirror: { transform: [{ scaleX: -1 }] },
  rm: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(11,24,32,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rmx: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff', lineHeight: 13 },

  bar: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: `calc(${SAFE_BOTTOM} + 12px)` as unknown as number,
    backgroundColor: 'rgba(16,29,36,0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  } as object,
  summary: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tag: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(245,235,220,0.7)' },
  swords: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.goldAccent },
  chev: { marginLeft: 'auto' },
  back: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },

  stackWrap: { paddingBottom: 3, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  stackActive: { borderBottomColor: COLORS.goldAccent },
  stack: { position: 'relative' },
  deckCard: {
    position: 'absolute',
    top: 0,
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: 1.5,
    backgroundColor: '#1b2a30',
  },
  deckEmpty: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckQ: { fontFamily: 'Flame-Regular', fontSize: 16, color: 'rgba(255,255,255,0.6)' },

  ctaFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.goldAccent,
    borderRadius: 13,
    paddingVertical: 14,
  },
  ctaCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.goldAccent,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  ctaDim: { backgroundColor: 'rgba(255,255,255,0.12)' },
  ctaText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#1a130a', letterSpacing: 0.4 },
  ctaTextDim: { color: 'rgba(245,235,220,0.55)' },
});
