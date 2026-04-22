// ─── SERVICE WORKER - TallerPro ───────────────────────────────────────────────
// Incrementar en cada deploy para invalidar caché viejo
const CACHE_NAME = 'tallerpro-v3';

// Solo el shell mínimo — JS y CSS NO van aquí (se manejan network-first)
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
];

// Dominios externos que NUNCA se interceptan
const BYPASS_DOMAINS = [
  'supabase.co',
  'supabase.in',
  'groq.com',
  'ocr.space',
  'googleapis.com',
  'gstatic.com',
];

function shouldBypass(url) {
  return BYPASS_DOMAINS.some(d => url.includes(d));
}

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('📦 SW: cacheando shell');
      return cache.addAll(SHELL_URLS);
    })
  );
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key !== CACHE_NAME)
        .map(key => {
          console.log('🗑️ SW: eliminando caché viejo:', key);
          return caches.delete(key);
        })
    ))
  );
  self.clients.claim();
  console.log('✅ SW activado:', CACHE_NAME);
});

// ─── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Dejar pasar APIs externas sin interceptar
  if (shouldBypass(url)) return;

  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  const isJS  = url.includes('.js');
  const isCSS = url.includes('.css');
  const isHTML = url.includes('.html') || url.endsWith('/');

  // ── JS y CSS: Network-first ──────────────────────────────────────────────
  if (isJS || isCSS) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          const responseToCache = networkResponse.clone();
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request, responseToCache)
            );
          }
          return networkResponse;
        })
        .catch(() => {
          console.warn('SW: offline, sirviendo JS/CSS desde caché:', url);
          return caches.match(event.request);
        })
    );
    return;
  }

  // ── HTML: Network-first ──────────────────────────────────────────────────
  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          const responseToCache = networkResponse.clone();
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request, responseToCache)
            );
          }
          return networkResponse;
        })
        .catch(() => {
          console.warn('SW: offline, sirviendo HTML desde caché:', url);
          return caches.match(event.request) || caches.match('./index.html');
        })
    );
    return;
  }

  // ── Imágenes y fonts: Stale-while-revalidate ─────────────────────────────
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            console.warn('SW: fetch falló para:', url);
          });
        return cachedResponse || fetchPromise;
      })
    )
  );
});

// ─── MENSAJES ─────────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('⏩ SW: forzando skipWaiting');
    self.skipWaiting();
  }

  if (event.data?.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: CACHE_NAME });
  }
});
