// ─── MOD-2: MECÁNICOS POR REPARACIÓN (VERSIÓN COMERCIAL) ─────────────────────
async function repMecanicos_cargar(repId) {
  const { data } = await sb.from('reparacion_mecanicos')
    .select('*, empleados(nombre)')
    .eq('reparacion_id', repId);
  return data || [];
}

function repMecanicos_renderChips(mecanicos) {
  if (!mecanicos || mecanicos.length === 0) return '<span style="font-size:.8rem;color:var(--text2)">Sin mecánicos asignados</span>';
  return mecanicos.map(m => `
    <div style="display:inline-flex;align-items:center;gap:.35rem;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:.25rem .6rem .25rem .4rem;font-size:.78rem;margin:.15rem">
      <div style="width:22px;height:22px;border-radius:50%;background:rgba(0,229,255,.15);display:flex;align-items:center;justify-content:center;font-size:.6rem;color:var(--accent);font-weight:700">${h(m.empleados?.nombre || '?').charAt(0)}</div>
      <span>${h(m.empleados?.nombre || '?')}</span>
      <span style="color:var(--text2)">${m.horas||0}h</span>
      ${m.pago ? `<span style="color:var(--success)">₲${gs(m.pago)}</span>` : ''}
    </div>`).join('');
}

async function repMecanicos_modal(repId) {
  const [mecanicos, { data: empleados }] = await Promise.all([
    repMecanicos_cargar(repId),
    sb.from('empleados').select('id,nombre').eq('taller_id', tid()).order('nombre')
  ]);

  const asignadosIds = mecanicos.map(m => m.empleado_id).filter(Boolean);

  openModal(`
    <div class="modal-title">Mecánicos asignados</div>
    <div id="mec-chips" style="margin-bottom:1rem;display:flex;flex-direction:column;gap:.4rem">
      ${mecanicos.map(m => `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:.5rem .65rem">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.35rem">
            <span style="font-size:.85rem;font-weight:500">${h(m.empleados?.nombre||'Sin nombre')}</span>
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
        ${(empleados||[]).filter(e => !asignadosIds.includes(e.id)).map(e => `<option value="${e.id}">${h(e.nombre)}</option>`).join('')}
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

  const empleadoId = sel.value;

  const { data: existente } = await sb
    .from('reparacion_mecanicos')
    .select('id')
    .eq('reparacion_id', repId)
    .eq('empleado_id', empleadoId)
    .maybeSingle();

  if (existente) {
    toast('Este mecánico ya está asignado', 'error');
    return;
  }

  const { error } = await sb.from('reparacion_mecanicos').insert({
    reparacion_id: repId,
    empleado_id: empleadoId,
    horas: 0,
    pago: 0
  });

  if (error) {
    console.error('Error al agregar mecánico:', error);
    toast('Error al agregar: ' + error.message, 'error');
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
  await sb.from('reparacion_mecanicos').delete().eq('id', id);
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
  await sb.from('reparacion_mecanicos').update(update).eq('id', id);
}
