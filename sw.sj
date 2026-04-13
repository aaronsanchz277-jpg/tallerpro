// Service Worker para TallerPro
const CACHE_NAME = 'tallerpro-v2';
const urlsToCache = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.json',
  './js/config.js',
  './js/auth.js',
  './js/ui.js',
  './js/navigation.js',
  './js/offline.js',
  './js/i18n.js',
  './js/pwa.js',
  './js/push.js',
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
  './js/sueldos.js',
  './js/ubicaciones.js',
  './js/tests.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});
