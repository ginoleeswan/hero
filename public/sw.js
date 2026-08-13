/* Mythique service worker — PUSH ONLY.
 * Deliberately no fetch handler and no caching: this SW exists solely to receive
 * Web Push and open the app on click. (Adding a cache here would risk serving a
 * stale bundle.) Served verbatim from /sw.js; registered in app/+html.tsx. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = {};
  }
  const title = data.title || 'Mythique';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/versus' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      // Focus an existing tab and navigate it; otherwise open a new one.
      for (const tab of tabs) {
        if ('focus' in tab) {
          tab.navigate(url);
          return tab.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
