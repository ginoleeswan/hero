// src/components/event/HeroFace.tsx
// One character's face, drawn correctly for whichever picture the query found.
//
// There are two kinds and they need opposite treatments, which is the whole
// reason this is a component rather than an <Image> repeated in four places:
//
//   AVATAR (heroes.avatar_url) — a flat head-icon on a transparent ground,
//     drawn to be a finished mark. It sits directly on the page: no disc behind
//     it, no ring, no circular mask, and `contain` so nothing is cropped. A fill
//     behind a transparent PNG turns the mark into a sticker, and a round crop
//     shears the silhouette it was drawn to keep.
//
//   PORTRAIT (portrait_url / image_url) — a rectangular illustration, usually
//     waist-up, on its own opaque background. Left flat it reads as a stray
//     screenshot pasted into the list. It gets what it always had: cropped to a
//     circle over a faint fill, `cover`, so a set of them reads as a cast.
//
// The RPCs resolve which one they sent and return `avatar` alongside the URL,
// because the client should not repeat a three-way coalesce in four components
// and cannot infer the kind from the URL.
//
// Roughly 1,033 of the 1,047 heroes above fame 40 have an avatar and every list
// that uses this is fame-gated, so the portrait branch is the exception — but it
// is the exception that was rendering as a bare rectangle.
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

export interface HeroFaceProps {
  uri: string;
  /** True when `uri` is heroes.avatar_url. See the two branches above. */
  avatar?: boolean;
  size: number;
  name?: string;
}

export function HeroFace({ uri, avatar = false, size, name }: HeroFaceProps) {
  return (
    <Image
      source={{ uri }}
      style={
        avatar
          ? { width: size, height: size }
          : [s.portrait, { width: size, height: size, borderRadius: size / 2 }]
      }
      contentFit={avatar ? 'contain' : 'cover'}
      transition={160}
      accessibilityLabel={name}
    />
  );
}

const s = StyleSheet.create({
  // Only ever applied to the portrait branch — an avatar gets no background.
  portrait: { backgroundColor: 'rgba(11,24,32,0.08)' },
});
