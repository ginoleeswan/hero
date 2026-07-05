import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

/**
 * First sentence of a bio teaser, for the pull-quote treatment. A boundary is
 * sentence punctuation followed by whitespace and a capital — so "D.E.O. "
 * mid-sentence doesn't split. Leads over 220 chars don't quote well; fall back
 * to rendering the whole teaser at body size.
 */
export function splitLeadSentence(text: string): { lead: string; rest: string } {
  const m = /[.!?]["')\]]?\s+(?=[A-Z0-9"'(])/.exec(text);
  if (!m) return { lead: text, rest: '' };
  const cut = m.index + m[0].length;
  const lead = text.slice(0, cut).trim();
  if (lead.length > 220) return { lead: text, rest: '' };
  return { lead, rest: text.slice(cut).trim() };
}

// The page's breathing moment: an accent quote-bar, the first sentence set
// large in Flame, the remaining teaser in FlameSans — no card chrome.
export function PullQuoteBio({
  summary,
  accent,
  hasBiography,
  onReadMore,
  onEdit,
}: {
  summary: string;
  accent: string;
  hasBiography: boolean;
  onReadMore: () => void;
  onEdit?: () => void;
}) {
  if (!summary && !hasBiography) return null;
  const { lead, rest } = splitLeadSentence(summary);
  const quotable = rest.length > 0;
  return (
    <View style={styles.wrap}>
      <View style={[styles.quoteBar, { backgroundColor: accent }] as object} />
      <View style={styles.body}>
        {summary ? (
          <Text style={quotable ? styles.lead : styles.plain}>
            {lead}
            {onEdit && !quotable ? (
              <>
                {'  '}
                <MaterialCommunityIcons
                  name="pencil"
                  size={15}
                  color="rgba(41,60,67,0.5)"
                  onPress={onEdit}
                />
              </>
            ) : null}
          </Text>
        ) : null}
        {quotable ? (
          <Text style={styles.plain}>
            {rest}
            {onEdit ? (
              <>
                {'  '}
                <MaterialCommunityIcons
                  name="pencil"
                  size={15}
                  color="rgba(41,60,67,0.5)"
                  onPress={onEdit}
                />
              </>
            ) : null}
          </Text>
        ) : null}
        {hasBiography ? (
          <Pressable
            onPress={onReadMore}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [styles.readMore, hovered && styles.readMoreHover] as object
            }
          >
            <Text style={[styles.readMoreText, { color: accent }] as object}>Read biography</Text>
            <Ionicons name="chevron-forward" size={13} color={accent} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Card chrome matching the page's other sections — the accent quote-bar is
  // the card's left edge, so the editorial moment stays anchored in the rhythm
  // instead of floating loose on the beige.
  wrap: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8ddd0',
    boxShadow: '0 6px 22px rgba(41,60,67,0.06)',
    padding: 20,
    overflow: 'hidden',
  } as object,
  quoteBar: {
    width: 3,
    borderRadius: 2,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
  body: { flex: 1, gap: 10, maxWidth: 720 },
  // Non-clamped Flame display — free-wrapping, so no descender clipping risk.
  lead: { fontFamily: 'Flame-Regular', fontSize: 23, lineHeight: 32, color: COLORS.navy },
  plain: { fontFamily: 'FlameSans-Regular', fontSize: 15, lineHeight: 24, color: COLORS.navy },
  readMore: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' },
  readMoreHover: { opacity: 0.75 } as object,
  readMoreText: { fontFamily: 'Nunito_700Bold', fontSize: 13 },
});
