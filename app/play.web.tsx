import { Stack } from 'expo-router';
import { DailyGame } from '../src/components/game/DailyGame';
import { SeoHead } from '../src/components/web/SeoHead';

// Web variant of the daily game route — same shared screen (RNW), header hidden.
export default function PlayScreen() {
  return (
    <>
      <SeoHead
        title="Guess the Hero — Daily Challenge | Mythique"
        description="A new mystery hero every day. Reveal the blurred portrait, read the clues, and name them in six guesses. Play today's Guess the Hero."
        path="/play"
      />
      <Stack.Screen options={{ headerShown: false }} />
      <DailyGame />
    </>
  );
}
