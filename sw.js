// Service Worker para TallerPro
const CACHE_NAME = 'tallerpro-v4'; // Nueva versión para forzar actualización limpia

// Rutas verificadas una por una contra la estructura real
const urlsToCache = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.json',

  // === Núcleo ===
  './js/core/config.js',
  './js/core/pwa.js',
  './js/core/offline.js',
  './js/core/i18n.js',
  './js/core/ui.js',
  './js/core/core.js',
  './js/core/components.js',
  './js/core/validators.js',
  './js/core/backup.js',
  './js/core/debug.js',

  // === Auth ===
  './js/auth/auth.js',
  './js/auth/plan.js',
  './js/auth/admin.js',

  // === Dashboard ===
  './js/dashboard/dashboard.js',
  './js/dashboard/simple-mode.js',
  './js/dashboard/modo-taller.js',

  // === CRM ===
  './js/crm/clientes.js',
  './js/crm/vehiculos.js',
  './js/crm/cliente-view.js',

  // === Workshop (Reparaciones modularizado) ===
  './js/workshop/reparaciones-core.js',
  './js/workshop/reparaciones-list.js',
  './js/workshop/reparaciones-detalle.js',
  './js/workshop/reparaciones-items.js',
  './js/workshop/reparaciones-pagos.js',
  './js/workshop/reparaciones-checklist.js',
  './js/workshop/reparaciones-fotos.js',
  './js/workshop/reparaciones-modales.js',
  './js/workshop/reparaciones-wizard.js',
  './js/workshop/reparaciones.js',

  // === Otros módulos de taller ===
  './js/workshop/inventario.js',
  './js/workshop/barcode.js',
  './js/workshop/agenda.js',
  './js/workshop/mantenimientos.js',
  './js/workshop/kanban.js',
  './js/workshop/checklist-templates.js',
  './js/workshop/stock-realtime.js',

  // === Finanzas ===
  './js/finances/finanzas.js',
  './js/finances/creditos.js',
  './js/finances/cuentas.js',
  './js/finances/gastos.js',
  './js/finances/caja.js',
  './js/finances/sueldos.js',
  './js/finances/Categorias.js',          // ← CORREGIDO: con mayúscula inicial
  './js/finances/conciliador.js',

  // === RRHH ===
  './js/hr/empleados.js',
  './js/hr/usuarios.js',
  './js/hr/mecanicos.js',
  './js/hr/perfil.js',

  // === Ventas ===
  './js/sales/ventas.js',
  './js/sales/presupuestos.js',

  // === Reportes ===
  './js/reports/common.js',
  './js/reports/rentabilidad.js',
  './js/reports/flujo-caja.js',
  './js/reports/comparativas.js',
  './js/reports/tendencias.js',
  './js/reports/export-excel.js',

  // === Integraciones ===
  './js/integrations/ia.js',
  './js/integrations/push.js',
  './js/integrations/ocr.js',
  './js/integrations/google-calendar.js',
  './js/integrations/recordatorios.js',
  './js/integrations/realtime.js',
  './js/integrations/integrations-wizard.js',

  // === Navegación ===
  './js/navigation/navigation.js',

  // === UX ===
  './js/ux/theme.js',
  './js/ux/optimize-images.js',
  './js/ux/ubicaciones.js',
  './js/ux/form-guard.js',

  // === Dev ===
  './js/dev/tests.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('📦 Instalando Service Worker...');
      const resultados = { exitos: 0, fallos: 0, fallosDetalle: [] };

      for (const url of urlsToCache) {
        try {
          await cache.add(url);
          resultados.exitos++;
        } catch (err) {
          resultados.fallos++;
          resultados.fallosDetalle.push({ url, error: err.message });
          console.error(`❌ Falló cacheo: ${url} — ${err.message}`);
        }
      }

      console.log(`✅ Instalación completada: ${resultados.exitos} recursos cacheados.`);
      if (resultados.fallos > 0) {
        console.warn(`⚠️ ${resultados.fallos} recursos no se pudieron cachear.`);
        console.table(resultados.fallosDetalle);
      }
    })
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
  // Tomar control inmediato de los clientes
  event.waitUntil(clients.claim());
});
