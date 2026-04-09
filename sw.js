// ═══════════════════════════════════════════════════════════════
//  TallerPro Service Worker — Offline + Background Sync
//  v3.0 — Modular (35 archivos JS + CSS)
// ═══════════════════════════════════════════════════════════════
const CACHE_NAME = 'tallerpro-v3.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/config.js',
  './js/pwa.js',
  './js/offline.js',
  './js/i18n.js',
  './js/ui.js',
  './js/navigation.js',
  './js/ia.js',
  './js/push.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/clientes.js',
  './js/vehiculos.js',
  './js/reparaciones.js',
  './js/inventario.js',
  './js/creditos.js',
  './js/empleados.js',
  './js/facturacion.js',
  './js/usuarios.js',
  './js/cliente-view.js',
  './js/mantenimientos.js',
  './js/agenda.js',
  './js/plan.js',
  './js/admin.js',
  './js/finanzas.js',
  './js/mecanicos.js',
  './js/barcode.js',
  './js/caja.js',
  './js/cuentas.js',
  './js/perfil.js',
  './js/presupuestos.js',
  './js/quickservice.js',
  './js/ventas.js',
  './js/gastos.js',
  './js/kanban.js',
  './js/tests.js',
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.min.js'
];

// ─── INSTALL: Cache static assets ────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE: Clean old caches ──────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── FETCH: Network first, fallback to cache ─────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (POST/PATCH/DELETE go to network only)
  if (event.request.method !== 'GET') return;

  // For Supabase API calls: network first, cache as fallback
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            return new Response(JSON.stringify([]), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // For static assets & pages: cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// ─── BACKGROUND SYNC: Process queued offline operations ──────
self.addEventListener('sync', event => {
  if (event.tag === 'tallerpro-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_REQUESTED' }));
      })
    );
  }
});

// ─── MESSAGE: Handle messages from main thread ───────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
