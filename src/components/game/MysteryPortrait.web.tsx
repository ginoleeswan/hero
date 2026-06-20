// The blurred mystery portrait for the daily game (web). expo-image's
// blurRadius is native-only, so on web we blur with a CSS filter on a wrapper
// (the codebase already uses `filter: blur(...)` elsewhere). A slight scale-up
// hides the soft edges the blur would otherwise feather against the card.
import { View, StyleSheet } from 'react-native';
import { HeroImage } from '../HeroImage';
import type { MysteryPortraitProps } from './MysteryPortrait';

export function MysteryPortrait({ id, name, imageUrl, portraitUrl, blur }: MysteryPortraitProps) {
  return (
    <View
      style={
        [
          StyleSheet.absoluteFill,
          blur > 0 && {
            filter: `blur(${blur}px)`,
            transform: [{ scale: 1.08 }],
            transition: 'filter 300ms ease',
          },
        ] as object
      }
    >
      <HeroImage
        id={id}
        name={name}
        imageUrl={imageUrl}
        portraitUrl={portraitUrl}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        recyclingKey={`daily-${id}`}
      />
    </View>
  );
}
