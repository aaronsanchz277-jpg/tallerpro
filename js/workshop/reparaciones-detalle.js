// ─── DETALLE DE REPARACIÓN ───────────────────────────────────────────────────
import { TIPO_ICONS } from './reparaciones-core.js';
import { cargarItemsReparacion, renderItemsReparacion } from './reparaciones-items.js';
import { repMecanicos_cargar, repMecanicos_renderChips } from './mecanicos.js';

export async function detalleReparacion(id) {
  // ... contenido original ...
}

export async function cambiarEstado(id, estado) {
  // ... contenido original ...
}

export function aprobarPresupuestoCliente(repId, decision) {
  // ... contenido original ...
}

export function enviarAprobacionWhatsApp(repId) {
  // ... contenido original ...
}

export function modalActualizarCosto(id, costoActual, repuestosActual) {
  // ... contenido original ...
}

export async function guardarActualizarCosto(id) {
  // ... contenido original ...
}
