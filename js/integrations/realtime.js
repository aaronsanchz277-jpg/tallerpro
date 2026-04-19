// ─── SINCRONIZACIÓN EN TIEMPO REAL CON SUPABASE ────────────────────────────
let _realtimeChannels = [];

function suscribirRealtime() {
  if (!tid()) return;
  
  // Limpiar suscripciones anteriores
  _realtimeChannels.forEach(c => c.unsubscribe());
  _realtimeChannels = [];
  
  // Suscribir a cambios en reparaciones
  const repChannel = sb.channel(`reparaciones_${tid()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reparaciones', filter: `taller_id=eq.${tid()}` }, (payload) => {
      console.log('🔄 Cambio en reparaciones:', payload.eventType);
      if (currentPage === 'reparaciones' || currentPage === 'panel-trabajo' || (currentPage === 'dashboard' && _modoTallerActivo)) {
        navigate(currentPage);
      }
      // Mostrar notificación interna
      if (payload.eventType === 'UPDATE' && payload.new.estado === 'finalizado') {
        mostrarNotificacion('✅ Trabajo finalizado', `${payload.new.descripcion} fue marcado como finalizado.`);
      }
    })
    .subscribe();
  _realtimeChannels.push(repChannel);
  
  // Suscribir a notificaciones
  const notifChannel = sb.channel(`notificaciones_${currentUser?.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${currentUser?.id}` }, (payload) => {
      mostrarNotificacion(payload.new.titulo, payload.new.mensaje);
    })
    .subscribe();
  _realtimeChannels.push(notifChannel);
}

function mostrarNotificacion(titulo, mensaje) {
  if (Notification.permission === 'granted') {
    pushNotify(titulo, mensaje);
  }
  // También mostrar un toast no invasivo
  toast(`🔔 ${titulo}`, 'info', 4000);
}

async function crearNotificacion(tipo, titulo, mensaje, usuarioId = null, referenciaId = null, referenciaTabla = null) {
  await sb.from('notificaciones').insert({
    taller_id: tid(),
    tipo,
    titulo,
    mensaje,
    usuario_id: usuarioId,
    referencia_id: referenciaId,
    referencia_tabla: referenciaTabla
  });
}

// Iniciar Realtime al cargar la app
if (typeof currentPerfil !== 'undefined') {
  suscribirRealtime();
}
