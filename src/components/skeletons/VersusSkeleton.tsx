// src/components/skeletons/VersusSkeleton.tsx
// Loading placeholder for the Arena hub's showdown block (app/(tabs)/versus.tsx).
//
// The stage's eyebrow and title are already real while the matchup loads, so
// this stands in only for what's pending: the two tilted holo cards with the
// VS coin between them, and the "join the debate" link under them.
//
// Geometry is copied from ShowdownCards (CARD_W 150, CARD_H 200, COIN 56, the
// ±4° tilt and the -16 coin overlap). If it changes there, change it here in
// the same PR.
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';

const CARD_W = 150;
const CARD_H = 200;
const COIN = 56;

// Placeholder fill for the navy game-lobby stage.
const ON_DARK = 'rgba(245,235,220,0.10)';

export function VersusSkeleton() {
  return (
    <SkeletonProvider>
      <View style={styles.wrap}>
        <View style={styles.arena}>
          <Skeleton
            width={CARD_W}
            height={CARD_H}
            borderRadius={18}
            color={ON_DARK}
            style={styles.tiltL}
          />
          <Skeleton
            width={COIN}
            height={COIN}
            borderRadius={COIN / 2}
            color={ON_DARK}
            style={styles.coin}
          />
          <Skeleton
            width={CARD_W}
            height={CARD_H}
            borderRadius={18}
            color={ON_DARK}
            style={styles.tiltR}
          />
        </View>
        <Skeleton width={168} height={13} borderRadius={4} color={ON_DARK} style={styles.link} />
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'stretch' },
  arena: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  tiltL: { transform: [{ rotate: '-4deg' }] },
  tiltR: { transform: [{ rotate: '4deg' }] },
  coin: { marginHorizontal: -16, zIndex: 6 },
  link: { marginTop: 14 },
});
