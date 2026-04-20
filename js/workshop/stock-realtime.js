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
    // Evitar notificaciones duplicadas en corto tiempo (30 segundos)
    const now = Date.now();
    const lastNotif = _stockNotificadosCache[item.id];
    if (lastNotif && (now - lastNotif) < 30000) return;

    _stockNotificadosCache[item.id] = now;

    const mensaje = `⚠️ Stock bajo: ${item.nombre} (${cantidad} ${item.unidad || 'unid.'})`;
    toast(mensaje, 'warning', 5000);

    // También push si está habilitado
    if (typeof pushNotify === 'function' && Notification.permission === 'granted') {
      pushNotify('Stock bajo', mensaje, 'stock-bajo-' + item.id, () => navigate('inventario'));
    }
  }
}

// Llamar a stockRealtime_init después de que realtime_init se ejecute
const originalRealtimeInit = realtime_init;
realtime_init = function() {
  originalRealtimeInit();
  stockRealtime_init();
};
