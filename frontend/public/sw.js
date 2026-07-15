// Service worker for kitchen order push notifications. Registered once
// (see lib/pushNotifications.ts) and runs independently of any open tab —
// this is specifically what makes it reach a phone that isn't actively
// looking at the Kitchen Display screen, unlike the in-app sound alert
// which only plays if that tab is open and audible.

self.addEventListener('push', (event) => {
  let payload = { title: 'New Order', body: 'A new order has come in.', data: {} };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch { /* malformed payload — fall back to the generic message above rather than failing silently */ }

  const options = {
    body: payload.body,
    icon: '/logo-icon.png',
    badge: '/logo-icon.png',
    tag: payload.tag || 'new-order',
    // Kept visible until someone actually taps it — a kitchen notification
    // that auto-dismisses in a few seconds defeats the entire point of
    // "hard to ignore" if nobody's looking at the phone right when it fires.
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Tapping the notification focuses an already-open Kitchen Display tab if
// one exists, rather than always opening a fresh one — avoids someone
// accumulating a dozen duplicate tabs over a shift.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/kitchen';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/kitchen') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});