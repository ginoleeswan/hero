import { StyleSheet, Text, View } from 'react-native';
import TouchableScale from 'react-native-touchable-scale';
import { SquircleView } from 'react-native-figma-squircle';
import MaskedView from '@react-native-masked-view/masked-view';
import { Image } from 'expo-image';
import { COLORS } from '../constants/colors';
import { HERO_IMAGES } from '../constants/heroImages';

interface HeroCardProps {
  id: string;
  name: string;
  imageUrl: string | null;
  onPress: () => void;
}

export function HeroCard({ id, name, imageUrl, onPress }: HeroCardProps) {
  const imageSource = imageUrl
    ? (HERO_IMAGES[imageUrl] ?? HERO_IMAGES[id])
    : HERO_IMAGES[id];

  return (
    <View style={styles.card}>
      <TouchableScale
        delayPressIn={50}
        activeScale={0.9}
        tension={160}
        friction={2}
        onPress={onPress}
      >
        <MaskedView
          maskElement={
            <SquircleView
              style={StyleSheet.absoluteFill}
              squircleParams={{
                cornerRadius: 50,
                cornerSmoothing: 1,
                fillColor: 'pink',
              }}
            />
          }
        >
          <Image
            source={imageSource}
            contentFit="cover"
            style={styles.image}
          />
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{name}</Text>
          </View>
        </MaskedView>
      </TouchableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    height: 300,
    marginHorizontal: 5,
    marginBottom: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.39,
    shadowRadius: 8.3,
    elevation: 13,
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
    borderRadius: 20,
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
