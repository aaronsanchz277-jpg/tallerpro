// ─── REALTIME (Sincronización multi-dispositivo) ────────────────────────────
let _realtimeChannel = null;

function realtime_init() {
  if (_realtimeChannel) return;
  if (!currentPerfil || !tid()) {
    console.warn('Realtime: Usuario no autenticado o sin taller.');
    return;
  }
  
  _realtimeChannel = sb.channel(`taller-${tid()}`);
  
  _realtimeChannel
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reparaciones', filter: `taller_id=eq.${tid()}` }, (payload) => {
      if (currentPage === 'reparaciones' || currentPage === 'panel-trabajo' || currentPage === 'modo-taller') {
        toast(`Nuevo trabajo: ${payload.new.descripcion}`, 'info');
        if (currentPage !== 'modo-taller') navigate(currentPage);
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reparaciones', filter: `taller_id=eq.${tid()}` }, (payload) => {
      if (payload.new.estado === 'finalizado' && payload.old.estado !== 'finalizado') {
        toast(`Trabajo finalizado: ${payload.new.descripcion}`, 'success');
      }
      if (currentPage === 'reparaciones' || currentPage === 'panel-trabajo') navigate(currentPage);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ventas', filter: `taller_id=eq.${tid()}` }, (payload) => {
      toast(`Venta registrada: ₲${gs(payload.new.total)}`, 'success');
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('Realtime conectado');
    });
}

function realtime_desconectar() {
  if (_realtimeChannel) {
    _realtimeChannel.unsubscribe();
    _realtimeChannel = null;
  }
}
