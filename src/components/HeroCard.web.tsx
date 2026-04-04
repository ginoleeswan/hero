import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../constants/colors';
import { heroImageSource } from '../constants/heroImages';

interface HeroCardProps {
  id: string;
  name: string;
  imageUrl: string | null;
  onPress: () => void;
}

export function HeroCard({ id, name, imageUrl, onPress }: HeroCardProps) {
  const imageSource = heroImageSource(id, imageUrl);

  return (
    <View style={styles.card}>
      <Pressable style={styles.pressable} onPress={onPress}>
        <Image source={imageSource} contentFit="cover" style={styles.image} />
        <View style={styles.nameContainer}>
          <Text style={styles.name}>{name}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 32,
    height: 300,
    marginHorizontal: 5,
    marginBottom: 16,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.39,
    shadowRadius: 8.3,
  },
  pressable: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  nameContainer: {
    position: 'absolute',
    bottom: -5,
    padding: 30,
    width: '100%',
    justifyContent: 'center',
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    textShadowColor: 'rgba(0, 0, 0, 1)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 5,
  },
});
