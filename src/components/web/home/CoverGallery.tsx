import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import type { FirstAppearanceCover } from '../../../lib/db/heroes';

interface CoverGalleryProps {
  covers: FirstAppearanceCover[];
  onPress: (id: string) => void;
}

const CARD_W = 168;
const CARD_H = 252; // ~2:3 comic cover

function CoverCard({ cover, onPress }: { cover: FirstAppearanceCover; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [g.card, hovered && (g.cardHover as object)] as object
      }
    >
      <Image
        source={{ uri: cover.first_issue_image_url ?? undefined }}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={cover.id}
        transition={200}
      />
      <View style={g.overlay as object} />
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
    </Pressable>
  );
}

export function CoverGallery({ covers, onPress }: CoverGalleryProps) {
  const { width } = useWindowDimensions();
  const pagePad = width < 640 ? 16 : 32;

  if (covers.length === 0) return null;

  return (
    <View style={g.section}>
      <View style={[g.header, { paddingLeft: pagePad }] as object}>
        <View style={g.accentBar} />
        <View style={g.headerText}>
          <Text style={g.label}>Origins</Text>
          <Text style={g.title}>First Appearances</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingHorizontal: pagePad }}
      >
        {covers.map((c) => (
          <CoverCard key={c.id} cover={c} onPress={() => onPress(c.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

const g = StyleSheet.create({
  section: { marginBottom: 52 },
  header: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
    marginBottom: 16,
  },
  accentBar: { width: 4, borderRadius: 2, backgroundColor: COLORS.orange, minHeight: 38 },
  headerText: { gap: 2, justifyContent: 'center' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 36, color: COLORS.navy, lineHeight: 38 },

  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    position: 'relative',
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  cardHover: {
    transform: [{ translateY: -6 }],
    boxShadow: '0 20px 52px rgba(0,0,0,0.32)',
    zIndex: 2,
  } as object,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(15,20,24,0.95) 0%, rgba(15,20,24,0.1) 45%, transparent 75%)',
  } as object,
  caption: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.beige,
    lineHeight: 18,
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
  } as object,
  issue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.6)',
    marginTop: 2,
  } as object,
});
