// ─── SERVICE WORKER - TallerPro ───────────────────────────────────────────────
// Incrementar en cada deploy para invalidar caché viejo.
// IMPORTANTE: si no se bumpea esta versión, los usuarios no ven los cambios
// (network-first revalida JS/CSS, pero el toast "Hay una versión nueva" solo
// se dispara cuando el SW se reinstala — y eso requiere que cambie este string).
const CACHE_NAME = 'tallerpro-v8';

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
  // NO llamar self.skipWaiting() acá. Queremos que el SW nuevo quede en estado
  // "waiting" hasta que el usuario toque "ACTUALIZAR" en el toast (Tarea #64).
  // El skipWaiting se dispara desde el handler de mensaje { type: 'SKIP_WAITING' }
  // de abajo, que el cliente envía cuando el usuario confirma.
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS))
  );
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// ─── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Dejar pasar APIs externas sin interceptar
  if (shouldBypass(url)) return;

  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  // Detectar tipo por pathname para evitar falsos positivos
  // (p.ej. ".js" en query strings, o ".json" matcheando ".js")
  let pathname = '';
  try { pathname = new URL(url).pathname; } catch { return; }

  // Toda navegación (incluye URLs sin extensión tipo /algo) cae al app-shell.
  // Esto cubre rutas SPA y el caso "abro un link nuevo offline".
  const isNavigation =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  const isJS   = pathname.endsWith('.js');
  const isCSS  = pathname.endsWith('.css');
  const isHTML = isNavigation || pathname.endsWith('.html') || pathname.endsWith('/');

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
        .catch(() => caches.match(event.request))
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
        .catch(async () => {
          // Para navegaciones SPA a rutas no cacheadas, devolver siempre el
          // app-shell para que la app pueda arrancar y resolver la ruta.
          if (isNavigation) {
            const shell = await caches.match('./index.html');
            if (shell) return shell;
          }
          const cached = await caches.match(event.request);
          return cached || caches.match('./index.html');
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
          .catch(() => null);
        return cachedResponse || fetchPromise;
      })
    )
  );
});

// ─── MENSAJES ─────────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: CACHE_NAME });
  }
});
