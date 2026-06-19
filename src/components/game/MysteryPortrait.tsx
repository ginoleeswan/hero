// The blurred mystery portrait for the daily game (native). expo-image's
// blurRadius does the work here; the web twin uses a CSS filter instead, since
// blurRadius is native-only. Keep the two in sync.
import { StyleSheet } from 'react-native';
import { HeroImage } from '../HeroImage';

export interface MysteryPortraitProps {
  id: string;
  name: string;
  imageUrl: string | null;
  portraitUrl: string | null;
  /** Gaussian blur radius; 0 once the puzzle is solved (full reveal). */
  blur: number;
}

export function MysteryPortrait({ id, name, imageUrl, portraitUrl, blur }: MysteryPortraitProps) {
  return (
    <HeroImage
      id={id}
      name={name}
      imageUrl={imageUrl}
      portraitUrl={portraitUrl}
      contentFit="cover"
      contentPosition="top"
      blurRadius={blur}
      transition={250}
      style={StyleSheet.absoluteFill}
      recyclingKey={`daily-${id}-${blur}`}
    />
  );
}
