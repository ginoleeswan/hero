// Community / engagement domain — the read-only "who's doing what" glance.
// Aggregates come from one admin-guarded RPC (see src/lib/db/community.ts); this
// is a pure view of that data. No mutations: moderation lives in ReviewDomain
// (the "Open review" action just deep-links there).
import { useState, type ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { HeroThumb, StatTile, EmptyState, Chip, Well } from '../ui';
import { CommunitySkeleton } from '../skeletons';
import { relTime, withAlpha } from '../format';
import { fetchMemberDetail } from '../../../../lib/db/community';
import type {
  CommunityOverview,
  HeroStat,
  Contributor,
  ActivityItem,
  ActivityKind,
  PresenceSummary,
  Member,
  OnlineMember,
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

/** "12 Jul 2026" — stable absolute join date, locale-agnostic month. */
const joinDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// Circular member avatar (real photo when present, person fallback otherwise)
// with an optional live-presence ring/dot.
function MemberAvatar({
  uri,
  size = 36,
  live,
}: {
  uri?: string | null;
  size?: number;
  live?: boolean;
}) {
  return (
    <View>
      <HeroThumb uri={uri} size={size} radius={size / 2} />
      {live ? (
        <View
          style={[s.liveRing, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }]}
        />
      ) : null}
    </View>
  );
}

// Compact role/level chips shown next to a member's name. Admins and supporters
// are first-class; contributor tier trails when they've had edits approved.
function RoleBadges({
  isAdmin,
  isSupporter,
  level,
}: {
  isAdmin: boolean;
  isSupporter: boolean;
  level?: string | null;
}) {
  const levelTint = level ? (LEVEL_TINT[level] ?? COLORS.grey) : null;
  return (
    <View style={s.badges}>
      {isAdmin ? <Chip bg={withAlpha(COLORS.navy, 0.14)} fg={COLORS.navy} text="Admin" /> : null}
      {isSupporter ? (
        <Chip bg={withAlpha(COLORS.gold, 0.16)} fg={COLORS.gold} text="Supporter" />
      ) : null}
      {level && level !== 'new' && levelTint ? (
        <Chip bg={withAlpha(levelTint, 0.16)} fg={levelTint} text={level} capitalize />
      ) : null}
    </View>
  );
}

// Proportional stacked bar of the deliberate engagement actions (views are
// shown as context, not a segment — they dwarf everything else). Fills the
// headline panel with a real chart instead of dead space.
function EngagementMix({ t }: { t: CommunityOverview['totals'] }) {
  const parts = [
    { label: 'Compares', value: t.compares, tint: COLORS.orange },
    { label: 'Contributions', value: t.contributions, tint: COLORS.green },
    { label: 'Votes', value: t.votes, tint: COLORS.gold },
    { label: 'Favourites', value: t.favourites, tint: COLORS.red },
  ];
  const sum = parts.reduce((a, p) => a + p.value, 0);
  return (
    <View style={s.mixWrap}>
      <View style={s.mixHead}>
        <Text style={s.mixTitle}>Engagement mix</Text>
        <Text style={s.mixSub}>{t.views.toLocaleString()} views in context</Text>
      </View>
      <View style={s.mixTrack}>
        {sum === 0 ? (
          <View style={[s.mixSeg, { flex: 1, backgroundColor: 'rgba(41,60,67,0.08)' }]} />
        ) : (
          parts.map((p) =>
            p.value > 0 ? (
              <View key={p.label} style={[s.mixSeg, { flex: p.value, backgroundColor: p.tint }]} />
            ) : null,
          )
        )}
      </View>
      <View style={s.mixLegend}>
        {parts.map((p) => (
          <View key={p.label} style={s.mixLegItem}>
            <View style={[s.mixDot, { backgroundColor: p.tint }]} />
            <Text style={s.mixLegLabel}>{p.label}</Text>
            <Text style={s.mixLegVal}>{p.value.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// One-line context pill — a small icon + fact, used in the insight strip.
function InsightPill({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.insightPill}>
      <Ionicons name={icon} size={13} color={COLORS.navy} />
      <Text style={s.insightText}>{text}</Text>
    </View>
  );
}

// Compact ranked leaderboard row: rank · thumb · name · count, with a
// proportional bar under the name that fills the horizontal space and encodes
// magnitude at a glance. Win-rate (most-backed only) sits inline before the count.
function LeaderRow({
  rank,
  hero,
  unit,
  tint,
  max,
  onPress,
}: {
  rank: number;
  hero: HeroStat;
  unit: string;
  tint: string;
  max: number;
  onPress: () => void;
}) {
  const pct = max > 0 ? Math.max(5, Math.round((hero.count / max) * 100)) : 0;
  return (
    <Pressable onPress={onPress} style={s.lRow}>
      <Text style={s.lRank}>{rank}</Text>
      <HeroThumb uri={hero.image_url} size={26} radius={7} />
      <View style={s.lInfo}>
        <View style={s.lTop}>
          <Text style={s.lName} numberOfLines={1}>
            {hero.name}
          </Text>
          {hero.winRate != null ? <Text style={s.lWin}>{hero.winRate}%</Text> : null}
          <Text style={s.lCount}>
            {hero.count.toLocaleString()}
            <Text style={s.rowUnit}> {unit}</Text>
          </Text>
        </View>
        <View style={s.lTrack}>
          <View style={[s.lFill, { width: `${pct}%`, backgroundColor: tint }]} />
        </View>
      </View>
    </Pressable>
  );
}

// Compact contributor row — mirrors LeaderRow (rank · avatar · name · bar) but
// the bar is tinted by contributor tier and measures approved edits.
function ContribRow({ rank, c, max }: { rank: number; c: Contributor; max: number }) {
  const tint = LEVEL_TINT[c.level ?? 'new'] ?? COLORS.grey;
  const pct = max > 0 ? Math.max(5, Math.round((c.approved / max) * 100)) : 0;
  return (
    <View style={s.lRow}>
      <Text style={s.lRank}>{rank}</Text>
      <View style={[s.cAvatar, { backgroundColor: tint + '22' }]}>
        <Ionicons name="person" size={13} color={tint} />
      </View>
      <View style={s.lInfo}>
        <View style={s.lTop}>
          <Text style={s.lName} numberOfLines={1}>
            {c.displayName ?? 'Anonymous'}
          </Text>
          {c.level && c.level !== 'new' ? (
            <Text style={[s.lLevel, { color: tint }]}>{c.level}</Text>
          ) : null}
          <Text style={s.lCount}>
            {c.approved.toLocaleString()}
            <Text style={s.rowUnit}> approved</Text>
          </Text>
        </View>
        <View style={s.lTrack}>
          <View style={[s.lFill, { width: `${pct}%`, backgroundColor: tint }]} />
        </View>
      </View>
    </View>
  );
}

// Reusable leaderboard card: title/hint + a Well-grouped top-5 ranked list with
// proportional bars. Sizes to its content (never stretches into a void).
function LeaderPanel({
  title,
  hint,
  tint,
  unit,
  rows,
  empty,
  style,
  action,
  onHero,
}: {
  title: string;
  hint: string;
  tint: string;
  unit: string;
  rows: HeroStat[];
  empty: string;
  style?: StyleProp<ViewStyle>;
  action?: ReactNode;
  onHero: (id: string) => void;
}) {
  const top = rows.slice(0, 5);
  const max = Math.max(1, ...top.map((r) => r.count));
  return (
    <Panel title={title} hint={hint} style={style} action={action}>
      {top.length === 0 ? (
        <EmptyState text={empty} />
      ) : (
        <Well>
          {top.map((h, i) => (
            <LeaderRow
              key={h.id}
              rank={i + 1}
              hero={h}
              unit={unit}
              tint={tint}
              max={max}
              onPress={() => onHero(h.id)}
            />
          ))}
        </Well>
      )}
    </Panel>
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

// Named-user presence: who's signed in and active right now. The anonymous
// "active visitors" line is a deliberate placeholder until Phase 3's page_views
// table lands (anon traffic isn't tracked yet).
function OnlineNow({ online }: { online: PresenceSummary }) {
  return (
    <Panel title="Online now" hint="Signed-in members · last 5 min" style={s.flex1}>
      <View style={s.onlineHead}>
        <View style={s.onlineBig}>
          <View style={s.dot} />
          <Text style={s.onlineCount}>{online.onlineNow.toLocaleString()}</Text>
        </View>
        <View>
          <Text style={s.onlineSub}>{online.activeToday.toLocaleString()}</Text>
          <Text style={s.onlineSubLabel}>active today</Text>
        </View>
        <View>
          <Text style={s.onlineSub}>{online.activeVisitors.toLocaleString()}</Text>
          <Text style={s.onlineSubLabel}>visitors now</Text>
        </View>
      </View>
      {online.recent.length === 0 ? (
        <EmptyState text="No members seen yet." />
      ) : (
        online.recent.map((m: OnlineMember) => (
          <View key={m.userId} style={s.row}>
            <MemberAvatar uri={m.avatarUrl} size={28} live={m.live} />
            <View style={s.rowInfo}>
              <Text style={s.rowName} numberOfLines={1}>
                {m.displayName ?? 'Anonymous'}
              </Text>
              {m.isAdmin || m.isSupporter ? (
                <RoleBadges isAdmin={m.isAdmin} isSupporter={m.isSupporter} />
              ) : null}
            </View>
            <Text style={s.actTime}>{relTime(m.lastSeenAt)}</Text>
          </View>
        ))
      )}
      <Text style={s.anonNote}>
        “Visitors now” counts anonymous + signed-in sessions — see Traffic for detail.
      </Text>
    </Panel>
  );
}

// A tiny icon+count used on the right of a roster row to preview engagement.
function MiniStat({ icon, n }: { icon: keyof typeof Ionicons.glyphMap; n: number }) {
  return (
    <View style={s.miniStat}>
      <Ionicons name={icon} size={12} color={COLORS.grey} />
      <Text style={s.miniStatNum}>{n.toLocaleString()}</Text>
    </View>
  );
}

// Lazy per-member drill-down: fetched only when a roster row is expanded. Shows
// the full engagement breakdown, recently favourited heroes, and this member's
// own newest-first activity — the "who is this person" view.
function MemberDetailCard({ userId, onHero }: { userId: string; onHero: (id: string) => void }) {
  const q = useQuery({
    queryKey: ['memberDetail', userId],
    queryFn: () => fetchMemberDetail(userId),
    staleTime: 60_000,
  });

  if (q.isLoading) {
    return (
      <View style={s.detailLoading}>
        <ActivityIndicator size="small" color={COLORS.orange} />
      </View>
    );
  }
  if (!q.data) {
    return (
      <View style={s.detailCard}>
        <Text style={s.rowSub}>Couldn’t load this member’s detail.</Text>
      </View>
    );
  }

  const { counts, joinedAt, lastSeenAt } = q.data.profile;
  return (
    <View style={s.detailCard}>
      <View style={s.tiles}>
        <StatTile label="Views" value={counts.views.toLocaleString()} tint={COLORS.blue} />
        <StatTile label="Favourites" value={counts.favourites.toLocaleString()} tint={COLORS.red} />
        <StatTile label="Votes" value={counts.votes.toLocaleString()} tint={COLORS.gold} />
        <StatTile label="Edits" value={counts.contributions.toLocaleString()} tint={COLORS.green} />
        {counts.approved > 0 || counts.pending > 0 ? (
          <StatTile
            label={counts.pending > 0 ? `Approved · ${counts.pending} pending` : 'Approved'}
            value={counts.approved.toLocaleString()}
            tint={COLORS.navy}
          />
        ) : null}
      </View>

      <Text style={s.detailMeta}>
        Joined {joinDate(joinedAt)}
        {lastSeenAt ? ` · last seen ${relTime(lastSeenAt)}` : ' · never signed in'}
      </Text>

      {q.data.favourites.length > 0 ? (
        <View style={s.favStrip}>
          <Text style={s.detailLabel}>Favourites</Text>
          <View style={s.favThumbs}>
            {q.data.favourites.map((h) => (
              <Pressable key={h.id} onPress={() => onHero(h.id)}>
                <HeroThumb uri={h.image_url} size={38} radius={8} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {q.data.recent.length > 0 ? (
        <View style={s.detailFeed}>
          <Text style={s.detailLabel}>Recent activity</Text>
          {q.data.recent.map((item, i) => (
            <ActivityRow
              key={`${item.kind}-${item.at}-${i}`}
              item={item}
              onPress={() => onHero(item.heroId)}
            />
          ))}
        </View>
      ) : (
        <EmptyState text="No activity from this member yet." />
      )}
    </View>
  );
}

// One roster row. Taps to expand the lazy detail card below it.
function MemberRow({ m, onHero }: { m: Member; onHero: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen((v) => !v)} style={s.memberRow}>
        <MemberAvatar uri={m.avatarUrl} size={38} live={m.live} />
        <View style={s.rowInfo}>
          <View style={s.nameLine}>
            <Text style={s.rowName} numberOfLines={1}>
              {m.displayName ?? 'Anonymous'}
            </Text>
            <RoleBadges
              isAdmin={m.isAdmin}
              isSupporter={m.isSupporter}
              level={m.contributorLevel}
            />
          </View>
          <Text style={s.rowSub} numberOfLines={1}>
            Joined {joinDate(m.joinedAt)}
            {m.lastSeenAt ? ` · seen ${relTime(m.lastSeenAt)}` : ' · never seen'}
          </Text>
        </View>
        <View style={s.miniStats}>
          <MiniStat icon="eye-outline" n={m.views} />
          <MiniStat icon="heart" n={m.favourites} />
          <MiniStat icon="create-outline" n={m.contributions} />
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={COLORS.grey}
          style={s.chev}
        />
      </Pressable>
      {open ? <MemberDetailCard userId={m.userId} onHero={onHero} /> : null}
    </View>
  );
}

// Full member roster — every signed-up profile, richest-signal first. Tap a row
// to drill into that person.
function MembersPanel({
  members,
  newThisWeek,
  onHero,
}: {
  members: Member[];
  newThisWeek: number;
  onHero: (id: string) => void;
}) {
  const hint =
    newThisWeek > 0
      ? `${members.length} shown · ${newThisWeek} new this week`
      : `${members.length} shown · tap to expand`;
  return (
    <Panel title="Members" hint={hint}>
      {members.length === 0 ? (
        <EmptyState text="No members yet." />
      ) : (
        <Well>
          {members.map((m) => (
            <MemberRow key={m.userId} m={m} onHero={onHero} />
          ))}
        </Well>
      )}
    </Panel>
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
    return <CommunitySkeleton narrow={narrow} />;
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
      <Bento.Row narrow={narrow}>
        {/* Headline stats */}
        <Panel title="Community" hint="Engagement across the catalogue" style={s.flex15}>
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

          <EngagementMix t={t} />

          <View style={s.insights}>
            {data.newThisWeek > 0 ? (
              <InsightPill icon="sparkles-outline" text={`${data.newThisWeek} new this week`} />
            ) : null}
            {t.members > 0 ? (
              <InsightPill
                icon="eye-outline"
                text={`${Math.round(t.views / t.members).toLocaleString()} views / member`}
              />
            ) : null}
            {t.members > 0 && t.contributions > 0 ? (
              <InsightPill
                icon="create-outline"
                text={`${Math.round(t.contributions / t.members).toLocaleString()} edits / member`}
              />
            ) : null}
          </View>
        </Panel>

        {/* Online now */}
        <OnlineNow online={data.online} />
      </Bento.Row>

      {/* Full member roster with per-member drill-down */}
      <MembersPanel members={data.members} newThisWeek={data.newThisWeek} onHero={goHero} />

      {/* Hero leaderboards — three compact top-5 columns. Cards size to content
          (flex-start) so a short list never stretches into a void. */}
      <View style={narrow ? s.stackCols : s.cols}>
        <LeaderPanel
          title="Most viewed"
          hint="Top heroes by page view"
          tint={COLORS.blue}
          unit="views"
          rows={data.topViewed}
          empty="No views recorded yet."
          style={s.flex1}
          onHero={goHero}
        />
        <LeaderPanel
          title="Most favourited"
          hint="Top heroes by favourite"
          tint={COLORS.red}
          unit="favs"
          rows={data.topFavourited}
          empty="No favourites yet."
          style={s.flex1}
          onHero={goHero}
        />
        <LeaderPanel
          title="Most backed"
          hint="Matchup-vote winners"
          tint={COLORS.gold}
          unit="votes"
          rows={data.topBacked}
          empty="No votes cast yet."
          style={s.flex1}
          onHero={goHero}
        />
      </View>

      {/* People + activity — contributors alongside the newest-first feed. */}
      <View style={narrow ? s.stackCols : s.cols}>
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
            <Well>
              {(() => {
                const top = data.topContributors.slice(0, 5);
                const max = Math.max(1, ...top.map((x) => x.approved));
                return top.map((c, i) => (
                  <ContribRow key={c.userId} rank={i + 1} c={c} max={max} />
                ));
              })()}
            </Well>
          )}
        </Panel>

        <Panel title="Recent activity" hint="Newest first across all signals" style={s.flex15}>
          {data.recent.length === 0 ? (
            <EmptyState text="No activity yet — it fills in as people use the app." />
          ) : (
            <Well>
              {data.recent.slice(0, 10).map((item, i) => (
                <ActivityRow
                  key={`${item.kind}-${item.at}-${i}`}
                  item={item}
                  onPress={() => goHero(item.heroId)}
                />
              ))}
            </Well>
          )}
        </Panel>
      </View>
    </Bento>
  );
}

const s = StyleSheet.create({
  flex1: { flex: 1 },
  flex15: { flex: 1.5 },
  // Content-sized column rows (never stretch to equal height, so short/empty
  // panels don't leave a void). Mirrors Bento.Row's gap.
  cols: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stackCols: { flexDirection: 'column', gap: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Compact ranked leaderboard / contributor row
  lRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 },
  lRank: {
    width: 14,
    textAlign: 'center',
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  lInfo: { flex: 1, minWidth: 0, gap: 4 },
  lTop: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  lName: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    color: COLORS.black,
  },
  lWin: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.green },
  lLevel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    textTransform: 'capitalize',
  },
  lCount: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    color: COLORS.navy,
    fontVariant: ['tabular-nums'],
  },
  lTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(41,60,67,0.08)',
    overflow: 'hidden',
  },
  lFill: { height: '100%', borderRadius: 999 },
  cAvatar: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Engagement-mix stacked bar
  mixWrap: { marginTop: 14, gap: 8 },
  mixHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  mixTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mixSub: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.blue },
  mixTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 2,
    backgroundColor: 'rgba(41,60,67,0.06)',
  },
  mixSeg: { height: '100%' },
  mixLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 2 },
  mixLegItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mixDot: { width: 8, height: 8, borderRadius: 999 },
  mixLegLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.navy },
  mixLegVal: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  // Insight strip
  insights: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  insightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#efe6d6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  insightText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  // Online-now panel
  onlineHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 28, marginBottom: 10 },
  onlineBig: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 999, backgroundColor: COLORS.green },
  onlineCount: { fontFamily: 'Flame-Regular', fontSize: 38, color: COLORS.green, lineHeight: 40 },
  onlineSub: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.navy, lineHeight: 24 },
  onlineSubLabel: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: COLORS.grey },
  liveRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    borderWidth: 2,
    borderColor: COLORS.green,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  // Members roster
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  miniStats: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  miniStatNum: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
    fontVariant: ['tabular-nums'],
  },
  chev: { marginLeft: 2 },
  detailLoading: { paddingVertical: 18, alignItems: 'center' },
  detailCard: {
    gap: 10,
    marginLeft: 48,
    marginBottom: 8,
    paddingTop: 4,
    paddingBottom: 10,
    paddingRight: 4,
  },
  detailMeta: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  detailLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  favStrip: { gap: 4 },
  favThumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailFeed: { gap: 0 },
  anonNote: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: COLORS.grey,
    fontStyle: 'italic',
    marginTop: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 },
  rowInfo: { flex: 1, gap: 1, minWidth: 0 },
  rowName: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  rowSub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  rowUnit: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: COLORS.grey },
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
