import { Modal, View, Text, FlatList, Pressable, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import type { MovieAppearance } from '../types';
import { COLORS } from '../constants/colors';

interface Props {
  movies: MovieAppearance[];
  onClose: () => void;
  onSelectMovie: (movie: MovieAppearance) => void;
}

const COLS = 3;
const CARD_GAP = 10;

function GridCard({
  movie,
  cardW,
  onPress,
}: {
  movie: MovieAppearance;
  cardW: number;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const cardH = cardW * 1.5;

  const webHoverProps =
    Platform.OS === 'web'
      ? ({ onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } as object)
      : {};

  return (
    <Pressable
      style={({ pressed }) => [styles.gridCard, { width: cardW }, (pressed || hovered) && styles.cardActive]}
      onPress={onPress}
      {...webHoverProps}
    >
      <View style={[styles.posterWrapper, { width: cardW, height: cardH }]}>
        {movie.imageUrl ? (
          <Image
            source={{ uri: movie.imageUrl }}
            style={{ width: cardW, height: cardH }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.posterPlaceholder, { width: cardW, height: cardH }]}>
            <Ionicons name="film-outline" size={20} color={COLORS.grey} />
          </View>
        )}
      </View>
      <Text style={[styles.cardTitle, { width: cardW }]} numberOfLines={2}>
        {movie.name}
      </Text>
      {movie.year ? <Text style={styles.cardYear}>{movie.year}</Text> : null}
    </Pressable>
  );
}

export function MovieGridModal({ movies, onClose, onSelectMovie }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 700;

  const sheetWidth = isDesktop ? Math.min(width * 0.85, 600) : width;
  const cardW = (sheetWidth - 32 - CARD_GAP * (COLS - 1)) / COLS;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.backdrop, isDesktop && styles.backdropDesktop]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            isDesktop ? styles.sheetDesktop : { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {!isDesktop ? <View style={styles.handle} /> : null}

          <View style={styles.header}>
            <Text style={styles.headerTitle}>All Appearances</Text>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <FlatList
            data={movies}
            numColumns={COLS}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <GridCard movie={item} cardW={cardW} onPress={() => onSelectMovie(item)} />
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  backdropDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    maxHeight: '85%',
  },
  sheetDesktop: {
    width: '85%',
    maxWidth: 600,
    maxHeight: '90%',
    borderRadius: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.navy + '30',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: 'Flame-Bold',
    fontSize: 16,
    color: COLORS.navy,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.navy + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
  },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  columnWrapper: {
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  gridCard: {
    alignItems: 'center',
  },
  cardActive: {
    opacity: 0.75,
  },
  posterWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 5,
  },
  posterPlaceholder: {
    backgroundColor: COLORS.navy + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    textAlign: 'center',
    lineHeight: 13,
  },
  cardYear: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 9,
    color: COLORS.grey,
    marginTop: 2,
    textAlign: 'center',
  },
});
