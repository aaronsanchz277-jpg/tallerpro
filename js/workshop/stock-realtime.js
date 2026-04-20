// ─── NOTIFICACIONES DE STOCK BAJO EN TIEMPO REAL ────────────────────────────
// Se suscribe a cambios en inventario y muestra toast/push cuando el stock baja del mínimo.

let _stockRealtimeChannel = null;
const _stockNotificadosCache = {};

function stockRealtime_init() {
  if (_stockRealtimeChannel) return;
  if (!tid() || !currentUser) return;

  _stockRealtimeChannel = sb.channel(`stock-${tid()}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'inventario',
      filter: `taller_id=eq.${tid()}`
    }, (payload) => {
      stockRealtime_verificarBajo(payload.new);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('📦 Stock Realtime conectado');
    });
}

function stockRealtime_verificarBajo(item) {
  if (!item) return;

  const cantidad = parseFloat(item.cantidad) || 0;
  const minimo = parseFloat(item.stock_minimo) || 5;

  if (cantidad <= minimo) {
    const now = Date.now();
    const lastNotif = _stockNotificadosCache[item.id];
    if (lastNotif && (now - lastNotif) < 30000) return;

    _stockNotificadosCache[item.id] = now;

    const mensaje = `⚠️ Stock bajo: ${item.nombre} (${cantidad} ${item.unidad || 'unid.'})`;
    if (typeof toast === 'function') toast(mensaje, 'warning', 5000);

    if (typeof pushNotify === 'function' && Notification.permission === 'granted') {
      pushNotify('Stock bajo', mensaje, 'stock-bajo-' + item.id, () => {
        if (typeof navigate === 'function') navigate('inventario');
      });
    }
  }
}

// Enganche seguro con realtime_init (si existe)
(function() {
  if (typeof realtime_init === 'function') {
    const originalRealtimeInit = realtime_init;
    realtime_init = function() {
      originalRealtimeInit();
      stockRealtime_init();
    };
  } else {
    // Si realtime_init no existe aún, esperar a que el canal de Supabase esté disponible
    console.warn('realtime_init no definido, stock-realtime se inicializará bajo demanda');
    // Intentar inicializar cuando haya usuario
    const checkInterval = setInterval(() => {
      if (typeof sb !== 'undefined' && tid() && currentUser) {
        stockRealtime_init();
        clearInterval(checkInterval);
      }
    }, 1000);
  }
})();
