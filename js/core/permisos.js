// ─── PERMISOS DEL EMPLEADO Y CONTROL DE ACCESO ──────────────────────────────
// Helpers globales para chequear rol y permisos finos.
// Las claves del jsonb `permisos` (en perfiles) son:
//   ver_costos            → ver costos de repuestos en detalle de reparación
//   ver_ganancia          → ver ganancia neta del trabajo
//   registrar_cobros      → puede tocar el botón "Pagos" en reparación
//   anular_ventas         → puede eliminar/anular ventas
//   modificar_precios     → puede usar "Actualizar costos" en reparación
//   ver_historial_otros   → puede entrar al detalle de OTRO empleado

const PERMISOS_DEFAULT = {
  ver_costos: false,
  ver_ganancia: false,
  registrar_cobros: false,
  anular_ventas: false,
  modificar_precios: false,
  ver_historial_otros: false
};

const PERMISOS_LABELS = {
  ver_costos:          'Ver costos de repuestos',
  ver_ganancia:        'Ver ganancia neta del trabajo',
  registrar_cobros:    'Registrar cobros al cliente',
  anular_ventas:       'Anular ventas',
  modificar_precios:   'Modificar precios cobrados al cliente',
  ver_historial_otros: 'Ver historial de otros mecánicos'
};

function userPermisos() {
  const p = currentPerfil?.permisos;
  return { ...PERMISOS_DEFAULT, ...(p && typeof p === 'object' ? p : {}) };
}

function esAdmin()    { return currentPerfil?.rol === 'admin'; }
function esEmpleado() { return currentPerfil?.rol === 'empleado'; }
function esCliente()  { return currentPerfil?.rol === 'cliente'; }

// Admin siempre puede; empleado solo si tiene la casilla en true
function puedeVer(clave) {
  if (esAdmin()) return true;
  if (!esEmpleado()) return false;
  return userPermisos()[clave] === true;
}

// ¿Puede ver el detalle del empleado con id `empleadoId`?
// Admin: siempre. Empleado: solo el suyo, salvo permiso `ver_historial_otros`.
function puedoVerEmpleado(empleadoId) {
  if (esAdmin()) return true;
  if (!esEmpleado()) return false;
  if (currentPerfil?.empleado_id && currentPerfil.empleado_id === empleadoId) return true;
  return userPermisos().ver_historial_otros === true;
}

// Guardia para acciones que requieren admin. Devuelve true si puede seguir.
function requireAdmin(mensaje = 'No tenés permisos para esta acción') {
  if (esAdmin()) return true;
  if (typeof toast === 'function') toast(mensaje, 'error');
  return false;
}

// Guardia genérica por permiso (admin pasa siempre)
function requirePerm(clave, mensaje = 'No tenés permisos para esta acción') {
  if (puedeVer(clave)) return true;
  if (typeof toast === 'function') toast(mensaje, 'error');
  return false;
}

// Para mostrar/ocultar botones (no hace toast, solo devuelve bool)
function tienePerm(clave) { return puedeVer(clave); }

// Exponer en window para que sea accesible desde HTML inline
window.userPermisos        = userPermisos;
window.esAdmin             = esAdmin;
window.esEmpleado          = esEmpleado;
window.esCliente           = esCliente;
window.puedeVer            = puedeVer;
window.tienePerm           = tienePerm;
window.puedoVerEmpleado    = puedoVerEmpleado;
window.requireAdmin        = requireAdmin;
window.requirePerm         = requirePerm;
window.PERMISOS_DEFAULT    = PERMISOS_DEFAULT;
window.PERMISOS_LABELS     = PERMISOS_LABELS;
