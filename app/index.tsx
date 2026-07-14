import { lazy, Suspense } from 'react';
import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { LogoLoader } from '../src/components/ui/LogoLoader';
import { useWebCanvas } from '../src/hooks/useWebCanvas';

// Code-split: the landing pulls in three.js (the summon stage), which would
// otherwise ride in the shared entry bundle and slow the boot of EVERY page on
// every platform. Lazy keeps it in its own chunk, fetched only when a
// logged-out web visitor actually lands on `/`; native redirects before the
// chunk is ever requested.
const LandingPage = lazy(() => import('../src/components/landing/LandingPage.dom'));

export default function Index() {
  useWebCanvas('#0b1820');
  if (Platform.OS !== 'web') return <Redirect href="/explore" />;
  return (
    // Same ink LogoLoader the boot gate shows, so the chunk fetch reads as a
    // continuation of the app loading rather than a second distinct phase.
    <Suspense fallback={<LogoLoader />}>
      <LandingPage dom={{ scrollEnabled: false, matchContents: true }} />
    </Suspense>
  );
}
