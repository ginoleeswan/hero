// Scheduled-cron list for the Build domain. Each row shows status + Start/Stop
// and an inline editor (cadence + batch size) that rebuilds the job in place via
// admin_reschedule_cron.
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../../constants/colors';
import { InfoTip } from '../InfoTip';
import { Button, IconButton, PillGroup, EmptyState } from '../ui';
import { CADENCE, BATCHES, humanizeCron, cronHelp } from './pipelineHelpers';
import type { CronJob } from '../../../../lib/db/catalogHealth';

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

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: c.active ? COLORS.green : COLORS.grey }]} />
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
            {c.last_status ? ` · last ${c.last_status}` : ''}
          </Text>
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
