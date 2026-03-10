/* ==========================================================================
   find.amalfi.day — Service Worker
   Cache-first strategy with aggressive precaching
   ========================================================================== */

const CACHE_VERSION = 'find-amalfi-v4';

/* --- Asset list to precache --- */
const PRECACHE_URLS = [
  '/',
  '/a/',
  '/route/amalfi-house.html',
  '/route/atrani-house.html',
  '/route/amalfi-awesome.html',
  '/css/style.css',
  '/js/app.js',
  '/i18n/en.json',
  '/i18n/it.json',
  '/i18n/de.json',
  '/i18n/fr.json',
  '/manifest.json',
  // Hero images
  '/img/hero/amalfi-harbor.webp',
  '/img/hero/amalfi-harbor.jpg',
  '/img/hero/atrani-tunnel.webp',
  '/img/hero/atrani-tunnel.jpg',
  // Segment A (13 images)
  ...generateImagePaths('seg-a', 13),
  // Segment B (20 images)
  ...generateImagePaths('seg-b', 20),
  // Segment B-alt (7 images)
  ...generateImagePaths('seg-b-alt', 7),
  // Segment C (2 images)
  ...generateImagePaths('seg-c', 2),
];

function generateImagePaths(segment, count) {
  const paths = [];
  for (let i = 1; i <= count; i++) {
    const num = String(i).padStart(2, '0');
    paths.push(`/img/${segment}/${num}.webp`);
    paths.push(`/img/${segment}/${num}.jpg`);
  }
  return paths;
}

/* --- Install: precache all assets --- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const total = PRECACHE_URLS.length;
      let loaded = 0;

      // Cache in batches to report progress
      // Use fetch+put instead of cache.add to follow redirects properly
      const batchSize = 5;
      for (let i = 0; i < total; i += batchSize) {
        const batch = PRECACHE_URLS.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (url) => {
            try {
              const response = await fetch(url, { redirect: 'follow' });
              if (response.ok) {
                await cache.put(url, response);
              }
            } catch (err) {
              console.warn('Failed to cache:', url, err);
            }
            loaded++;
            // Report progress to all clients
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'CACHE_PROGRESS',
                  progress: Math.round((loaded / total) * 100),
                });
              });
            });
          })
        );
      }

      // Notify completion
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'CACHE_COMPLETE' });
        });
      });

      return self.skipWaiting();
    })
  );
});

/* --- Activate: clean old caches --- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* --- Fetch: cache-first, skip cached redirects --- */
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (e.g., CDN scripts — let browser handle)
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // If cached response is a redirect, skip it and fetch from network
      // Safari refuses to serve cached redirects for navigation requests
      if (cached && !cached.redirected && cached.status < 300) {
        return cached;
      }

      return fetch(event.request).then(response => {
        // Cache successful, non-redirect responses for future offline use
        if (response.ok && !response.redirected) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback for HTML pages
      if (event.request.headers.get('accept')?.includes('text/html')) {
        return caches.match('/');
      }
    })
  );
});
