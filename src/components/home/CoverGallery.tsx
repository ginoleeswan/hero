// src/components/home/CoverGallery.tsx — native "Origins" gallery wall.
// First-appearance comic covers; taps open the character.
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PressScale } from '../ui/PressScale';
import { COLORS, ORANGE_INK } from '../../constants/colors';
import type { FirstAppearanceCover } from '../../lib/db/heroes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = Math.round(SCREEN_WIDTH * 0.4);
const CARD_H = Math.round(CARD_W * 1.5); // ~2:3 comic cover

function CoverCard({ cover, onPress }: { cover: FirstAppearanceCover; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} scale={0.95} style={g.card}>
      <Image
        source={{ uri: cover.first_issue_image_url ?? undefined }}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={cover.id}
        transition={200}
      />
      <LinearGradient
        colors={['rgba(15,20,24,0.95)', 'rgba(15,20,24,0.1)', 'transparent']}
        locations={[0, 0.45, 0.75]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={g.caption}>
        <Text style={g.name} numberOfLines={1}>
          {cover.name}
        </Text>
        {!!cover.first_appearance && (
          <Text style={g.issue} numberOfLines={1}>
            {cover.first_appearance}
          </Text>
        )}
      </View>
    </PressScale>
  );
}

export function CoverGallery({
  covers,
  onPress,
}: {
  covers: FirstAppearanceCover[];
  onPress: (id: string) => void;
}) {
  if (covers.length === 0) return null;
  return (
    <View style={g.section}>
      <View style={g.header}>
        <View style={g.accentBar} />
        <View style={g.headerText}>
          <Text style={g.label}>Origins</Text>
          <Text style={g.title}>First Appearances</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={g.row}>
        {covers.map((c) => (
          <CoverCard key={c.id} cover={c} onPress={() => onPress(c.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

const g = StyleSheet.create({
  section: { paddingTop: 14, paddingBottom: 16 },
  header: {
    paddingHorizontal: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 11,
  },
  accentBar: { width: 4, borderRadius: 2, backgroundColor: COLORS.orange },
  headerText: { gap: 2, justifyContent: 'center' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: ORANGE_INK,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.navy, lineHeight: 28 },
  row: { gap: 12, paddingHorizontal: 15, paddingBottom: 4 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 10,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  caption: { position: 'absolute', bottom: 10, left: 12, right: 12 },
  name: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige, lineHeight: 18 },
  issue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.6)',
    marginTop: 2,
  },
});
