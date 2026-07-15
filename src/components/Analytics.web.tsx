import { useEffect, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { usePathname, useSegments } from 'expo-router';
import { recordPageView } from '../lib/db/pageViews';
import { captureAttribution, recordAttribution } from '../lib/attribution';
import { setSentryTag } from '../lib/sentry';

export default function AnalyticsProvider() {
  // path is the concrete URL (e.g. /character/123); route is the matched
  // pattern (e.g. /character/[id]). Passing both lets Vercel group dynamic
  // routes instead of logging every id as a distinct page. Route-group
  // segments like (tabs) aren't part of the URL, so strip them.
  const path = usePathname();
  const segments = useSegments();
  const route = '/' + segments.filter((segment) => !segment.startsWith('(')).join('/');

  // Mirror the same view into our self-hosted page_views table (command-center
  // Traffic domain). Keyed on path + deduped so a re-render doesn't double-count.
  // First-touch attribution: capture the landing UTM/referrer once at mount —
  // before router navigation drops the query string — then persist it. Both
  // no-op cleanly on repeat visits and off-web.
  useEffect(() => {
    captureAttribution();
    void recordAttribution();
  }, []);

  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (!path || lastPath.current === path) return;
    lastPath.current = path;
    void recordPageView(route, path);
    // Tag the Sentry scope so any error is attributed to the route pattern.
    setSentryTag('route', route);
  }, [path, route]);

  return (
    <>
      <Analytics route={route} path={path} />
      <SpeedInsights route={route} />
    </>
  );
}
