// ─── QUICKSERVICE (Servicio Rápido — sin OT, facturación directa) ────────────

async function quickservice({ filtro='todos', offset=0 }={}) {
  const { data, count } = await cachedQuery(`qs_${filtro}_${offset}`, () => {
    let q = sb.from('quickservices').select('*, vehiculos(patente,marca), clientes(nombre)', {count:'exact'}).eq('taller_id',tid()).order('created_at',{ascending:false});
    if(filtro!=='todos') q = q.eq('estado',filtro);
    return q.range(offset, offset + PAGE_SIZE - 1);
  });
  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">Servicio Rápido ${count?`<span style="font-size:.75rem;color:var(--text2)">(${count})</span>`:''}</div>
      <button class="btn-add" onclick="modalNuevoQS()">+ Nuevo</button>
    </div>
    <div class="tabs">
      <button class="tab ${filtro==='todos'?'active':''}" onclick="quickservice({filtro:'todos'})">Todos</button>
      <button class="tab ${filtro==='completado'?'active':''}" onclick="quickservice({filtro:'completado'})">Completados</button>
      <button class="tab ${filtro==='facturado'?'active':''}" onclick="quickservice({filtro:'facturado'})">Facturados</button>
    </div>
    ${(data||[]).length===0?'<div class="empty"><p>No hay servicios rápidos</p></div>':
      (data||[]).map(q=>`
      <div class="card" onclick="detalleQS('${q.id}')">
        <div class="card-header">
          <div class="card-avatar">⚡</div>
          <div class="card-info">
            <div class="card-name">${h(q.descripcion||'Servicio rápido')}</div>
            <div class="card-sub">${q.vehiculos?h(q.vehiculos.marca)+' '+h(q.vehiculos.patente):''} · ${q.clientes?h(q.clientes.nombre):''}</div>
          </div>
          <div style="text-align:right">
            <span class="card-badge ${q.estado==='facturado'?'badge-green':'badge-yellow'}">${(q.estado||'').toUpperCase()}</span>
            <div style="font-family:var(--font-head);font-size:.9rem;color:var(--accent);margin-top:4px">₲${gs(q.total||0)}</div>
          </div>
        </div>
      </div>`).join('')}`;
}

async function detalleQS(id) {
  const { data:q } = await sb.from('quickservices').select('*, vehiculos(patente,marca,modelo), clientes(nombre,telefono)').eq('id',id).single();
  if(!q) return;
  const items = q.items || [];
  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('quickservice')">← Volver</button>
      <div class="detail-avatar">⚡</div>
      <div style="flex:1"><div class="detail-name">${h(q.descripcion||'Servicio rápido')}</div><div class="detail-sub">${formatFecha(q.created_at?.split('T')[0])}</div></div>
      <span class="card-badge ${q.estado==='facturado'?'badge-green':'badge-yellow'}">${(q.estado||'').toUpperCase()}</span>
    </div>
    <div class="info-grid">
      ${q.vehiculos?`<div class="info-item"><div class="label">Vehículo</div><div class="value">${h(q.vehiculos.marca)} ${h(q.vehiculos.patente)}</div></div>`:''}
      ${q.clientes?`<div class="info-item"><div class="label">Cliente</div><div class="value">${h(q.clientes.nombre)}</div></div>`:''}
      <div class="info-item"><div class="label">Total</div><div class="value" style="color:var(--accent)">₲${gs(q.total||0)}</div></div>
    </div>
    <div class="sub-section"><div class="sub-section-title">ÍTEMS</div>
      ${items.map(i=>`<div class="factura-item"><span>${h(i.descripcion)}${i.cantidad>1?' x'+i.cantidad:''}</span><span style="color:var(--accent)">₲${gs(parseFloat(i.precio||0)*(i.cantidad||1))}</span></div>`).join('')}
      <div class="factura-total"><span>TOTAL</span><span>₲${gs(q.total||0)}</span></div>
    </div>
    <div style="display:flex;gap:.5rem;margin-top:1rem">
      ${q.estado==='completado'?`<button class="btn-primary" style="flex:1;margin:0;background:var(--success)" onclick="facturarQS('${q.id}')">🧾 Facturar</button>`:''}
      ${q.estado==='completado'&&currentPerfil?.rol==='admin'?`<button class="btn-danger" style="flex:1;margin:0" onclick="eliminarQS('${q.id}')">Eliminar</button>`:''}
      ${q.clientes?.telefono?`<button onclick="window.open('https://wa.me/595${q.clientes.telefono.replace(/\\D/g,'')}')" style="flex:1;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:.6rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer">💬 WhatsApp</button>`:''}
    </div>`;
}

async function modalNuevoQS() {
  const [{ data:cls }, { data:vehs }] = await Promise.all([
    sb.from('clientes').select('id,nombre').eq('taller_id',tid()).order('nombre'),
    sb.from('vehiculos').select('id,patente,marca,modelo,cliente_id').eq('taller_id',tid()).order('patente')
  ]);
  window._qsItems = [];
  openModal(`
    <div class="modal-title" style="color:var(--success)">⚡ NUEVO SERVICIO RÁPIDO</div>
    <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="qs-desc" placeholder="Cambio de aceite + filtro"></div>
    <div class="form-group"><label class="form-label">Vehículo</label>
      <select class="form-input" id="qs-veh" onchange="qsAutoCliente()">
        <option value="">Seleccionar</option>
        ${(vehs||[]).map(v=>`<option value="${v.id}" data-cli="${v.cliente_id||''}">${h(v.patente)} — ${h(v.marca)} ${h(v.modelo||'')}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Cliente</label>
      <select class="form-input" id="qs-cli"><option value="">Seleccionar</option>${(cls||[]).map(c=>`<option value="${c.id}">${h(c.nombre)}</option>`).join('')}</select>
    </div>
    <div class="sub-section-title" style="margin-top:.75rem">SERVICIOS Y PRODUCTOS</div>
    <div id="qs-items-list"></div>
    <div style="display:flex;gap:.4rem;margin:.5rem 0">
      <button onclick="qsAddItem('servicio')" style="flex:1;background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.3);border-radius:8px;padding:.4rem;font-size:.72rem;color:var(--accent);cursor:pointer">+ Servicio</button>
      <button onclick="qsAddItem('producto')" style="flex:1;background:rgba(0,255,136,.1);border:1px solid rgba(0,255,136,.3);border-radius:8px;padding:.4rem;font-size:.72rem;color:var(--success);cursor:pointer">+ Producto</button>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Descuento</label><input class="form-input" id="qs-desc-monto" type="number" value="0" oninput="qsUpdateTotal()"></div>
      <div class="form-group"><label class="form-label">TOTAL</label><div id="qs-total" style="font-family:var(--font-head);font-size:1.5rem;color:var(--accent);padding-top:.3rem">₲0</div></div>
    </div>
    <button class="btn-primary" style="background:var(--success)" onclick="guardarQS()">✓ CONFIRMAR SERVICIO</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}
function qsAutoCliente(){const s=document.getElementById('qs-veh');const c=s.options[s.selectedIndex]?.getAttribute('data-cli');if(c)document.getElementById('qs-cli').value=c;}
function qsAddItem(tipo){window._qsItems.push({tipo,descripcion:'',precio:0,cantidad:1});document.getElementById('qs-items-list').innerHTML=qsRenderItems();qsUpdateTotal();}
function qsRemoveItem(i){window._qsItems.splice(i,1);document.getElementById('qs-items-list').innerHTML=qsRenderItems();qsUpdateTotal();}
function qsUpdateItem(i,f,v){window._qsItems[i][f]=(f==='descripcion')?v:parseFloat(v)||0;qsUpdateTotal();}
function qsUpdateTotal(){const t=window._qsItems.reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);const d=parseFloat(document.getElementById('qs-desc-monto')?.value||0);const el=document.getElementById('qs-total');if(el)el.textContent='₲'+gs(Math.max(0,t-d));}
function qsRenderItems(){return window._qsItems.map((item,i)=>`
  <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.5rem;margin-bottom:.4rem;display:flex;gap:.4rem;align-items:center">
    <input class="form-input" style="flex:2;padding:.3rem .5rem;font-size:.78rem" value="${h(item.descripcion)}" placeholder="${item.tipo==='servicio'?'Ej: Cambio de aceite':'Ej: Filtro de aceite'}" oninput="qsUpdateItem(${i},'descripcion',this.value)">
    <input class="form-input" style="width:45px;padding:.3rem;font-size:.78rem;text-align:center" type="number" value="${item.cantidad||1}" min="1" oninput="qsUpdateItem(${i},'cantidad',this.value)">
    <input class="form-input" style="width:80px;padding:.3rem;font-size:.78rem;text-align:right" type="number" value="${item.precio||0}" placeholder="₲" oninput="qsUpdateItem(${i},'precio',this.value)">
    <button onclick="qsRemoveItem(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.9rem">✕</button>
  </div>`).join('');}
async function guardarQS(){
  if(guardando())return;
  if(window._qsItems.length===0){toast('Agregá al menos un ítem','error');return;}
  const total=window._qsItems.reduce((s,i)=>s+parseFloat(i.precio||0)*(i.cantidad||1),0);
  const desc=parseFloat(document.getElementById('qs-desc-monto')?.value||0);
  const{error}=await offlineInsert('quickservices',{descripcion:document.getElementById('qs-desc').value||'Servicio rápido',vehiculo_id:document.getElementById('qs-veh').value||null,cliente_id:document.getElementById('qs-cli').value||null,items:window._qsItems,total:Math.max(0,total-desc),descuento:desc,estado:'completado',taller_id:tid()});
  if(error){toast('Error: '+error.message,'error');return;}
  clearCache('qs');toast('✓ Servicio rápido creado','success');closeModal();quickservice();
}
async function facturarQS(id){confirmar('¿Facturar este servicio rápido?',async()=>{await sb.from('quickservices').update({estado:'facturado',fecha_facturacion:new Date().toISOString()}).eq('id',id);clearCache('qs');toast('✓ Servicio facturado','success');quickservice();});}
async function eliminarQS(id){confirmar('¿Eliminar este servicio?',async()=>{await offlineDelete('quickservices','id',id);clearCache('qs');toast('Eliminado');quickservice();});}

