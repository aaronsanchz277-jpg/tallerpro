//// ─── REPARACIONES ────────────────────────────────────────────────────────────
const TIPOS_TRABAJO = [
  'Mecánica general', 'Cambio de aceite / Service', 'Frenos',
  'Suspensión / Tren delantero', 'Electricidad', 'Chapa y pintura',
  'Aire acondicionado', 'Diagnóstico', 'Otro'
];
const TIPO_ICONS = { 'Mecánica general':'🔧', 'Cambio de aceite / Service':'🛢️', 'Frenos':'🛑', 'Suspensión / Tren delantero':'🔩', 'Electricidad':'⚡', 'Chapa y pintura':'🎨', 'Aire acondicionado':'❄️', 'Diagnóstico':'🔍', 'Otro':'📋' };

function inicioSemana() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

async function reparaciones({ filtro='todos', search='', offset=0, tipo='' }={}) {
  const cacheKey = `reparaciones_${filtro}_${search}_${offset}_${tipo}`;
  const { data, count } = await cachedQuery(cacheKey, () => {
    let q = sb.from('reparaciones').select('*, vehiculos(patente,marca), clientes(nombre)', {count:'exact'}).eq('taller_id',tid()).order('created_at',{ascending:false});
    if (filtro==='hoy') q = q.eq('fecha', new Date().toISOString().split('T')[0]);
    else if (filtro==='semana') q = q.gte('fecha', inicioSemana());
    else if (filtro==='mes') q = q.gte('fecha', primerDiaMes());
    else if (filtro!=='todos') q = q.eq('estado',filtro);
    if (tipo) q = q.eq('tipo_trabajo', tipo);
    if (search) q = q.ilike('descripcion', `%${search}%`);
    return q.range(offset, offset + PAGE_SIZE - 1);
  });

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">Trabajos ${count ? `<span style="font-size:.75rem;color:var(--text2)">(${count})</span>` : ''}</div>
      ${['admin','empleado'].includes(currentPerfil?.rol) ? `<button class="btn-add" onclick="modalNuevaReparacion()">+ Nuevo</button>` : ''}
    </div>
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" placeholder="Buscar trabajo..." value="${h(search)}" oninput="debounce('rep',()=>reparaciones({filtro:'${filtro}',search:this.value,tipo:'${tipo}'}))" class="form-input" style="padding-left:2.5rem">
    </div>
    <div class="tabs">
      <button class="tab ${filtro==='todos'?'active':''}" onclick="reparaciones({filtro:'todos',tipo:'${tipo}'})">Todos</button>
      <button class="tab ${filtro==='pendiente'?'active':''}" onclick="reparaciones({filtro:'pendiente',tipo:'${tipo}'})">Pendiente</button>
      <button class="tab ${filtro==='en_progreso'?'active':''}" onclick="reparaciones({filtro:'en_progreso',tipo:'${tipo}'})">En progreso</button>
      <button class="tab ${filtro==='esperando_repuestos'?'active':''}" onclick="reparaciones({filtro:'esperando_repuestos',tipo:'${tipo}'})">Esp. repuestos</button>
      <button class="tab ${filtro==='finalizado'?'active':''}" onclick="reparaciones({filtro:'finalizado',tipo:'${tipo}'})">Finalizado</button>
    </div>
    ${tipo ? `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.5rem">
      <span style="font-size:.78rem;color:var(--text2)">Filtro: ${TIPO_ICONS[tipo]||'📋'} ${h(tipo)}</span>
      <button onclick="reparaciones({filtro:'${filtro}'})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.8rem">✕</button>
    </div>` : `<div style="display:flex;gap:.3rem;margin-bottom:.5rem;overflow-x:auto;padding-bottom:.3rem">
      ${TIPOS_TRABAJO.map(t => `<button onclick="reparaciones({filtro:'${filtro}',tipo:'${t}'})" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.25rem .5rem;font-size:.65rem;cursor:pointer;white-space:nowrap;color:var(--text2)">${TIPO_ICONS[t]||'📋'} ${t}</button>`).join('')}
    </div>`}
    ${(data||[]).length===0 ? `<div class="empty"><p>No hay trabajos</p></div>` :
      (data||[]).map(r => `
      <div class="card" onclick="detalleReparacion('${r.id}')">
        <div class="card-header">
          <div class="card-avatar">${TIPO_ICONS[r.tipo_trabajo]||'🔧'}</div>
          <div class="card-info">
            <div class="card-name">${h(r.descripcion)}</div>
            <div class="card-sub">${r.tipo_trabajo?h(r.tipo_trabajo)+' · ':''}${r.vehiculos?h(r.vehiculos.marca)+' '+h(r.vehiculos.patente):''} ${r.clientes?' · '+h(r.clientes.nombre):''}</div>
            <div class="card-sub">₲${gs(r.costo)} · ${formatFecha(r.fecha)}</div>
          </div>
          <span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span>
        </div>
      </div>`).join('')}
    ${renderPagination(count||0, offset, '_navRep')}`;
}
function _navRep(o) { reparaciones({offset:o}); }

// ─── CARGAR ÍTEMS DE REPARACIÓN ─────────────────────────────────────────────
async function cargarItemsReparacion(repId) {
  const { data } = await sb.from('reparacion_items').select('*').eq('reparacion_id', repId).order('created_at');
  return data || [];
}

function renderItemsReparacion(items) {
  if (!items || items.length === 0) return '<p style="color:var(--text2);font-size:.85rem">Sin ítems registrados</p>';
  return items.map(i => `
    <div class="factura-item">
      <span>${h(i.descripcion)} ${i.cantidad>1?`x${i.cantidad}`:''}</span>
      <span>₲${gs(i.total || i.precio_unitario * i.cantidad)}</span>
    </div>
  `).join('');
}

async function detalleReparacion(id) {
  const { data:r, error:qErr } = await safeQuery(() => sb.from('reparaciones').select('*, vehiculos(patente,marca,modelo), clientes(nombre,telefono)').eq('id',id).single());
  if (!r) { if (qErr) toast('Error al cargar reparación','error'); navigate('reparaciones'); return; }
  
  const isAdmin = currentPerfil?.rol==='admin';
  const canEdit = ['admin','empleado'].includes(currentPerfil?.rol);
  const isCliente = currentPerfil?.rol === 'cliente';
  
  const checklist = r.checklist_recepcion || {};
  const fotos = r.fotos_recepcion || [];
  const aprobacion = r.aprobacion_cliente || 'pendiente';
  const aprobBadge = aprobacion === 'aprobado' ? 'badge-green' : aprobacion === 'rechazado' ? 'badge-red' : 'badge-yellow';
  const aprobLabel = aprobacion === 'aprobado' ? '✓ Aprobado' : aprobacion === 'rechazado' ? '✕ Rechazado' : '⏳ Pendiente';

  // Cargar ítems y pagos
  const items = await cargarItemsReparacion(id);
  const { data: pagos } = await sb.from('pagos_reparacion').select('monto').eq('reparacion_id', id);
  const totalPagado = (pagos||[]).reduce((s,p) => s + parseFloat(p.monto||0), 0);
  const saldo = parseFloat(r.costo||0) - totalPagado;

  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('${isCliente?'mis-reparaciones':'reparaciones'}')">${t('volver')}</button>
      <div class="detail-avatar">${TIPO_ICONS[r.tipo_trabajo]||'🔧'}</div>
      <div><div class="detail-name" style="font-size:1rem">${h(r.descripcion)}</div><div class="detail-sub">${r.tipo_trabajo?h(r.tipo_trabajo)+' · ':''}${formatFecha(r.fecha)}</div></div>
    </div>
    <div class="info-grid">
      <div class="info-item"><div class="label">Estado</div><div class="value"><span class="card-badge ${estadoBadge(r.estado)}">${estadoLabel(r.estado)}</span></div></div>
      <div class="info-item"><div class="label">Vehículo</div><div class="value">${r.vehiculos?h(r.vehiculos.patente)+' '+h(r.vehiculos.marca||''):'-'}</div></div>
      <div class="info-item"><div class="label">Cliente</div><div class="value">${r.clientes?h(r.clientes.nombre):'-'}</div></div>
      <div class="info-item"><div class="label">Aprobación</div><div class="value"><span class="card-badge ${aprobBadge}">${aprobLabel}</span></div></div>
      ${r.kilometraje_ingreso?`<div class="info-item"><div class="label">Km ingreso</div><div class="value">${r.kilometraje_ingreso.toLocaleString()} km</div></div>`:''}
      ${r.combustible_ingreso?`<div class="info-item"><div class="label">Combustible</div><div class="value">${h(r.combustible_ingreso)}</div></div>`:''}
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <span style="font-size:.72rem;color:var(--text2);font-family:var(--font-head);letter-spacing:1px">COBRADO AL CLIENTE</span>
        <span style="font-family:var(--font-head);font-size:1.4rem;color:var(--success)">₲${gs(r.costo)}</span>
      </div>
      ${r.costo_repuestos ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-top:1px solid var(--border)">
        <span style="font-size:.78rem;color:var(--text2)">Repuestos gastados</span>
        <span style="font-size:.85rem;color:var(--danger)">-₲${gs(r.costo_repuestos)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-top:1px solid var(--border)">
        <span style="font-size:.78rem;font-weight:600">Tu ganancia</span>
        <span style="font-family:var(--font-head);font-size:1.1rem;color:${(r.costo-r.costo_repuestos)>0?'var(--accent)':'var(--danger)'}">₲${gs(r.costo-r.costo_repuestos)} <span style="font-size:.7rem;color:var(--text2)">(${r.costo>0?Math.round(((r.costo-r.costo_repuestos)/r.costo)*100):0}%)</span></span>
      </div>` : ''}
      ${saldo > 0 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-top:1px solid var(--border);margin-top:.4rem">
        <span style="font-size:.78rem;color:var(--warning)">SALDO PENDIENTE</span>
        <span style="font-family:var(--font-head);font-size:1rem;color:var(--warning)">₲${gs(saldo)}</span>
      </div>` : totalPagado > 0 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-top:1px solid var(--border);margin-top:.4rem">
        <span style="font-size:.78rem;color:var(--success)">TOTALMENTE PAGADO</span>
        <span style="font-family:var(--font-head);font-size:.85rem;color:var(--success)">✓</span>
      </div>` : ''}
      ${canEdit ? `<button onclick="modalActualizarCosto('${id}',${r.costo},${r.costo_repuestos||0})" style="width:100%;margin-top:.5rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.4rem;font-size:.72rem;color:var(--text2);cursor:pointer">✏️ Actualizar costos</button>` : ''}
    </div>

    <!-- ÍTEMS DETALLADOS -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <span style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:1px">📦 ÍTEMS DETALLADOS</span>
        ${canEdit ? `<button onclick="modalAgregarItemReparacion('${id}')" style="background:var(--surface2);border:1px solid var(--border);color:var(--accent);border-radius:8px;padding:.25rem .5rem;font-size:.7rem;cursor:pointer">+ Agregar</button>` : ''}
      </div>
      ${renderItemsReparacion(items)}
      ${items.length > 0 ? `<div style="text-align:right;margin-top:.5rem;font-size:.8rem;color:var(--accent)">Total ítems: ₲${gs(items.reduce((s,i)=>s+parseFloat(i.total||i.precio_unitario*i.cantidad),0))}</div>` : ''}
    </div>

    ${r.notas?`<div class="info-item" style="margin-bottom:1rem"><div class="label">Notas</div><div class="value">${h(r.notas)}</div></div>`:''}
    <div id="rep-presupuesto-link"></div>

    <div id="rep-mecanicos-section" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:1px">👥 MECÁNICOS ASIGNADOS</div>
        ${canEdit ? `<button onclick="repMecanicos_modal('${id}')" style="background:var(--surface2);border:1px solid var(--border);color:var(--accent);border-radius:8px;padding:.25rem .5rem;font-size:.7rem;cursor:pointer;font-family:var(--font-head)">Gestionar</button>` : ''}
      </div>
      <div id="rep-mec-chips">Cargando...</div>
    </div>

    ${Object.keys(checklist).length > 0 ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:1px;margin-bottom:.5rem">📋 CHECKLIST DE RECEPCIÓN</div>
      ${Object.entries(checklist).map(([k,v]) => `<div style="font-size:.85rem;padding:.25rem 0;display:flex;justify-content:space-between"><span style="color:var(--text2)">${h(k)}</span><span style="color:${v==='ok'?'var(--success)':v==='problema'?'var(--danger)':'var(--text2)'}">${v==='ok'?'✓ OK':v==='problema'?'⚠ Problema':'—'}</span></div>`).join('')}
    </div>` : ''}

    ${fotos.length > 0 || (r.fotos_proceso||[]).length > 0 || (r.fotos_entrega||[]).length > 0 ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);letter-spacing:1px;margin-bottom:.5rem">📷 FOTOS</div>
      ${fotos.length > 0 ? `<div style="font-size:.7rem;color:var(--text2);margin-bottom:.3rem">RECEPCIÓN</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-bottom:.6rem">
        ${fotos.map(url => `<img src="${safeFotoUrl(url)}" style="width:100%;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer" onclick="window.open('${safeFotoUrl(url)}')">`).join('')}
      </div>` : ''}
      ${(r.fotos_proceso||[]).length > 0 ? `<div style="font-size:.7rem;color:var(--accent2);margin-bottom:.3rem">EN PROCESO</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-bottom:.6rem">
        ${(r.fotos_proceso||[]).map(url => `<img src="${safeFotoUrl(url)}" style="width:100%;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer" onclick="window.open('${safeFotoUrl(url)}')">`).join('')}
      </div>` : ''}
      ${(r.fotos_entrega||[]).length > 0 ? `<div style="font-size:.7rem;color:var(--success);margin-bottom:.3rem">ENTREGA</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem">
        ${(r.fotos_entrega||[]).map(url => `<img src="${safeFotoUrl(url)}" style="width:100%;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer" onclick="window.open('${safeFotoUrl(url)}')">`).join('')}
      </div>` : ''}
    </div>` : ''}

    ${isCliente && aprobacion === 'pendiente' && r.costo > 0 ? `
    <div style="background:rgba(0,229,255,.05);border:1px solid rgba(0,229,255,.2);border-radius:12px;padding:1rem;margin-bottom:1rem;text-align:center">
      <div style="font-family:var(--font-head);font-size:.9rem;color:var(--text);margin-bottom:.5rem">¿Aprobás este presupuesto?</div>
      <div style="font-size:.85rem;color:var(--text2);margin-bottom:.75rem">${h(r.descripcion)} — ₲${gs(r.costo)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
        <button onclick="aprobarPresupuestoCliente('${id}','aprobado')" style="background:rgba(0,255,136,.15);color:var(--success);border:1px solid rgba(0,255,136,.3);border-radius:10px;padding:.6rem;font-family:var(--font-head);font-size:.9rem;cursor:pointer">✓ APROBAR</button>
        <button onclick="aprobarPresupuestoCliente('${id}','rechazado')" style="background:rgba(255,68,68,.1);color:var(--danger);border:1px solid rgba(255,68,68,.3);border-radius:10px;padding:.6rem;font-family:var(--font-head);font-size:.9rem;cursor:pointer">✕ RECHAZAR</button>
      </div>
    </div>` : ''}

    ${canEdit ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
      ${r.estado!=='en_progreso'?`<button class="btn-secondary" style="margin:0;font-size:.8rem" onclick="cambiarEstado('${id}','en_progreso')">${t('enProgresoBtn')}</button>`:''}
      ${r.estado!=='esperando_repuestos'?`<button class="btn-secondary" style="margin:0;font-size:.73rem;color:var(--accent2);border-color:var(--accent2)" onclick="cambiarEstado('${id}','esperando_repuestos')">⏳ Esp. repuestos</button>`:''}
      ${r.estado!=='finalizado'?`<button class="btn-secondary" style="margin:0;font-size:.8rem;color:var(--success);border-color:var(--success)" onclick="cambiarEstado('${id}','finalizado')">${t('finalizarBtn')}</button>`:''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;margin-bottom:.5rem">
      <button class="btn-secondary" style="margin:0;font-size:.72rem;padding:.5rem .3rem" onclick="modalFotosEtapa('${id}','recepcion')">📷 Recepción</button>
      <button class="btn-secondary" style="margin:0;font-size:.72rem;padding:.5rem .3rem" onclick="modalFotosEtapa('${id}','proceso')">📷 Proceso</button>
      <button class="btn-secondary" style="margin:0;font-size:.72rem;padding:.5rem .3rem" onclick="modalFotosEtapa('${id}','entrega')">📷 Entrega</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem">
      <button class="btn-secondary" style="margin:0;font-size:.8rem" onclick="modalChecklistRecepcion('${id}')">📋 Revisión</button>
      <button class="btn-secondary" style="margin:0;font-size:.8rem" onclick="modalPagosReparacion('${id}')">💰 Pagos</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem">
      ${r.ficha_recepcion?`<button class="btn-secondary" style="margin:0;font-size:.8rem;color:var(--success);border-color:var(--success)" onclick="verFichaRecepcion('${id}')">📋 Ver Ficha</button>`:`<button class="btn-secondary" style="margin:0;font-size:.8rem" onclick="modalFichaRecepcion('${id}')">📋 Ficha Ingreso</button>`}
      ${r.estado==='finalizado'?`<button class="btn-secondary" style="margin:0;font-size:.8rem;color:var(--success);border-color:var(--success)" onclick="generarCartaConformidad('${id}')">📨 Carta Conformidad</button>`:`<button class="btn-secondary" style="margin:0;font-size:.8rem;opacity:.5" disabled>📨 Carta (al finalizar)</button>`}
    </div>
    ${aprobacion === 'pendiente' && r.clientes?.telefono ? `
    <button onclick="enviarAprobacionWhatsApp('${id}')" style="width:100%;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:.6rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer;margin-bottom:.5rem">💬 Pedir aprobación por WhatsApp</button>` : ''}
    <div style="display:flex;gap:.5rem">
      <button class="btn-secondary" style="margin:0" onclick="modalEditarReparacion('${id}')">${t('editarBtn')}</button>
      ${isAdmin ? `<button class="btn-danger" style="margin:0" onclick="eliminarReparacion('${id}')">${t('eliminarBtn')}</button>` : ''}
      ${isAdmin ? `<button class="btn-add" style="flex:1;justify-content:center" onclick="modalNuevoPresupuesto()">🧾 Presupuesto</button>` : ''}
    </div>` : ''}`;

  repMecanicos_cargar(id).then(mecs => {
    const el = document.getElementById('rep-mec-chips');
    if (el) el.innerHTML = repMecanicos_renderChips(mecs);
  });
  
  sb.from('presupuestos_v2').select('id,descripcion,total').eq('reparacion_id',id).maybeSingle().then(({data:ppto})=>{
    const linkEl = document.getElementById('rep-presupuesto-link');
    if(linkEl && ppto){
      linkEl.innerHTML = `<div style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.2);border-radius:10px;padding:.6rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="detallePresupuesto('${ppto.id}')">
        <div><div style="font-size:.68rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px">PRESUPUESTO ORIGEN</div><div style="font-size:.82rem;color:var(--text)">${h(ppto.descripcion||'Presupuesto')} — ₲${gs(ppto.total||0)}</div></div>
        <span style="color:var(--accent);font-size:.85rem">Ver →</span>
      </div>`;
    }
  });
}

// ─── AGREGAR ÍTEM A REPARACIÓN ──────────────────────────────────────────────
async function modalAgregarItemReparacion(repId) {
  const { data: inv } = await sb.from('inventario').select('id,nombre,precio_unitario,cantidad').eq('taller_id',tid()).order('nombre');
  openModal(`
    <div class="modal-title">Agregar ítem a la reparación</div>
    <div class="form-group"><label class="form-label">Tipo</label>
      <select class="form-input" id="item-tipo">
        <option value="servicio">Servicio</option>
        <option value="producto">Producto</option>
        <option value="adicional">Adicional</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="item-desc" placeholder="Ej: Cambio de aceite"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Cantidad</label><input class="form-input" id="item-cant" type="number" value="1" min="1"></div>
      <div class="form-group"><label class="form-label">Precio unit. ₲</label><input class="form-input" id="item-precio" type="number" value="0"></div>
    </div>
    <div class="form-group"><label class="form-label">O seleccionar del inventario</label>
      <select class="form-input" id="item-inv" onchange="llenarDesdeInventario()">
        <option value="">Seleccionar producto...</option>
        ${(inv||[]).map(p=>`<option value="${p.id}" data-nombre="${h(p.nombre)}" data-precio="${p.precio_unitario}">${h(p.nombre)} (stock: ${p.cantidad})</option>`).join('')}
      </select>
    </div>
    <button class="btn-primary" onclick="guardarItemReparacion('${repId}')">Agregar</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

function llenarDesdeInventario() {
  const sel = document.getElementById('item-inv');
  const opt = sel.options[sel.selectedIndex];
  if (opt && opt.value) {
    document.getElementById('item-desc').value = opt.getAttribute('data-nombre') || '';
    document.getElementById('item-precio').value = opt.getAttribute('data-precio') || '0';
    document.getElementById('item-tipo').value = 'producto';
  }
}

async function guardarItemReparacion(repId) {
  const tipo = document.getElementById('item-tipo').value;
  const desc = document.getElementById('item-desc').value.trim();
  const cant = parseFloat(document.getElementById('item-cant').value) || 1;
  const precio = parseFloat(document.getElementById('item-precio').value) || 0;
  if (!desc) { toast('La descripción es obligatoria','error'); return; }
  
  const { error } = await sb.from('reparacion_items').insert({
    reparacion_id: repId,
    tipo,
    descripcion: desc,
    cantidad: cant,
    precio_unitario: precio,
    taller_id: tid()
  });
  if (error) { toast('Error: '+error.message,'error'); return; }
  
  const invId = document.getElementById('item-inv').value;
  if (invId && tipo === 'producto') {
    const { data: inv } = await sb.from('inventario').select('cantidad').eq('id', invId).single();
    if (inv) {
      await sb.from('inventario').update({ cantidad: Math.max(0, parseFloat(inv.cantidad) - cant) }).eq('id', invId);
    }
  }
  
  const { data: rep } = await sb.from('reparaciones').select('costo_repuestos').eq('id', repId).single();
  const nuevoCosto = parseFloat(rep?.costo_repuestos||0) + (tipo==='producto' ? precio*cant : 0);
  await sb.from('reparaciones').update({ costo_repuestos: nuevoCosto }).eq('id', repId);
  
  clearCache('reparaciones'); clearCache('inventario');
  toast('Ítem agregado', 'success');
  closeModal();
  detalleReparacion(repId);
}

// ─── CAMBIAR ESTADO (con control de pagos) ──────────────────────────────────
async function cambiarEstado(id, estado) {
  const { data: rep } = await sb.from('reparaciones').select('costo, descripcion, clientes(nombre)').eq('id', id).single();
  
  if (estado === 'finalizado') {
    const { data: pagos } = await sb.from('pagos_reparacion').select('monto').eq('reparacion_id', id);
    const totalPagado = (pagos||[]).reduce((s,p) => s + parseFloat(p.monto||0), 0);
    const saldo = parseFloat(rep.costo||0) - totalPagado;
    
    if (saldo > 0) {
      const confirmMsg = `Queda un saldo pendiente de ₲${gs(saldo)}. ¿Registrar pago completo ahora?`;
      if (confirm(confirmMsg)) {
        closeModal();
        await modalPagosReparacion(id, saldo);
        return;
      }
    }
    
    if (totalPagado === 0 && rep.costo > 0) {
      const { data: cats } = await sb.from('categorias_financieras').select('id').eq('taller_id',tid()).eq('nombre','Reparaciones').limit(1);
      if (cats?.length) {
        const { data: existe } = await sb.from('movimientos_financieros').select('id').eq('taller_id',tid()).eq('referencia_id',id).eq('referencia_tabla','reparaciones').limit(1);
        if (!existe?.length) {
          await sb.from('movimientos_financieros').insert({
            taller_id: tid(),
            tipo: 'ingreso',
            categoria_id: cats[0].id,
            monto: rep.costo,
            descripcion: 'Trabajo: ' + (rep.descripcion||'') + (rep.clientes?' — '+rep.clientes.nombre:''),
            fecha: new Date().toISOString().split('T')[0],
            referencia_id: id,
            referencia_tabla: 'reparaciones'
          });
        }
      }
    }
  }
  
  await offlineUpdate('reparaciones', { estado }, 'id', id);
  clearCache('reparaciones');
  toast('Estado actualizado', 'success');
  detalleReparacion(id);
}

// ─── PAGOS PARCIALES ────────────────────────────────────────────────────────
async function modalPagosReparacion(repId, montoSugerido = null) {
  const [{ data: rep }, { data: pagos }] = await Promise.all([
    sb.from('reparaciones').select('costo,descripcion').eq('id', repId).single(),
    sb.from('pagos_reparacion').select('*').eq('reparacion_id', repId).order('fecha', {ascending:false})
  ]);
  const totalPagado = (pagos||[]).reduce((s,p) => s + parseFloat(p.monto||0), 0);
  const saldo = montoSugerido !== null ? montoSugerido : parseFloat(rep?.costo||0) - totalPagado;

  openModal(`
    <div class="modal-title">💰 Pagos — ${h(rep?.descripcion||'')}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;margin-bottom:1rem">
      <div style="background:var(--surface2);border-radius:10px;padding:.5rem;text-align:center">
        <div style="font-size:.55rem;color:var(--text2);letter-spacing:1px">TOTAL</div>
        <div style="font-family:var(--font-head);font-size:.95rem;color:var(--text)">₲${gs(rep?.costo||0)}</div>
      </div>
      <div style="background:rgba(0,255,136,.08);border-radius:10px;padding:.5rem;text-align:center">
        <div style="font-size:.55rem;color:var(--success);letter-spacing:1px">PAGADO</div>
        <div style="font-family:var(--font-head);font-size:.95rem;color:var(--success)">₲${gs(totalPagado)}</div>
      </div>
      <div style="background:${saldo>0?'rgba(255,68,68,.08)':'rgba(0,255,136,.08)'};border-radius:10px;padding:.5rem;text-align:center">
        <div style="font-size:.55rem;color:${saldo>0?'var(--danger)':'var(--success)'};letter-spacing:1px">SALDO</div>
        <div style="font-family:var(--font-head);font-size:.95rem;color:${saldo>0?'var(--danger)':'var(--success)'}">₲${gs(saldo)}</div>
      </div>
    </div>
    ${(pagos||[]).length > 0 ? `
    <div style="margin-bottom:1rem">
      ${(pagos||[]).map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-size:.82rem">${h(p.metodo||'Efectivo')}</div>
            <div style="font-size:.68rem;color:var(--text2)">${formatFecha(p.fecha)}${p.notas?' · '+h(p.notas):''}</div>
          </div>
          <div style="font-family:var(--font-head);color:var(--success);font-size:.9rem">₲${gs(p.monto)}</div>
        </div>`).join('')}
    </div>` : ''}
    ${saldo > 0 ? `
    <div style="font-family:var(--font-head);font-size:.75rem;color:var(--text2);letter-spacing:1px;margin-bottom:.4rem">REGISTRAR PAGO</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Monto ₲</label><input class="form-input" id="f-pago-monto" type="number" value="${saldo}" min="1"></div>
      <div class="form-group"><label class="form-label">Método</label>
        <select class="form-input" id="f-pago-metodo">
          <option value="Efectivo">Efectivo</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Tarjeta">Tarjeta</option>
          <option value="Crédito">Crédito (queda como fiado)</option>
          <option value="Otro">Otro</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Nota (opcional)</label><input class="form-input" id="f-pago-notas" placeholder="Seña, cuota 1/3..."></div>
    <button class="btn-primary" onclick="guardarPagoReparacion('${repId}')">Registrar Pago</button>` : '<div style="text-align:center;color:var(--success);font-size:.9rem;padding:.5rem">✓ Totalmente pagado</div>'}
    <button class="btn-secondary" onclick="closeModal()">Cerrar</button>`);
}

async function guardarPagoReparacion(repId) {
  if (guardando()) return;
  const monto = parseFloat(document.getElementById('f-pago-monto').value);
  if (!monto || monto <= 0) { toast('El monto debe ser mayor a 0','error'); return; }
  const metodo = document.getElementById('f-pago-metodo').value;
  const notas = document.getElementById('f-pago-notas').value;
  const fecha = new Date().toISOString().split('T')[0];
  
  const { data: pago, error } = await sb.from('pagos_reparacion').insert({
    reparacion_id: repId,
    monto,
    metodo,
    notas,
    fecha,
    taller_id: tid()
  }).select('id').single();
  
  if (error) { toast('Error: '+error.message,'error'); return; }
  
  if (metodo !== 'Crédito') {
    const { data: cats } = await sb.from('categorias_financieras').select('id').eq('taller_id',tid()).eq('nombre','Reparaciones').limit(1);
    if (cats?.length) {
      const { data: rep } = await sb.from('reparaciones').select('descripcion').eq('id',repId).single();
      await sb.from('movimientos_financieros').insert({
        taller_id: tid(),
        tipo: 'ingreso',
        categoria_id: cats[0].id,
        monto,
        descripcion: 'Pago: ' + (rep?.descripcion||'') + ' (' + metodo + ')',
        fecha,
        referencia_id: pago.id,
        referencia_tabla: 'pagos_reparacion'
      });
    }
  } else {
    const { data: rep } = await sb.from('reparaciones').select('cliente_id,descripcion').eq('id',repId).single();
    if (rep?.cliente_id) {
      await sb.from('fiados').insert({
        cliente_id: rep.cliente_id,
        monto,
        descripcion: 'Crédito: ' + (rep.descripcion||''),
        pagado: false,
        taller_id: tid()
      });
      clearCache('creditos');
    }
  }
  
  clearCache('reparaciones');
  toast('Pago registrado', 'success');
  closeModal();
  detalleReparacion(repId);
}

// ─── MODALES DE NUEVA/EDITAR REPARACIÓN ─────────────────────────────────────
async function modalNuevaReparacion() {
  const { data:inv } = await sb.from('inventario').select('id,nombre,cantidad,precio_unitario').eq('taller_id',tid()).order('nombre').limit(200);
  openModal(`
    <div class="modal-title">Nuevo Trabajo</div>
    <div class="form-group"><label class="form-label">Tipo de trabajo</label>
      <select class="form-input" id="f-tipo-trabajo">
        ${TIPOS_TRABAJO.map(t => `<option value="${t}">${TIPO_ICONS[t]||'📋'} ${t}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="f-desc" placeholder="Cambio de pastillas delanteras"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t("lblCosto")}</label><input class="form-input" id="f-costo" type="number" min="0" placeholder="Total facturado"></div>
      <div class="form-group"><label class="form-label">Costo repuestos</label><input class="form-input" id="f-costo-rep" type="number" min="0" placeholder="0"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Kilometraje actual</label><input class="form-input" id="f-km" type="number" placeholder="Ej: 45000"></div>
      <div class="form-group"><label class="form-label">Combustible</label>
        <select class="form-input" id="f-combustible">
          <option value="RESERVA">RESERVA</option><option value="1/4">1/4</option><option value="1/2" selected>1/2</option>
          <option value="3/4">3/4</option><option value="LLENO">LLENO</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">${t("lblFecha")}</label><input class="form-input" id="f-fecha" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label class="form-label">${t("lblEstado")}</label>
      <select class="form-input" id="f-estado">
        <option value="pendiente">${t('repPendiente')}</option>
        <option value="en_progreso">${t('repEnProgreso')}</option>
        <option value="esperando_repuestos">Esperando repuestos</option>
        <option value="finalizado">${t('repFinalizadas')}</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Cliente</label>
      ${searchableSelect('f-cliente','Buscar cliente por nombre...')}
    </div>
    <div class="form-group"><label class="form-label">Vehículo</label>
      ${searchableSelect('f-vehiculo','Buscar por patente o marca...')}
      <button onclick="toggleNuevoVehRep()" id="btn-toggle-nv" style="margin-top:.4rem;width:100%;background:rgba(0,229,255,.08);color:var(--accent);border:1px solid rgba(0,229,255,.2);border-radius:8px;padding:.45rem;font-size:.78rem;cursor:pointer;font-family:var(--font-head)">+ Registrar vehículo nuevo</button>
    </div>
    <div id="nuevo-veh-rep" style="display:none;background:var(--surface2);border:1px solid var(--accent);border-radius:10px;padding:.75rem;margin-bottom:.75rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <div style="font-size:.72rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px">NUEVO VEHÍCULO</div>
        <button onclick="toggleNuevoVehRep()" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:.9rem">✕</button>
      </div>
      <div class="form-group"><label class="form-label">Patente *</label><input class="form-input" id="f-nv-patente" placeholder="ABC 123" style="text-transform:uppercase"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Marca *</label><input class="form-input" id="f-nv-marca" placeholder="Toyota"></div>
        <div class="form-group"><label class="form-label">Modelo</label><input class="form-input" id="f-nv-modelo" placeholder="Hilux"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Año</label><input class="form-input" id="f-nv-anio" type="number" placeholder="2020"></div>
        <div class="form-group"><label class="form-label">Color</label><input class="form-input" id="f-nv-color" placeholder="Blanco"></div>
      </div>
      <div style="font-size:.7rem;color:var(--text2);margin-top:.3rem">Se vinculará al cliente seleccionado arriba automáticamente.</div>
    </div>
    <div class="form-group"><label class="form-label">${t("lblNotas")}</label><textarea class="form-input" id="f-notas" rows="2"></textarea></div>
    <button class="btn-primary" onclick="guardarReparacion()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
    
  ssRegister('f-cliente', async (q) => {
    const { data } = await sb.from('clientes').select('id,nombre,telefono').eq('taller_id',tid()).ilike('nombre','%'+q+'%').limit(8);
    return (data||[]).map(c => ({ id:c.id, label:c.nombre+(c.telefono?' — '+c.telefono:'') }));
  });
  ssRegister('f-vehiculo', async (q) => {
    const clienteId = document.getElementById('f-cliente')?.value;
    let query = sb.from('vehiculos').select('id,patente,marca,modelo,clientes(nombre)').eq('taller_id',tid());
    if (clienteId) query = query.eq('cliente_id', clienteId);
    if (q) query = query.or('patente.ilike.%'+q+'%,marca.ilike.%'+q+'%');
    const { data } = await query.limit(8);
    return (data||[]).map(v => ({ id:v.id, label:v.patente+' — '+v.marca+' '+(v.modelo||'')+(v.clientes?' ('+v.clientes.nombre+')':'') }));
  });
}

function toggleNuevoVehRep() {
  const el = document.getElementById('nuevo-veh-rep');
  const btn = document.getElementById('btn-toggle-nv');
  const searchInput = document.getElementById('f-vehiculo-search');
  if (el.style.display === 'none') {
    el.style.display = 'block';
    document.getElementById('f-vehiculo').value = '';
    if (searchInput) { searchInput.value = ''; searchInput.disabled = true; searchInput.placeholder = 'Creando vehículo nuevo...'; }
    if (btn) btn.textContent = '✕ Cancelar vehículo nuevo';
    if (btn) btn.style.background = 'rgba(255,68,68,.08)';
    if (btn) btn.style.color = 'var(--danger)';
    if (btn) btn.style.borderColor = 'rgba(255,68,68,.2)';
  } else {
    el.style.display = 'none';
    if (searchInput) { searchInput.disabled = false; searchInput.placeholder = 'Buscar por patente o marca...'; }
    if (btn) btn.textContent = '+ Registrar vehículo nuevo';
    if (btn) btn.style.background = 'rgba(0,229,255,.08)';
    if (btn) btn.style.color = 'var(--accent)';
    if (btn) btn.style.borderColor = 'rgba(0,229,255,.2)';
    ['f-nv-patente','f-nv-marca','f-nv-modelo','f-nv-anio','f-nv-color'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
  }
}

async function guardarReparacion(id=null) {
  if (guardando()) return;
  const desc = document.getElementById('f-desc').value.trim();
  if (!desc) { toast('La descripción es obligatoria','error'); return; }
  let vid = document.getElementById('f-vehiculo').value;
  const cid = document.getElementById('f-cliente').value;

  const nvPatente = document.getElementById('f-nv-patente')?.value?.trim()?.toUpperCase();
  if (!vid && nvPatente) {
    const { data: nuevoVeh, error: vErr } = await sb.from('vehiculos').insert({
      patente: nvPatente,
      marca: document.getElementById('f-nv-marca')?.value || '',
      modelo: document.getElementById('f-nv-modelo')?.value || '',
      anio: parseInt(document.getElementById('f-nv-anio')?.value) || null,
      color: document.getElementById('f-nv-color')?.value || null,
      cliente_id: cid || null,
      taller_id: tid()
    }).select('id').single();
    if (vErr) { toast('Error creando vehículo: '+vErr.message,'error'); return; }
    vid = nuevoVeh.id;
    toast('Vehículo '+nvPatente+' creado','success');
  }

  const costoRep = parseFloat(document.getElementById('f-costo-rep')?.value) || 0;
  const tipoTrabajo = document.getElementById('f-tipo-trabajo')?.value || 'Mecánica general';
  const data = { 
    descripcion:desc, 
    tipo_trabajo:tipoTrabajo, 
    costo:parseFloat(document.getElementById('f-costo').value)||0, 
    costo_repuestos:costoRep, 
    fecha:document.getElementById('f-fecha').value, 
    estado:document.getElementById('f-estado').value, 
    vehiculo_id:vid||null, 
    cliente_id:cid||null, 
    notas:document.getElementById('f-notas').value, 
    taller_id:tid(), 
    kilometraje_ingreso:parseInt(document.getElementById('f-km')?.value)||null, 
    combustible_ingreso:document.getElementById('f-combustible')?.value||null 
  };
  
  const { data: saved, error } = id 
    ? await sb.from('reparaciones').update(data).eq('id',id).select('id').single() 
    : await sb.from('reparaciones').insert(data).select('id').single();
    
  if (error) { toast('Error: '+error.message,'error'); return; }

  if (!id && saved?.id && currentPerfil?.rol === 'empleado') {
    await sb.from('reparacion_mecanicos').insert({
      reparacion_id: saved.id,
      mecanico_id: currentUser.id,
      nombre_mecanico: currentPerfil.nombre,
      horas: 0,
      pago: 0
    });
  }

  clearCache('reparaciones');
  toast('Trabajo guardado','success');
  closeModal();
  reparaciones();
}

async function modalEditarReparacion(id) {
  const [{ data:r }, { data:vehs }, { data:cls }] = await Promise.all([
    sb.from('reparaciones').select('*').eq('id',id).single(),
    sb.from('vehiculos').select('id,patente,marca').eq('taller_id',tid()).order('patente'),
    sb.from('clientes').select('id,nombre').eq('taller_id',tid()).order('nombre')
  ]);
  openModal(`
    <div class="modal-title">Editar Trabajo</div>
    <div class="form-group"><label class="form-label">Tipo de trabajo</label>
      <select class="form-input" id="f-tipo-trabajo">
        ${TIPOS_TRABAJO.map(t => `<option value="${t}" ${t===(r.tipo_trabajo||'Mecánica general')?'selected':''}>${TIPO_ICONS[t]||'📋'} ${t}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="f-desc" value="${h(r.descripcion||'')}"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t("lblCosto")}</label><input class="form-input" id="f-costo" type="number" min="0" value="${r.costo||0}"></div>
      <div class="form-group"><label class="form-label">Costo repuestos</label><input class="form-input" id="f-costo-rep" type="number" min="0" value="${r.costo_repuestos||0}"></div>
    </div>
    <div class="form-group"><label class="form-label">${t("lblFecha")}</label><input class="form-input" id="f-fecha" type="date" value="${r.fecha||''}"></div>
    <div class="form-group"><label class="form-label">${t("lblEstado")}</label>
      <select class="form-input" id="f-estado">
        <option value="pendiente" ${r.estado==='pendiente'?'selected':''}>${t('repPendiente')}</option>
        <option value="en_progreso" ${r.estado==='en_progreso'?'selected':''}>${t('repEnProgreso')}</option>
        <option value="esperando_repuestos" ${r.estado==='esperando_repuestos'?'selected':''}>Esperando repuestos</option>
        <option value="finalizado" ${r.estado==='finalizado'?'selected':''}>${t('repFinalizadas')}</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Vehículo</label>
      ${searchableSelect('f-vehiculo','Buscar por patente o marca...')}
    </div>
    <div class="form-group"><label class="form-label">Cliente</label>
      ${searchableSelect('f-cliente','Buscar cliente por nombre...')}
    </div>
    <div class="form-group"><label class="form-label">${t("lblNotas")}</label><textarea class="form-input" id="f-notas" rows="2">${h(r.notas||'')}</textarea></div>
    <button class="btn-primary" onclick="guardarReparacion('${id}')">${t('actualizar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
    
  ssRegister('f-vehiculo', async (q) => {
    const { data } = await sb.from('vehiculos').select('id,patente,marca,modelo').eq('taller_id',tid()).or('patente.ilike.%'+q+'%,marca.ilike.%'+q+'%').limit(8);
    return (data||[]).map(v => ({ id:v.id, label:v.patente+' — '+v.marca+' '+(v.modelo||'') }));
  });
  ssRegister('f-cliente', async (q) => {
    const { data } = await sb.from('clientes').select('id,nombre,telefono').eq('taller_id',tid()).ilike('nombre','%'+q+'%').limit(8);
    return (data||[]).map(c => ({ id:c.id, label:c.nombre+(c.telefono?' — '+c.telefono:'') }));
  });
  if (r.vehiculo_id && vehs) {
    const v = vehs.find(v=>v.id===r.vehiculo_id);
    if (v) ssSetValue('f-vehiculo', v.id, v.patente+' — '+v.marca);
  }
  if (r.cliente_id && cls) {
    const c = cls.find(c=>c.id===r.cliente_id);
    if (c) ssSetValue('f-cliente', c.id, c.nombre);
  }
}

async function eliminarReparacion(id) {
  confirmar('Esta acción eliminará el trabajo permanentemente.', async () => {
    await offlineDelete('reparaciones', 'id', id);
    clearCache('reparaciones');
    toast('Trabajo eliminado');
    navigate('reparaciones');
  });
}

function modalActualizarCosto(id, costoActual, repuestosActual) {
  openModal(`
    <div class="modal-title">✏️ Actualizar costos</div>
    <div class="form-group"><label class="form-label">Cobrado al cliente ₲</label><input class="form-input" id="f-upd-costo" type="number" min="0" value="${costoActual||0}"></div>
    <div class="form-group"><label class="form-label">Gastado en repuestos ₲</label><input class="form-input" id="f-upd-rep" type="number" min="0" value="${repuestosActual||0}"></div>
    <div class="form-group"><label class="form-label">Notas adicionales</label><textarea class="form-input" id="f-upd-notas" rows="2" placeholder="Cambió el presupuesto porque..."></textarea></div>
    <button class="btn-primary" onclick="guardarActualizarCosto('${id}')">Actualizar</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function guardarActualizarCosto(id) {
  if (guardando()) return;
  const costo = parseFloat(document.getElementById('f-upd-costo').value) || 0;
  const rep = parseFloat(document.getElementById('f-upd-rep').value) || 0;
  const notasExtra = document.getElementById('f-upd-notas').value.trim();
  const updates = { costo, costo_repuestos: rep };
  if (notasExtra) {
    const { data: r } = await sb.from('reparaciones').select('notas').eq('id',id).single();
    updates.notas = ((r?.notas||'') + '\n' + notasExtra).trim();
  }
  await sb.from('reparaciones').update(updates).eq('id', id);
  clearCache('reparaciones');
  toast('Costos actualizados','success');
  closeModal();
  detalleReparacion(id);
}

function aprobarPresupuestoCliente(repId, decision) {
  const confirmMsg = decision === 'aprobado' 
    ? '¿Confirmás que aprobás este presupuesto?' 
    : '¿Confirmás que rechazás este presupuesto?';
  if (!confirm(confirmMsg)) return;
  offlineUpdate('reparaciones', { 
    aprobacion_cliente: decision, 
    fecha_aprobacion: new Date().toISOString() 
  }, 'id', repId).then(() => {
    toast(decision === 'aprobado' ? 'Presupuesto aprobado' : 'Presupuesto rechazado', decision === 'aprobado' ? 'success' : 'error');
    detalleReparacion(repId);
  });
}

function enviarAprobacionWhatsApp(repId) {
  sb.from('reparaciones').select('*, clientes(nombre,telefono), vehiculos(patente)').eq('id',repId).single().then(({data:r}) => {
    if (!r?.clientes?.telefono) return;
    const tel = r.clientes.telefono.replace(/\D/g,'');
    const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';
    const msg = `Hola ${r.clientes.nombre}! Soy del taller ${tallerNombre}. Te paso el presupuesto para tu vehículo ${r.vehiculos?.patente||''}:\n\n🔧 ${r.descripcion}\n💰 Costo: ₲${gs(r.costo)}\n\n¿Aprobás este trabajo? Respondé con SI o NO.`;
    window.open(`https://wa.me/595${tel}?text=${encodeURIComponent(msg)}`);
  });
}

// Las funciones de fotos, checklist, ficha recepción y carta conformidad se mantienen igual que en el archivo original.
// (No se modifican para esta integración)
// ─── CHECKLIST DE RECEPCIÓN ─────────────────────────────────────────────────
async function modalChecklistRecepcion(repId) {
  const { data:r } = await sb.from('reparaciones').select('checklist_recepcion').eq('id',repId).single();
  const checklist = r?.checklist_recepcion || {};
  const items = [
    'Nivel de aceite','Nivel de refrigerante','Nivel de combustible',
    'Frenos','Luces','Neumáticos','Batería',
    'Carrocería (golpes/rayas)','Interior/tapizado',
    'Aire acondicionado','Limpiaparabrisas','Espejos'
  ];
  openModal(`
    <div class="modal-title">📋 Revisión de Recepción</div>
    <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">Marcar el estado de cada punto al recibir el vehículo</div>
    ${items.map(item => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border)">
      <span style="font-size:.85rem;flex:1">${item}</span>
      <div style="display:flex;gap:.3rem">
        <button onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.style.opacity='.4');this.style.opacity='1';this.dataset.val='ok'" data-val="${checklist[item]||''}" style="padding:.25rem .5rem;border-radius:6px;border:1px solid var(--success);background:${checklist[item]==='ok'?'rgba(0,255,136,.2)':'transparent'};color:var(--success);font-size:.75rem;cursor:pointer;opacity:${checklist[item]==='ok'?'1':'.4'}">✓ OK</button>
        <button onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.style.opacity='.4');this.style.opacity='1';this.dataset.val='problema'" data-val="${checklist[item]||''}" style="padding:.25rem .5rem;border-radius:6px;border:1px solid var(--danger);background:${checklist[item]==='problema'?'rgba(255,68,68,.15)':'transparent'};color:var(--danger);font-size:.75rem;cursor:pointer;opacity:${checklist[item]==='problema'?'1':'.4'}">⚠</button>
      </div>
    </div>`).join('')}
    <div class="form-group" style="margin-top:1rem"><label class="form-label">Km del vehículo</label><input class="form-input" id="f-km-recepcion" type="number" value="${h(checklist['_km']||'')}" placeholder="Ej: 45000"></div>
    <div class="form-group"><label class="form-label">Observaciones</label><textarea class="form-input" id="f-obs-recepcion" rows="2" placeholder="Detalles adicionales...">${h(checklist['_observaciones']||'')}</textarea></div>
    <button class="btn-primary" onclick="guardarChecklist('${repId}')">GUARDAR CHECKLIST</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarChecklist(repId) {
  const items = document.querySelectorAll('#modal-overlay .modal-content > div[style*="border-bottom"]');
  const checklist = {};
  items.forEach(row => {
    const label = row.querySelector('span').textContent;
    const btns = row.querySelectorAll('button');
    const okBtn = btns[0], probBtn = btns[1];
    if (okBtn.style.opacity === '1') checklist[label] = 'ok';
    else if (probBtn.style.opacity === '1') checklist[label] = 'problema';
  });
  const km = document.getElementById('f-km-recepcion')?.value;
  const obs = document.getElementById('f-obs-recepcion')?.value;
  if (km) checklist['_km'] = km;
  if (obs) checklist['_observaciones'] = obs;
  await offlineUpdate('reparaciones', { checklist_recepcion: checklist }, 'id', repId);
  toast('Checklist guardado','success'); closeModal(); detalleReparacion(repId);
}

// ─── FOTOS POR ETAPA ─────────────────────────────────────────────────────────
function modalFotosEtapa(repId, etapa) {
  const labels = { recepcion:'Recepción', proceso:'En Proceso', entrega:'Entrega' };
  const colors = { recepcion:'var(--text2)', proceso:'var(--accent2)', entrega:'var(--success)' };
  openModal(`
    <div class="modal-title" style="color:${colors[etapa]}">📷 Fotos — ${labels[etapa]}</div>
    <div style="font-size:.8rem;color:var(--text2);margin-bottom:1rem">${etapa==='recepcion'?'Estado del vehículo al recibirlo':etapa==='proceso'?'Fotos durante la reparación':'Estado del vehículo al entregar'}</div>
    <div class="form-group">
      <input type="file" id="f-fotos-etapa" accept="image/*" multiple capture="environment" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.5rem;color:var(--text);font-size:.85rem">
    </div>
    <div id="fotos-preview" style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:1rem"></div>
    <button class="btn-primary" onclick="subirFotosEtapa('${repId}','${etapa}')">SUBIR FOTOS</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);

  document.getElementById('f-fotos-etapa').addEventListener('change', (e) => {
    const preview = document.getElementById('fotos-preview');
    preview.innerHTML = '';
    Array.from(e.target.files).forEach(file => {
      const url = URL.createObjectURL(file);
      preview.innerHTML += `<img src="${url}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">`;
    });
  });
}

async function subirFotosEtapa(repId, etapa) {
  const input = document.getElementById('f-fotos-etapa');
  if (!input.files.length) { toast('Seleccioná al menos una foto','error'); return; }
  toast('Subiendo fotos...','info');
  const campo = etapa === 'recepcion' ? 'fotos_recepcion' : etapa === 'proceso' ? 'fotos_proceso' : 'fotos_entrega';
  const { data:r } = await sb.from('reparaciones').select(campo).eq('id',repId).single();
  const fotosExistentes = r?.[campo] || [];
  const nuevasFotos = [];

  for (const file of input.files) {
    const ext = file.name.split('.').pop();
    const path = `${etapa}/${repId}/${Date.now()}_${Math.random().toString(36).substr(2,9)}.${ext}`;
    const { error } = await sb.storage.from('fotos').upload(path, file);
    if (!error) {
      const { data } = sb.storage.from('fotos').getPublicUrl(path);
      nuevasFotos.push(data.publicUrl);
    }
  }
  const todasFotos = [...fotosExistentes, ...nuevasFotos];
  await offlineUpdate('reparaciones', { [campo]: todasFotos }, 'id', repId);
  toast(`${nuevasFotos.length} foto(s) subida(s)`,'success'); closeModal(); detalleReparacion(repId);
}

// ─── FICHA DE RECEPCIÓN ─────────────────────────────────────────────────────
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
