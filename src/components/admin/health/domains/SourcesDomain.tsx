// Sources — one place to see what each external provider contributes to the
// catalogue and how healthy its link is. The app's data spine is source-agnostic
// (internal id = identity; each source id is an attribute), so this reads each
// source's coverage + status side by side. A no-scroll dashboard (fills the view).
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Bento } from '../Bento';
import { Panel } from '../Panel';
import { pct } from '../format';
import type { SourceCoverage } from '../../../../lib/db/catalogHealth';

function Stat({ value, label, tint }: { value: number | string; label: string; tint?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statNum, tint ? { color: tint } : null]}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function CoverBar({ have, total, tint }: { have: number; total: number; tint: string }) {
  const p = pct(have, total);
  return (
    <View style={s.barWrap}>
      <View style={s.barHead}>
        <Text style={s.barCap}>
          {have.toLocaleString()} <Text style={s.barDim}>/ {total.toLocaleString()} linked</Text>
        </Text>
        <Text style={[s.barPct, { color: tint }]}>{p}%</Text>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${p}%`, backgroundColor: tint }]} />
      </View>
    </View>
  );
}

function SourceCard({
  icon,
  name,
  role,
  tint,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
  role: string;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <Panel style={s.card}>
      <View style={s.cardHead}>
        <View style={[s.cardIcon, { backgroundColor: tint + '1a' }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardName}>{name}</Text>
          <Text style={s.cardRole} numberOfLines={1}>
            {role}
          </Text>
        </View>
      </View>
      {children}
    </Panel>
  );
}

export function SourcesDomain({
  cov,
  loading,
  narrow,
}: {
  cov: SourceCoverage | null | undefined;
  loading: boolean;
  narrow: boolean;
}) {
  if (loading || !cov) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={COLORS.orange} />
      </View>
    );
  }
  const total = cov.total;
  return (
    <Bento fill>
      <Bento.Row narrow={narrow} fill>
        <SourceCard
          icon="flash-outline"
          name="SuperheroAPI"
          role="Origin source · seeded the early catalogue"
          tint={COLORS.grey}
        >
          <CoverBar have={cov.superhero_api.linked} total={total} tint={COLORS.grey} />
          <Text style={s.note}>
            Legacy ids are kept as an attribute (superhero_api_id), not identity.
          </Text>
        </SourceCard>

        <SourceCard
          icon="library-outline"
          name="ComicVine"
          role="Comics core · powers, bio, first appearance, foes"
          tint={COLORS.orange}
        >
          <CoverBar have={cov.comicvine.linked} total={total} tint={COLORS.orange} />
          <View style={s.stats}>
            <Stat value={cov.comicvine.done} label="enriched" tint={COLORS.green} />
            <Stat value={cov.comicvine.pending} label="pending" />
            <Stat
              value={cov.comicvine.failed}
              label="failed"
              tint={cov.comicvine.failed > 0 ? COLORS.red : undefined}
            />
          </View>
        </SourceCard>
      </Bento.Row>

      <Bento.Row narrow={narrow} fill>
        <SourceCard
          icon="git-network-outline"
          name="Wikidata"
          role="Identity hub · cross-media bridge between sources"
          tint={COLORS.navy}
        >
          <CoverBar have={cov.wikidata.resolved} total={total} tint={COLORS.navy} />
          <View style={s.stats}>
            <Stat value={cov.wikidata.enriched} label="appearances" tint={COLORS.green} />
            <Stat
              value={cov.wikidata.ambiguous}
              label="need you"
              tint={cov.wikidata.ambiguous > 0 ? COLORS.yellow : undefined}
            />
            <Stat value={cov.wikidata.unresolved} label="unresolved" />
          </View>
        </SourceCard>

        <SourceCard
          icon="film-outline"
          name="TMDB"
          role="Screen media · film & TV posters, cast, trailers"
          tint={COLORS.green}
        >
          <CoverBar
            have={cov.tmdb.enriched}
            total={Math.max(1, cov.tmdb.titles)}
            tint={COLORS.green}
          />
          <View style={s.stats}>
            <Stat value={cov.tmdb.titles} label="titles" />
            <Stat value={cov.tmdb.films} label="films" />
            <Stat value={cov.tmdb.tv} label="TV" />
          </View>
        </SourceCard>
      </Bento.Row>
    </Bento>
  );
}

const s = StyleSheet.create({
  center: { paddingVertical: 40, alignItems: 'center' },
  card: { flex: 1, gap: 12 },
  cardFill: { minHeight: 0 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.black },
  cardRole: { fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: COLORS.grey },
  barWrap: { gap: 5 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barCap: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  barDim: { fontFamily: 'Nunito_400Regular', color: COLORS.grey },
  barPct: { fontFamily: 'Flame-Regular', fontSize: 15 },
  barTrack: { height: 7, borderRadius: 4, backgroundColor: '#ece2cf', overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4 },
  stats: { flexDirection: 'row', gap: 18, marginTop: 2 },
  stat: { gap: 1 },
  statNum: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.black },
  statLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.3,
    color: COLORS.grey,
    textTransform: 'uppercase',
  },
  note: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey, lineHeight: 17 },
});
