const CACHE_NAME = 'ai-assistant-v1';
const DYNAMIC_CACHE = 'ai-assistant-dynamic-v1';

const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(URLS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.includes('localhost')) {
      return;
  }

  // API Requests (Network First, then cache or handle via Background Sync queue)
  if (event.request.url.includes('/api/')) {
      event.respondWith(
        fetch(event.request)
          .catch(() => {
              // We don't cache POST/PUT/DELETE API requests here; they are handled via IndexedDB queue
              // For GET requests, we could return cached JSON if implemented
              return new Response(JSON.stringify({ error: 'offline', message: 'You are offline.' }), {
                  headers: { 'Content-Type': 'application/json' }
              });
          })
      );
      return;
  }

  // Static Assets (Cache First, then Network)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
  );
});

// Background Sync (If supported)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-offline-actions') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    // In a real scenario, the SW could read from IndexedDB directly and sync
    // For now, we will rely on our React Hook to do this when coming online
    // to easily manage UI state and Auth tokens.
    // So Background Sync tag just wakes up the SW, but we can message the client.
    const clients = await self.clients.matchAll();
    for (const client of clients) {
        client.postMessage({ type: 'SYNC_NOW' });
    }
}
