import { Stack } from 'expo-router';
import { LegalScreen } from '../src/components/legal/LegalScreen';
import { PRIVACY } from '../src/lib/legal';

export default function PrivacyScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LegalScreen doc={PRIVACY} />
    </>
  );
}
