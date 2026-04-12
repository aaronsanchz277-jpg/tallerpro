// ============================================
// MEJORA #5 – UBICACIONES JERÁRQUICAS
// Permite organizar el inventario en ubicaciones físicas
// (Ej: Estante A → Balda 2 → Caja 3)
// ============================================

// Cargar ubicaciones en un <select> de forma jerárquica (sin recursión infinita)
async function cargarUbicaciones(selectId, valorActual = null) {
  try {
    const { data: todas } = await sb.from('ubicaciones')
      .select('id,nombre,padre_id')
      .eq('taller_id', tid())
      .order('nombre');

    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Sin ubicación</option>';
    if (!todas || todas.length === 0) return;

    // Construir árbol en memoria
    const hijosPorPadre = {};
    todas.forEach(u => {
      const key = u.padre_id || 'null';
      if (!hijosPorPadre[key]) hijosPorPadre[key] = [];
      hijosPorPadre[key].push(u);
    });

    function agregarOpciones(padreId, nivel = 0) {
      const hijos = hijosPorPadre[padreId === null ? 'null' : padreId] || [];
      hijos.forEach(h => {
        const option = document.createElement('option');
        option.value = h.id;
        option.textContent = '　'.repeat(nivel) + h.nombre;
        if (valorActual === h.id) option.selected = true;
        sel.appendChild(option);
        agregarOpciones(h.id, nivel + 1);
      });
    }

    agregarOpciones(null);
  } catch (e) {
    console.warn('Error cargando ubicaciones:', e);
  }
}

// Modal para gestionar ubicaciones (solo admin)
async function modalGestionarUbicaciones() {
  const { data: todas } = await sb.from('ubicaciones')
    .select('*')
    .eq('taller_id', tid())
    .order('nombre');

  // Construir árbol visual
  const hijosPorPadre = {};
  (todas || []).forEach(u => {
    const key = u.padre_id || 'null';
    if (!hijosPorPadre[key]) hijosPorPadre[key] = [];
    hijosPorPadre[key].push(u);
  });

  function renderArbol(padreId, nivel = 0) {
    const hijos = hijosPorPadre[padreId === null ? 'null' : padreId] || [];
    if (hijos.length === 0) return '';
    return hijos.map(u => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.4rem 0 .4rem ${nivel * 1.5}rem;border-bottom:1px solid var(--border)">
        <span style="font-size:.85rem">${'📁'.repeat(nivel > 0 ? 0 : 1)}${nivel > 0 ? '📄' : ''} ${escapeHtml(u.nombre)}</span>
        <button onclick="eliminarUbicacion('${u.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.75rem">✕</button>
      </div>
      ${renderArbol(u.id, nivel + 1)}
    `).join('');
  }

  openModal(`
    <div class="modal-title">📍 Gestionar Ubicaciones</div>
    <div style="margin-bottom:1rem;max-height:300px;overflow-y:auto">
      ${(todas || []).length === 0 ? '<div style="font-size:.82rem;color:var(--text2);padding:.5rem 0">No hay ubicaciones. Creá una para organizar tu inventario.</div>' : renderArbol(null)}
    </div>
    <div style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1px;margin-bottom:.4rem">AGREGAR UBICACIÓN</div>
    <div class="form-group">
      <label class="form-label">Nombre</label>
      <input class="form-input" id="f-ubi-nombre" placeholder="Estante A, Depósito 2...">
    </div>
    <div class="form-group">
      <label class="form-label">Dentro de (opcional)</label>
      <select class="form-input" id="f-ubi-padre">
        <option value="">Raíz (nivel principal)</option>
        ${(todas || []).map(u => `<option value="${u.id}">${'　'.repeat(u.nivel || 0)}${escapeHtml(u.nombre)}</option>`).join('')}
      </select>
    </div>
    <button class="btn-primary" onclick="guardarUbicacion()">Agregar</button>
    <button class="btn-secondary" onclick="closeModal()">Cerrar</button>
  `);
}

async function guardarUbicacion() {
  const nombre = document.getElementById('f-ubi-nombre').value.trim();
  if (!nombre) {
    toast('El nombre es obligatorio', 'error');
    return;
  }
  const padreId = document.getElementById('f-ubi-padre').value || null;
  const { error } = await sb.from('ubicaciones').insert({
    nombre,
    padre_id: padreId,
    taller_id: tid()
  });
  if (error) {
    toast('Error: ' + error.message, 'error');
    return;
  }
  toast('Ubicación creada', 'success');
  modalGestionarUbicaciones(); // recargar modal
}

async function eliminarUbicacion(id) {
  confirmar('¿Eliminar esta ubicación? También se eliminarán sus sub-ubicaciones.', async () => {
    const { error } = await sb.from('ubicaciones').delete().eq('id', id);
    if (error) {
      toast('Error: ' + error.message, 'error');
      return;
    }
    toast('Ubicación eliminada', 'success');
    modalGestionarUbicaciones();
  });
}

// Exponer funciones globales
window.cargarUbicaciones = cargarUbicaciones;
window.modalGestionarUbicaciones = modalGestionarUbicaciones;
window.guardarUbicacion = guardarUbicacion;
window.eliminarUbicacion = eliminarUbicacion;
