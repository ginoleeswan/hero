// src/components/event/EventSection.tsx
// One section masthead for every event surface.
//
// It used to be a 26pt title with a 13pt note stacked under it and nothing else
// — no rule, no top edge, about 200 of the measure's 1,100 points used, and the
// identical treatment on all seven sections. Stacked down a page that reads as a
// CMS template rather than a designed thing: no boundary says where one section
// ends and the next begins except the size of the gap, and nothing says which of
// them matters.
//
// The device is the one EventIndexList already uses for its quarters — label,
// hairline, note — so the event pages share one grammar instead of several. The
// rule does the work: it draws a hard top edge across the full measure, and it
// carries the note out to the right margin where it reads as a caption on the
// section rather than as a second heading under the first.
//
// It lives in its own file rather than inside EventDossier because the archive
// block under a live dossier needs the same masthead, and importing it from the
// dossier would drag the whole dossier into the hub's bundle to get four styles.
// Three copies of "Editions" had already drifted apart for exactly that reason.
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { COLORS, INK_TEXT, PAPER_TEXT } from '../../constants/colors';
import { EVENT_PAPER } from '../../constants/eventGeometry';

export function Section({
  title,
  note,
  onInk = false,
  wide = false,
  topRule = true,
  children,
}: {
  title: string;
  note: string;
  /** Sections sit on paper by default. The measurement band is ink, and the
   *  heading has to invert with it or it disappears into the ground. */
  onInk?: boolean;
  wide?: boolean;
  /** The narrow layout draws the rule as a full-width top edge. A section that
   *  is already the first thing under the orange seam does not want one: two
   *  horizontal hairlines 30pt apart read as a rendering fault, not as
   *  structure. The seam is the stronger edge, so it wins. Ignored on wide,
   *  where the rule runs BETWEEN the title and the note and is never a top
   *  edge in the first place. */
  topRule?: boolean;
  children: React.ReactNode;
}) {
  const ruleInk = onInk ? s.sectionRuleInk : null;
  return (
    <View style={s.section}>
      {/* A phone has no room for three things on a line, so the rule goes above
          and the note below — same edge, stacked. */}
      {wide ? (
        <View style={s.sectionHead}>
          <Text style={[s.sectionTitle, onInk ? s.sectionTitleInk : null]}>{title}</Text>
          <View style={[s.sectionRule, ruleInk]} />
          <Text style={[s.sectionNote, onInk ? s.sectionNoteInk : null]} numberOfLines={1}>
            {note}
          </Text>
        </View>
      ) : (
        <>
          {topRule ? <View style={[s.sectionRuleTop, ruleInk]} /> : null}
          <Text
            style={[
              s.sectionTitle,
              onInk ? s.sectionTitleInk : null,
              topRule ? s.sectionTitleStacked : null,
            ]}
          >
            {title}
          </Text>
          <Text style={[s.sectionNote, onInk ? s.sectionNoteInk : null]}>{note}</Text>
        </>
      )}
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: EVENT_PAPER.sectionMarginBottom },
  // Baseline-aligned with the rule and the note beside it.
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 14 },
  // Between the title and the note, in a ROW — flex: 1 takes the slack.
  sectionRule: { flex: 1, height: 1, backgroundColor: 'rgba(11,24,32,0.16)' },
  // Above the title, in a COLUMN. It cannot share the style above: `flex: 1`
  // sets flexBasis to 0, and along a column that IS the height, so the rule
  // measured 1pt and drew 0. It was invisible on every phone-width section.
  sectionRuleTop: { alignSelf: 'stretch', height: 1, backgroundColor: 'rgba(11,24,32,0.16)' },
  sectionRuleInk: { backgroundColor: 'rgba(245,235,220,0.20)' },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 30,
    lineHeight: EVENT_PAPER.sectionTitleLine,
    color: COLORS.deepNavy,
  },
  sectionTitleStacked: { marginTop: 14 },
  sectionNote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    lineHeight: EVENT_PAPER.sectionNoteLine,
    color: PAPER_TEXT.muted,
    marginTop: EVENT_PAPER.sectionNoteGap,
    flexShrink: 0,
  },
  sectionTitleInk: { color: 'rgba(245,235,220,0.96)' },
  sectionNoteInk: { color: INK_TEXT.faint },
  sectionBody: { marginTop: EVENT_PAPER.sectionBodyGap, gap: 20 },
});
