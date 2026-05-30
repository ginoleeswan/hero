import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import LandingPage from '../src/components/landing/LandingPage.dom';

export default function Index() {
  if (Platform.OS !== 'web') return <Redirect href="/explore" />;
  return <LandingPage />;
}
