// ─── EMPLEADOS ───────────────────────────────────────────────────────────────
async function empleados() {
  const { data } = await cachedQuery('empleados_list', () =>
    sb.from('empleados').select('*').eq('taller_id',tid()).order('nombre')
  );

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('empTitulo')}</div>
      <button class="btn-add" onclick="modalNuevoEmpleado()">${t('empNuevo')}</button>
    </div>
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('empSinDatos')}</p></div>` :
      (data||[]).map(e => `
      <div class="card" onclick="detalleEmpleado('${e.id}')">
        <div class="card-header">
          <div class="card-avatar" style="overflow:hidden;padding:0">
            ${e.foto_url?`<img src="${safeFotoUrl(e.foto_url)}" style="width:100%;height:100%;object-fit:cover">`:`<span style="font-size:1.3rem">${h(e.nombre).charAt(0).toUpperCase()}</span>`}
          </div>
          <div class="card-info">
            <div class="card-name">${h(e.nombre)}</div>
            <div class="card-sub">${e.rol||t('sinRol')} · ${h(e.telefono||t('cliSinTel'))}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text2)"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>`).join('')}`;
}

async function detalleEmpleado(id) {
  const DEBUG = localStorage.getItem('tallerpro_debug') === 'true';
  let emp, trabajosManuales, asignacionesMecanico;
  
  try {
    const empRes = await sb.from('empleados').select('*').eq('id',id).single();
    emp = empRes.data;
    if (DEBUG) console.log('📋 detalleEmpleado - emp:', emp);

    const trabajosRes = await sb.from('trabajos_empleado')
      .select('*, vehiculos(patente,marca,modelo)')
      .eq('empleado_id', id)
      .order('fecha',{ascending:false})
      .limit(50);
    trabajosManuales = trabajosRes.data || [];
    if (DEBUG) console.log('🛠️ detalleEmpleado - manuales:', trabajosManuales.length);

    const asignacionesRes = await sb.from('reparacion_mecanicos')
      .select('reparacion_id, horas, reparaciones(id,descripcion,tipo_trabajo,estado,fecha,costo,vehiculos(patente,marca),clientes(nombre))')
      .eq('empleado_id', id)
      .order('created_at', { ascending: false })
      .limit(50);
    asignacionesMecanico = asignacionesRes.data || [];
    if (DEBUG) console.log('🔧 detalleEmpleado - asignaciones:', asignacionesMecanico.length);
  } catch(e) {
    toast('Error al cargar empleado','error');
    navigate('empleados');
    return;
  }
  
  if (!emp) { toast('Empleado no encontrado','error'); navigate('empleados'); return; }

  // Unificar trabajos
  const trabajosUnificados = [];

  trabajosManuales.forEach(t => {
    trabajosUnificados.push({
      fecha: t.fecha,
      tipo: 'manual',
      descripcion: t.tipo_trabajo || 'Trabajo general',
      horas: t.horas || 0,
      vehiculo: t.vehiculos ? `${t.vehiculos.patente} · ${t.vehiculos.marca} ${t.vehiculos.modelo||''}` : null,
      comentario: t.comentario,
      foto_url: t.foto_vehiculo_url,
      origen: 'manual',
      id: t.id,
      estado: null,
      costo: null,
      cliente: null
    });
  });

  const idsVistos = new Set();
  asignacionesMecanico.forEach(a => {
    const r = a.reparaciones;
    if (!r || idsVistos.has(r.id)) return;
    idsVistos.add(r.id);
    trabajosUnificados.push({
      fecha: r.fecha,
      tipo: 'reparacion',
      descripcion: r.descripcion,
      horas: a.horas || 0,
      vehiculo: r.vehiculos ? `${r.vehiculos.patente} · ${r.vehiculos.marca}` : null,
      comentario: null,
      foto_url: null,
      origen: 'reparacion',
      id: r.id,
      estado: r.estado,
      costo: r.costo,
      cliente: r.clientes?.nombre
    });
  });

  trabajosUnificados.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  const porFecha = {};
  trabajosUnificados.forEach(t => {
    const f = t.fecha || 'sinFecha';
    if (!porFecha[f]) porFecha[f] = [];
    porFecha[f].push(t);
  });

  const totalHoras = trabajosUnificados.reduce((s, t) => s + parseFloat(t.horas || 0), 0);

  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('empleados')">${t('volver')}</button>
      <div class="card-avatar" style="width:56px;height:56px;border-radius:12px;overflow:hidden;border:2px solid var(--accent);flex-shrink:0">
        ${emp.foto_url?`<img src="${safeFotoUrl(emp.foto_url)}" style="width:100%;height:100%;object-fit:cover">`:`<span style="font-family:var(--font-head);font-size:1.6rem;font-weight:700;color:var(--accent)">${h(emp.nombre).charAt(0).toUpperCase()}</span>`}
      </div>
      <div><div class="detail-name">${h(emp.nombre)}</div><div class="detail-sub">${emp.rol||''}</div></div>
    </div>
    <div class="info-grid">
      <div class="info-item"><div class="label">${t('cliTel')}</div><div class="value">${h(emp.telefono||'-')}</div></div>
      <div class="info-item"><div class="label">Total horas</div><div class="value" style="color:var(--accent)">${totalHoras.toFixed(1)} hs</div></div>
      ${emp.sueldo?`<div class="info-item"><div class="label">Sueldo</div><div class="value" style="color:var(--success)">₲${gs(emp.sueldo)}</div></div>`:''}
    </div>
    <div id="emp-vales-section"></div>
    <div style="display:flex;gap:.5rem;margin-bottom:.5rem">
      <button class="btn-add" style="flex:1;justify-content:center" onclick="modalNuevoTrabajo('${id}')">+ Registrar trabajo</button>
      <button onclick="modalNuevoVale('${id}')" style="flex:1;background:rgba(255,204,0,.12);color:var(--warning);border:1px solid rgba(255,204,0,.3);border-radius:10px;padding:.5rem;font-family:var(--font-head);font-size:.8rem;cursor:pointer;text-align:center">+ Vale / Adelanto</button>
    </div>
    <div style="display:flex;gap:.5rem;margin-bottom:1.25rem">
      <button class="btn-secondary" style="margin:0;flex:1" onclick="modalEditarEmpleado('${id}')">${t('editarBtn')}</button>
      <button class="btn-danger" style="margin:0" onclick="eliminarEmpleado('${id}')">✕</button>
    </div>
    <div class="sub-section">
      <div class="sub-section-title">${t('empTrabajosReg')} (${trabajosUnificados.length})</div>
      ${Object.keys(porFecha).length===0 ? `<p style="color:var(--text2);font-size:.85rem">${t('empSinTrabajos')}</p>` :
        Object.entries(porFecha).map(([fecha, ts]) => `
          <div style="margin-bottom:1rem">
            <div style="font-size:.75rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.4rem">${fecha}</div>
            ${ts.map(t => `
            <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:.75rem;margin-bottom:.4rem;cursor:pointer" onclick="${t.origen === 'reparacion' ? `detalleReparacion('${t.id}')` : ''}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
                <div style="flex:1">
                  <div style="font-weight:500;font-size:.9rem">
                    ${h(t.descripcion)}
                    ${t.origen === 'reparacion' ? `<span class="card-badge ${estadoBadge(t.estado)}" style="margin-left:.5rem;font-size:.65rem">${estadoLabel(t.estado)}</span>` : ''}
                  </div>
                  <div style="font-size:.75rem;color:var(--text2);margin-top:2px">
                    ${t.vehiculo ? h(t.vehiculo) : ''}
                    ${t.cliente ? ` · ${h(t.cliente)}` : ''}
                    ${t.costo ? ` · ₲${gs(t.costo)}` : ''}
                  </div>
                  ${t.comentario?`<div style="font-size:.8rem;color:var(--text2);margin-top:.4rem;font-style:italic">"${h(t.comentario)}"</div>`:''}
                  ${t.foto_url?`<img src="${safeFotoUrl(t.foto_url)}" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-top:.5rem;border:1px solid var(--border)">`:''}
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${t.horas}hs</div>
                  ${t.origen === 'manual' ? `<button onclick="event.stopPropagation();eliminarTrabajo('${t.id}','${id}')" style="font-size:.65rem;background:none;border:none;color:var(--text2);cursor:pointer;margin-top:4px">✕ borrar</button>` : ''}
                </div>
              </div>
            </div>`).join('')}
          </div>`).join('')}
    </div>`;
  cargarVales(id);
}

// ─── VALES Y ADELANTOS ──────────────────────────────────────────────────────
async function cargarVales(empleadoId) {
  const mesActual = new Date();
  const primerDia = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDia = new Date(mesActual.getFullYear(), mesActual.getMonth()+1, 0).toISOString().split('T')[0];
  const { data: vales } = await sb.from('vales_empleado').select('*').eq('empleado_id', empleadoId).gte('fecha', primerDia).lte('fecha', ultimoDia).order('fecha',{ascending:false});
  const { data: emp } = await sb.from('empleados').select('sueldo').eq('id', empleadoId).single();
  const totalVales = (vales||[]).reduce((s,v) => s + parseFloat(v.monto||0), 0);
  const sueldo = parseFloat(emp?.sueldo||0);
  const neto = sueldo - totalVales;

  const section = document.getElementById('emp-vales-section');
  if (!section) return;
  section.innerHTML = (vales||[]).length > 0 || sueldo > 0 ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1px;margin-bottom:.5rem">💵 RESUMEN DEL MES</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;margin-bottom:.5rem">
        <div style="background:var(--surface2);border-radius:8px;padding:.4rem;text-align:center">
          <div style="font-size:.55rem;color:var(--text2)">SUELDO</div>
          <div style="font-family:var(--font-head);font-size:.85rem;color:var(--success)">₲${gs(sueldo)}</div>
        </div>
        <div style="background:rgba(255,204,0,.08);border-radius:8px;padding:.4rem;text-align:center">
          <div style="font-size:.55rem;color:var(--warning)">VALES</div>
          <div style="font-family:var(--font-head);font-size:.85rem;color:var(--warning)">-₲${gs(totalVales)}</div>
        </div>
        <div style="background:${neto>=0?'rgba(0,255,136,.08)':'rgba(255,68,68,.08)'};border-radius:8px;padding:.4rem;text-align:center">
          <div style="font-size:.55rem;color:${neto>=0?'var(--success)':'var(--danger)'}">A COBRAR</div>
          <div style="font-family:var(--font-head);font-size:.85rem;color:${neto>=0?'var(--success)':'var(--danger)'}">₲${gs(neto)}</div>
        </div>
      </div>
      ${(vales||[]).length > 0 ? (vales||[]).map(v => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem 0;border-top:1px solid var(--border)">
          <div>
            <div style="font-size:.78rem">${h(v.concepto||'Vale')}</div>
            <div style="font-size:.65rem;color:var(--text2)">${formatFecha(v.fecha)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:.4rem">
            <span style="font-family:var(--font-head);color:var(--warning);font-size:.85rem">-₲${gs(v.monto)}</span>
            <button onclick="eliminarVale('${v.id}','${empleadoId}')" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:.7rem">✕</button>
          </div>
        </div>`).join('') : ''}
    </div>` : '';
}

function modalNuevoVale(empleadoId) {
  openModal(`
    <div class="modal-title">💵 Registrar Vale / Adelanto</div>
    <div class="form-group"><label class="form-label">Monto ₲ *</label>${renderMontoInput('f-vale-monto', '', '50000')}</div>
    <div class="form-group"><label class="form-label">Concepto</label><input class="form-input" id="f-vale-concepto" placeholder="Almuerzo, adelanto, etc."></div>
    <div class="form-group"><label class="form-label">Fecha</label>${renderFechaInput('f-vale-fecha')}</div>
    <button class="btn-primary" onclick="guardarValeConSafeCall('${empleadoId}')">Registrar vale</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function guardarValeConSafeCall(empleadoId) {
  await safeCall(async () => {
    await guardarVale(empleadoId);
  }, null, 'No se pudo registrar el vale');
}

async function guardarVale(empleadoId) {
  const monto = parseFloat(document.getElementById('f-vale-monto').value);
  if (!validatePositiveNumber(monto, 'Monto')) return;
  
  const concepto = document.getElementById('f-vale-concepto').value || 'Vale';
  const fecha = document.getElementById('f-vale-fecha').value;
  
  const { error } = await sb.from('vales_empleado').insert({
    empleado_id: empleadoId,
    monto,
    concepto,
    fecha,
    taller_id: tid()
  });
  if (error) { toast('Error: '+error.message,'error'); return; }
  
  const { data: emp } = await sb.from('empleados').select('nombre').eq('id', empleadoId).single();
  const categoriaId = await obtenerCategoriaFinanciera('Vales/Adelantos', 'egreso');
  if (categoriaId) {
    await sb.from('movimientos_financieros').insert({
      taller_id: tid(),
      tipo: 'egreso',
      categoria_id: categoriaId,
      monto,
      concepto: 'Vale: ' + (emp?.nombre||'') + ' — ' + concepto,
      fecha
    });
  }
  
  clearCache('empleados');
  clearCache('finanzas');
  toast('Vale registrado','success');
  closeModal(); 
  detalleEmpleado(empleadoId);
}

async function eliminarVale(valeId, empleadoId) {
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
  if (error) { toast('Error: '+error.message,'error'); return; }
  
  toast('Trabajo registrado','success');
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

function modalNuevoEmpleado() {
  openModal(`
    <div class="modal-title">${t("modNuevoEmpleado")}</div>
    <div class="form-group"><label class="form-label">Nombre *</label><input class="form-input" id="f-nombre" placeholder="Carlos Rodríguez"></div>
    <div class="form-group"><label class="form-label">Rol</label><input class="form-input" id="f-rol" placeholder="Mecánico, Electricista..."></div>
    <div class="form-group"><label class="form-label">Sueldo mensual ₲</label>${renderMontoInput('f-sueldo', '', '0')}</div>
    <div class="form-group"><label class="form-label">Teléfono</label>${phoneInput('f-tel','','0981 123 456')}</div>
    <button class="btn-primary" onclick="guardarEmpleadoConSafeCall()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarEmpleadoConSafeCall() {
  await safeCall(async () => {
    await guardarEmpleado();
  }, null, 'No se pudo guardar el empleado');
}

async function guardarEmpleado(id=null) {
  const nombre = document.getElementById('f-nombre').value.trim();
  if (!validateRequired(nombre, 'Nombre')) return;
  
  const data = {
    nombre,
    rol: document.getElementById('f-rol').value,
    sueldo: parseFloat(document.getElementById('f-sueldo')?.value)||0,
    telefono: document.getElementById('f-tel').value,
    taller_id: tid()
  };
  
  const { error } = id ? await offlineUpdate('empleados', data, 'id', id) : await offlineInsert('empleados', data);
  if (error) { toast('Error: '+error.message,'error'); return; }
  
  clearCache('empleados');
  toast(id ? 'Empleado actualizado' : 'Empleado guardado','success');
  closeModal(); 
  empleados();
}

async function modalEditarEmpleado(id) {
  const { data:e } = await sb.from('empleados').select('*').eq('id',id).single();
  openModal(`
    <div class="modal-title">${t("modEditarEmpleado")}</div>
    <div class="form-group"><label class="form-label">Nombre *</label><input class="form-input" id="f-nombre" value="${h(e.nombre||'')}"></div>
    <div class="form-group"><label class="form-label">Rol</label><input class="form-input" id="f-rol" value="${h(e.rol||'')}"></div>
    <div class="form-group"><label class="form-label">Sueldo mensual ₲</label>${renderMontoInput('f-sueldo', e.sueldo||0)}</div>
    <div class="form-group"><label class="form-label">Teléfono</label>${phoneInput('f-tel', e.telefono, '0981 123 456')}</div>
    <button class="btn-primary" onclick="guardarEmpleadoConSafeCall('${id}')">${t('actualizar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}
