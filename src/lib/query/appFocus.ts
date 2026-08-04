// src/lib/query/appFocus.ts — teach React Query when the app is in front.
//
// React Query decides whether a query is "focused" from `document.hasFocus()`
// / `visibilitychange`. Neither exists on React Native, so without this the
// focusManager is permanently stuck on its initial value and
// `refetchOnWindowFocus` can never fire — which is why a backgrounded app came
// back showing whatever it had cached, with nothing revalidating until the user
// navigated somewhere new. The library's own React Native guide asks for this
// wiring; the app simply never had it.
//
// AppState is core React Native, so this needs no native module and ships over
// the air. (Connectivity is the sibling problem — `onlineManager` wants
// NetInfo, which is a native module and therefore needs a rebuild. Until then
// React Query assumes it is always online, which at least means it tries.)
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { focusManager } from '@tanstack/react-query';

/**
 * Returns an unsubscribe. Web is left alone — the browser's own visibility
 * events are what React Query expects there, and overriding them would break
 * tab-switch revalidation.
 */
export function startAppFocusTracking(): () => void {
  if (Platform.OS === 'web') return () => {};

  const onChange = (status: AppStateStatus) => {
    // 'inactive' is the iOS in-between state (app switcher, incoming call, a
    // system sheet over the app). Treating it as unfocused would fire a
    // refetch every time the user merely peeks at the app switcher, so only a
    // real background counts as blur.
    focusManager.setFocused(status === 'active');
  };

  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}
