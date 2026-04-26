// ─── REALTIME (Sincronización multi-dispositivo) ────────────────────────────
let _realtimeChannel = null;

function _realtimeBadgeShow(text) {
  let el = document.getElementById('realtime-badge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'realtime-badge';
    el.style.cssText = 'position:fixed;top:12px;right:12px;background:var(--surface2);color:var(--accent);border:1px solid var(--accent);border-radius:20px;padding:6px 12px;font-size:.72rem;font-family:var(--font-head);font-weight:600;z-index:998;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.25);transition:opacity .2s;opacity:0';
    el.onclick = () => {
      el.remove();
      if (typeof navigate === 'function' && currentPage) navigate(currentPage);
    };
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
  }
  el.textContent = '↻ ' + text;
}

function _realtimeBadgeHide() {
  const el = document.getElementById('realtime-badge');
  if (el) el.remove();
}

function realtime_init() {
  if (_realtimeChannel) return;
  if (!currentPerfil || !tid()) return;

  _realtimeChannel = sb.channel(`taller-${tid()}`);

  _realtimeChannel
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reparaciones', filter: `taller_id=eq.${tid()}` }, (payload) => {
      if (currentPage === 'reparaciones' || currentPage === 'panel-trabajo' || currentPage === 'modo-taller') {
        toast(`Nuevo trabajo: ${payload.new.descripcion}`, 'info');
        if (currentPage !== 'modo-taller') _realtimeBadgeShow('Tocá para actualizar');
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reparaciones', filter: `taller_id=eq.${tid()}` }, (payload) => {
      if (payload.new.estado === 'finalizado' && payload.old.estado !== 'finalizado') {
        toast(`Trabajo finalizado: ${payload.new.descripcion}`, 'success');
      }
      if (currentPage === 'reparaciones' || currentPage === 'panel-trabajo') {
        _realtimeBadgeShow('Tocá para actualizar');
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ventas', filter: `taller_id=eq.${tid()}` }, (payload) => {
      toast(`Venta registrada: ₲${gs(payload.new.total)}`, 'success');
    })
    .subscribe();
}

function realtime_desconectar() {
  if (_realtimeChannel) {
    try { _realtimeChannel.unsubscribe(); } catch (e) {}
    _realtimeChannel = null;
  }
  _realtimeBadgeHide();
}
