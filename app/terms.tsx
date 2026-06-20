import { Stack } from 'expo-router';
import { LegalScreen } from '../src/components/legal/LegalScreen';
import { TERMS } from '../src/lib/legal';

export default function TermsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LegalScreen doc={TERMS} />
    </>
  );
}
