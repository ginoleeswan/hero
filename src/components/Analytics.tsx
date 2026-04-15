import { Platform } from 'react-native';
import { Analytics } from '@vercel/analytics/react';

export default function AnalyticsProvider() {
  if (Platform.OS !== 'web') return null;
  return <Analytics />;
}
