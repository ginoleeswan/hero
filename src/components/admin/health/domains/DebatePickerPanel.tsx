// Command-center: curate the Arena's daily debate pair (overrides the
// server's auto-pick RPC, pick_daily_debate). Smallest possible control — a
// date field, two hero-search pickers, an optional hook line, and a submit
// that calls the admin-gated set_daily_debate RPC.
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Panel } from '../Panel';
import { COLORS } from '../../../../constants/colors';
import { searchHeroes, type HeroSearchResult } from '../../../../lib/db/heroes';
import { setDailyDebate } from '../../../../lib/db/dailyDebate';

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function HeroField({
  label,
  picked,
  onPick,
}: {
  label: string;
  picked: HeroSearchResult | null;
  onPick: (h: HeroSearchResult | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HeroSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      searchHeroes(query, 'All', 6)
        .then((r) => {
          if (active) setResults(r);
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {picked ? (
        <View style={s.pickedRow}>
          <Text style={s.pickedName} numberOfLines={1}>
            {picked.name}
          </Text>
          <Pressable onPress={() => onPick(null)}>
            <Text style={s.clearText}>Change</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search hero…"
            placeholderTextColor={COLORS.grey}
            style={s.input as object}
          />
          {loading ? <ActivityIndicator size="small" color={COLORS.orange} /> : null}
          {results.length > 0 ? (
            <View style={s.results}>
              {results.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    onPick(r);
                    setQuery('');
                    setResults([]);
                  }}
                  style={s.resultRow}
                >
                  <Text style={s.resultText} numberOfLines={1}>
                    {r.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

export function DebatePickerPanel() {
  const [date, setDate] = useState(tomorrowIso());
  const [heroA, setHeroA] = useState<HeroSearchResult | null>(null);
  const [heroB, setHeroB] = useState<HeroSearchResult | null>(null);
  const [hook, setHook] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  const save = async () => {
    setMsg(null);
    if (!heroA || !heroB) {
      setMsg({ text: 'Pick both heroes.', error: true });
      return;
    }
    if (heroA.id === heroB.id) {
      setMsg({ text: 'Pick two different heroes.', error: true });
      return;
    }
    if (!date.trim()) {
      setMsg({ text: 'Pick a date.', error: true });
      return;
    }
    setSaving(true);
    const result = await setDailyDebate(date.trim(), heroA.id, heroB.id, hook.trim() || null);
    setSaving(false);
    if (result.ok) {
      setMsg({ text: `Set ${heroA.name} vs ${heroB.name} for ${date.trim()}.`, error: false });
      setHeroA(null);
      setHeroB(null);
      setHook('');
      setDate(tomorrowIso());
    } else {
      setMsg({ text: result.error, error: true });
    }
  };

  return (
    <Panel
      title="Daily debate"
      hint="Curate the Arena's featured pair for a date — overrides the auto-pick. Defaults to tomorrow."
    >
      <View style={s.field}>
        <Text style={s.fieldLabel}>Date</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={COLORS.grey}
          style={s.input as object}
        />
      </View>
      <View style={s.formGrid}>
        <HeroField label="Hero A" picked={heroA} onPick={setHeroA} />
        <HeroField label="Hero B" picked={heroB} onPick={setHeroB} />
      </View>
      <View style={s.field}>
        <Text style={s.fieldLabel}>Hook line (optional)</Text>
        <TextInput
          value={hook}
          onChangeText={setHook}
          placeholder="A rivalry decades in the making."
          placeholderTextColor={COLORS.grey}
          style={s.input as object}
        />
      </View>
      {msg ? <Text style={[s.msg, msg.error && s.msgError] as object}>{msg.text}</Text> : null}
      <Pressable onPress={save} disabled={saving} style={[s.btn, s.btnPrimary] as object}>
        <Text style={s.btnPrimaryText}>{saving ? 'Saving…' : 'Set debate'}</Text>
      </Pressable>
    </Panel>
  );
}

const s = StyleSheet.create({
  formGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  field: { flex: 1, gap: 4, marginTop: 8, minWidth: 160 },
  fieldLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.grey,
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
  } as object,
  results: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.1)',
    overflow: 'hidden',
  },
  resultRow: { paddingHorizontal: 10, paddingVertical: 8 },
  resultText: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.navy },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#efe6d6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  // Clamped Flame text needs lineHeight ≥ 1.22 × fontSize or descenders clip.
  pickedName: {
    flex: 1,
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    lineHeight: 18,
    color: COLORS.navy,
  },
  clearText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.orange },
  msg: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.green, marginTop: 10 },
  msgError: { color: COLORS.red } as object,
  btn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#efe6d6',
    cursor: 'pointer',
  } as object,
  btnPrimary: { backgroundColor: COLORS.orange } as object,
  btnPrimaryText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
});
