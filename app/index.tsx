import { Platform } from 'react-native';
import LandingPage from '../src/components/landing/LandingPage.dom';

export default function Index() {
  // On native, the AuthGate in _layout.tsx redirects unauthenticated users
  // to /(auth)/login. Nothing to render here.
  if (Platform.OS !== 'web') return null;
  return <LandingPage />;
}
