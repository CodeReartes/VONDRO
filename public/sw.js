// VONDRO Service Worker - PWA, Offline & Zero-Data Repeat Image Cache
const CACHE_NAME = 'vondro-v1.1';
const IMG_CACHE = 'vondro-img-v1';
const MAX_IMG_CACHE_ENTRIES = 500;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// Install Event - Pre-cache essential app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache addAll error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== IMG_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

async function trimImageCache(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length > MAX_IMG_CACHE_ENTRIES) {
      const toDelete = keys.length - MAX_IMG_CACHE_ENTRIES;
      await Promise.all(keys.slice(0, toDelete).map((k) => cache.delete(k)));
    }
  } catch {
    // ignore trim errors
  }
}

// Fetch Event - Cache-First for /api/img & Stale-While-Revalidate for app shell
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET requests and browser extensions
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Optimized product images (/api/img): Cache-First so scrolling back or revisiting spends 0 bytes
  if (request.url.includes('/api/img')) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        const netRes = await fetch(request);
        if (netRes && netRes.status === 200) {
          const clone = netRes.clone();
          cache.put(request, clone).then(() => trimImageCache(cache)).catch(() => {});
        }
        return netRes;
      })
    );
    return;
  }

  // Other API calls and Firestore operations are handled live
  if (request.url.includes('/api/') || request.url.includes('firestore.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});
