// Community / engagement domain — the read-only "who's doing what" glance.
// Aggregates come from one admin-guarded RPC (see src/lib/db/community.ts); this
// is a pure view of that data. No mutations: moderation lives in ReviewDomain
// (the "Open review" action just deep-links there).
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { HeroThumb, StatTile, EmptyState, Chip } from '../ui';
import { relTime } from '../format';
import type {
  CommunityOverview,
  HeroStat,
  Contributor,
  ActivityItem,
  ActivityKind,
} from '../../../../lib/db/community';

const KIND_META: Record<
  ActivityKind,
  { icon: keyof typeof Ionicons.glyphMap; tint: string; verb: string }
> = {
  view: { icon: 'eye-outline', tint: COLORS.blue, verb: 'viewed' },
  favourite: { icon: 'heart', tint: COLORS.red, verb: 'favourited' },
  vote: { icon: 'trophy-outline', tint: COLORS.gold, verb: 'backed' },
  compare: { icon: 'git-compare-outline', tint: COLORS.orange, verb: 'compared' },
  contribution: { icon: 'create-outline', tint: COLORS.green, verb: 'edited' },
};

const LEVEL_TINT: Record<string, string> = {
  steward: COLORS.green,
  curator: COLORS.blue,
  new: COLORS.grey,
};

// One leaderboard row: thumb + name/publisher, a right-aligned count, and an
// optional win-rate chip (most-backed only). Taps through to the character.
function HeroRow({ hero, unit, onPress }: { hero: HeroStat; unit: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.row}>
      <HeroThumb uri={hero.image_url} size={30} radius={8} />
      <View style={s.rowInfo}>
        <Text style={s.rowName} numberOfLines={1}>
          {hero.name}
        </Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {hero.publisher ?? '—'}
        </Text>
      </View>
      {hero.winRate != null ? (
        <Chip bg={COLORS.green + '1a'} fg={COLORS.green} text={`${hero.winRate}%`} />
      ) : null}
      <Text style={s.rowCount}>
        {hero.count.toLocaleString()}
        <Text style={s.rowUnit}> {unit}</Text>
      </Text>
    </Pressable>
  );
}

function ContributorRow({ c }: { c: Contributor }) {
  const tint = LEVEL_TINT[c.level ?? 'new'] ?? COLORS.grey;
  return (
    <View style={s.row}>
      <View style={[s.avatar, { backgroundColor: tint + '22' }]}>
        <Ionicons name="person" size={15} color={tint} />
      </View>
      <View style={s.rowInfo}>
        <Text style={s.rowName} numberOfLines={1}>
          {c.displayName ?? 'Anonymous'}
        </Text>
        {c.level ? (
          <Text style={[s.rowSub, { color: tint, textTransform: 'capitalize' }]}>{c.level}</Text>
        ) : null}
      </View>
      <Text style={s.rowCount}>
        {c.approved.toLocaleString()}
        <Text style={s.rowUnit}> approved</Text>
      </Text>
    </View>
  );
}

function ActivityRow({ item, onPress }: { item: ActivityItem; onPress: () => void }) {
  const meta = KIND_META[item.kind];
  return (
    <Pressable onPress={onPress} style={s.actRow}>
      <View style={[s.actIcon, { backgroundColor: meta.tint + '1a' }]}>
        <Ionicons name={meta.icon} size={14} color={meta.tint} />
      </View>
      <View style={s.rowInfo}>
        <Text style={s.actText} numberOfLines={1}>
          <Text style={s.actVerb}>{meta.verb} </Text>
          {item.heroName}
        </Text>
        {item.text ? (
          <Text style={s.rowSub} numberOfLines={1}>
            {item.text}
          </Text>
        ) : null}
      </View>
      <Text style={s.actTime}>{relTime(item.at)}</Text>
    </Pressable>
  );
}

export function CommunityDomain({
  data,
  loading,
  narrow,
  onOpenReview,
}: {
  data: CommunityOverview | null;
  loading: boolean;
  narrow: boolean;
  onOpenReview: () => void;
}) {
  const router = useRouter();
  const goHero = (id: string) => router.push(`/character/${id}`);

  if (loading && !data) {
    return (
      <Panel title="Community">
        <ActivityIndicator color={COLORS.orange} style={{ marginTop: 16 }} />
      </Panel>
    );
  }
  if (!data) {
    return (
      <Panel title="Community">
        <View style={s.locked}>
          <Ionicons name="lock-closed-outline" size={26} color={COLORS.grey} />
          <Text style={s.lockedText}>
            Community analytics are admin-only, or no engagement data is available yet.
          </Text>
        </View>
      </Panel>
    );
  }

  const t = data.totals;
  const pending = data.contributionsByStatus.pending;

  return (
    <Bento>
      {/* Headline stats */}
      <Panel title="Community" hint="Engagement across the catalogue">
        <View style={s.tiles}>
          <StatTile label="Members" value={t.members.toLocaleString()} tint={COLORS.navy} />
          <StatTile label="Favourites" value={t.favourites.toLocaleString()} tint={COLORS.red} />
          <StatTile label="Views" value={t.views.toLocaleString()} tint={COLORS.blue} />
          <StatTile label="Compares" value={t.compares.toLocaleString()} tint={COLORS.orange} />
          <StatTile label="Votes" value={t.votes.toLocaleString()} tint={COLORS.gold} />
          <StatTile
            label="Contributions"
            value={t.contributions.toLocaleString()}
            tint={COLORS.green}
          />
        </View>
      </Panel>

      <Bento.Row narrow={narrow}>
        {/* Most viewed */}
        <Panel title="Most viewed" hint="Top heroes by page view" style={s.flex1}>
          {data.topViewed.length === 0 ? (
            <EmptyState text="No views recorded yet." />
          ) : (
            data.topViewed.map((h) => (
              <HeroRow key={h.id} hero={h} unit="views" onPress={() => goHero(h.id)} />
            ))
          )}
        </Panel>

        {/* Most favourited */}
        <Panel title="Most favourited" hint="Top heroes by favourite" style={s.flex1}>
          {data.topFavourited.length === 0 ? (
            <EmptyState text="No favourites yet." />
          ) : (
            data.topFavourited.map((h) => (
              <HeroRow key={h.id} hero={h} unit="favs" onPress={() => goHero(h.id)} />
            ))
          )}
        </Panel>
      </Bento.Row>

      <Bento.Row narrow={narrow}>
        {/* Most backed */}
        <Panel title="Most backed" hint="Matchup-vote winners · win rate" style={s.flex1}>
          {data.topBacked.length === 0 ? (
            <EmptyState text="No votes cast yet." />
          ) : (
            data.topBacked.map((h) => (
              <HeroRow key={h.id} hero={h} unit="votes" onPress={() => goHero(h.id)} />
            ))
          )}
        </Panel>

        {/* Top contributors */}
        <Panel
          title="Top contributors"
          hint="By approved edits"
          style={s.flex1}
          action={
            <Pressable onPress={onOpenReview} style={s.mini}>
              <Text style={s.miniText}>Open review</Text>
              {pending > 0 ? (
                <View style={s.pendBadge}>
                  <Text style={s.pendText}>{pending > 99 ? '99+' : pending}</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={13} color={COLORS.navy} />
              )}
            </Pressable>
          }
        >
          {data.topContributors.length === 0 ? (
            <EmptyState text="No contributors yet." />
          ) : (
            data.topContributors.map((c) => <ContributorRow key={c.userId} c={c} />)
          )}
        </Panel>
      </Bento.Row>

      {/* Recent activity */}
      <Panel title="Recent activity" hint="Newest first across all signals">
        {data.recent.length === 0 ? (
          <EmptyState text="No activity yet — it fills in as people use the app." />
        ) : (
          data.recent.map((item, i) => (
            <ActivityRow
              key={`${item.kind}-${item.at}-${i}`}
              item={item}
              onPress={() => goHero(item.heroId)}
            />
          ))
        )}
      </Panel>
    </Bento>
  );
}

const s = StyleSheet.create({
  flex1: { flex: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 },
  rowInfo: { flex: 1, gap: 1, minWidth: 0 },
  rowName: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  rowSub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  rowCount: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.navy },
  rowUnit: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: COLORS.grey },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Activity feed
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 },
  actIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  actVerb: { fontFamily: 'Nunito_400Regular', color: COLORS.grey },
  actTime: { fontFamily: 'Nunito_700Bold', fontSize: 10.5, color: COLORS.grey },
  // "Open review" action + pending badge
  mini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#efe6d6',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  miniText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  pendBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    paddingHorizontal: 4,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendText: { fontFamily: 'Nunito_700Bold', fontSize: 9.5, color: '#fff' },
  locked: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  lockedText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textAlign: 'center',
    maxWidth: 360,
  },
});
