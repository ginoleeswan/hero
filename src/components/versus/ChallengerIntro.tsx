import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { CuratedRow } from './CuratedRow';
import { COLORS, INK_TEXT } from '../../constants/colors';
import type { PickedHero } from '../../lib/battleBuilderState';

interface RowItem {
  id: string;
  name: string;
  image_url?: string | null;
  portrait_url?: string | null;
}

interface Props {
  lead: PickedHero | null;
  rivals: RowItem[];
  onPick: (item: RowItem) => void;
  onSurprise: () => void;
}

/** Act 2 header — frames the matchup as a dare and leads with the lead's canon
 *  arch-enemies (the grudge-match dopamine), with Surprise as a one-tap escape.
 *  Building a custom challenger happens via the grid below this. */
export function ChallengerIntro({ lead, rivals, onPick, onSurprise }: Props) {
  return (
    <View style={s.wrap}>
      <Text style={s.title} numberOfLines={2}>
        {lead ? `Who dares face ${lead.name}?` : 'Choose the challenger'}
      </Text>

      {rivals.length > 0 ? (
        <CuratedRow label="Their arch-enemies" items={rivals} onPick={onPick} cardW={96} />
      ) : null}

      <View style={s.paths}>
        <Pressable onPress={onSurprise} style={s.path}>
          <Ionicons name="dice" size={15} color={COLORS.beige} />
          <Text style={s.pathText}>Surprise me</Text>
        </Pressable>
        <Text style={s.or}>or pick anyone below ↓</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 4 },
  title: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige },
  paths: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  path: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  pathText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.beige },
  or: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: INK_TEXT.faint },
});
