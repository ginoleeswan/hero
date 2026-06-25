import { Stack } from 'expo-router';
import { LegalScreen } from '../src/components/legal/LegalScreen';
import { TERMS } from '../src/lib/legal';
import { SeoHead } from '../src/components/web/SeoHead';

// Web variant of the terms route — same shared screen (RNW), header hidden.
export default function TermsScreen() {
  return (
    <>
      <SeoHead
        title="Terms of Service | Mythique"
        description="Read the Mythique Terms of Service to understand the rules for using our platform."
        path="/terms"
      />
      <Stack.Screen options={{ headerShown: false }} />
      <LegalScreen doc={TERMS} />
    </>
  );
}
