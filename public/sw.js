// Kill switch Service Worker to force-clear caches and disable offline intercepting
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          console.log('Clearing cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Pass-through fetch event (no intercepting/caching)
self.addEventListener('fetch', (event) => {
  // Do not intercept, let it go to the network directly
  return;
});
