import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import LandingPage from '../src/components/landing/LandingPage.dom';
import { useWebDocumentScroll } from '../src/hooks/useWebDocumentScroll';

export default function Index() {
  useWebDocumentScroll('#0b1820');
  if (Platform.OS !== 'web') return <Redirect href="/explore" />;
  return <LandingPage dom={{ scrollEnabled: false, matchContents: true }} />;
}
