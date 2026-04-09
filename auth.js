// ─── PRESUPUESTOS (Flujo: Generado → Aprobado → OT automática) ──────────────

const PRESUPUESTO_ESTADOS = {generado:'GENERADO',aprobado:'APROBADO',rechazado:'RECHAZADO'};
const presupuestoBadge = (e) => ({generado:'badge-yellow',aprobado:'badge-green',rechazado:'badge-red'}[e]||'badge-blue');

async function presupuestos({ filtro='todos', search='', offset=0 }={}) {
  const cacheKey = `presupuestos_${filtro}_${search}_${offset}`;
  const { data, count } = await cachedQuery(cacheKey, () => {
    let q = sb.from('presupuestos_v2').select('*, vehiculos(patente,marca,modelo), clientes(nombre)', {count:'exact'}).eq('taller_id',tid()).order('created_at',{ascending:false});
    if (filtro!=='todos') q = q.eq('estado',filtro);
    if (search) q = q.ilike('descripcion', `%${search}%`);
    return q.range(offset, offset + PAGE_SIZE - 1);
  });
  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">Presupuestos ${count?`<span style="font-size:.75rem;color:var(--text2)">(${count})</span>`:''}</div>
      <button class="btn-add" onclick="modalNuevoPresupuesto()">+ Nuevo</button>
    </div>
    <div class="search-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" placeholder="Buscar presupuesto..." value="${h(search)}" oninput="debounce('ppto',()=>presupuestos({filtro:'${filtro}',search:this.value}))" class="form-input" style="padding-left:2.5rem">
    </div>
    <div class="tabs">
      <button class="tab ${filtro==='todos'?'active':''}" onclick="presupuestos({filtro:'todos'})">Todos</button>
      <button class="tab ${filtro==='generado'?'active':''}" onclick="presupuestos({filtro:'generado'})">Generados</button>
      <button class="tab ${filtro==='aprobado'?'active':''}" onclick="presupuestos({filtro:'aprobado'})">Aprobados</button>
      <button class="tab ${filtro==='rechazado'?'active':''}" onclick="presupuestos({filtro:'rechazado'})">Rechazados</button>
    </div>
    ${(data||[]).length===0?'<div class="empty"><p>No hay presupuestos</p></div>':
      (data||[]).map(p=>`
      <div class="card" onclick="detallePresupuesto('${p.id}')">
        <div class="card-header">
          <div class="card-avatar" style="font-size:.7rem">📋</div>
          <div class="card-info">
            <div class="card-name">${h(p.descripcion||'Presupuesto')}</div>
            <div class="card-sub">${p.vehiculos?h(p.vehiculos.marca)+' '+h(p.vehiculos.patente):''} · ${p.clientes?h(p.clientes.nombre):''} · ₲${gs(p.total||0)}</div>
          </div>
          <span class="card-badge ${presupuestoBadge(p.estado)}">${PRESUPUESTO_ESTADOS[p.estado]||p.estado}</span>
        </div>
      </div>`).join('')}
    ${renderPagination(count||0,offset,'_navPpto')}`;
}
function _navPpto(o){presupuestos({offset:o});}

async function detallePresupuesto(id) {
  const { data:p } = await sb.from('presupuestos_v2').select('*, vehiculos(patente,marca,modelo,anio,color), clientes(nombre,telefono,ruc)').eq('id',id).single();
  if(!p) return;
  const items = p.items || [];
  const totalServicios = items.filter(i=>i.tipo==='servicio').reduce((s,i)=>s+parseFloat(i.precio||0),0);
  const totalProductos = items.filter(i=>i.tipo==='producto').reduce((s,i)=>s+parseFloat(i.precio||0)*parseFloat(i.cantidad||1),0);
  const totalAdicionales = items.filter(i=>i.tipo==='adicional').reduce((s,i)=>s+parseFloat(i.precio||0),0);
  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('presupuestos')">← Volver</button>
      <div class="detail-avatar" style="font-size:.8rem">📋</div>
      <div style="flex:1"><div class="detail-name">${h(p.descripcion||'Presupuesto')}</div><div class="detail-sub">${formatFecha(p.created_at?.split('T')[0])}</div></div>
      <span class="card-badge ${presupuestoBadge(p.estado)}">${PRESUPUESTO_ESTADOS[p.estado]||p.estado}</span>
    </div>
    ${p.vehiculos?`<div class="info-grid">
      <div class="info-item"><div class="label">Vehículo</div><div class="value">${h(p.vehiculos.marca)} ${h(p.vehiculos.modelo||'')}</div></div>
      <div class="info-item"><div class="label">Patente</div><div class="value">${h(p.vehiculos.patente)}</div></div>
      <div class="info-item"><div class="label">Año</div><div class="value">${h(p.vehiculos.anio||'-')}</div></div>
      <div class="info-item"><div class="label">Color</div><div class="value">${h(p.vehiculos.color||'-')}</div></div>
    </div>`:''}
    ${p.clientes?`<div class="info-grid">
      <div class="info-item"><div class="label">Cliente</div><div class="value">${h(p.clientes.nombre)}</div></div>
      <div class="info-item"><div class="label">RUC</div><div class="value">${h(p.clientes.ruc||'-')}</div></div>
      <div class="info-item"><div class="label">Teléfono</div><div class="value">${h(p.clientes.telefono||'-')}</div></div>
    </div>`:''}
    <div class="sub-section"><div class="sub-section-title">DETALLE DE ÍTEMS</div>
      ${items.length===0?'<p style="color:var(--text2);font-size:.85rem">Sin ítems</p>':
        items.map(i=>`<div class="factura-item"><span>${h(i.descripcion)}${i.cantidad>1?' x'+i.cantidad:''}</span><span style="color:var(--accent)">₲${gs(parseFloat(i.precio||0)*(i.cantidad||1))}</span></div>`).join('')}
      <div style="border-top:2px solid var(--accent);margin-top:.5rem;padding-top:.5rem">
        ${totalServicios?`<div class="factura-item"><span>Servicios</span><span>₲${gs(totalServicios)}</span></div>`:''}
        ${totalProductos?`<div class="factura-item"><span>Productos</span><span>₲${gs(totalProductos)}</span></div>`:''}
        ${totalAdicionales?`<div class="factura-item"><span>Adicionales</span><span>₲${gs(totalAdicionales)}</span></div>`:''}
        ${p.descuento?`<div class="factura-item"><span>Descuento</span><span style="color:var(--danger)">-₲${gs(p.descuento)}</span></div>`:''}
        <div class="factura-total"><span>TOTAL</span><span>₲${gs(p.total||0)}</span></div>
        <div style="text-align:right;font-size:.7rem;color:var(--text2)">I.V.A. INCLUIDO</div>
      </div>
    </div>
    ${p.observaciones?`<div class="sub-section"><div class="sub-section-title">OBSERVACIONES</div><p style="font-size:.85rem;color:var(--text2)">${h(p.observaciones)}</p></div>`:''}
    <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
      ${p.estado==='generado'?`
        <button class="btn-primary" style="flex:1;margin:0;background:var(--success);min-width:120px" onclick="aprobarPresupuesto('${p.id}')">✓ APROBAR</button>
        <button class="btn-danger" style="flex:1;margin:0;min-width:120px" onclick="rechazarPresupuesto('${p.id}')">✕ RECHAZAR</button>
        <button class="btn-secondary" style="flex:1;margin:0;min-width:120px" onclick="modalEditarPresupuesto('${p.id}')">Editar</button>
      `:''}
      ${p.estado==='aprobado'&&p.reparacion_id?`<button class="btn-primary" style="flex:1;margin:0" onclick="detalleReparacion('${p.reparacion_id}')">Ver Orden de Trabajo</button>`:''}
      ${p.clientes?.telefono?`<button onclick="window.open('https://wa.me/595${p.clientes.telefono.replace(/\\D/g,'')}')" style="flex:1;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:.6rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer;min-width:120px">💬 WhatsApp</button>`:''}
      <button class="btn-secondary" style="flex:1;margin:0;min-width:120px" onclick="window.print()">🖨️ Imprimir</button>
    </div>`;
}

async function aprobarPresupuesto(id) {
  confirmar('Al aprobar se creará una Orden de Trabajo automáticamente.', async()=>{
    const { data:p } = await sb.from('presupuestos_v2').select('*').eq('id',id).single();
    if(!p) return;
    const { data:rep, error } = await sb.from('reparaciones').insert({
      descripcion: p.descripcion || 'Trabajo desde presupuesto',
      tipo_trabajo: p.tipo_trabajo || 'Mecánica general',
      vehiculo_id: p.vehiculo_id, cliente_id: p.cliente_id,
      costo: p.total || 0, estado: 'pendiente',
      fecha: new Date().toISOString().split('T')[0],
      notas: 'Generado desde presupuesto. '+(p.observaciones||''),
      taller_id: tid()
    }).select('id').single();
    if(error){toast('Error: '+error.message,'error');return;}
    await sb.from('presupuestos_v2').update({ estado:'aprobado', reparacion_id:rep.id, fecha_aprobacion:new Date().toISOString() }).eq('id',id);
    clearCache('presupuestos');clearCache('reparaciones');
    toast('✓ Presupuesto aprobado — OT creada','success');
    detallePresupuesto(id);
  });
}

async function rechazarPresupuesto(id) {
  confirmar('¿Rechazar este presupuesto?', async()=>{
    await sb.from('presupuestos_v2').update({estado:'rechazado'}).eq('id',id);
    clearCache('presupuestos');toast('Presupuesto rechazado');detallePresupuesto(id);
  });
}

async function modalNuevoPresupuesto(editId) {
  let existing = null;
  if(editId){const{data}=await sb.from('presupuestos_v2').select('*').eq('id',editId).single();existing=data;}
  const [{ data:cls }, { data:vehs }] = await Promise.all([
    sb.from('clientes').select('id,nombre').eq('taller_id',tid()).order('nombre'),
    sb.from('vehiculos').select('id,patente,marca,modelo,cliente_id').eq('taller_id',tid()).order('patente')
  ]);
  window._pptoItems = existing?.items || [];
  openModal(`
    <div class="modal-title">${editId?'EDITAR':'NUEVO'} PRESUPUESTO</div>
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
function modalEditarPresupuesto(id){modalNuevoPresupuesto(id);}
function pptoAutoCliente(){const s=document.getElementById('pp-veh');const c=s.options[s.selectedIndex]?.getAttribute('data-cli');if(c)document.getElementById('pp-cli').value=c;}
function pptoAddItem(tipo){window._pptoItems.push({tipo,descripcion:'',precio:0,cantidad:1});document.getElementById('pp-items-list').innerHTML=pptoRenderItems();pptoUpdateTotal();}
function pptoRemoveItem(idx){window._pptoItems.splice(idx,1);document.getElementById('pp-items-list').innerHTML=pptoRenderItems();pptoUpdateTotal();}
function pptoUpdateItem(idx,field,val){window._pptoItems[idx][field]=(field==='descripcion')?val:parseFloat(val)||0;pptoUpdateTotal();}
function pptoUpdateTotal(){const total=window._pptoItems.reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);const desc=parseFloat(document.getElementById('pp-descuento')?.value||0);const el=document.getElementById('pp-total');if(el)el.textContent='₲'+gs(Math.max(0,total-desc));}
function pptoRenderItems(){
  return window._pptoItems.map((item,i)=>`
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.5rem;margin-bottom:.4rem;display:flex;gap:.4rem;align-items:center">
      <span style="font-size:.6rem;padding:2px 5px;border-radius:4px;${item.tipo==='servicio'?'background:rgba(0,229,255,.15);color:var(--accent)':item.tipo==='producto'?'background:rgba(0,255,136,.15);color:var(--success)':'background:rgba(255,107,53,.15);color:var(--accent2)'}">${item.tipo==='servicio'?'SRV':item.tipo==='producto'?'PROD':'ADIC'}</span>
      <input class="form-input" style="flex:2;padding:.3rem .5rem;font-size:.78rem" value="${h(item.descripcion)}" placeholder="Descripción" oninput="pptoUpdateItem(${i},'descripcion',this.value)">
      ${item.tipo==='producto'?`<input class="form-input" style="width:45px;padding:.3rem;font-size:.78rem;text-align:center" type="number" value="${item.cantidad||1}" min="1" oninput="pptoUpdateItem(${i},'cantidad',this.value)">`:''}
      <input class="form-input" style="width:80px;padding:.3rem;font-size:.78rem;text-align:right" type="number" value="${item.precio||0}" placeholder="₲" oninput="pptoUpdateItem(${i},'precio',this.value)">
      <button onclick="pptoRemoveItem(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.9rem;flex-shrink:0">✕</button>
    </div>`).join('');
}
async function guardarPresupuesto(id){
  if(guardando())return;
  const desc=document.getElementById('pp-desc').value.trim();
  if(!desc){toast('La descripción es obligatoria','error');return;}
  const total=window._pptoItems.reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);
  const descuento=parseFloat(document.getElementById('pp-descuento').value)||0;
  const d={descripcion:desc,tipo_trabajo:document.getElementById('pp-tipo').value,vehiculo_id:document.getElementById('pp-veh').value||null,cliente_id:document.getElementById('pp-cli').value||null,items:window._pptoItems,total:Math.max(0,total-descuento),descuento,observaciones:document.getElementById('pp-obs').value,taller_id:tid()};
  if(!id)d.estado='generado';
  const{error}=id?await offlineUpdate('presupuestos_v2',d,'id',id):await offlineInsert('presupuestos_v2',d);
  if(error){toast('Error: '+error.message,'error');return;}
  clearCache('presupuestos');toast(id?'Presupuesto actualizado':'Presupuesto creado','success');closeModal();presupuestos();
}

