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
  let emp, trabajosManuales, asignacionesRep;
  try {
    const empRes = await sb.from('empleados').select('*').eq('id',id).single();
    emp = empRes.data;
    if (!emp) throw new Error('Empleado no encontrado');

    const manualesRes = await sb.from('trabajos_empleado')
      .select('*, vehiculos(patente,marca,modelo)')
      .eq('empleado_id', id)
      .order('fecha',{ascending:false})
      .limit(50);
    trabajosManuales = manualesRes.data || [];

    const asignRes = await sb.from('reparacion_mecanicos')
      .select('*, reparaciones(id,descripcion,tipo_trabajo,estado,fecha,costo,vehiculos(patente,marca),clientes(nombre))')
      .eq('empleado_id', id)
      .order('created_at',{ascending:false})
      .limit(50);
    asignacionesRep = asignRes.data || [];

  } catch(e) { toast('Error al cargar empleado','error'); navigate('empleados'); return; }

  const listaTrabajos = [];

  trabajosManuales.forEach(t => {
    listaTrabajos.push({
      fecha: t.fecha,
      tipo: 'manual',
      descripcion: t.tipo_trabajo || 'Trabajo general',
      horas: t.horas || 0,
      vehiculo: t.vehiculos ? `${t.vehiculos.patente} · ${t.vehiculos.marca} ${t.vehiculos.modelo||''}` : null,
      comentario: t.comentario,
      foto_url: t.foto_vehiculo_url,
      id: t.id,
      estado: null,
      costo: null,
      cliente: null,
      esReparacion: false
    });
  });

  asignacionesRep.forEach(a => {
    const r = a.reparaciones;
    if (!r) return;
    listaTrabajos.push({
      fecha: r.fecha,
      tipo: 'reparacion',
      descripcion: r.descripcion,
      horas: a.horas || 0,
      vehiculo: r.vehiculos ? `${r.vehiculos.patente} · ${r.vehiculos.marca}` : null,
      comentario: null,
      foto_url: null,
      id: r.id,
      estado: r.estado,
      costo: r.costo,
      cliente: r.clientes?.nombre,
      esReparacion: true
    });
  });

  listaTrabajos.sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''));

  const porFecha = {};
  listaTrabajos.forEach(t => {
    const f = t.fecha || 'sinFecha';
    if (!porFecha[f]) porFecha[f] = [];
    porFecha[f].push(t);
  });

  const totalHoras = listaTrabajos.reduce((s,t) => s + parseFloat(t.horas||0), 0);

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
      <div class="sub-section-title">${t('empTrabajosReg')} (${listaTrabajos.length})</div>
      ${Object.keys(porFecha).length===0 ? `<p style="color:var(--text2);font-size:.85rem">${t('empSinTrabajos')}</p>` :
        Object.entries(porFecha).map(([fecha, ts]) => `
          <div style="margin-bottom:1rem">
            <div style="font-size:.75rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.4rem">${fecha}</div>
            ${ts.map(t => `
            <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:.75rem;margin-bottom:.4rem;cursor:pointer" onclick="${t.esReparacion ? `detalleReparacion('${t.id}')` : ''}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
                <div style="flex:1">
                  <div style="font-weight:500;font-size:.9rem">
                    ${h(t.descripcion)}
                    ${t.esReparacion ? `<span class="card-badge ${estadoBadge(t.estado)}" style="margin-left:.5rem;font-size:.65rem">${estadoLabel(t.estado)}</span>` : ''}
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
                  ${!t.esReparacion ? `<button onclick="event.stopPropagation();eliminarTrabajo('${t.id}','${id}')" style="font-size:.65rem;background:none;border:none;color:var(--text2);cursor:pointer;margin-top:4px">✕ borrar</button>` : ''}
                </div>
              </div>
            </div>`).join('')}
          </div>`).join('')}
    </div>`;
  cargarVales(id);
}

// Funciones de vales, modales, etc. (se mantienen igual que antes, las tienes en versiones anteriores)
