const CACHE_NAME = 'smmr-v5.3'; // Bumped version
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-ui@2.1.2/sui-tokens.min.css',
  'https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-ui@2.1.2/sui-components.min.css',
  'https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-ui@2.1.2/sui.min.js',
  'https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js',
  'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js',
  'https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      // REMOVED: self.skipWaiting() - We want to wait for user approval now
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Navigation: Network-first, fallback to index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(r => {
          const c = r.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, c));
          return r;
        })
        .catch(() => caches.match('/') || caches.match('/index.html'))
    );
    return;
  }

  // Assets: Stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchP = fetch(event.request).then(r => {
        if (r.ok) {
          const c = r.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, c));
        }
        return r;
      }).catch(() => cached);
      return cached || fetchP;
    })
  );
});

// LISTEN FOR UPDATE SIGNAL
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});