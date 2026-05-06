// SO-KI service worker - push notifications only.
// Intentionally NO fetch caching to avoid serving stale builds.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = { title: 'SO-KI', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'SO-KI';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'soki-reminder',
    renotify: true,
    data: { url: payload.url || '/' },
    lang: 'ja',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        } catch (_e) {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
