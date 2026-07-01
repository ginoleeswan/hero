import { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Text,
  FlatList,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  images: { url: string; caption?: string | null }[];
  initialIndex: number;
  onClose: () => void;
  onReport?: (image: { url: string; caption?: string | null }) => void;
}

export function ImageLightbox({ images, initialIndex, onClose, onReport }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const indexRef = useRef(initialIndex);

  useEffect(() => {
    // Scroll to initial index after mount
    if (initialIndex > 0) {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    }
  }, [initialIndex]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowRight') {
        const next = Math.min(indexRef.current + 1, images.length - 1);
        listRef.current?.scrollToIndex({ index: next, animated: true });
        indexRef.current = next;
      }
      if (e.key === 'ArrowLeft') {
        const prev = Math.max(indexRef.current - 1, 0);
        listRef.current?.scrollToIndex({ index: prev, animated: true });
        indexRef.current = prev;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images.length, onClose]);

  return (
    <Modal
      testID="lightbox-modal"
      visible
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={({ viewableItems }) => {
            if (viewableItems[0]) indexRef.current = viewableItems[0].index ?? 0;
          }}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Image
                source={{ uri: item.url }}
                style={styles.image}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
              {item.caption ? (
                <Text style={styles.caption} numberOfLines={2}>
                  {item.caption}
                </Text>
              ) : null}
            </View>
          )}
        />

        <TouchableOpacity
          testID="lightbox-close"
          onPress={onClose}
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        {onReport ? (
          <TouchableOpacity
            testID="lightbox-report"
            onPress={() => onReport(images[indexRef.current])}
            style={[styles.reportBtn, { top: insets.top + 12 }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="flag-outline" size={22} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.85 },
  caption: {
    position: 'absolute',
    bottom: 48,
    left: 20,
    right: 20,
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBtn: { position: 'absolute', right: 64, padding: 6 },
});
