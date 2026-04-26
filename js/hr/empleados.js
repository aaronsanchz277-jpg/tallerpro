// ─── EMPLEADOS ───────────────────────────────────────────────────────────────
async function empleados() {
  const { data } = await cachedQuery('empleados_list', () =>
    sb.from('empleados').select('*').eq('taller_id', tid()).order('nombre')
  );

  // Tarea #17: para mostrar el estado de vinculación por empleado, traemos
  // los perfiles de este taller que ya tienen empleado_id seteado. Solo
  // admin necesita esto.
  let perfilPorEmp = {};
  if (typeof esAdmin === 'function' && esAdmin()) {
    const { data: perfilesEmp } = await sb.from('perfiles')
      .select('id,nombre,empleado_id,rol')
      .eq('taller_id', tid())
      .eq('rol', 'empleado')
      .not('empleado_id', 'is', null);
    (perfilesEmp || []).forEach(p => { perfilPorEmp[p.empleado_id] = p; });
  }

  const _esAdminLista = (typeof esAdmin === 'function') && esAdmin();

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('empTitulo')}</div>
      <button class="btn-add" onclick="modalNuevoEmpleado()">${t('empNuevo')}</button>
    </div>
    ${(data || []).length === 0 ? `<div class="empty"><p>${t('empSinDatos')}</p></div>` :
      (data || []).map(e => {
        const vinculado = perfilPorEmp[e.id];
        const badgeVinculo = _esAdminLista
          ? (vinculado
              ? `<span style="font-size:.62rem;background:rgba(0,255,136,.1);color:var(--success);border:1px solid rgba(0,255,136,.25);border-radius:6px;padding:2px 6px;font-family:var(--font-head)">🔗 Vinculado</span>`
              : `<span style="font-size:.62rem;background:rgba(255,204,0,.1);color:var(--warning);border:1px solid rgba(255,204,0,.25);border-radius:6px;padding:2px 6px;font-family:var(--font-head)">Sin usuario</span>`)
          : '';
        const btnInvitar = (_esAdminLista && !vinculado)
          ? `<button onclick="event.stopPropagation();modalInvitarUsuario('${e.id}')" style="font-size:.65rem;background:rgba(255,107,53,.12);color:var(--accent2);border:1px solid rgba(255,107,53,.3);border-radius:6px;padding:3px 8px;cursor:pointer;font-family:var(--font-head);margin-right:.4rem">📨 Invitar</button>`
          : '';
        return `
      <div class="card" onclick="detalleEmpleado('${e.id}')">
        <div class="card-header">
          <div class="card-avatar" style="overflow:hidden;padding:0">
            ${e.foto_url ? `<img src="${safeFotoUrl(e.foto_url)}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:1.3rem">${h(e.nombre).charAt(0).toUpperCase()}</span>`}
          </div>
          <div class="card-info">
            <div class="card-name">${h(e.nombre)} ${badgeVinculo}</div>
            <div class="card-sub">${e.rol || t('sinRol')} · ${h(e.telefono || t('cliSinTel'))}</div>
          </div>
          ${btnInvitar}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text2)"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>`;
      }).join('')}`;
}

async function detalleEmpleado(id) {
  // Guardia: solo admin o el propio empleado mirándose a sí mismo.
  if (typeof puedoVerEmpleado === 'function' && !puedoVerEmpleado(id)) {
    toast('No autorizado', 'error');
    navigate('dashboard');
    return;
  }
  let emp, trabajosManuales;
  try {
    const empRes = await sb.from('empleados').select('*').eq('id', id).single();
    emp = empRes.data;
    if (!emp) throw new Error('Empleado no encontrado');

    const manualesRes = await sb.from('trabajos_empleado')
      .select('*, vehiculos(patente,marca,modelo)')
      .eq('empleado_id', id)
      .order('fecha', { ascending: false })
      .limit(50);
    trabajosManuales = manualesRes.data || [];

  } catch (e) {
    toast('Error al cargar empleado', 'error');
    navigate('empleados');
    return;
  }

  // ─── VALES AGRUPADOS POR PERÍODO ─────────────────────────────────────────
  const { data: periodos } = await sb.from('periodos_sueldo')
    .select('id, fecha_inicio, fecha_fin, estado')
    .eq('taller_id', tid())
    .order('fecha_inicio', { ascending: false })
    .limit(12);

  const periodosMap = {};
  periodos?.forEach(p => { periodosMap[p.id] = p; });

  const { data: valesTodos } = await sb.from('vales_empleado')
    .select('*, periodo_id')
    .eq('empleado_id', id)
    .order('fecha', { ascending: false })
    .limit(200);

  // Agrupar vales por periodo_id
  const valesPorPeriodo = {};
  valesTodos?.forEach(v => {
    const pid = v.periodo_id || 'sin_periodo';
    if (!valesPorPeriodo[pid]) valesPorPeriodo[pid] = [];
    valesPorPeriodo[pid].push(v);
  });

  // Ordenar períodos del más reciente al más antiguo
  const periodosOrdenados = periodos?.sort((a,b) => b.fecha_inicio.localeCompare(a.fecha_inicio)) || [];

  // Calcular total de vales del MES ACTUAL (para el resumen de arriba)
  const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const ultimoDiaMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
  const totalValesMes = (valesTodos || [])
    .filter(v => v.fecha >= primerDiaMes && v.fecha <= ultimoDiaMes)
    .reduce((s, v) => s + parseFloat(v.monto || 0), 0);

  const sueldo = parseFloat(emp?.sueldo || 0);
  const neto = sueldo - totalValesMes;

  // Construir HTML de vales agrupados
  let valesHTML = '';
  if (periodosOrdenados.length === 0 && (!valesTodos || valesTodos.length === 0)) {
    valesHTML = '<p style="color:var(--text2);font-size:.85rem">No hay vales registrados</p>';
  } else {
    periodosOrdenados.forEach(p => {
      const valesDelPeriodo = valesPorPeriodo[p.id] || [];
      if (valesDelPeriodo.length === 0) return;

      const totalPeriodo = valesDelPeriodo.reduce((s, v) => s + parseFloat(v.monto || 0), 0);
      valesHTML += `
        <div style="margin-bottom:1rem; background:var(--surface); border-radius:10px; padding:.5rem; border:1px solid var(--border)">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:.5rem; padding:0 .3rem">
            <span style="font-family:var(--font-head); font-size:.8rem; color:var(--accent);">
              📅 ${formatFecha(p.fecha_inicio)} – ${formatFecha(p.fecha_fin)} ${p.estado === 'abierto' ? '(abierto)' : ''}
            </span>
            <span style="font-family:var(--font-head); color:var(--warning);">Total: ₲${gs(totalPeriodo)}</span>
          </div>
          ${valesDelPeriodo.map(v => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:.4rem .3rem; border-top:1px solid var(--border);">
              <div>
                <div style="font-size:.82rem;">${h(v.concepto || 'Vale')}</div>
                <div style="font-size:.68rem; color:var(--text2);">${formatFecha(v.fecha)}</div>
              </div>
              <div style="display:flex; align-items:center; gap:.4rem;">
                <span style="font-family:var(--font-head); color:var(--warning); font-size:.85rem;">-₲${gs(v.monto)}</span>
                <button onclick="eliminarVale('${v.id}','${id}')" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:.7rem;">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    });

    // Mostrar vales sin período asignado
    const valesSinPeriodo = valesPorPeriodo['sin_periodo'] || [];
    if (valesSinPeriodo.length > 0) {
      const totalSinPeriodo = valesSinPeriodo.reduce((s, v) => s + parseFloat(v.monto || 0), 0);
      valesHTML += `
        <div style="margin-bottom:1rem; background:var(--surface); border-radius:10px; padding:.5rem; border:1px dashed var(--danger);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:.5rem; padding:0 .3rem">
            <span style="font-family:var(--font-head); font-size:.8rem; color:var(--danger);">⚠️ Sin período asignado</span>
            <span style="font-family:var(--font-head); color:var(--warning);">Total: ₲${gs(totalSinPeriodo)}</span>
          </div>
          ${valesSinPeriodo.map(v => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:.4rem .3rem; border-top:1px solid var(--border);">
              <div>
                <div style="font-size:.82rem;">${h(v.concepto || 'Vale')}</div>
                <div style="font-size:.68rem; color:var(--text2);">${formatFecha(v.fecha)}</div>
              </div>
              <div style="display:flex; align-items:center; gap:.4rem;">
                <span style="font-family:var(--font-head); color:var(--warning); font-size:.85rem;">-₲${gs(v.monto)}</span>
                <button onclick="eliminarVale('${v.id}','${id}')" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:.7rem;">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  // Total horas (solo trabajos manuales)
  const totalHoras = (trabajosManuales || []).reduce((s, t) => s + parseFloat(t.horas || 0), 0);

  // ¿Quién está mirando? Determina qué se muestra:
  //  - admin: ve todo (sueldo, vales, resumen, botones)
  //  - el propio empleado: ve todo lo suyo
  //  - cualquier otro empleado: NO debería llegar acá (puedoVerEmpleado
  //    lo bloquea arriba) y RLS también bloquea el SELECT.
  const _esAdmin   = (typeof esAdmin === 'function') && esAdmin();
  const _esPropio  = currentPerfil?.empleado_id && currentPerfil.empleado_id === id;
  const verSensible = _esAdmin || _esPropio;

  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('empleados')">${t('volver')}</button>
      <div class="card-avatar" style="width:56px;height:56px;border-radius:12px;overflow:hidden;border:2px solid var(--accent);flex-shrink:0">
        ${emp.foto_url ? `<img src="${safeFotoUrl(emp.foto_url)}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-family:var(--font-head);font-size:1.6rem;font-weight:700;color:var(--accent)">${h(emp.nombre).charAt(0).toUpperCase()}</span>`}
      </div>
      <div><div class="detail-name">${h(emp.nombre)}</div><div class="detail-sub">${emp.rol || ''}</div></div>
    </div>
    <div class="info-grid">
      <div class="info-item"><div class="label">${t('cliTel')}</div><div class="value">${h(emp.telefono || '-')}</div></div>
      <div class="info-item"><div class="label">Total horas</div><div class="value" style="color:var(--accent)">${totalHoras.toFixed(1)} hs</div></div>
      ${verSensible && emp.sueldo ? `<div class="info-item"><div class="label">Sueldo</div><div class="value" style="color:var(--success)">₲${gs(emp.sueldo)}</div></div>` : ''}
    </div>

    ${verSensible ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1px;margin-bottom:.5rem">💵 RESUMEN DEL MES</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;margin-bottom:.5rem">
        <div style="background:var(--surface2);border-radius:8px;padding:.4rem;text-align:center">
          <div style="font-size:.55rem;color:var(--text2)">SUELDO</div>
          <div style="font-family:var(--font-head);font-size:.85rem;color:var(--success)">₲${gs(sueldo)}</div>
        </div>
        <div style="background:rgba(255,204,0,.08);border-radius:8px;padding:.4rem;text-align:center">
          <div style="font-size:.55rem;color:var(--warning)">VALES</div>
          <div style="font-family:var(--font-head);font-size:.85rem;color:var(--warning)">-₲${gs(totalValesMes)}</div>
        </div>
        <div style="background:${neto >= 0 ? 'rgba(0,255,136,.08)' : 'rgba(255,68,68,.08)'};border-radius:8px;padding:.4rem;text-align:center">
          <div style="font-size:.55rem;color:${neto >= 0 ? 'var(--success)' : 'var(--danger)'}">A COBRAR</div>
          <div style="font-family:var(--font-head);font-size:.85rem;color:${neto >= 0 ? 'var(--success)' : 'var(--danger)'}">₲${gs(neto)}</div>
        </div>
      </div>
    </div>

    ${valesHTML}
    ` : `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:.75rem;margin-bottom:1rem;font-size:.78rem;color:var(--text2)">
      🔒 La información de sueldo y vales solo la ve el dueño del taller o el propio empleado.
    </div>
    `}

    ${verSensible ? `
    <div style="display:flex;gap:.5rem;margin-bottom:.5rem">
      ${_esAdmin ? `<button class="btn-add" style="flex:1;justify-content:center" onclick="modalNuevoTrabajo('${id}')">+ Registrar trabajo</button>` : ''}
      ${_esAdmin ? `<button onclick="modalNuevoVale('${id}')" style="flex:1;background:rgba(255,204,0,.12);color:var(--warning);border:1px solid rgba(255,204,0,.3);border-radius:10px;padding:.5rem;font-family:var(--font-head);font-size:.8rem;cursor:pointer;text-align:center">+ Vale / Adelanto</button>` : ''}
    </div>` : ''}
    <div style="display:flex;gap:.5rem;margin-bottom:1.25rem">
      <button class="btn-secondary" style="margin:0;flex:1" onclick="reparaciones({filtro:'todos', mecanico:'${id}'})">
        🔧 Ver reparaciones asignadas
      </button>
      ${_esAdmin ? `<button class="btn-secondary" style="margin:0;flex:1" onclick="modalEditarEmpleado('${id}')">${t('editarBtn')}</button>` : ''}
      ${_esAdmin ? `<button class="btn-danger" style="margin:0" onclick="eliminarEmpleado('${id}')">✕</button>` : ''}
    </div>`;
}

// ─── FUNCIONES AUXILIARES (Vales, Modales, etc.) ────────────────────────────
async function eliminarVale(valeId, empleadoId) {
  if (typeof requireAdmin === 'function' && !requireAdmin()) return;
  confirmar('¿Eliminar este vale?', async () => {
    await safeCall(async () => {
      await sb.from('vales_empleado').delete().eq('id', valeId);
      clearCache('empleados');
      toast('Vale eliminado');
      detalleEmpleado(empleadoId);
    }, null, 'No se pudo eliminar el vale');
  });
}

async function eliminarEmpleado(id) {
  if (typeof requireAdmin === 'function' && !requireAdmin()) return;
  confirmar('Esta acción eliminará al empleado y sus registros.', async () => {
    await safeCall(async () => {
      await sb.from('trabajos_empleado').delete().eq('empleado_id', id);
      await offlineDelete('empleados', 'id', id);
      clearCache('empleados');
      toast('Empleado eliminado');
      navigate('empleados');
    }, null, 'No se pudo eliminar el empleado');
  });
}

async function modalNuevoTrabajo(empleadoId) {
  if (typeof requireAdmin === 'function' && !requireAdmin()) return;
  const vehiculoSelect = await renderVehiculoSelect('f-vehiculo', null, null, true);
  openModal(`
    <div class="modal-title">${t("modRegistrarTrabajo")}</div>
    <div class="form-group"><label class="form-label">${t("lblFecha")} *</label>${renderFechaInput('f-fecha')}</div>
    <div class="form-group"><label class="form-label">${t("lblVehiculo")}</label>${vehiculoSelect}</div>
    <div class="form-group"><label class="form-label">${t("lblTipoTrabajo")} *</label><input class="form-input" id="f-tipo" placeholder="Cambio de frenos, Alineación..."></div>
    <div class="form-group"><label class="form-label">${t("lblHoras")} trabajadas *</label><input class="form-input" id="f-horas" type="number" placeholder="2.5" min="0.5" step="0.5"></div>
    <div class="form-group"><label class="form-label">${t("lblComentario")}</label><textarea class="form-input" id="f-comentario" rows="2"></textarea></div>
    <div class="form-group">
      <label class="form-label">Foto del vehículo</label>
      <input type="file" id="f-foto-file" accept="image/*" capture="environment" class="form-input" style="padding:.4rem" onchange="previewFoto(this,'f-foto-b64','foto-prev')">
      <div id="foto-prev"></div>
      <input type="hidden" id="f-foto-b64">
    </div>
    <button class="btn-primary" onclick="guardarTrabajoConSafeCall('${empleadoId}')">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarTrabajoConSafeCall(empleadoId) {
  await safeCall(async () => {
    await guardarTrabajo(empleadoId);
  }, null, 'No se pudo registrar el trabajo');
}

async function guardarTrabajo(empleadoId) {
  const tipo = document.getElementById('f-tipo').value.trim();
  if (!validateRequired(tipo, 'Tipo de trabajo')) return;

  const horas = parseFloat(document.getElementById('f-horas').value);
  if (!validatePositiveNumber(horas, 'Horas trabajadas')) return;

  const vid = document.getElementById('f-vehiculo').value;
  const data = {
    empleado_id: empleadoId,
    vehiculo_id: vid || null,
    fecha: document.getElementById('f-fecha').value,
    tipo_trabajo: tipo,
    horas,
    comentario: document.getElementById('f-comentario').value || null,
    foto_vehiculo_url: document.getElementById('f-foto-b64').value || null
  };

  const { error } = await offlineInsert('trabajos_empleado', data);
  if (error) { toast('Error: ' + error.message, 'error'); return; }

  toast('Trabajo registrado', 'success');
  closeModal();
  detalleEmpleado(empleadoId);
}

async function eliminarTrabajo(trabajoId, empleadoId) {
  confirmar('¿Eliminar este registro de trabajo?', async () => {
    await safeCall(async () => {
      await offlineDelete('trabajos_empleado', 'id', trabajoId);
      toast('Registro eliminado');
      detalleEmpleado(empleadoId);
    }, null, 'No se pudo eliminar el trabajo');
  });
}

// ─── Utilidades para períodos ───────────────────────────────────────────────
function getLunesActual() {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0 = domingo
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dia === 0 ? 6 : dia - 1));
  // Ajuste de zona horaria: usar setUTCHours para evitar desplazamientos
  lunes.setUTCHours(0,0,0,0);
  return lunes.toISOString().split('T')[0];
}

function getDomingoActual() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const domingo = new Date(hoy);
  domingo.setDate(hoy.getDate() + (dia === 0 ? 0 : 7 - dia));
  domingo.setUTCHours(0,0,0,0);
  return domingo.toISOString().split('T')[0];
}

// Mostrar formulario de creación rápida de período
function mostrarFormNuevoPeriodo(empleadoId) {
  const form = document.getElementById('nuevo-periodo-form');
  if (form) {
    form.style.display = 'block';
    document.getElementById('np-inicio').value = getLunesActual();
    document.getElementById('np-fin').value = getDomingoActual();
  }
}

// Crear el período desde el modal y recargar
async function crearPeriodoDesdeModal(empleadoId) {
  const inicio = document.getElementById('np-inicio')?.value;
  const fin = document.getElementById('np-fin')?.value;
  if (!inicio || !fin) {
    toast('Las fechas son obligatorias', 'error');
    return;
  }
  
  await safeCall(async () => {
    const { data: nuevo, error } = await sb.from('periodos_sueldo')
      .insert({ 
        fecha_inicio: inicio, 
        fecha_fin: fin, 
        taller_id: tid(),
        estado: 'abierto'
      })
      .select('id')
      .single();
      
    if (error) throw new Error(error.message);
    
    toast('Período creado correctamente', 'success');
    closeModal();
    // Reabrir el modal de vale con el nuevo período seleccionado por defecto
    await modalNuevoVale(empleadoId, nuevo.id);
  }, null, 'No se pudo crear el período');
}

// Modal principal de vale (ahora recibe opcionalmente periodoSeleccionadoId)
async function modalNuevoVale(empleadoId, periodoSeleccionadoId = null) {
  if (typeof requireAdmin === 'function' && !requireAdmin()) return;
  const { data: periodos } = await sb.from('periodos_sueldo')
    .select('id, fecha_inicio, fecha_fin, estado')
    .eq('taller_id', tid())
    .order('fecha_inicio', { ascending: false })
    .limit(20);

  // Determinar cuál período dejar seleccionado por defecto
  let defaultSelected = periodoSeleccionadoId;
  if (!defaultSelected) {
    const periodoAbierto = periodos?.find(p => p.estado === 'abierto');
    defaultSelected = periodoAbierto?.id || periodos?.[0]?.id || '';
  }

  const opcionesPeriodos = (periodos || []).map(p => 
    `<option value="${p.id}" ${p.id === defaultSelected ? 'selected' : ''}>
      ${formatFecha(p.fecha_inicio)} – ${formatFecha(p.fecha_fin)} ${p.estado === 'abierto' ? '(abierto)' : ''}
    </option>`
  ).join('');

  openModal(`
    <div class="modal-title">💵 Registrar Vale / Adelanto</div>
    <div class="form-group">
      <label class="form-label">Período (semana) *</label>
      <div style="display:flex; gap:.4rem; align-items:center">
        <select class="form-input" id="f-vale-periodo" style="flex:1">
          <option value="">Seleccionar período...</option>
          ${opcionesPeriodos}
        </select>
        <button onclick="event.preventDefault(); mostrarFormNuevoPeriodo('${empleadoId}')" type="button" style="background:var(--accent); color:#000; border:none; border-radius:8px; padding:.45rem .8rem; font-size:.8rem; font-family:var(--font-head); cursor:pointer; white-space:nowrap">➕ Nueva semana</button>
      </div>
      ${periodos?.length === 0 ? '<div style="font-size:.7rem;color:var(--warning);margin-top:.3rem">No hay períodos creados. Creá uno con el botón "Nueva semana".</div>' : ''}
    </div>
    <div id="nuevo-periodo-form" style="display:none; margin-top:.5rem; background:var(--surface2); border-radius:10px; padding:.75rem; border:1px solid var(--border)">
      <div style="font-family:var(--font-head); font-size:.75rem; color:var(--accent); margin-bottom:.5rem;">📅 Crear nuevo período semanal</div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Inicio</label><input class="form-input" id="np-inicio" type="date" value="${getLunesActual()}"></div>
        <div class="form-group"><label class="form-label">Fin</label><input class="form-input" id="np-fin" type="date" value="${getDomingoActual()}"></div>
      </div>
      <div style="display:flex; gap:.4rem; margin-top:.5rem">
        <button onclick="event.preventDefault(); crearPeriodoDesdeModal('${empleadoId}')" class="btn-primary" style="margin:0; padding:.5rem; font-size:.8rem">Crear y seleccionar</button>
        <button onclick="event.preventDefault(); document.getElementById('nuevo-periodo-form').style.display='none'" class="btn-secondary" style="margin:0; padding:.5rem; font-size:.8rem">Cancelar</button>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Monto ₲ *</label>${renderMontoInput('f-vale-monto', '', '50000')}</div>
    <div class="form-group"><label class="form-label">Concepto</label><input class="form-input" id="f-vale-concepto" placeholder="Almuerzo, adelanto, etc."></div>
    <div class="form-group"><label class="form-label">Fecha</label>${renderFechaInput('f-vale-fecha')}</div>
    <button class="btn-primary" onclick="guardarValeConSafeCall('${empleadoId}')">Registrar vale</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
  `);
}

async function guardarValeConSafeCall(empleadoId) {
  await safeCall(async () => {
    await guardarVale(empleadoId);
  }, null, 'No se pudo registrar el vale');
}

async function guardarVale(empleadoId) {
  if (typeof requireAdmin === 'function' && !requireAdmin()) return;
  const monto = parseFloat(document.getElementById('f-vale-monto').value);
  if (!validatePositiveNumber(monto, 'Monto')) return;

  const concepto = document.getElementById('f-vale-concepto').value || 'Vale';
  const fecha = document.getElementById('f-vale-fecha').value;
  const periodoId = document.getElementById('f-vale-periodo')?.value || null;

  if (!periodoId) {
    toast('Debés seleccionar un período (semana)', 'error');
    return;
  }

  const { error } = await sb.from('vales_empleado').insert({
    empleado_id: empleadoId,
    monto,
    concepto,
    fecha,
    periodo_id: periodoId,
    taller_id: tid()
  });
  if (error) { toast('Error: ' + error.message, 'error'); return; }

  const { data: emp } = await sb.from('empleados').select('nombre').eq('id', empleadoId).single();
  const categoriaId = await obtenerCategoriaFinanciera('Vales/Adelantos', 'egreso');
  if (categoriaId) {
    await sb.from('movimientos_financieros').insert({
      taller_id: tid(),
      tipo: 'egreso',
      categoria_id: categoriaId,
      monto,
      concepto: 'Vale: ' + (emp?.nombre || '') + ' — ' + concepto,
      fecha
    });
  }

  clearCache('empleados');
  clearCache('finanzas');
  toast('Vale registrado', 'success');
  closeModal();
  detalleEmpleado(empleadoId);
}

function modalNuevoEmpleado() {
  openModal(`
    <div class="modal-title">${t("modNuevoEmpleado")}</div>
    <div class="form-group"><label class="form-label">Nombre *</label><input class="form-input" id="f-nombre" placeholder="Carlos Rodríguez"></div>
    <div class="form-group"><label class="form-label">Rol</label><input class="form-input" id="f-rol" placeholder="Mecánico, Electricista..."></div>
    <div class="form-group"><label class="form-label">Sueldo mensual ₲</label>${renderMontoInput('f-sueldo', '', '0')}</div>
    <div class="form-group"><label class="form-label">Teléfono</label>${phoneInput('f-tel', '', '0981 123 456')}</div>
    <button class="btn-primary" onclick="guardarEmpleadoConSafeCall()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarEmpleadoConSafeCall() {
  await safeCall(async () => {
    await guardarEmpleado();
  }, null, 'No se pudo guardar el empleado');
}

async function guardarEmpleado(id = null) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede crear o editar empleados')) return;
  const nombre = document.getElementById('f-nombre').value.trim();
  if (!validateRequired(nombre, 'Nombre')) return;

  const data = {
    nombre,
    rol: document.getElementById('f-rol').value,
    sueldo: parseFloat(document.getElementById('f-sueldo')?.value) || 0,
    telefono: document.getElementById('f-tel').value,
    taller_id: tid()
  };

  const { error } = id ? await offlineUpdate('empleados', data, 'id', id) : await offlineInsert('empleados', data);
  if (error) { toast('Error: ' + error.message, 'error'); return; }

  clearCache('empleados');
  toast(id ? 'Empleado actualizado' : 'Empleado guardado', 'success');
  closeModal();
  empleados();
}

async function modalEditarEmpleado(id) {
  if (typeof requireAdmin === 'function' && !requireAdmin()) return;
  const [{ data: e }, perfilRes] = await Promise.all([
    sb.from('empleados').select('*').eq('id', id).single(),
    sb.from('perfiles').select('id, nombre, permisos').eq('empleado_id', id).maybeSingle()
  ]);
  const perfilVinculado = perfilRes?.data || null;
  const permisos = (perfilVinculado?.permisos && typeof perfilVinculado.permisos === 'object')
    ? perfilVinculado.permisos
    : {};

  const labels = (typeof PERMISOS_LABELS !== 'undefined') ? PERMISOS_LABELS : {
    ver_costos: 'Ver costos de repuestos',
    ver_ganancia: 'Ver ganancia neta del trabajo',
    registrar_cobros: 'Registrar cobros al cliente',
    anular_ventas: 'Anular ventas',
    modificar_precios: 'Modificar precios cobrados al cliente'
  };

  const permisosHTML = perfilVinculado ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:.75rem;margin-bottom:.75rem">
      <div style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1px;margin-bottom:.5rem">🔐 PERMISOS DEL USUARIO</div>
      <div style="font-size:.72rem;color:var(--text2);margin-bottom:.6rem">Marcá lo que esta persona puede ver/hacer en la app. Por defecto todo está en NO.</div>
      ${Object.keys(labels).map(k => `
        <label style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;cursor:pointer;font-size:.83rem">
          <input type="checkbox" class="perm-check" data-perm="${k}" ${permisos[k] === true ? 'checked' : ''} style="accent-color:var(--accent);width:18px;height:18px">
          <span>${labels[k]}</span>
        </label>
      `).join('')}
      <div style="font-size:.65rem;color:var(--text2);margin-top:.4rem">Usuario vinculado: <strong style="color:var(--text)">${h(perfilVinculado.nombre || '')}</strong></div>
    </div>` : `
    <div style="background:rgba(255,204,0,.05);border:1px solid rgba(255,204,0,.25);border-radius:10px;padding:.6rem;margin-bottom:.75rem;font-size:.78rem;color:var(--warning)">
      Este empleado todavía no tiene un usuario vinculado. Para asignar permisos, vinculalo desde la sección "Usuarios".
    </div>`;

  openModal(`
    <div class="modal-title">${t("modEditarEmpleado")}</div>
    <div class="form-group"><label class="form-label">Nombre *</label><input class="form-input" id="f-nombre" value="${h(e.nombre || '')}"></div>
    <div class="form-group"><label class="form-label">Rol</label><input class="form-input" id="f-rol" value="${h(e.rol || '')}"></div>
    <div class="form-group"><label class="form-label">Sueldo mensual ₲</label>${renderMontoInput('f-sueldo', e.sueldo || 0)}</div>
    <div class="form-group"><label class="form-label">Teléfono</label>${phoneInput('f-tel', e.telefono, '0981 123 456')}</div>
    ${permisosHTML}
    <button class="btn-primary" onclick="guardarEmpleadoConPermisosConSafeCall('${id}', ${perfilVinculado ? `'${perfilVinculado.id}'` : 'null'})">${t('actualizar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarEmpleadoConPermisosConSafeCall(empleadoId, perfilId) {
  await safeCall(async () => {
    await guardarEmpleadoConPermisos(empleadoId, perfilId);
  }, null, 'No se pudieron guardar los cambios');
}

async function guardarEmpleadoConPermisos(empleadoId, perfilId) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede modificar permisos')) return;

  // 1) Guardar datos básicos del empleado (igual que antes)
  const nombre = document.getElementById('f-nombre').value.trim();
  if (!validateRequired(nombre, 'Nombre')) return;
  const data = {
    nombre,
    rol: document.getElementById('f-rol').value,
    sueldo: parseFloat(document.getElementById('f-sueldo')?.value) || 0,
    telefono: document.getElementById('f-tel').value,
    taller_id: tid()
  };
  const { error } = await offlineUpdate('empleados', data, 'id', empleadoId);
  if (error) { toast('Error: ' + error.message, 'error'); return; }

  // 2) Guardar permisos del perfil vinculado, si lo hay
  if (perfilId && perfilId !== 'null') {
    const checks = document.querySelectorAll('.perm-check');
    const permisos = {};
    checks.forEach(cb => { permisos[cb.dataset.perm] = !!cb.checked; });
    const { error: pErr } = await sb.from('perfiles').update({ permisos }).eq('id', perfilId);
    if (pErr) {
      // Si falla por columna inexistente, avisamos al admin que falta correr el SQL.
      if (/permisos/i.test(pErr.message || '')) {
        toast('Falta correr el script SQL de seguridad para guardar permisos.', 'error');
      } else {
        toast('Permisos no guardados: ' + pErr.message, 'error');
      }
    }
  }

  clearCache('empleados');
  toast('Empleado actualizado', 'success');
  closeModal();
  empleados();
}
