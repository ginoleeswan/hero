import { Stack } from 'expo-router';
import { DailyGame } from '../src/components/game/DailyGame';

// Daily "Guess the Hero" game. The screen carries its own top bar, so the
// native header is hidden.
export default function PlayScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DailyGame />
    </>
  );
}
