// Scheduled-cron list for the Build domain. Each row shows status + Start/Stop
// and an inline editor (cadence + batch size) that rebuilds the job in place via
// admin_reschedule_cron.
//
// The dot used to mean "pg_cron says this job is active". For the fourteen jobs
// that only queue an HTTP POST at an edge function that was close to
// meaningless: the POST returns in 60ms, pg_cron records 'succeeded', and the
// function behind it could be 500ing for a week without the dot changing
// colour. It now means "this job ran and the thing it triggered worked", which
// is the only version of the question worth asking.
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../../ui/Text';
import { COLORS } from '../../../../constants/colors';
import { InfoTip } from '../InfoTip';
import { Button, IconButton, PillGroup, EmptyState } from '../ui';
import { CADENCE, BATCHES, humanizeCron, cronHelp } from './pipelineHelpers';
import type { CronJob } from '../../../../lib/db/catalogHealth';

/** Milliseconds as something readable at a glance. A cron that takes a minute
 *  and a cron that takes 60ms both matter, so the unit changes rather than the
 *  precision: "42ms", "5.4s", "1m 38s". */
function duration(ms: number | null): string | null {
  if (ms == null) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** Green only when the job ran AND whatever it triggered came back clean.
 *  A paused job is grey, not red — it is off on purpose. */
function healthColor(c: CronJob): string {
  if (!c.active) return COLORS.grey;
  const failing =
    (c.fails_24h ?? 0) > 0 ||
    (c.http_fails_24h ?? 0) > 0 ||
    (c.http_status != null && (c.http_status < 200 || c.http_status > 299));
  if (failing) return COLORS.red;
  // Scheduled, enabled, and no run on record — a job that has never fired is
  // not healthy, but it is not broken either.
  if (c.last_run == null) return COLORS.yellow;
  return COLORS.green;
}

function CronRow({
  c,
  busy,
  onToggle,
  onReschedule,
}: {
  c: CronJob;
  busy: string | null;
  onToggle: (jobname: string, enabled: boolean) => void;
  onReschedule: (jobname: string, schedule: string, limit: number | null) => void;
}) {
  const busyThis = busy === `cron-${c.jobname}`;
  const [editing, setEditing] = useState(false);
  const [sched, setSched] = useState(c.schedule);
  const [lim, setLim] = useState<number | null>(c.lim);
  const open = () => {
    setSched(c.schedule);
    setLim(c.lim);
    setEditing(true);
  };
  const save = () => {
    onReschedule(c.jobname, sched, c.lim != null ? lim : null);
    setEditing(false);
  };

  // Cost first, because it is what the cadence editor above is for: seeing that
  // a job averages 24 seconds an hour is the reason to slow it down. Then the
  // outcome, preferring the edge function's response over pg_cron's, since for
  // a posting job pg_cron only ever saw the queue accept the request.
  const cost = duration(c.avg_ms_7d ?? c.last_ms);
  const outcome =
    c.http_status != null
      ? `HTTP ${c.http_status}`
      : c.last_status
        ? `last ${c.last_status}`
        : null;
  const failures = (c.http_fails_24h ?? 0) + (c.fails_24h ?? 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: healthColor(c) }]} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {c.jobname}
            </Text>
            <InfoTip text={`${cronHelp(c.jobname)} Schedule: ${c.schedule}.`} size={13} />
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {humanizeCron(c.schedule)}
            {c.lim != null ? ` · ${c.lim}/run` : ''}
            {cost ? ` · ${cost}` : ''}
            {outcome ? ` · ${outcome}` : ''}
          </Text>
          {failures > 0 ? (
            <Text style={styles.fail} numberOfLines={1}>
              {failures} {failures === 1 ? 'failure' : 'failures'} in the last 24h
            </Text>
          ) : null}
        </View>
        <IconButton
          icon="options-outline"
          active={editing}
          onPress={() => (editing ? setEditing(false) : open())}
          accessibilityLabel={`Configure ${c.jobname}`}
        />
        <Button
          label={c.active ? 'Stop' : 'Start'}
          icon={c.active ? 'pause' : 'play'}
          tone={c.active ? 'ghost' : 'success'}
          size="sm"
          loading={busyThis}
          disabled={!!busy}
          onPress={() => onToggle(c.jobname, !c.active)}
        />
      </View>

      {editing ? (
        <View style={styles.editor}>
          <Text style={styles.editLabel}>Cadence</Text>
          <PillGroup
            variant="solid"
            options={CADENCE.map((p) => ({ label: p.label, value: p.expr }))}
            value={sched}
            onChange={setSched}
          />
          {c.lim != null ? (
            <>
              <Text style={styles.editLabel}>Batch size</Text>
              <PillGroup
                variant="solid"
                options={BATCHES.map((n) => ({ label: String(n), value: n }))}
                value={lim ?? BATCHES[0]}
                onChange={setLim}
              />
            </>
          ) : null}
          <View style={styles.editActions}>
            <Button label="Cancel" tone="ghost" size="sm" onPress={() => setEditing(false)} />
            <Button label="Save" tone="primary" size="sm" loading={busyThis} onPress={save} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function CronList({
  crons,
  busy,
  onToggle,
  onReschedule,
}: {
  crons: CronJob[];
  busy: string | null;
  onToggle: (jobname: string, enabled: boolean) => void;
  onReschedule: (jobname: string, schedule: string, limit: number | null) => void;
}) {
  if (crons.length === 0) return <EmptyState text="No cron jobs scheduled." />;
  return (
    <>
      {crons.map((c) => (
        <CronRow
          key={c.jobname}
          c={c}
          busy={busy}
          onToggle={onToggle}
          onReschedule={onReschedule}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1, borderBottomColor: 'rgba(41,60,67,0.06)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 8 },
  info: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black, flexShrink: 1 },
  meta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  fail: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.red,
    fontVariant: ['tabular-nums'],
  },
  editor: { gap: 6, paddingBottom: 10, paddingLeft: 18 },
  editLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: COLORS.grey,
    textTransform: 'uppercase',
  },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
