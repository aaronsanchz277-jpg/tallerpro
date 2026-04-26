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
    .subscribe();
}

function stockRealtime_desconectar() {
  if (_stockRealtimeChannel) {
    try { _stockRealtimeChannel.unsubscribe(); } catch (e) {}
    _stockRealtimeChannel = null;
  }
  // Limpiar cache de deduplicación
  for (const k in _stockNotificadosCache) delete _stockNotificadosCache[k];
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

// Inicialización: se dispara explícitamente desde showApp() y se desconecta
// desde logout(). No usamos polling ni monkey-patches sobre realtime_init.
