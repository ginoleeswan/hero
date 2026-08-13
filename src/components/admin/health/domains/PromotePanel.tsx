// Publish › Promote — the boost cockpit. One place for the whole "put money
// behind a post" flow, in the order you actually do it: pick a safe post →
// build the destination link → set up the promote correctly → judge it by the
// right number. The steps encode the playbook learned from the July promotes
// (docs/marketing/utm-attribution.md) so the process lives in the UI, not in
// memory. The link builder (AdLinksPanel) has its canonical home here — the
// Acquisition tab shows results and points back to this tab for links.
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { AdLinksPanel } from './AdLinksPanel';

const STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'images-outline',
    title: 'Pick a boost-safe post',
    body: 'Only boost "Ad toolkit" / "Ad library" batches from the Social queue. Organic packs use franchise art — never put spend behind those.',
  },
  {
    icon: 'link-outline',
    title: 'Build the destination link below',
    body: 'Battle page for matchup creatives (it paints instantly and captures the vote); homepage otherwise. One campaign name per creative.',
  },
  {
    icon: 'rocket-outline',
    title: 'Set up the promote',
    body: 'Goal: "More engaged visits" — never likes. Audience: Automatic (hand-picked regions starved delivery 8×). Paste the link as the destination URL.',
  },
  {
    icon: 'trending-up-outline',
    title: 'Judge it by engaged visitors',
    body: 'Platform likes are vanity. The number that decides scale-vs-kill is engaged visitors per rand — in Audience → Acquisition once the promote runs.',
  },
];

export function PromotePanel({ onOpenAcquisition }: { onOpenAcquisition?: () => void }) {
  return (
    <Bento>
      <Panel
        title="How to boost"
        hint="The four steps, in order"
        action={
          onOpenAcquisition ? (
            <Pressable style={s.resultsBtn} onPress={onOpenAcquisition}>
              <Ionicons name="trending-up-outline" size={13} color="#fff" />
              <Text style={s.resultsText}>Results</Text>
            </Pressable>
          ) : undefined
        }
      >
        <View style={s.steps}>
          {STEPS.map((st, i) => (
            <View key={st.title} style={s.step}>
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{i + 1}</Text>
              </View>
              <View style={s.stepBody}>
                <View style={s.stepTitleRow}>
                  <Ionicons name={st.icon} size={14} color={COLORS.orange} />
                  <Text style={s.stepTitle}>{st.title}</Text>
                </View>
                <Text style={s.stepText}>{st.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </Panel>

      <AdLinksPanel />
    </Bento>
  );
}

const s = StyleSheet.create({
  steps: { gap: 12 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(224,168,62,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 11.5, color: COLORS.orange },
  stepBody: { flex: 1, gap: 2 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: COLORS.black },
  stepText: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, lineHeight: 18, color: COLORS.grey },
  resultsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.navy,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  resultsText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
});
