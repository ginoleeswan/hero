import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { FACTION_A, FACTION_B } from './factionColors';
import { MAX_SIDE, type PickedHero, type Side } from '../../lib/battleBuilderState';
import type { BattleBuilder } from '../../hooks/useBattleBuilder';

interface Props {
  b: BattleBuilder;
  expanded: boolean;
  onToggle: () => void;
  onFight: () => void;
  onRandom: (side: Side) => void;
}

const SAFE_BOTTOM = 'env(safe-area-inset-bottom)';

/** Mobile "draft drawer": the pool owns the screen; the matchup lives in a bottom
 *  sheet — a slim peek bar (mini-matchup + FIGHT) that expands to a full squad
 *  manager. Progressive disclosure, thumb-reachable. */
export function DraftDrawer({ b, expanded, onToggle, onFight, onRandom }: Props) {
  const aLead = b.aHeroes[0] ?? null;
  const bLead = b.bHeroes[0] ?? null;
  const uri = (h: PickedHero | null) => h?.portrait_url ?? h?.image_url ?? undefined;

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

            <FightButton b={b} onFight={onFight} />
          </View>
        </View>
      ) : null}

      {/* Collapsed peek bar */}
      <View style={s.bar}>
        <Pressable onPress={onToggle} style={s.summary} hitSlop={6}>
          <Avatar
            uri={uri(aLead)}
            tint={FACTION_A}
            active={b.active === 'A'}
            count={b.aHeroes.length}
          />
          <Text style={s.swords}>⚔</Text>
          <Avatar
            uri={uri(bLead)}
            tint={FACTION_B}
            active={b.active === 'B'}
            count={b.bHeroes.length}
            flip
          />
          <Ionicons name="chevron-up" size={18} color="rgba(245,235,220,0.6)" style={s.chev} />
        </Pressable>
        <FightButton b={b} onFight={onFight} compact />
      </View>
    </>
  );
}

function Avatar({
  uri,
  tint,
  active,
  count,
  flip,
}: {
  uri?: string;
  tint: string;
  active: boolean;
  count: number;
  flip?: boolean;
}) {
  return (
    <View style={s.avatarWrap}>
      <View style={[s.avatar, { borderColor: active ? COLORS.goldAccent : tint }]}>
        {uri ? (
          <Image
            source={{ uri }}
            style={[StyleSheet.absoluteFill, flip ? s.mirror : null]}
            contentFit="cover"
          />
        ) : (
          <Text style={s.avatarQ}>?</Text>
        )}
      </View>
      <View style={[s.countPip, { backgroundColor: tint }]}>
        <Text style={s.countText}>{count}</Text>
      </View>
    </View>
  );
}

function FightButton({
  b,
  onFight,
  compact,
}: {
  b: BattleBuilder;
  onFight: () => void;
  compact?: boolean;
}) {
  const ready = b.canBattle && !!b.battleHref;
  return (
    <Pressable
      onPress={ready ? onFight : undefined}
      disabled={!ready}
      style={[compact ? s.fightCompact : s.fightFull, ready ? null : s.fightDim]}
    >
      <Text style={[s.fightText, ready ? null : s.fightTextDim]}>
        ⚔ FIGHT{ready ? ` · ${b.aHeroes.length} v ${b.bHeroes.length}` : ''}
      </Text>
    </Pressable>
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
            {active ? '▶ ' : ''}Side {side}
          </Text>
          {roster.length >= 2 ? (
            <Text style={[s.syn, { color: tint }]}>SYN +{synergy}%</Text>
          ) : null}
          {publisher ? (
            <Text style={s.pub}>{publisher === 'dc' ? 'all-DC' : 'all-Marvel'}</Text>
          ) : null}
        </Pressable>
        <View style={s.sideActs}>
          <Pressable onPress={onRandom} style={s.act} hitSlop={8}>
            <Text style={s.actText}>🎲</Text>
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
          <View style={[s.card, s.cardEmpty, active ? { borderColor: tint } : null]}>
            <Text style={[s.plus, active ? { color: tint } : null]}>+</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { position: 'fixed', inset: 0, zIndex: 40, justifyContent: 'flex-end' } as object,
  sheet: {
    backgroundColor: '#101d24',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: `calc(${SAFE_BOTTOM} + 16px)` as unknown as number,
    gap: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    boxShadow: '0 -16px 40px rgba(0,0,0,0.5)',
  } as object,
  handleHit: { alignItems: 'center', paddingVertical: 4 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },

  vsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  vsLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  vsText: { fontFamily: 'Flame-Regular', fontSize: 14, color: COLORS.goldAccent },

  side: { gap: 9, padding: 10, borderRadius: 14 },
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
  plus: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: 'rgba(255,255,255,0.4)' },
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

  // Collapsed peek bar
  bar: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: `calc(${SAFE_BOTTOM} + 12px)` as unknown as number,
    backgroundColor: 'rgba(16,29,36,0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  } as object,
  summary: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  swords: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.goldAccent },
  chev: { marginLeft: 'auto' },
  avatarWrap: { width: 38, height: 38 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: '#1b2a30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarQ: { fontFamily: 'Flame-Regular', fontSize: 18, color: 'rgba(255,255,255,0.3)' },
  countPip: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#101d24',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  countText: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: '#fff' },

  fightFull: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.goldAccent,
    borderRadius: 13,
    paddingVertical: 14,
  },
  fightCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.goldAccent,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  fightDim: { backgroundColor: 'rgba(255,255,255,0.12)' },
  fightText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#1a130a', letterSpacing: 0.4 },
  fightTextDim: { color: 'rgba(245,235,220,0.55)' },
});
