import { Analytics } from '@vercel/analytics/react';
import { usePathname, useSegments } from 'expo-router';

export default function AnalyticsProvider() {
  // path is the concrete URL (e.g. /character/123); route is the matched
  // pattern (e.g. /character/[id]). Passing both lets Vercel group dynamic
  // routes instead of logging every id as a distinct page. Route-group
  // segments like (tabs) aren't part of the URL, so strip them.
  const path = usePathname();
  const segments = useSegments();
  const route = '/' + segments.filter((segment) => !segment.startsWith('(')).join('/');

  return <Analytics route={route} path={path} />;
}
