// ─── PANEL DE TRABAJO (Vista Kanban de OTs activas) ──────────────────────────

async function panelTrabajo() {
  const { data:reps } = await sb.from('reparaciones').select('*, vehiculos(patente,marca,modelo), clientes(nombre), reparacion_mecanicos(nombre_mecanico)')
    .eq('taller_id',tid()).in('estado',['pendiente','en_progreso','esperando_repuestos','finalizado']).order('created_at',{ascending:false}).limit(100);
  const pendientes = (reps||[]).filter(r=>r.estado==='pendiente');
  const enProgreso = (reps||[]).filter(r=>r.estado==='en_progreso');
  const esperando = (reps||[]).filter(r=>r.estado==='esperando_repuestos');
  const finalizados = (reps||[]).filter(r=>r.estado==='finalizado').slice(0,10);
  function kanbanCard(r){
    const mecanicos=(r.reparacion_mecanicos||[]).map(m=>m.nombre_mecanico).filter(Boolean);
    return `<div class="card" style="margin-bottom:.5rem;cursor:pointer" onclick="detalleReparacion('${r.id}')">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div style="flex:1;min-width:0">
          <div style="font-size:.85rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(r.descripcion)}</div>
          <div style="font-size:.72rem;color:var(--text2);margin-top:2px">${r.vehiculos?h(r.vehiculos.marca)+' '+h(r.vehiculos.patente):''}</div>
          ${r.clientes?`<div style="font-size:.7rem;color:var(--text2)">👤 ${h(r.clientes.nombre)}</div>`:''}
          ${mecanicos.length?`<div style="font-size:.68rem;color:var(--accent);margin-top:2px">🔧 ${mecanicos.join(', ')}</div>`:''}
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:.5rem">
          <div style="font-family:var(--font-head);font-size:.85rem;color:var(--accent)">₲${gs(r.costo||0)}</div>
          <div style="font-size:.65rem;color:var(--text2)">${formatFecha(r.fecha)}</div>
        </div>
      </div>
    </div>`;
  }
  function kanbanCol(title,items,color,icon){
    return `<div style="margin-bottom:1.25rem">
      <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.5rem">
        <span style="font-size:1rem">${icon}</span>
        <span style="font-family:var(--font-head);font-size:.8rem;color:${color};letter-spacing:1px">${title}</span>
        <span style="background:var(--surface2);border-radius:10px;padding:1px 8px;font-size:.7rem;color:var(--text2)">${items.length}</span>
      </div>
      ${items.length===0?'<div style="font-size:.78rem;color:var(--text2);padding:.5rem;background:var(--surface);border-radius:8px;text-align:center">Sin trabajos</div>':items.map(kanbanCard).join('')}
    </div>`;
  }
  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">Panel de Trabajo</div>
      <button class="btn-add" onclick="navigate('reparaciones')">Ver listado</button>
    </div>
    <div style="background:rgba(0,229,255,.05);border:1px solid rgba(0,229,255,.15);border-radius:10px;padding:.6rem;margin-bottom:1rem;font-size:.78rem;color:var(--text2);text-align:center">
      ${pendientes.length+enProgreso.length+esperando.length} trabajos activos · ${enProgreso.length} en desarrollo · ${finalizados.length} finalizados recientes
    </div>
    ${kanbanCol('PENDIENTES',pendientes,'var(--warning)','🟡')}
    ${kanbanCol('EN DESARROLLO',enProgreso,'var(--accent2)','🔶')}
    ${kanbanCol('ESPERANDO REPUESTOS',esperando,'var(--accent)','🔵')}
    ${kanbanCol('FINALIZADOS RECIENTES',finalizados,'var(--success)','🟢')}`;
}

// ─── FICHA DE RECEPCIÓN DE VEHÍCULO ─────────────────────────────────────────

async function modalFichaRecepcion(repId) {
  const { data:rep } = await sb.from('reparaciones').select('*, vehiculos(patente,marca,modelo,color), clientes(nombre,telefono)').eq('id',repId).single();
  if(!rep) return;
  openModal(`
    <div class="modal-title">📋 FICHA DE RECEPCIÓN</div>
    <div style="background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);border-radius:8px;padding:.6rem;margin-bottom:1rem;font-size:.82rem">
      <strong>${rep.vehiculos?h(rep.vehiculos.marca)+' '+h(rep.vehiculos.patente):''}</strong> · ${rep.clientes?h(rep.clientes.nombre):'Sin cliente'}
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Kilometraje</label><input class="form-input" id="fr-km" type="number" placeholder="0"></div>
      <div class="form-group"><label class="form-label">Combustible</label>
        <select class="form-input" id="fr-comb"><option>RESERVA</option><option>1/4</option><option selected>1/2</option><option>3/4</option><option>LLENO</option></select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Fecha aprox. entrega</label><input class="form-input" id="fr-entrega" type="date"></div>
    <div class="sub-section-title" style="margin-top:.75rem">ACCESORIOS</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-bottom:.75rem">
      ${['Gato','Matafuego','Herramientas','Autoradio','Rueda auxilio','Alfombras','Vidrios OK','Doc. vehículo','Luces OK','Limpiaparabrisas'].map(a=>`
        <label style="display:flex;align-items:center;gap:.4rem;background:var(--surface2);border-radius:6px;padding:.35rem .5rem;font-size:.75rem;cursor:pointer">
          <input type="checkbox" class="fr-acc" value="${a}"> ${a}
        </label>`).join('')}
    </div>
    <div class="sub-section-title">ESTADO INTERIOR</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-bottom:.75rem">
      ${['Tablero','Asientos','Puertas','Techo','Parabrisas','Consola'].map(p=>`
        <div class="form-group" style="margin:0"><label class="form-label" style="font-size:.65rem">${p}</label>
          <select class="form-input fr-estado-int" data-parte="${p}" style="padding:.3rem;font-size:.78rem">
            <option>Bueno</option><option>Regular</option><option>Malo</option>
          </select>
        </div>`).join('')}
    </div>
    <div class="form-group"><label class="form-label">Daños / Averías</label><textarea class="form-input" id="fr-danos" rows="3" placeholder="Describir daños visibles..."></textarea></div>
    <div class="form-group"><label class="form-label">Observaciones</label><textarea class="form-input" id="fr-obs" rows="2"></textarea></div>
    <button class="btn-primary" style="background:var(--success)" onclick="confirmarIngreso('${repId}')">✓ CONFIRMAR INGRESO AL TALLER</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function confirmarIngreso(repId) {
  const accesorios = [...document.querySelectorAll('.fr-acc:checked')].map(c=>c.value);
  const estadoInterior = {};
  document.querySelectorAll('.fr-estado-int').forEach(s=>{estadoInterior[s.getAttribute('data-parte')]=s.value;});
  const ficha = {
    kilometraje:document.getElementById('fr-km').value,combustible:document.getElementById('fr-comb').value,
    fecha_entrega_aprox:document.getElementById('fr-entrega').value,accesorios,estado_interior:estadoInterior,
    danos:document.getElementById('fr-danos').value,observaciones:document.getElementById('fr-obs').value,
    fecha_ingreso:new Date().toISOString()
  };
  await sb.from('reparaciones').update({ ficha_recepcion:ficha, estado:'en_progreso' }).eq('id',repId);
  clearCache('reparaciones');toast('✓ Vehículo ingresado al taller','success');closeModal();detalleReparacion(repId);
}

function verFichaRecepcion(repId) {
  sb.from('reparaciones').select('ficha_recepcion, vehiculos(patente,marca), clientes(nombre)').eq('id',repId).single().then(({data:rep})=>{
    if(!rep||!rep.ficha_recepcion){toast('No hay ficha de recepción','error');return;}
    const f=rep.ficha_recepcion;
    openModal(`
      <div class="modal-title">📋 FICHA DE RECEPCIÓN</div>
      <div style="font-size:.82rem;color:var(--text2);margin-bottom:.75rem">${rep.vehiculos?h(rep.vehiculos.marca)+' '+h(rep.vehiculos.patente):''} · ${rep.clientes?h(rep.clientes.nombre):''}</div>
      <div class="info-grid">
        <div class="info-item"><div class="label">Kilometraje</div><div class="value">${h(f.kilometraje||'-')} km</div></div>
        <div class="info-item"><div class="label">Combustible</div><div class="value">${h(f.combustible||'-')}</div></div>
        <div class="info-item"><div class="label">Fecha ingreso</div><div class="value">${f.fecha_ingreso?formatFecha(f.fecha_ingreso.split('T')[0]):'-'}</div></div>
        <div class="info-item"><div class="label">Entrega aprox.</div><div class="value">${f.fecha_entrega_aprox?formatFecha(f.fecha_entrega_aprox):'-'}</div></div>
      </div>
      ${f.accesorios?.length?`<div class="sub-section"><div class="sub-section-title">ACCESORIOS</div><div style="display:flex;flex-wrap:wrap;gap:.3rem">${f.accesorios.map(a=>`<span style="background:rgba(0,255,136,.1);color:var(--success);border-radius:4px;padding:2px 6px;font-size:.7rem">✓ ${h(a)}</span>`).join('')}</div></div>`:''}
      ${f.estado_interior?`<div class="sub-section"><div class="sub-section-title">ESTADO INTERIOR</div><div class="info-grid">${Object.entries(f.estado_interior).map(([k,v])=>`<div class="info-item"><div class="label">${h(k)}</div><div class="value" style="color:${v==='Bueno'?'var(--success)':v==='Regular'?'var(--warning)':'var(--danger)'}">${h(v)}</div></div>`).join('')}</div></div>`:''}
      ${f.danos?`<div class="sub-section"><div class="sub-section-title">DAÑOS</div><p style="font-size:.82rem;color:var(--text2)">${h(f.danos)}</p></div>`:''}
      ${f.observaciones?`<div class="sub-section"><div class="sub-section-title">OBSERVACIONES</div><p style="font-size:.82rem;color:var(--text2)">${h(f.observaciones)}</p></div>`:''}
      <div style="display:flex;gap:.5rem;margin-top:1rem">
        <button class="btn-primary" style="flex:1;margin:0" onclick="window.print()">🖨️ Imprimir</button>
        <button class="btn-secondary" style="flex:1;margin:0" onclick="closeModal()">Cerrar</button>
      </div>`);
  });
}

// ─── CARTA DE CONFORMIDAD ───────────────────────────────────────────────────

async function generarCartaConformidad(repId) {
  const { data:rep } = await sb.from('reparaciones').select('*, vehiculos(patente,marca,modelo), clientes(nombre)').eq('id',repId).single();
  if(!rep) return;
  const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';
  const fecha = new Date().toLocaleDateString('es-PY',{day:'2-digit',month:'long',year:'numeric'});
  openModal(`
    <div id="carta-conformidad" style="padding:.5rem">
      <div style="text-align:center;font-family:var(--font-head);font-size:1.2rem;color:var(--accent);margin-bottom:1rem;letter-spacing:2px">CARTA DE CONFORMIDAD</div>
      <div style="text-align:right;font-size:.82rem;color:var(--text2);margin-bottom:1rem">${fecha}</div>
      <div style="font-size:.85rem;line-height:1.8;color:var(--text)">
        <p>Por medio de la presente, yo <strong>${h(rep.clientes?.nombre||'________________')}</strong>, dejo constancia de que retiro el vehículo 
        <strong>${h(rep.vehiculos?.marca||'')} ${h(rep.vehiculos?.modelo||'')}</strong>, chapa <strong>${h(rep.vehiculos?.patente||'')}</strong>, 
        de las instalaciones de <strong>${h(tallerNombre)}</strong>, habiendo verificado los trabajos realizados y encontrándome conforme con los mismos.</p>
        <p style="margin-top:.75rem">Trabajo realizado: <strong>${h(rep.descripcion||'')}</strong></p>
        <p>Monto: <strong>₲${gs(rep.costo||0)}</strong></p>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:2.5rem;padding-top:1rem">
        <div style="text-align:center;width:45%"><div style="border-top:1px solid var(--text2);padding-top:.3rem;font-size:.78rem;color:var(--text2)">${h(tallerNombre)}</div></div>
        <div style="text-align:center;width:45%"><div style="border-top:1px solid var(--text2);padding-top:.3rem;font-size:.78rem;color:var(--text2)">Cliente</div></div>
      </div>
    </div>
    <div style="margin-top:1rem;display:flex;gap:.5rem">
      <button class="btn-primary" style="flex:1;margin:0" onclick="window.print()">🖨️ Imprimir</button>
      <button class="btn-primary" style="flex:1;margin:0;background:var(--success)" onclick="marcarEntregado('${repId}')">📨 Marcar Entregado</button>
      <button class="btn-secondary" style="flex:1;margin:0" onclick="closeModal()">Cerrar</button>
    </div>`);
}

async function marcarEntregado(repId) {
  await sb.from('reparaciones').update({ estado:'finalizado', fecha_entrega:new Date().toISOString() }).eq('id',repId);
  clearCache('reparaciones');toast('✓ Vehículo entregado','success');closeModal();navigate('reparaciones');
}
