// ─── PRESUPUESTOS (Flujo: Generado → Aprobado → OT automática) ──────────────
// Este archivo unifica la funcionalidad de presupuestos y facturas.

const PRESUPUESTO_ESTADOS = {generado:'GENERADO',aprobado:'APROBADO',rechazado:'RECHAZADO'};
const presupuestoBadge = (e) => ({generado:'badge-yellow',aprobado:'badge-green',rechazado:'badge-red'}[e]||'badge-blue');

// Listado principal (reemplaza a facturacion())
async function presupuestos({ filtro='todos', search='', offset=0 }={}) {
  const cacheKey = `presupuestos_${filtro}_${search}_${offset}`;
  const { data, count } = await cachedQuery(cacheKey, () => {
    let q = sb.from('presupuestos_v2').select('*, vehiculos(patente,marca,modelo), clientes(nombre)', {count:'exact'})
      .eq('taller_id',tid()).order('created_at',{ascending:false});
    if (filtro!=='todos') q = q.eq('estado',filtro);
    if (search) q = q.ilike('descripcion', `%${search}%`);
    return q.range(offset, offset + PAGE_SIZE - 1);
  });
  
  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('facTitulo')} ${count ? `<span style="font-size:.75rem;color:var(--text2)">(${count})</span>` : ''}</div>
      <button class="btn-add" onclick="modalNuevoPresupuesto()">+ Nuevo</button>
    </div>
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" placeholder="Buscar presupuesto..." value="${h(search)}" oninput="debounce('ppto',()=>presupuestos({filtro:'${filtro}',search:this.value}))" class="form-input" style="padding-left:2.5rem">
    </div>
    <div class="tabs">
      <button class="tab ${filtro==='todos'?'active':''}" onclick="presupuestos({filtro:'todos'})">Todos</button>
      <button class="tab ${filtro==='generado'?'active':''}" onclick="presupuestos({filtro:'generado'})">Generados</button>
      <button class="tab ${filtro==='aprobado'?'active':''}" onclick="presupuestos({filtro:'aprobado'})">Aprobados</button>
      <button class="tab ${filtro==='rechazado'?'active':''}" onclick="presupuestos({filtro:'rechazado'})">Rechazados</button>
    </div>
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('facSinDatos')}</p></div>` :
      (data||[]).map(p => `
      <div class="card" onclick="detallePresupuesto('${p.id}')">
        <div class="card-header">
          <div class="card-avatar">📋</div>
          <div class="card-info">
            <div class="card-name">${h(p.descripcion||'Presupuesto')}</div>
            <div class="card-sub">${p.vehiculos?h(p.vehiculos.marca)+' '+h(p.vehiculos.patente):''} · ${p.clientes?h(p.clientes.nombre):''}</div>
            <div class="card-sub">${formatFecha(p.created_at?.split('T')[0])} · ₲${gs(p.total||0)}</div>
          </div>
          <span class="card-badge ${presupuestoBadge(p.estado)}">${PRESUPUESTO_ESTADOS[p.estado]||p.estado}</span>
        </div>
      </div>`).join('')}
    ${renderPagination(count||0, offset, '_navPpto')}`;
}
function _navPpto(o) { presupuestos({offset:o}); }

// Detalle de presupuesto (unificado)
async function detallePresupuesto(id) {
  const { data:p } = await sb.from('presupuestos_v2').select('*, vehiculos(patente,marca,modelo,anio,color), clientes(nombre,telefono,ruc)').eq('id',id).single();
  if (!p) return;
  const items = p.items || [];
  const totalServicios = items.filter(i=>i.tipo==='servicio').reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);
  const totalProductos = items.filter(i=>i.tipo==='producto').reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);
  const totalAdicionales = items.filter(i=>i.tipo==='adicional').reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);
  const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';
  const tallerRuc = currentPerfil?.talleres?.ruc || '';
  const tallerDir = currentPerfil?.talleres?.direccion || '';
  const tallerTel = currentPerfil?.talleres?.telefono || '';

  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('presupuestos')">${t('volver')}</button>
      <div class="detail-avatar">📋</div>
      <div style="flex:1"><div class="detail-name">${h(p.descripcion||'Presupuesto')}</div><div class="detail-sub">${formatFecha(p.created_at?.split('T')[0])}</div></div>
      <span class="card-badge ${presupuestoBadge(p.estado)}">${PRESUPUESTO_ESTADOS[p.estado]||p.estado}</span>
    </div>

    <!-- Vista imprimible estilo factura -->
    <div id="presupuesto-imprimible" style="background:var(--surface2);border-radius:12px;padding:1rem;margin-bottom:1rem;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem">
        <div>
          <div style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent);letter-spacing:2px">${h(tallerNombre)}</div>
          ${tallerRuc?`<div style="font-size:.75rem;color:var(--text2)">RUC: ${h(tallerRuc)}</div>`:''}
          ${tallerDir?`<div style="font-size:.72rem;color:var(--text2)">${h(tallerDir)}</div>`:''}
          ${tallerTel?`<div style="font-size:.72rem;color:var(--text2)">Tel: ${h(tallerTel)}</div>`:''}
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--font-head);font-size:1rem;color:var(--text)">PRESUPUESTO</div>
          <div style="font-size:.75rem;color:var(--text2)">${formatFecha(p.created_at?.split('T')[0])}</div>
        </div>
      </div>

      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);margin-bottom:.4rem;letter-spacing:1px">CLIENTE</div>
      <div class="factura-item"><span style="color:var(--text2)">Nombre</span><span>${p.clientes?h(p.clientes.nombre):'-'}</span></div>
      ${p.clientes?.ruc?`<div class="factura-item"><span style="color:var(--text2)">RUC / CI</span><span>${h(p.clientes.ruc)}</span></div>`:''}
      ${p.clientes?.telefono?`<div class="factura-item"><span style="color:var(--text2)">Teléfono</span><span>${h(p.clientes.telefono)}</span></div>`:''}

      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);margin:.5rem 0 .4rem;letter-spacing:1px">VEHÍCULO</div>
      <div class="factura-item"><span style="color:var(--text2)">Patente</span><span>${p.vehiculos?h(p.vehiculos.patente):'-'}</span></div>
      <div class="factura-item"><span style="color:var(--text2)">Marca/Modelo</span><span>${p.vehiculos?h(p.vehiculos.marca)+' '+h(p.vehiculos.modelo||''):'-'}</span></div>

      <div style="height:1px;background:var(--border);margin:.5rem 0"></div>
      ${items.length===0 ? '<p style="color:var(--text2);font-size:.85rem">Sin ítems</p>' : items.map(i=>`
        <div class="factura-item"><span>${h(i.descripcion)}${i.cantidad>1?' x'+i.cantidad:''}</span><span>₲${gs(parseFloat(i.precio||0)*(i.cantidad||1))}</span></div>
      `).join('')}
      
      ${p.descuento>0?`<div class="factura-item"><span style="color:var(--danger)">Descuento</span><span style="color:var(--danger)">-₲${gs(p.descuento)}</span></div>`:''}
      <div class="factura-total"><span>TOTAL</span><span>₲${gs(p.total||0)}</span></div>
      <div style="text-align:right;font-size:.7rem;color:var(--text2)">I.V.A. INCLUIDO</div>
      
      ${p.observaciones?`<div style="margin-top:.5rem;font-size:.8rem;color:var(--text2);font-style:italic">${h(p.observaciones)}</div>`:''}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem">
      <button class="btn-secondary" style="margin:0" onclick="window.print()">🖨️ ${t('facImprimir')}</button>
      <button class="btn-secondary" style="margin:0" onclick="compartirPresupuesto('${id}')">📥 PDF</button>
    </div>
    
    ${p.clientes?.telefono ? `
    <button onclick="enviarPresupuestoWhatsApp('${id}')" style="width:100%;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:.7rem;font-family:var(--font-head);font-size:.95rem;cursor:pointer;margin-bottom:.5rem">💬 ${t('facWhatsapp')}</button>
    ` : ''}

    <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
      ${p.estado==='generado' ? `
        <button class="btn-primary" style="flex:1;margin:0;background:var(--success)" onclick="aprobarPresupuesto('${p.id}')">✓ APROBAR</button>
        <button class="btn-danger" style="flex:1;margin:0" onclick="rechazarPresupuesto('${p.id}')">✕ RECHAZAR</button>
        <button class="btn-secondary" style="flex:1;margin:0" onclick="modalEditarPresupuesto('${p.id}')">Editar</button>
      ` : ''}
      ${p.estado==='aprobado' && p.reparacion_id ? `
        <button class="btn-primary" style="flex:1;margin:0" onclick="detalleReparacion('${p.reparacion_id}')">Ver Orden de Trabajo</button>
      ` : ''}
      ${currentPerfil?.rol==='admin' && p.estado!=='aprobado' ? `
        <button class="btn-danger" style="margin:0" onclick="eliminarPresupuesto('${p.id}')">${t('eliminarBtn')}</button>
      ` : ''}
    </div>`;
}// ─── PRESUPUESTOS (Flujo: Generado → Aprobado → OT automática con ítems) ─────
// Este archivo unifica la funcionalidad de presupuestos y facturas.

const PRESUPUESTO_ESTADOS = {generado:'GENERADO',aprobado:'APROBADO',rechazado:'RECHAZADO'};
const presupuestoBadge = (e) => ({generado:'badge-yellow',aprobado:'badge-green',rechazado:'badge-red'}[e]||'badge-blue');

async function presupuestos({ filtro='todos', search='', offset=0 }={}) {
  const cacheKey = `presupuestos_${filtro}_${search}_${offset}`;
  const { data, count } = await cachedQuery(cacheKey, () => {
    let q = sb.from('presupuestos_v2').select('*, vehiculos(patente,marca,modelo), clientes(nombre)', {count:'exact'})
      .eq('taller_id',tid()).order('created_at',{ascending:false});
    if (filtro!=='todos') q = q.eq('estado',filtro);
    if (search) q = q.ilike('descripcion', `%${search}%`);
    return q.range(offset, offset + PAGE_SIZE - 1);
  });
  
  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('facTitulo')} ${count ? `<span style="font-size:.75rem;color:var(--text2)">(${count})</span>` : ''}</div>
      <button class="btn-add" onclick="modalNuevoPresupuesto()">+ Nuevo</button>
    </div>
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" placeholder="Buscar presupuesto..." value="${h(search)}" oninput="debounce('ppto',()=>presupuestos({filtro:'${filtro}',search:this.value}))" class="form-input" style="padding-left:2.5rem">
    </div>
    <div class="tabs">
      <button class="tab ${filtro==='todos'?'active':''}" onclick="presupuestos({filtro:'todos'})">Todos</button>
      <button class="tab ${filtro==='generado'?'active':''}" onclick="presupuestos({filtro:'generado'})">Generados</button>
      <button class="tab ${filtro==='aprobado'?'active':''}" onclick="presupuestos({filtro:'aprobado'})">Aprobados</button>
      <button class="tab ${filtro==='rechazado'?'active':''}" onclick="presupuestos({filtro:'rechazado'})">Rechazados</button>
    </div>
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('facSinDatos')}</p></div>` :
      (data||[]).map(p => `
      <div class="card" onclick="detallePresupuesto('${p.id}')">
        <div class="card-header">
          <div class="card-avatar">📋</div>
          <div class="card-info">
            <div class="card-name">${h(p.descripcion||'Presupuesto')}</div>
            <div class="card-sub">${p.vehiculos?h(p.vehiculos.marca)+' '+h(p.vehiculos.patente):''} · ${p.clientes?h(p.clientes.nombre):''}</div>
            <div class="card-sub">${formatFecha(p.created_at?.split('T')[0])} · ₲${gs(p.total||0)}</div>
          </div>
          <span class="card-badge ${presupuestoBadge(p.estado)}">${PRESUPUESTO_ESTADOS[p.estado]||p.estado}</span>
        </div>
      </div>`).join('')}
    ${renderPagination(count||0, offset, '_navPpto')}`;
}
function _navPpto(o) { presupuestos({offset:o}); }

async function detallePresupuesto(id) {
  const { data:p } = await sb.from('presupuestos_v2').select('*, vehiculos(patente,marca,modelo,anio,color), clientes(nombre,telefono,ruc)').eq('id',id).single();
  if (!p) return;
  const items = p.items || [];
  const totalServicios = items.filter(i=>i.tipo==='servicio').reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);
  const totalProductos = items.filter(i=>i.tipo==='producto').reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);
  const totalAdicionales = items.filter(i=>i.tipo==='adicional').reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);
  const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';
  const tallerRuc = currentPerfil?.talleres?.ruc || '';
  const tallerDir = currentPerfil?.talleres?.direccion || '';
  const tallerTel = currentPerfil?.talleres?.telefono || '';

  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('presupuestos')">${t('volver')}</button>
      <div class="detail-avatar">📋</div>
      <div style="flex:1"><div class="detail-name">${h(p.descripcion||'Presupuesto')}</div><div class="detail-sub">${formatFecha(p.created_at?.split('T')[0])}</div></div>
      <span class="card-badge ${presupuestoBadge(p.estado)}">${PRESUPUESTO_ESTADOS[p.estado]||p.estado}</span>
    </div>

    <div id="presupuesto-imprimible" style="background:var(--surface2);border-radius:12px;padding:1rem;margin-bottom:1rem;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem">
        <div>
          <div style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent);letter-spacing:2px">${h(tallerNombre)}</div>
          ${tallerRuc?`<div style="font-size:.75rem;color:var(--text2)">RUC: ${h(tallerRuc)}</div>`:''}
          ${tallerDir?`<div style="font-size:.72rem;color:var(--text2)">${h(tallerDir)}</div>`:''}
          ${tallerTel?`<div style="font-size:.72rem;color:var(--text2)">Tel: ${h(tallerTel)}</div>`:''}
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--font-head);font-size:1rem;color:var(--text)">PRESUPUESTO</div>
          <div style="font-size:.75rem;color:var(--text2)">${formatFecha(p.created_at?.split('T')[0])}</div>
        </div>
      </div>

      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);margin-bottom:.4rem;letter-spacing:1px">CLIENTE</div>
      <div class="factura-item"><span style="color:var(--text2)">Nombre</span><span>${p.clientes?h(p.clientes.nombre):'-'}</span></div>
      ${p.clientes?.ruc?`<div class="factura-item"><span style="color:var(--text2)">RUC / CI</span><span>${h(p.clientes.ruc)}</span></div>`:''}
      ${p.clientes?.telefono?`<div class="factura-item"><span style="color:var(--text2)">Teléfono</span><span>${h(p.clientes.telefono)}</span></div>`:''}

      <div style="font-family:var(--font-head);font-size:.8rem;color:var(--text2);margin:.5rem 0 .4rem;letter-spacing:1px">VEHÍCULO</div>
      <div class="factura-item"><span style="color:var(--text2)">Patente</span><span>${p.vehiculos?h(p.vehiculos.patente):'-'}</span></div>
      <div class="factura-item"><span style="color:var(--text2)">Marca/Modelo</span><span>${p.vehiculos?h(p.vehiculos.marca)+' '+h(p.vehiculos.modelo||''):'-'}</span></div>

      <div style="height:1px;background:var(--border);margin:.5rem 0"></div>
      ${items.length===0 ? '<p style="color:var(--text2);font-size:.85rem">Sin ítems</p>' : items.map(i=>`
        <div class="factura-item"><span>${h(i.descripcion)}${i.cantidad>1?' x'+i.cantidad:''}</span><span>₲${gs(parseFloat(i.precio||0)*(i.cantidad||1))}</span></div>
      `).join('')}
      
      ${p.descuento>0?`<div class="factura-item"><span style="color:var(--danger)">Descuento</span><span style="color:var(--danger)">-₲${gs(p.descuento)}</span></div>`:''}
      <div class="factura-total"><span>TOTAL</span><span>₲${gs(p.total||0)}</span></div>
      <div style="text-align:right;font-size:.7rem;color:var(--text2)">I.V.A. INCLUIDO</div>
      
      ${p.observaciones?`<div style="margin-top:.5rem;font-size:.8rem;color:var(--text2);font-style:italic">${h(p.observaciones)}</div>`:''}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem">
      <button class="btn-secondary" style="margin:0" onclick="window.print()">🖨️ ${t('facImprimir')}</button>
      <button class="btn-secondary" style="margin:0" onclick="compartirPresupuesto('${id}')">📥 PDF</button>
    </div>
    
    ${p.clientes?.telefono ? `
    <button onclick="enviarPresupuestoWhatsApp('${id}')" style="width:100%;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:.7rem;font-family:var(--font-head);font-size:.95rem;cursor:pointer;margin-bottom:.5rem">💬 ${t('facWhatsapp')}</button>
    ` : ''}

    <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
      ${p.estado==='generado' ? `
        <button class="btn-primary" style="flex:1;margin:0;background:var(--success)" onclick="aprobarPresupuesto('${p.id}')">✓ APROBAR</button>
        <button class="btn-danger" style="flex:1;margin:0" onclick="rechazarPresupuesto('${p.id}')">✕ RECHAZAR</button>
        <button class="btn-secondary" style="flex:1;margin:0" onclick="modalEditarPresupuesto('${p.id}')">Editar</button>
      ` : ''}
      ${p.estado==='aprobado' && p.reparacion_id ? `
        <button class="btn-primary" style="flex:1;margin:0" onclick="detalleReparacion('${p.reparacion_id}')">Ver Orden de Trabajo</button>
      ` : ''}
      ${currentPerfil?.rol==='admin' && p.estado!=='aprobado' ? `
        <button class="btn-danger" style="margin:0" onclick="eliminarPresupuesto('${p.id}')">${t('eliminarBtn')}</button>
      ` : ''}
    </div>`;
}

async function aprobarPresupuesto(id) {
  confirmar(t('confirmarAprobar') || '¿Aprobar este presupuesto y crear la orden de trabajo?', async () => {
    const { data:p } = await sb.from('presupuestos_v2').select('*').eq('id',id).single();
    if (!p) return;
    
    const { data:rep, error } = await sb.from('reparaciones').insert({
      descripcion: p.descripcion || 'Trabajo desde presupuesto',
      tipo_trabajo: p.tipo_trabajo || 'Mecánica general',
      vehiculo_id: p.vehiculo_id,
      cliente_id: p.cliente_id,
      costo: p.total || 0,
      costo_repuestos: (p.items||[]).filter(i=>i.tipo==='producto').reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0),
      estado: 'pendiente',
      fecha: new Date().toISOString().split('T')[0],
      notas: 'Generado desde presupuesto. '+(p.observaciones||''),
      taller_id: tid()
    }).select('id').single();
    
    if (error) { toast('Error: '+error.message,'error'); return; }
    
    const items = p.items || [];
    if (items.length > 0) {
      const itemsData = items.map(item => ({
        reparacion_id: rep.id,
        tipo: item.tipo,
        descripcion: item.descripcion,
        cantidad: item.cantidad || 1,
        precio_unitario: item.precio || 0,
        taller_id: tid()
      }));
      await sb.from('reparacion_items').insert(itemsData);
    }
    
    await sb.from('presupuestos_v2').update({ 
      estado: 'aprobado', 
      reparacion_id: rep.id, 
      fecha_aprobacion: new Date().toISOString() 
    }).eq('id', id);
    
    clearCache('presupuestos'); clearCache('reparaciones');
    toast('✓ Presupuesto aprobado — OT creada', 'success');
    detallePresupuesto(id);
  });
}

async function rechazarPresupuesto(id) {
  confirmar(t('confirmarRechazar') || '¿Rechazar este presupuesto?', async () => {
    await sb.from('presupuestos_v2').update({estado:'rechazado'}).eq('id', id);
    clearCache('presupuestos');
    toast('Presupuesto rechazado');
    detallePresupuesto(id);
  });
}

async function eliminarPresupuesto(id) {
  confirmar(t('confirmarEliminar') || '¿Eliminar este presupuesto permanentemente?', async () => {
    await offlineDelete('presupuestos_v2', 'id', id);
    clearCache('presupuestos');
    toast('Presupuesto eliminado');
    navigate('presupuestos');
  });
}

async function modalNuevoPresupuesto(editId) {
  let existing = null;
  if (editId) {
    const { data } = await sb.from('presupuestos_v2').select('*').eq('id', editId).single();
    existing = data;
  }
  const [{ data:cls }, { data:vehs }] = await Promise.all([
    sb.from('clientes').select('id,nombre').eq('taller_id',tid()).order('nombre'),
    sb.from('vehiculos').select('id,patente,marca,modelo,cliente_id').eq('taller_id',tid()).order('patente')
  ]);
  window._pptoItems = existing?.items || [];
  
  openModal(`
    <div class="modal-title">${editId ? 'EDITAR' : 'NUEVO'} PRESUPUESTO</div>
    <div class="form-group"><label class="form-label">Descripción *</label><input class="form-input" id="pp-desc" value="${h(existing?.descripcion||'')}" placeholder="Cambio de frenos completo"></div>
    <div class="form-group"><label class="form-label">Vehículo</label>
      <select class="form-input" id="pp-veh" onchange="pptoAutoCliente()">
        <option value="">Seleccionar vehículo</option>
        ${(vehs||[]).map(v=>`<option value="${v.id}" data-cli="${v.cliente_id||''}" ${existing?.vehiculo_id===v.id?'selected':''}>${h(v.patente)} — ${h(v.marca)} ${h(v.modelo||'')}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Cliente</label>
      <select class="form-input" id="pp-cli">
        <option value="">Seleccionar cliente</option>
        ${(cls||[]).map(c=>`<option value="${c.id}" ${existing?.cliente_id===c.id?'selected':''}>${h(c.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Tipo de trabajo</label>
      <select class="form-input" id="pp-tipo">
        ${TIPOS_TRABAJO.map(tt=>`<option ${existing?.tipo_trabajo===tt?'selected':''}>${tt}</option>`).join('')}
      </select>
    </div>
    <div class="sub-section-title" style="margin-top:1rem">ÍTEMS DEL PRESUPUESTO</div>
    <div id="pp-items-list">${pptoRenderItems()}</div>
    <div style="display:flex;gap:.4rem;margin:.5rem 0">
      <button onclick="pptoAddItem('servicio')" style="flex:1;background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.3);border-radius:8px;padding:.4rem;font-size:.72rem;color:var(--accent);cursor:pointer">+ Servicio</button>
      <button onclick="pptoAddItem('producto')" style="flex:1;background:rgba(0,255,136,.1);border:1px solid rgba(0,255,136,.3);border-radius:8px;padding:.4rem;font-size:.72rem;color:var(--success);cursor:pointer">+ Producto</button>
      <button onclick="pptoAddItem('adicional')" style="flex:1;background:rgba(255,107,53,.1);border:1px solid rgba(255,107,53,.3);border-radius:8px;padding:.4rem;font-size:.72rem;color:var(--accent2);cursor:pointer">+ Adicional</button>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Descuento (₲)</label><input class="form-input" id="pp-descuento" type="number" value="${existing?.descuento||0}" oninput="pptoUpdateTotal()"></div>
      <div class="form-group"><label class="form-label">TOTAL</label><div id="pp-total" style="font-family:var(--font-head);font-size:1.5rem;color:var(--accent);padding-top:.3rem">₲0</div></div>
    </div>
    <div class="form-group"><label class="form-label">Observaciones</label><textarea class="form-input" id="pp-obs" rows="2">${h(existing?.observaciones||'')}</textarea></div>
    <button class="btn-primary" onclick="guardarPresupuesto(${editId?"'"+editId+"'":'null'})">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
  pptoUpdateTotal();
}

function modalEditarPresupuesto(id) { modalNuevoPresupuesto(id); }

function pptoAutoCliente() {
  const s = document.getElementById('pp-veh');
  const c = s.options[s.selectedIndex]?.getAttribute('data-cli');
  if (c) document.getElementById('pp-cli').value = c;
}

function pptoAddItem(tipo) {
  window._pptoItems.push({tipo, descripcion:'', precio:0, cantidad:1});
  document.getElementById('pp-items-list').innerHTML = pptoRenderItems();
  pptoUpdateTotal();
}

function pptoRemoveItem(idx) {
  window._pptoItems.splice(idx,1);
  document.getElementById('pp-items-list').innerHTML = pptoRenderItems();
  pptoUpdateTotal();
}

function pptoUpdateItem(idx, field, val) {
  window._pptoItems[idx][field] = (field==='descripcion') ? val : parseFloat(val)||0;
  pptoUpdateTotal();
}

function pptoUpdateTotal() {
  const total = window._pptoItems.reduce((s,i) => s + parseFloat(i.precio||0)*(i.cantidad||1), 0);
  const desc = parseFloat(document.getElementById('pp-descuento')?.value || 0);
  const el = document.getElementById('pp-total');
  if (el) el.textContent = '₲' + gs(Math.max(0, total - desc));
}

function pptoRenderItems() {
  return window._pptoItems.map((item, i) => `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.5rem;margin-bottom:.4rem;display:flex;gap:.4rem;align-items:center">
      <span style="font-size:.6rem;padding:2px 5px;border-radius:4px;${item.tipo==='servicio'?'background:rgba(0,229,255,.15);color:var(--accent)':item.tipo==='producto'?'background:rgba(0,255,136,.15);color:var(--success)':'background:rgba(255,107,53,.15);color:var(--accent2)'}">${item.tipo==='servicio'?'SRV':item.tipo==='producto'?'PROD':'ADIC'}</span>
      <input class="form-input" style="flex:2;padding:.3rem .5rem;font-size:.78rem" value="${h(item.descripcion)}" placeholder="Descripción" oninput="pptoUpdateItem(${i},'descripcion',this.value)">
      ${item.tipo==='producto'?`<input class="form-input" style="width:45px;padding:.3rem;font-size:.78rem;text-align:center" type="number" value="${item.cantidad||1}" min="1" oninput="pptoUpdateItem(${i},'cantidad',this.value)">`:''}
      <input class="form-input" style="width:80px;padding:.3rem;font-size:.78rem;text-align:right" type="number" value="${item.precio||0}" placeholder="₲" oninput="pptoUpdateItem(${i},'precio',this.value)">
      <button onclick="pptoRemoveItem(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.9rem;flex-shrink:0">✕</button>
    </div>`).join('');
}

async function guardarPresupuesto(id) {
  if (guardando()) return;
  const desc = document.getElementById('pp-desc').value.trim();
  if (!desc) { toast('La descripción es obligatoria','error'); return; }
  const total = window._pptoItems.reduce((s,i) => s + parseFloat(i.precio||0)*(i.cantidad||1), 0);
  const descuento = parseFloat(document.getElementById('pp-descuento').value) || 0;
  const data = {
    descripcion: desc,
    tipo_trabajo: document.getElementById('pp-tipo').value,
    vehiculo_id: document.getElementById('pp-veh').value || null,
    cliente_id: document.getElementById('pp-cli').value || null,
    items: window._pptoItems,
    total: Math.max(0, total - descuento),
    descuento,
    observaciones: document.getElementById('pp-obs').value,
    taller_id: tid()
  };
  if (!id) data.estado = 'generado';
  
  const { error } = id 
    ? await offlineUpdate('presupuestos_v2', data, 'id', id)
    : await offlineInsert('presupuestos_v2', data);
    
  if (error) { toast('Error: '+error.message,'error'); return; }
  clearCache('presupuestos');
  toast(id ? 'Presupuesto actualizado' : 'Presupuesto creado', 'success');
  closeModal();
  presupuestos();
}

async function compartirPresupuesto(id) {
  const { data:p } = await sb.from('presupuestos_v2').select('*, vehiculos(patente,marca,modelo), clientes(nombre,telefono,ruc)').eq('id',id).single();
  if (!p) return;
  const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';
  const tallerRuc = currentPerfil?.talleres?.ruc || '';
  const tallerDir = currentPerfil?.talleres?.direccion || '';
  const tallerTel = currentPerfil?.talleres?.telefono || '';
  
  toast(t('generandoPdf'), 'info');
  try {
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const m = 15, w = 180;
    let y = 15;

    doc.setFillColor(22,22,35);
    doc.rect(0,0,210,32,'F');
    doc.setTextColor(0,229,255);
    doc.setFontSize(18);
    doc.setFont('helvetica','bold');
    doc.text(tallerNombre.toUpperCase(), m, 14);
    doc.setFontSize(8);
    doc.setTextColor(180,180,200);
    doc.setFont('helvetica','normal');
    [tallerRuc?'RUC: '+tallerRuc:'', tallerDir||'', tallerTel?'Tel: '+tallerTel:''].filter(Boolean).forEach((line,i)=>doc.text(line, m, 20+i*4));
    doc.setTextColor(255,255,255);
    doc.setFontSize(11);
    doc.text('PRESUPUESTO', 195, 12, {align:'right'});
    doc.setFontSize(8);
    doc.text('Fecha: '+formatFecha(p.created_at?.split('T')[0]), 195, 18, {align:'right'});
    y = 40;

    doc.setFillColor(245,247,250);
    doc.roundedRect(m, y, w, 28, 2, 2, 'F');
    doc.setTextColor(100,105,120);
    doc.setFontSize(7);
    doc.text('CLIENTE', m+4, y+5);
    doc.setFontSize(9);
    doc.setTextColor(30,30,45);
    doc.text(p.clientes?.nombre || 'Sin cliente', m+4, y+12);
    if (p.clientes?.ruc) doc.text('RUC: '+p.clientes.ruc, m+4, y+18);
    if (p.clientes?.telefono) doc.text('Tel: '+p.clientes.telefono, m+4, y+23);
    if (p.vehiculos) {
      doc.setTextColor(100,105,120);
      doc.setFontSize(7);
      doc.text('VEHÍCULO', m+95, y+5);
      doc.setFontSize(9);
      doc.setTextColor(30,30,45);
      doc.text(p.vehiculos.patente + ' · ' + p.vehiculos.marca, m+95, y+12);
    }
    y += 34;

    const items = p.items || [];
    doc.setFillColor(22,22,35);
    doc.roundedRect(m, y, w, 8, 1, 1, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(8);
    doc.text('CONCEPTO', m+4, y+5.5);
    doc.text('MONTO', 195-4, y+5.5, {align:'right'});
    y += 10;

    items.forEach((item, i) => {
      if (i%2===0) { doc.setFillColor(250,250,252); doc.rect(m, y-3, w, 8, 'F'); }
      doc.setTextColor(50,50,65);
      doc.setFontSize(9);
      const subtotal = parseFloat(item.precio||0)*(item.cantidad||1);
      doc.text(item.descripcion + (item.cantidad>1?' x'+item.cantidad:''), m+4, y+2);
      doc.text('Gs. '+gs(subtotal), 195-4, y+2, {align:'right'});
      y += 8;
    });

    if (p.descuento) {
      doc.setTextColor(200,50,50);
      doc.text('Descuento', m+4, y+2);
      doc.text('-Gs. '+gs(p.descuento), 195-4, y+2, {align:'right'});
      y += 8;
    }

    doc.setFillColor(0,229,255);
    doc.roundedRect(m, y, w, 12, 2, 2, 'F');
    doc.setTextColor(10,10,20);
    doc.setFontSize(12);
    doc.text('TOTAL', m+5, y+8);
    doc.text('Gs. '+gs(p.total), 195-5, y+8, {align:'right'});
    y += 20;

    if (p.observaciones) {
      doc.setTextColor(120,125,140);
      doc.setFontSize(8);
      doc.text('Observaciones: '+p.observaciones, m, y);
    }

    const pdfBlob = doc.output('blob');
    const fileName = `Presupuesto_${p.clientes?.nombre?.replace(/\s/g,'_')||'cliente'}_${formatFecha(p.created_at).replace(/\//g,'-')}.pdf`;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast(t('pdfDescargado'), 'success');
  } catch(e) {
    toast('Error al generar PDF: '+e.message, 'error');
  }
}

async function enviarPresupuestoWhatsApp(id) {
  const { data:p } = await sb.from('presupuestos_v2').select('*, clientes(telefono)').eq('id',id).single();
  if (!p?.clientes?.telefono) { toast('El cliente no tiene teléfono', 'error'); return; }
  const tel = p.clientes.telefono.replace(/\D/g,'');
  const tallerNombre = currentPerfil?.talleres?.nombre || 'TallerPro';
  const msg = `Hola! Te envío el presupuesto de ${tallerNombre}:\n\n📋 ${p.descripcion}\n💰 Total: ₲${gs(p.total)}\n\n¿Aprobás el trabajo?`;
  window.open(`https://wa.me/595${tel}?text=${encodeURIComponent(msg)}`);
}
