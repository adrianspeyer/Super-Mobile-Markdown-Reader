const CACHE_NAME = 'smmr-v6.2.5';
const APP_BASE_URL = new URL('./', self.location.href).href;
const CACHE_SCOPE_SUFFIX = ':' + APP_BASE_URL;
const CACHE_KEY = CACHE_NAME + CACHE_SCOPE_SUFFIX;
const APP_SHELL_URL = new URL('index.html', APP_BASE_URL).href;
const PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'favicon.ico',
  'src/markdown.js',
  'src/speyer-tour.css',
  'src/speyer-tour.js',
  'https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-ui@3.5.3/dist/sui-tokens.min.css',
  'https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-ui@3.5.3/dist/sui-components.min.css',
  'https://cdn.jsdelivr.net/gh/adrianspeyer/speyer-ui@3.5.3/dist/sui.min.js',
  'https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js',
  'https://cdn.jsdelivr.net/npm/dompurify@3.2.4/dist/purify.min.js',
  'https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap'
].map(path => new URL(path, APP_BASE_URL).href);

// Only cache same-origin and known CDN resources
const ALLOWED_CACHE_ORIGINS = new Set([
  self.location.origin,
  'https://cdn.jsdelivr.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
]);

function isCacheableRequest(url) {
  return ALLOWED_CACHE_ORIGINS.has(new URL(url).origin);
}

// A cache failure must not turn a successful network response into an error.
async function cacheResponse(cache, request, response) {
  if (!response.ok) return;
  try { await cache.put(request, response.clone()); }
  catch (error) { console.warn('Unable to cache resource:', error); }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_KEY)
      .then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      // Other paths on this origin may host their own SMMR installation.
      // Leave legacy unscoped caches intact for workers still using them.
      Promise.all(keys.filter(k => k.startsWith('smmr-') && k.endsWith(CACHE_SCOPE_SUFFIX) && k !== CACHE_KEY)
        .map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function navigationResponse(request) {
  const cache = await caches.open(CACHE_KEY);
  let response;
  try {
    response = await fetch(request);
    if (response.ok) {
      await cacheResponse(cache, request, response);
      const url = new URL(request.url);
      // Keep the canonical offline shell fresh when either entry URL is used.
      if (url.origin === self.location.origin &&
          [APP_BASE_URL, APP_SHELL_URL].includes(url.origin + url.pathname)) {
        await cacheResponse(cache, APP_SHELL_URL, response);
      }
      return response;
    }
  } catch {}
  return await cache.match(request) || await cache.match(APP_SHELL_URL) ||
    await cache.match(APP_BASE_URL) || response || Response.error();
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (event.request.cache === 'no-store') return;

  // Navigation: network-first, with an awaited, scope-relative shell fallback.
  if (event.request.mode === 'navigate') {
    event.respondWith(navigationResponse(event.request));
    return;
  }

  // Only cache known-safe origins (prevents caching user-fetched URLs)
  if (!isCacheableRequest(event.request.url)) return;

  // Keep revalidation and cache writes alive even when a cached response wins.
  const cachePromise = caches.open(CACHE_KEY);
  const networkPromise = fetch(event.request).then(async response => {
    await cacheResponse(await cachePromise, event.request, response);
    return response;
  });
  event.waitUntil(networkPromise.then(() => {}, () => {}));
  event.respondWith(cachePromise.then(async cache => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try { return await networkPromise; }
    catch { return Response.error(); }
  }));
});

// LISTEN FOR UPDATE SIGNAL
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});
