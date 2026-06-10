import { useState, type ReactElement } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { buildTiers } from '../../lib/family/buildTiers';
import type { FamilyMember } from '../../lib/family/types';

const COLLAPSE_AFTER = 6;

// good → teal, bad → red, otherwise orange — mirrors the character page helper.
function alignColor(alignment: string | null): string {
  if (alignment === 'good') return COLORS.blue;
  if (alignment === 'bad') return COLORS.red;
  return COLORS.orange;
}

// Short, human label: the relationship word without any trailing status clause.
function roleLabel(member: FamilyMember): string {
  if (member.role) return member.role.split(',')[0].trim();
  return member.relation.replace(/_/g, ' ');
}

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

// ── A single relative node ───────────────────────────────────────────────────
function MemberNode({ member }: { member: FamilyMember }) {
  const router = useRouter();
  const dead = member.status === 'deceased';

  if (member.heroId) {
    const tint = alignColor(member.heroAlignment);
    return (
      <Pressable
        style={[styles.linkNode, { borderColor: tint + '66' }]}
        onPress={() =>
          router.push(`/character/${member.heroId}?name=${encodeURIComponent(member.name)}`)
        }
      >
        {member.heroPower != null ? (
          <View style={styles.powerBadge}>
            <Text style={styles.powerBadgeText}>{member.heroPower}</Text>
          </View>
        ) : null}
        {member.heroImage ? (
          <Image source={{ uri: member.heroImage }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: tint }]}>
            <Text style={styles.avatarInitial}>{initial(member.name)}</Text>
          </View>
        )}
        <View style={styles.linkMeta}>
          <Text style={styles.linkName} numberOfLines={1}>
            {member.name}
          </Text>
          <Text style={styles.roleText} numberOfLines={1}>
            {roleLabel(member)}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.plainNode, dead && styles.dead]}>
      <Text style={styles.plainName} numberOfLines={1}>
        {member.name}
        {dead ? ' ✝' : ''}
      </Text>
      <Text style={styles.roleText} numberOfLines={1}>
        {roleLabel(member)}
      </Text>
    </View>
  );
}

// ── A wrapping row of nodes with "+N more" overflow ──────────────────────────
function NodeRow({ members, label }: { members: FamilyMember[]; label?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (members.length === 0) return null;
  const overflow = !expanded && members.length > COLLAPSE_AFTER;
  const shown = overflow ? members.slice(0, COLLAPSE_AFTER) : members;
  return (
    <View style={styles.tierBlock}>
      {label ? <Text style={styles.tierLabel}>{label}</Text> : null}
      <View style={styles.tierRow}>
        {shown.map((m) => (
          <MemberNode key={m.id} member={m} />
        ))}
        {overflow ? (
          <Pressable style={styles.moreChip} onPress={() => setExpanded(true)}>
            <Text style={styles.moreText}>+{members.length - COLLAPSE_AFTER} more</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const Spine = () => <View style={styles.spine} />;

// ── The card ─────────────────────────────────────────────────────────────────
export function FamilyTree({
  heroName,
  members,
}: {
  heroName: string;
  members: FamilyMember[];
}): ReactElement | null {
  if (members.length === 0) return null;

  const model = buildTiers(members);
  const byTier = new Map(model.tiers.map((t) => [t.tier, t]));

  const tier0 = byTier.get(0);
  const spouse = tier0?.members.find((m) => m.relation === 'spouse') ?? null;
  const sameGen = (tier0?.members ?? []).filter((m) => m !== spouse);

  const linkedCount = members.filter((m) => m.heroId).length;

  // Rows are stitched in vertical generation order; tier 0 always shows the hero.
  const rows: ReactElement[] = [];
  for (const t of [2, 1, 0, -1, -2]) {
    if (t === 0) {
      rows.push(
        <View key="hero" style={styles.tierBlock}>
          <View style={styles.anchorRow}>
            <View style={styles.heroAnchor}>
              <View style={styles.heroAvatar}>
                <Text style={styles.heroInitial}>{initial(heroName)}</Text>
              </View>
              <View>
                <Text style={styles.heroName} numberOfLines={1}>
                  {heroName}
                </Text>
                <Text style={styles.heroTag}>This hero</Text>
              </View>
            </View>
            {spouse ? (
              <>
                <View style={styles.spouseTie} />
                <MemberNode member={spouse} />
              </>
            ) : null}
          </View>
        </View>,
      );
      if (sameGen.length > 0) {
        rows.push(<NodeRow key="samegen" members={sameGen} label="Same generation" />);
      }
    } else {
      const tier = byTier.get(t);
      if (tier) rows.push(<NodeRow key={t} members={tier.members} label={tier.label} />);
    }
  }

  // Interleave spines between rendered rows.
  const spined: ReactElement[] = [];
  rows.forEach((row, i) => {
    if (i > 0) spined.push(<Spine key={`spine-${i}`} />);
    spined.push(row);
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Family</Text>
        <Text style={styles.count}>
          {members.length} {members.length === 1 ? 'relative' : 'relatives'}
          {linkedCount > 0 ? ` · ${linkedCount} on Mythique` : ''}
        </Text>
      </View>
      <View style={styles.divider} />

      <View>{spined}</View>

      {model.asides.length > 0 ? (
        <View style={styles.asideBlock}>
          <Text style={styles.tierLabel}>Variants</Text>
          <View style={styles.tierRow}>
            {model.asides.map((m) => (
              <MemberNode key={m.id} member={m} />
            ))}
          </View>
        </View>
      ) : null}

      {model.footnotes.length > 0 ? (
        <Text style={styles.footnote}>
          Also:{' '}
          {model.footnotes.map((m, i) => (
            <Text key={m.id}>
              {i > 0 ? ', ' : ''}
              {m.name} ({roleLabel(m)})
            </Text>
          ))}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd0',
    boxShadow: '0 6px 22px rgba(41,60,67,0.06)',
  } as object,
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  eyebrow: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  count: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#b3a791' },
  divider: { height: 1, backgroundColor: '#ede5da', marginTop: 10, marginBottom: 18 },

  tierBlock: { alignItems: 'center' },
  tierLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#a99b84',
    marginBottom: 9,
    textAlign: 'center',
  },
  tierRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 10,
  },
  spine: { width: 2, height: 18, borderRadius: 2, backgroundColor: '#e2d6c2', marginVertical: 7 },

  // Plain (no page) node
  plainNode: {
    backgroundColor: '#fbf7ef',
    borderWidth: 1,
    borderColor: '#e7dcc9',
    borderRadius: 13,
    paddingVertical: 8,
    paddingHorizontal: 13,
    alignItems: 'center',
    minWidth: 84,
  },
  plainName: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: COLORS.black, fontWeight: '700' },
  dead: { opacity: 0.6 },

  // Linked (has page) node
  linkNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#e7dcc9',
    borderRadius: 14,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    position: 'relative',
    boxShadow: '0 1px 3px rgba(41,60,67,0.06)',
  } as object,
  avatar: { width: 34, height: 34, borderRadius: 9 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: 'Flame-Regular', fontSize: 14, color: 'white' },
  linkMeta: { minWidth: 0 },
  linkName: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: COLORS.black, fontWeight: '700' },
  roleText: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: '#a99b84', textTransform: 'capitalize' },
  chevron: { color: '#cdbfa6', fontSize: 15 },
  powerBadge: {
    position: 'absolute',
    top: -7,
    right: -6,
    backgroundColor: COLORS.blue,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    zIndex: 2,
  },
  powerBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: 'white' },

  // Hero anchor
  anchorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  heroAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: COLORS.black,
    borderRadius: 15,
    paddingVertical: 8,
    paddingLeft: 9,
    paddingRight: 18,
  },
  heroAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.goldAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInitial: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.black },
  heroName: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige },
  heroTag: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#8a7e68',
  },
  spouseTie: { width: 18, height: 2, borderRadius: 2, backgroundColor: COLORS.orange },

  // Overflow + asides + footnote
  moreChip: {
    justifyContent: 'center',
    backgroundColor: '#f3ece0',
    borderWidth: 1,
    borderColor: '#d8cbb6',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  moreText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#9a8c76' },
  asideBlock: { alignItems: 'center', marginTop: 18 },
  footnote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10.5,
    color: '#b3a791',
    textAlign: 'center',
    marginTop: 16,
  },
});
