// Ad Links — the copy-paste answer to "which link do I put behind this ad?".
// Lives in the Acquisition sub-tab so the link you tag and the results it
// produces sit on the same screen. Builds every link through
// src/lib/marketing/adLinks (the single home of the UTM convention).
import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { HeroThumb, PillGroup } from '../ui';
import { searchHeroes } from '../../../../lib/db/heroes';
import type { HeroSearchResult } from '../../../../lib/db/heroes/types';
import {
  buildAdLink,
  battlePath,
  bioLink,
  slugifyCampaign,
  type AdSource,
  type AdMedium,
} from '../../../../lib/marketing/adLinks';

const SOURCES = [
  { label: 'TikTok', value: 'tiktok' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Reddit', value: 'reddit' },
  { label: 'X', value: 'x' },
] as const;
const MEDIUMS = [
  { label: 'Paid (promote/ads)', value: 'paid' },
  { label: 'Organic post', value: 'social' },
] as const;
const DESTS = [
  { label: 'Battle page', value: 'battle' },
  { label: 'Homepage', value: 'home' },
] as const;

function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      return navigator.clipboard.writeText(text).then(
        () => true,
        () => false,
      );
    }
  } catch {
    // fall through
  }
  return Promise.resolve(false);
}

// One debounced hero search box with a small inline suggestion list.
function HeroPicker({
  placeholder,
  picked,
  onPick,
}: {
  placeholder: string;
  picked: HeroSearchResult | null;
  onPick: (h: HeroSearchResult | null) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<HeroSearchResult[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      // Clearing suggestions when the query empties — driven by async typing,
      // same pattern the other admin search boxes use.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      searchHeroes(q, 'All', 5)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  if (picked) {
    return (
      <Pressable style={s.pickedRow} onPress={() => onPick(null)}>
        <HeroThumb uri={picked.portrait_url ?? picked.image_url} size={26} radius={7} />
        <Text style={s.pickedName} numberOfLines={1}>
          {picked.name}
        </Text>
        <Ionicons name="close-circle" size={16} color={COLORS.grey} />
      </Pressable>
    );
  }
  return (
    <View style={s.pickerWrap}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={placeholder}
        placeholderTextColor="rgba(41,60,67,0.35)"
        style={s.input}
      />
      {results.length > 0 ? (
        <View style={s.suggestions}>
          {results.map((h) => (
            <Pressable
              key={h.id}
              style={s.suggestion}
              onPress={() => {
                onPick(h);
                setQ('');
                setResults([]);
              }}
            >
              <HeroThumb uri={h.portrait_url ?? h.image_url} size={24} radius={6} />
              <Text style={s.suggestionName} numberOfLines={1}>
                {h.name}
              </Text>
              <Text style={s.suggestionPub} numberOfLines={1}>
                {h.publisher ?? ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Link display + copy button, used for the built link and the bio link.
function LinkRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <View style={s.linkRow}>
      <Text style={s.linkText} numberOfLines={2} selectable>
        {url}
      </Text>
      <Pressable
        style={[s.copyBtn, copied && s.copyBtnDone]}
        onPress={() => {
          void copyToClipboard(url).then((ok) => {
            setCopied(ok);
            if (ok) setTimeout(() => setCopied(false), 1600);
          });
        }}
      >
        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color="#fff" />
        <Text style={s.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
      </Pressable>
    </View>
  );
}

export function AdLinksPanel() {
  const [source, setSource] = useState<AdSource>('tiktok');
  const [medium, setMedium] = useState<AdMedium>('paid');
  const [dest, setDest] = useState<'battle' | 'home'>('battle');
  const [campaign, setCampaign] = useState('');
  const [heroA, setHeroA] = useState<HeroSearchResult | null>(null);
  const [heroB, setHeroB] = useState<HeroSearchResult | null>(null);

  const needsHeroes = dest === 'battle' && (!heroA || !heroB);
  const path = dest === 'battle' && heroA && heroB ? battlePath(heroA.id, heroB.id) : '/';
  const link = buildAdLink({ source, medium, campaign: campaign || 'untitled', path });

  return (
    <Panel title="Ad links" hint="Copy the destination URL for a promote or post">
      <View style={s.rows}>
        <View style={s.pillRow}>
          <PillGroup options={[...SOURCES]} value={source} onChange={setSource} />
          <PillGroup options={[...MEDIUMS]} value={medium} onChange={setMedium} />
        </View>
        <View style={s.pillRow}>
          <PillGroup options={[...DESTS]} value={dest} onChange={setDest} />
          <TextInput
            value={campaign}
            onChangeText={setCampaign}
            placeholder="campaign name — e.g. aquaman v2"
            placeholderTextColor="rgba(41,60,67,0.35)"
            style={[s.input, s.campaignInput]}
          />
        </View>
        {dest === 'battle' ? (
          <View style={s.heroRow}>
            <HeroPicker placeholder="First fighter…" picked={heroA} onPick={setHeroA} />
            <Text style={s.vs}>vs</Text>
            <HeroPicker placeholder="Second fighter…" picked={heroB} onPick={setHeroB} />
          </View>
        ) : null}
        {needsHeroes ? (
          <Text style={s.note}>Pick both fighters to build the battle link.</Text>
        ) : (
          <LinkRow url={link} />
        )}
        {campaign.trim() && slugifyCampaign(campaign) !== campaign.trim() ? (
          <Text style={s.note}>
            Campaign will appear in Acquisition as “{slugifyCampaign(campaign) || 'untitled'}”.
          </Text>
        ) : null}
        <View style={s.divider} />
        <Text style={s.bioLabel}>Bio / profile link ({source}) — evergreen, set once:</Text>
        <LinkRow url={bioLink(source)} />
      </View>
    </Panel>
  );
}

const s = StyleSheet.create({
  rows: { gap: 10 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  input: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.black,
    backgroundColor: '#efe6d6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 180,
  },
  campaignInput: { flex: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  vs: { fontFamily: 'Flame-Regular', fontSize: 13, color: COLORS.navy, marginTop: 9 },
  pickerWrap: { flex: 1, gap: 4 },
  suggestions: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.1)',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.black },
  suggestionPub: { fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: COLORS.grey },
  pickedRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#efe6d6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pickedName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // minWidth 0 + break-all: without them, web flexbox sizes the flex child to
  // the UNBREAKABLE URL's min-content width (min-width:auto), shoving the Copy
  // button ~50px off-screen at 390px. The URL may break anywhere — it's a link,
  // not prose.
  linkText: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
    backgroundColor: 'rgba(41,60,67,0.06)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    wordBreak: 'break-all',
  } as object,
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.orange,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  copyBtnDone: { backgroundColor: COLORS.green },
  copyText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
  note: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey },
  divider: { height: 1, backgroundColor: 'rgba(41,60,67,0.08)', marginVertical: 2 },
  bioLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey },
});
