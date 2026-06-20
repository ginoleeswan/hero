import { Stack } from 'expo-router';
import { DailyGame } from '../src/components/game/DailyGame';

// Web variant of the daily game route — same shared screen (RNW), header hidden.
export default function PlayScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DailyGame />
    </>
  );
}
