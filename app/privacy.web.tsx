import { Stack } from 'expo-router';
import { LegalScreen } from '../src/components/legal/LegalScreen';
import { PRIVACY } from '../src/lib/legal';
import { SeoHead } from '../src/components/web/SeoHead';

// Web variant of the privacy route — same shared screen (RNW), header hidden.
export default function PrivacyScreen() {
  return (
    <>
      <SeoHead
        title="Privacy Policy | Mythique"
        description="Read the Mythique Privacy Policy to understand how we collect and use your data."
        path="/privacy"
      />
      <Stack.Screen options={{ headerShown: false }} />
      <LegalScreen doc={PRIVACY} />
    </>
  );
}
