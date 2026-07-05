// Command-center domain: schedule & manage Explore's editorial campaigns
// (premieres, events, launches). List + create/edit form + delete, all through
// the is_admin-gated RPCs. Web-only, like the rest of the command center.
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Panel } from '../Panel';
import { SkRows } from '../skeletons';
import { COLORS } from '../../../../constants/colors';
import {
  listCampaigns,
  upsertCampaign,
  deleteCampaign,
  campaignStatus,
  type Campaign,
  type CampaignInput,
  type CampaignStatus,
} from '../../../../lib/db/campaigns';

type TargetType = 'franchise' | 'title' | 'heroes';

interface FormState {
  id: string | null;
  label: string;
  headline: string;
  blurb: string;
  accent: string;
  priority: string;
  startsAt: string;
  endsAt: string;
  targetType: TargetType;
  targetValue: string;
}

const EMPTY: FormState = {
  id: null,
  label: '',
  headline: '',
  blurb: '',
  accent: '#E77333',
  priority: '0',
  startsAt: '',
  endsAt: '',
  targetType: 'franchise',
  targetValue: '',
};

const STATUS_COLOR: Record<CampaignStatus, string> = {
  live: COLORS.green,
  scheduled: COLORS.gold,
  ended: COLORS.grey,
};

const TARGET_HINT: Record<TargetType, string> = {
  franchise: 'Franchise name, e.g. "The Boys"',
  title: 'Title id, e.g. "tmdb:454639"',
  heroes: 'Comma-separated hero ids, e.g. "cv-16423, 69"',
};

export function CampaignsDomain() {
  const qc = useQueryClient();
  const campaignsQ = useQuery({ queryKey: ['campaigns'], queryFn: listCampaigns });
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set =
    <K extends keyof FormState>(k: K) =>
    (v: FormState[K]) =>
      setForm((f) => ({ ...f, [k]: v }));

  const editRow = (c: Campaign) => {
    const tt: TargetType = c.hero_ids?.length ? 'heroes' : c.title_id ? 'title' : 'franchise';
    setForm({
      id: c.id,
      label: c.label,
      headline: c.headline,
      blurb: c.blurb ?? '',
      accent: c.accent ?? '#E77333',
      priority: String(c.priority),
      startsAt: c.starts_at ? c.starts_at.slice(0, 10) : '',
      endsAt: c.ends_at.slice(0, 10),
      targetType: tt,
      targetValue:
        tt === 'heroes'
          ? (c.hero_ids ?? []).join(', ')
          : tt === 'title'
            ? (c.title_id ?? '')
            : (c.franchise ?? ''),
    });
    setErr(null);
  };

  const save = async () => {
    setErr(null);
    if (!form.label.trim() || !form.headline.trim() || !form.endsAt.trim()) {
      setErr('Label, headline and end date are required.');
      return;
    }
    setSaving(true);
    try {
      const v = form.targetValue.trim();
      const input: CampaignInput = {
        id: form.id,
        label: form.label.trim(),
        headline: form.headline.trim(),
        blurb: form.blurb.trim() || null,
        accent: form.accent.trim() || null,
        priority: Number(form.priority) || 0,
        starts_at: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        ends_at: new Date(`${form.endsAt}T23:59:59`).toISOString(),
        franchise: form.targetType === 'franchise' ? v || null : null,
        title_id: form.targetType === 'title' ? v || null : null,
        hero_ids:
          form.targetType === 'heroes'
            ? v
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : null,
      };
      await upsertCampaign(input);
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setErr(null);
    try {
      await deleteCampaign(id);
      if (form.id === id) setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const campaigns = campaignsQ.data ?? [];

  return (
    <View style={s.wrap}>
      <Panel
        title={form.id ? 'Edit campaign' : 'New campaign'}
        hint="Schedule an editorial moment — it surfaces at the top of Explore while live."
      >
        <View style={s.formGrid}>
          <Field
            label="Label (eyebrow)"
            value={form.label}
            onChange={set('label')}
            placeholder="In Theaters Now"
          />
          <Field
            label="Headline"
            value={form.headline}
            onChange={set('headline')}
            placeholder="Masters of the Universe"
          />
        </View>
        <Field
          label="Blurb (optional)"
          value={form.blurb}
          onChange={set('blurb')}
          placeholder="One-line description"
        />
        <View style={s.formGrid}>
          <Field
            label="Accent (hex)"
            value={form.accent}
            onChange={set('accent')}
            placeholder="#E77333"
          />
          <Field
            label="Priority"
            value={form.priority}
            onChange={set('priority')}
            placeholder="0"
          />
        </View>
        <View style={s.formGrid}>
          <Field
            label="Start date (optional)"
            value={form.startsAt}
            onChange={set('startsAt')}
            placeholder="YYYY-MM-DD"
          />
          <Field
            label="End date"
            value={form.endsAt}
            onChange={set('endsAt')}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <Text style={s.fieldLabel}>Target</Text>
        <View style={s.targetRow}>
          {(['franchise', 'title', 'heroes'] as TargetType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setForm((f) => ({ ...f, targetType: t }))}
              style={[s.chip, form.targetType === t && s.chipOn] as object}
            >
              <Text style={[s.chipText, form.targetType === t && s.chipTextOn] as object}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <Field
          label=""
          value={form.targetValue}
          onChange={set('targetValue')}
          placeholder={TARGET_HINT[form.targetType]}
        />

        {!!err && <Text style={s.err}>{err}</Text>}

        <View style={s.actions}>
          <Pressable onPress={save} disabled={saving} style={[s.btn, s.btnPrimary] as object}>
            <Text style={s.btnPrimaryText}>
              {saving ? 'Saving…' : form.id ? 'Update campaign' : 'Create campaign'}
            </Text>
          </Pressable>
          {form.id && (
            <Pressable onPress={() => setForm(EMPTY)} style={s.btn as object}>
              <Text style={s.btnText}>Cancel edit</Text>
            </Pressable>
          )}
        </View>
      </Panel>

      <Panel title="Campaigns" hint={`${campaigns.length} total`}>
        {campaignsQ.isLoading ? (
          <SkRows n={4} thumb={false} />
        ) : campaigns.length === 0 ? (
          <Text style={s.muted}>No campaigns yet — create one above.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {campaigns.map((c) => {
              const status = campaignStatus(c);
              const target = c.hero_ids?.length
                ? `${c.hero_ids.length} heroes`
                : c.title_id
                  ? `title ${c.title_id}`
                  : c.franchise
                    ? c.franchise
                    : '—';
              return (
                <View key={c.id} style={s.row}>
                  <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[status] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>
                      {c.headline}
                      <Text style={s.rowMeta}>{`   ·   ${c.label}`}</Text>
                    </Text>
                    <Text style={s.rowSub} numberOfLines={1}>
                      {`${status.toUpperCase()} · P${c.priority} · ${target} · ends ${c.ends_at.slice(0, 10)}`}
                    </Text>
                  </View>
                  <Pressable onPress={() => editRow(c)} style={s.smallBtn as object}>
                    <Text style={s.smallBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => remove(c.id)}
                    style={[s.smallBtn, s.smallBtnDanger] as object}
                  >
                    <Text style={[s.smallBtnText, { color: COLORS.red }] as object}>Delete</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </Panel>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      {!!label && <Text style={s.fieldLabel}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.grey}
        style={s.input as object}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 14 },
  formGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  fieldLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f5efe3',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.black,
    marginTop: 4,
  } as object,
  targetRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#efe6d6',
    cursor: 'pointer',
  } as object,
  chipOn: { backgroundColor: COLORS.navy } as object,
  chipText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
    textTransform: 'capitalize',
  },
  chipTextOn: { color: COLORS.beige } as object,
  err: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.red, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#efe6d6',
    cursor: 'pointer',
  } as object,
  btnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  btnPrimary: { backgroundColor: COLORS.orange } as object,
  btnPrimaryText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
  muted: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  rowTitle: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.black },
  rowMeta: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey },
  rowSub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey, marginTop: 1 },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#efe6d6',
    cursor: 'pointer',
  } as object,
  smallBtnDanger: { backgroundColor: COLORS.red + '14' } as object,
  smallBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
});
