// ─── MODO DEBUG CENTRALIZADO ─────────────────────────────────────────────────
const DEBUG_MODE = localStorage.getItem('tallerpro_debug') === 'true';

function debug_log(mensaje, tipo = 'log', datos = null) {
  if (!DEBUG_MODE) return;
  const prefix = '[TallerPro]';
  switch (tipo) {
    case 'warn':
      console.warn(prefix, mensaje, datos || '');
      break;
    case 'error':
      console.error(prefix, mensaje, datos || '');
      break;
    default:
      console.log(prefix, mensaje, datos || '');
  }
}

function debug_toggle() {
  const nuevoEstado = !DEBUG_MODE;
  localStorage.setItem('tallerpro_debug', nuevoEstado);
  toast(`Modo debug ${nuevoEstado ? 'activado' : 'desactivado'}`, 'info');
  // Recargar para aplicar
  setTimeout(() => window.location.reload(), 1000);
}

// Exponer globalmente para usar en consola
window.debug_toggle = debug_toggle;
