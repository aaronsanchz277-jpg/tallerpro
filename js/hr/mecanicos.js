// ─── MOD-2: MECÁNICOS POR REPARACIÓN (multi-asignación con horas) ───────────

async function repMecanicos_cargar(repId) {
  const { data } = await sb.from('reparacion_mecanicos').select('*').eq('reparacion_id', repId);
  return data || [];
}

function repMecanicos_renderChips(mecanicos) {
  if (!mecanicos || mecanicos.length === 0) return '<span style="font-size:.8rem;color:var(--text2)">Sin mecánicos asignados</span>';
  return mecanicos.map(m => `
    <div style="display:inline-flex;align-items:center;gap:.35rem;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:.25rem .6rem .25rem .4rem;font-size:.78rem;margin:.15rem">
      <div style="width:22px;height:22px;border-radius:50%;background:rgba(0,229,255,.15);display:flex;align-items:center;justify-content:center;font-size:.6rem;color:var(--accent);font-weight:700">${h(m.nombre_mecanico||'?').charAt(0)}</div>
      <span>${h(m.nombre_mecanico||'?')}</span>
      <span style="color:var(--text2)">${m.horas||0}h</span>
      ${m.pago ? `<span style="color:var(--success)">₲${gs(m.pago)}</span>` : ''}
    </div>`).join('');
}

async function repMecanicos_modal(repId) {
  const [mecanicos, { data: perfilesEmps }, { data: empleadosManuales }] = await Promise.all([
    repMecanicos_cargar(repId),
    sb.from('perfiles').select('id,nombre').eq('taller_id', tid()).in('rol', ['admin','empleado']).order('nombre'),
    sb.from('empleados').select('id,nombre').eq('taller_id', tid()).order('nombre')
  ]);

  // Construir lista única de empleados disponibles (priorizando perfiles)
  const todosMap = new Map();
  
  // Agregar perfiles primero (tienen prioridad)
  (perfilesEmps || []).forEach(e => {
    if (e.id && e.nombre) {
      todosMap.set(e.id, { id: e.id, nombre: e.nombre.trim() || 'Sin nombre', source: 'perfil' });
    }
  });
  
  // Agregar empleados manuales solo si su ID no está ya en el mapa
  (empleadosManuales || []).forEach(e => {
    if (e.id && !todosMap.has(e.id)) {
      todosMap.set(e.id, { id: e.id, nombre: e.nombre?.trim() || 'Sin nombre', source: 'empleado' });
    }
  });

  // Asegurar que el usuario actual (si es empleado) esté disponible para asignarse a sí mismo
  if (currentPerfil?.rol === 'empleado' && currentUser?.id) {
    if (!todosMap.has(currentUser.id)) {
      todosMap.set(currentUser.id, {
        id: currentUser.id,
        nombre: currentPerfil.nombre || 'Yo (usuario actual)',
        source: 'perfil'
      });
    }
  }
  
  const todos = Array.from(todosMap.values());
  
  // IDs de mecánicos ya asignados
  const asignadosIds = mecanicos.map(m => m.mecanico_id || m.empleado_id).filter(Boolean);

  openModal(`
    <div class="modal-title">Mecánicos asignados</div>
    <div id="mec-chips" style="margin-bottom:1rem;display:flex;flex-direction:column;gap:.4rem">
      ${mecanicos.map(m => `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:.5rem .65rem">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.35rem">
            <span style="font-size:.85rem;font-weight:500">${h(m.nombre_mecanico||'Sin nombre')}</span>
            <button onclick="repMecanicos_quitarConSafeCall('${m.id}','${repId}')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.8rem;padding:0">✕</button>
          </div>
          <div style="display:flex;gap:.4rem;align-items:center">
            <div style="flex:1">
              <div style="font-size:.6rem;color:var(--text2);margin-bottom:2px">HORAS</div>
              <input type="number" value="${m.horas||0}" min="0" step="0.5" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:3px 6px;color:var(--text);font-size:.8rem;text-align:center" onchange="repMecanicos_actualizarConSafeCall('${m.id}','horas',this.value,'${repId}')">
            </div>
            <div style="flex:1">
              <div style="font-size:.6rem;color:var(--text2);margin-bottom:2px">PAGO ₲</div>
              <input type="number" value="${m.pago||0}" min="0" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:3px 6px;color:var(--success);font-size:.8rem;text-align:center" onchange="repMecanicos_actualizarConSafeCall('${m.id}','pago',this.value,'${repId}')">
            </div>
          </div>
        </div>`).join('')}
      ${mecanicos.length > 0 ? `<div style="text-align:right;font-size:.75rem;color:var(--text2);padding-top:.2rem">Total pagos: <strong style="color:var(--success)">₲${gs(mecanicos.reduce((s,m)=>s+parseFloat(m.pago||0),0))}</strong></div>` : ''}
    </div>
    <div style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1px;margin-bottom:.4rem">AGREGAR MECÁNICO</div>
    <div style="display:flex;gap:.4rem">
      <select class="form-input" id="f-mec-add" style="flex:1">
        <option value="">Seleccionar...</option>
        ${todos.filter(e => !asignadosIds.includes(e.id)).map(e => `<option value="${e.id}" data-source="${e.source}">${h(e.nombre)}${e.source==='empleado'?' (manual)':''}</option>`).join('')}
      </select>
      <button onclick="repMecanicos_agregarConSafeCall('${repId}')" class="btn-add" style="font-size:.8rem;padding:.4rem .8rem">+</button>
    </div>
    <button class="btn-secondary" style="margin-top:1rem" onclick="closeModal();detalleReparacion('${repId}')">Listo</button>`);
}

async function repMecanicos_agregarConSafeCall(repId) {
  await safeCall(async () => {
    await repMecanicos_agregar(repId);
  }, null, 'No se pudo agregar el mecánico');
}

async function repMecanicos_agregar(repId) {
  const sel = document.getElementById('f-mec-add');
  if (!sel || !sel.value) {
    toast('Seleccioná un mecánico', 'error');
    return;
  }

  const mecId = sel.value;
  const selectedOption = sel.options[sel.selectedIndex];
  const source = selectedOption?.dataset?.source || 'perfil';
  const nombre = selectedOption?.textContent?.replace(' (manual)', '').replace(' (usuario actual)', '').trim() || 'Sin nombre';

  // Verificar si ya está asignado (doble check)
  const { data: existente } = await sb
    .from('reparacion_mecanicos')
    .select('id')
    .eq('reparacion_id', repId)
    .or(`mecanico_id.eq.${mecId},empleado_id.eq.${mecId}`)
    .maybeSingle();

  if (existente) {
    toast('Este mecánico ya está asignado a este trabajo', 'error');
    return;
  }

  const insertData = {
    reparacion_id: repId,
    nombre_mecanico: nombre,
    horas: 0,
    pago: 0
  };

  if (source === 'perfil') {
    insertData.mecanico_id = mecId;
  } else {
    insertData.empleado_id = mecId;
  }

  console.log('Intentando agregar mecánico:', insertData);

  const { error } = await sb.from('reparacion_mecanicos').insert(insertData);

  if (error) {
    console.error('Error al agregar mecánico:', error);
    if (error.message.includes('duplicate')) {
      toast('Este mecánico ya está asignado a este trabajo', 'error');
    } else if (error.code === '42501' || error.message.includes('permission')) {
      toast('No tenés permiso para asignar mecánicos. Verificá tu rol.', 'error');
    } else if (error.message.includes('violates row-level security')) {
      toast('Error de seguridad: contactá al administrador para revisar permisos.', 'error');
    } else {
      toast('Error al agregar: ' + error.message, 'error');
    }
    return;
  }

  toast('Mecánico asignado', 'success');
  repMecanicos_modal(repId);
}

async function repMecanicos_quitarConSafeCall(id, repId) {
  await safeCall(async () => {
    await repMecanicos_quitar(id, repId);
  }, null, 'No se pudo quitar el mecánico');
}

async function repMecanicos_quitar(id, repId) {
  const { error } = await sb.from('reparacion_mecanicos').delete().eq('id', id);
  if (error) {
    console.error('Error al quitar mecánico:', error);
    toast('Error al quitar: ' + error.message, 'error');
    return;
  }
  toast('Mecánico removido', 'success');
  repMecanicos_modal(repId);
}

async function repMecanicos_actualizarConSafeCall(id, campo, valor, repId) {
  await safeCall(async () => {
    await repMecanicos_actualizar(id, campo, valor);
    repMecanicos_modal(repId);
  }, null, 'No se pudo actualizar');
}

async function repMecanicos_actualizar(id, campo, valor) {
  const update = {};
  update[campo] = campo === 'horas' || campo === 'pago' ? parseFloat(valor) || 0 : valor;
  
  const { error } = await sb.from('reparacion_mecanicos').update(update).eq('id', id);
  if (error) {
    console.error('Error al actualizar mecánico:', error);
    toast('Error al actualizar: ' + error.message, 'error');
  }
}
