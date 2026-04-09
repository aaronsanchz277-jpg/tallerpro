// ─── GASTOS (Registro de egresos del taller) ────────────────────────────────

const CATEGORIAS_GASTO = ['Alquiler','Servicios','Repuestos','Sueldos','Impuestos','Herramientas','Insumos','Limpieza','Otros'];

async function gastos({ filtro='todos', offset=0 }={}) {
  const { data, count } = await cachedQuery(`gastos_${filtro}_${offset}`, () => {
    let q = sb.from('gastos_taller').select('*', {count:'exact'}).eq('taller_id',tid()).order('fecha',{ascending:false});
    if(filtro!=='todos') q = q.eq('categoria',filtro);
    return q.range(offset, offset+PAGE_SIZE-1);
  });
  const totalGastos = (data||[]).reduce((s,g)=>s+parseFloat(g.monto||0),0);
  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">Gastos ${count?`<span style="font-size:.75rem;color:var(--text2)">(${count})</span>`:''}</div>
      <button class="btn-add" onclick="modalNuevoGasto()">+ Gasto</button>
    </div>
    <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:12px;padding:1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:.72rem;color:var(--danger);font-family:var(--font-head);letter-spacing:1px">TOTAL GASTOS</div>
        <div style="font-family:var(--font-head);font-size:1.8rem;font-weight:700;color:var(--danger)">₲${gs(totalGastos)}</div></div>
      <div style="font-size:2rem">📤</div>
    </div>
    <div class="tabs" style="flex-wrap:wrap">
      <button class="tab ${filtro==='todos'?'active':''}" onclick="gastos({filtro:'todos'})">Todos</button>
      ${CATEGORIAS_GASTO.map(c=>`<button class="tab ${filtro===c?'active':''}" onclick="gastos({filtro:'${c}'})">${c}</button>`).join('')}
    </div>
    ${(data||[]).length===0?'<div class="empty"><p>No hay gastos registrados</p></div>':
      (data||[]).map(g=>`
      <div class="card" onclick="modalEditarGasto('${g.id}')">
        <div class="card-header">
          <div class="card-avatar">📤</div>
          <div class="card-info">
            <div class="card-name">${h(g.descripcion||'Gasto')}</div>
            <div class="card-sub">${h(g.proveedor||'')}${g.categoria?' · '+h(g.categoria):''} · ${formatFecha(g.fecha)}</div>
          </div>
          <div style="font-family:var(--font-head);color:var(--danger);font-size:1rem">₲${gs(g.monto||0)}</div>
        </div>
      </div>`).join('')}`;
}

function modalNuevoGasto(existing){
  openModal(`
    <div class="modal-title">${existing?'EDITAR':'NUEVO'} GASTO</div>
    <div class="form-group"><label class="form-label">Descripción *</label><input class="form-input" id="g-desc" value="${h(existing?.descripcion||'')}" placeholder="Electricidad, alquiler, repuestos..."></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Monto (₲) *</label><input class="form-input" id="g-monto" type="number" value="${existing?.monto||''}"></div>
      <div class="form-group"><label class="form-label">Fecha</label><input class="form-input" id="g-fecha" type="date" value="${existing?.fecha||new Date().toISOString().split('T')[0]}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Categoría</label>
        <select class="form-input" id="g-cat">
          <option value="">Sin categoría</option>
          ${CATEGORIAS_GASTO.map(c=>`<option ${existing?.categoria===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label class="form-label">Proveedor</label><input class="form-input" id="g-prov" value="${h(existing?.proveedor||'')}"></div>
    </div>
    <div class="form-group"><label class="form-label">Nro. comprobante</label><input class="form-input" id="g-comp" value="${h(existing?.comprobante||'')}"></div>
    <button class="btn-primary" onclick="guardarGasto(${existing?"'"+existing.id+"'":'null'})">${t('guardar')}</button>
    ${existing?`<button class="btn-danger" onclick="eliminarGasto('${existing.id}')">Eliminar</button>`:''}
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}
async function modalEditarGasto(id){const{data}=await sb.from('gastos_taller').select('*').eq('id',id).single();if(data)modalNuevoGasto(data);}
async function guardarGasto(id){
  if(guardando())return;
  const desc=document.getElementById('g-desc').value.trim();const monto=parseFloat(document.getElementById('g-monto').value);
  if(!desc||!monto){toast('Descripción y monto son obligatorios','error');return;}
  const d={descripcion:desc,monto,fecha:document.getElementById('g-fecha').value,categoria:document.getElementById('g-cat').value,proveedor:document.getElementById('g-prov').value,comprobante:document.getElementById('g-comp').value,taller_id:tid()};
  const{error}=id?await offlineUpdate('gastos_taller',d,'id',id):await offlineInsert('gastos_taller',d);
  if(error){toast('Error: '+error.message,'error');return;}
  clearCache('gastos');toast(id?'Gasto actualizado':'Gasto registrado','success');closeModal();gastos();
}
async function eliminarGasto(id){confirmar('¿Eliminar este gasto?',async()=>{await offlineDelete('gastos_taller','id',id);clearCache('gastos');toast('Eliminado');closeModal();gastos();});}

