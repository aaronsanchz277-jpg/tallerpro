// ─── VENTAS POS (Punto de venta de productos sin OT) ────────────────────────

async function ventasPOS({ offset=0 }={}) {
  const { data, count } = await cachedQuery(`pos_${offset}`, () =>
    sb.from('ventas_pos').select('*, clientes(nombre)', {count:'exact'}).eq('taller_id',tid()).order('created_at',{ascending:false}).range(offset, offset+PAGE_SIZE-1)
  );
  const totalHoy = (data||[]).filter(v=>(v.created_at||'').startsWith(fechaHoy())).reduce((s,v)=>s+parseFloat(v.total||0),0);
  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">Ventas POS ${count?`<span style="font-size:.75rem;color:var(--text2)">(${count})</span>`:''}</div>
      <button class="btn-add" onclick="modalNuevaVentaPOS()">+ Venta</button>
    </div>
    ${totalHoy>0?`<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:.75rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:.7rem;color:var(--text2);font-family:var(--font-head);letter-spacing:1px">VENTAS HOY</div>
        <div style="font-family:var(--font-head);font-size:1.4rem;color:var(--success)">₲${gs(totalHoy)}</div></div>
      <div style="font-size:1.5rem">🛒</div>
    </div>`:''}
    ${(data||[]).length===0?'<div class="empty"><p>No hay ventas registradas</p></div>':
      (data||[]).map(v=>`
      <div class="card" onclick="detalleVentaPOS('${v.id}')">
        <div class="card-header">
          <div class="card-avatar">🛒</div>
          <div class="card-info">
            <div class="card-name">${v.clientes?h(v.clientes.nombre):'Venta mostrador'}</div>
            <div class="card-sub">${formatFecha(v.created_at?.split('T')[0])} · ${(v.items||[]).length} producto(s)</div>
          </div>
          <div style="font-family:var(--font-head);font-size:1rem;color:var(--success)">₲${gs(v.total||0)}</div>
        </div>
      </div>`).join('')}`;
}

async function detalleVentaPOS(id){
  const{data:v}=await sb.from('ventas_pos').select('*, clientes(nombre,telefono)').eq('id',id).single();
  if(!v)return;
  const items=v.items||[];
  document.getElementById('main-content').innerHTML=`
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('ventas-pos')">← Volver</button>
      <div class="detail-avatar">🛒</div>
      <div style="flex:1"><div class="detail-name">${v.clientes?h(v.clientes.nombre):'Venta mostrador'}</div><div class="detail-sub">${formatFecha(v.created_at?.split('T')[0])}</div></div>
    </div>
    <div class="sub-section"><div class="sub-section-title">PRODUCTOS VENDIDOS</div>
      ${items.map(i=>`<div class="factura-item"><span>${h(i.nombre)} x${i.cantidad}</span><span style="color:var(--accent)">₲${gs(parseFloat(i.precio||0)*i.cantidad)}</span></div>`).join('')}
      <div class="factura-total"><span>TOTAL</span><span>₲${gs(v.total||0)}</span></div>
    </div>
    <div style="display:flex;gap:.5rem;margin-top:1rem">
      <button class="btn-secondary" style="flex:1;margin:0" onclick="window.print()">🖨️ Imprimir</button>
      <button class="btn-danger" style="flex:1;margin:0" onclick="eliminarVentaPOS('${id}')">Eliminar</button>
    </div>`;
}

async function modalNuevaVentaPOS(){
  const[{data:cls},{data:inv}]=await Promise.all([
    sb.from('clientes').select('id,nombre').eq('taller_id',tid()).order('nombre'),
    sb.from('inventario').select('id,nombre,precio_unitario,cantidad').eq('taller_id',tid()).order('nombre')
  ]);
  window._posItems=[];window._posInv=inv||[];
  openModal(`
    <div class="modal-title">🛒 NUEVA VENTA</div>
    <div class="form-group"><label class="form-label">Cliente (opcional)</label>
      <select class="form-input" id="pos-cli"><option value="">Venta sin cliente</option>${(cls||[]).map(c=>`<option value="${c.id}">${h(c.nombre)}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label class="form-label">Agregar producto del inventario</label>
      <select class="form-input" id="pos-prod-sel" onchange="posAgregarProducto()">
        <option value="">Seleccionar producto...</option>
        ${(inv||[]).map(p=>`<option value="${p.id}" data-precio="${p.precio_unitario||0}" data-stock="${p.cantidad||0}" data-nombre="${h(p.nombre)}">${h(p.nombre)} — ₲${gs(p.precio_unitario||0)} (stock: ${p.cantidad||0})</option>`).join('')}
      </select>
    </div>
    <div id="pos-items-list"></div>
    <div id="pos-total" style="font-family:var(--font-head);font-size:1.8rem;color:var(--accent);text-align:right;margin:.75rem 0">₲0</div>
    <button class="btn-primary" style="background:var(--success)" onclick="guardarVentaPOS()">✓ CONFIRMAR VENTA</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}
function posAgregarProducto(){
  const sel=document.getElementById('pos-prod-sel');const opt=sel.options[sel.selectedIndex];if(!opt||!opt.value)return;
  const existing=window._posItems.find(i=>i.id===opt.value);
  if(existing){existing.cantidad++;} else {
    window._posItems.push({id:opt.value,nombre:opt.getAttribute('data-nombre'),precio:parseFloat(opt.getAttribute('data-precio'))||0,cantidad:1,maxStock:parseFloat(opt.getAttribute('data-stock'))||999});
  }
  sel.value='';posRenderItems();
}
function posUpdateCant(i,v){window._posItems[i].cantidad=Math.max(1,Math.min(parseInt(v)||1,window._posItems[i].maxStock));posRenderItems();}
function posRemoveItem(i){window._posItems.splice(i,1);posRenderItems();}
function posRenderItems(){
  const total=window._posItems.reduce((s,i)=>s+i.precio*i.cantidad,0);
  document.getElementById('pos-total').textContent='₲'+gs(total);
  document.getElementById('pos-items-list').innerHTML=window._posItems.map((item,i)=>`
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.5rem;margin-bottom:.4rem;display:flex;justify-content:space-between;align-items:center">
      <div style="flex:1;min-width:0"><div style="font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(item.nombre)}</div><div style="font-size:.72rem;color:var(--text2)">₲${gs(item.precio)} c/u</div></div>
      <input class="form-input" style="width:50px;padding:.3rem;text-align:center;font-size:.82rem" type="number" value="${item.cantidad}" min="1" max="${item.maxStock}" oninput="posUpdateCant(${i},this.value)">
      <span style="font-family:var(--font-head);color:var(--accent);width:80px;text-align:right;font-size:.85rem">₲${gs(item.precio*item.cantidad)}</span>
      <button onclick="posRemoveItem(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;margin-left:.3rem">✕</button>
    </div>`).join('');
}
async function guardarVentaPOS(){
  if(guardando())return;
  if(window._posItems.length===0){toast('Agregá al menos un producto','error');return;}
  const total=window._posItems.reduce((s,i)=>s+i.precio*i.cantidad,0);
  for(const item of window._posItems){const inv=window._posInv.find(p=>p.id===item.id);if(inv){await sb.from('inventario').update({cantidad:Math.max(0,parseFloat(inv.cantidad)-item.cantidad)}).eq('id',item.id);}}
  const{error}=await offlineInsert('ventas_pos',{cliente_id:document.getElementById('pos-cli').value||null,items:window._posItems.map(i=>({nombre:i.nombre,precio:i.precio,cantidad:i.cantidad})),total,metodo_pago:'efectivo',taller_id:tid()});
  if(error){toast('Error: '+error.message,'error');return;}
  clearCache('pos');clearCache('inventario');toast('✓ ¡Venta exitosa!','success');closeModal();ventasPOS();
}
async function eliminarVentaPOS(id){confirmar('¿Eliminar esta venta?',async()=>{await offlineDelete('ventas_pos','id',id);clearCache('pos');toast('Eliminado');ventasPOS();});}

