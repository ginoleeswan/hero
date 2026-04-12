// src/components/home/HomeHeroRow.tsx
import { View, Text, FlatList, StyleSheet, Dimensions } from 'react-native';
import { HeroCard } from '../HeroCard';
import { ThumbCard, type ThumbHero } from './ThumbCard';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PORTRAIT_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);

export interface RowHero extends ThumbHero {}

interface HomeHeroRowProps {
  label?: string;
  title: string;
  heroes: RowHero[];
  variant?: 'portrait' | 'thumb';
  onPress: (item: RowHero) => void;
  disabled?: boolean;
}

export function HomeHeroRow({
  label,
  title,
  heroes,
  variant = 'portrait',
  onPress,
  disabled = false,
}: HomeHeroRowProps) {
  const isPortrait = variant === 'portrait';

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        {!!label && <Text style={styles.label}>{label}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      <FlatList
        horizontal
        data={heroes}
        keyExtractor={(h) => h.id}
        showsHorizontalScrollIndicator={false}
        decelerationRate={isPortrait ? 'fast' : 'normal'}
        snapToInterval={isPortrait ? PORTRAIT_CARD_WIDTH + 12 : undefined}
        contentContainerStyle={[styles.listContent, { gap: isPortrait ? 12 : 8 }]}
        renderItem={({ item }) =>
          isPortrait ? (
            <View style={{ width: PORTRAIT_CARD_WIDTH }}>
              <HeroCard
                id={item.id}
                name={item.name}
                imageUrl={item.image_url}
                portraitUrl={item.portrait_url}
                onPress={() => onPress(item)}
              />
            </View>
          ) : (
            <ThumbCard item={item} onPress={() => onPress(item)} disabled={disabled} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 14, paddingBottom: 4 },
  header: { paddingHorizontal: 15, marginBottom: 10, gap: 2 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.navy },
  listContent: { paddingHorizontal: 15 },
});
