// ─── GASTOS (Registro de egresos del taller) ────────────────────────────────
// Integrado con Finanzas automáticamente

const CATEGORIAS_GASTO = ['Alquiler','Servicios','Repuestos','Sueldos','Impuestos','Herramientas','Insumos','Limpieza','Otros'];

async function gastos({ filtro='todos', offset=0 }={}) {
  const cacheKey = `gastos_${filtro}_${offset}`;
  const { data, count } = await cachedQuery(cacheKey, () => {
    let q = sb.from('gastos_taller').select('*', {count:'exact'}).eq('taller_id',tid()).order('fecha',{ascending:false});
    if(filtro!=='todos') q = q.eq('categoria',filtro);
    return q.range(offset, offset+PAGE_SIZE-1);
  });
  
  const totalGastos = (data||[]).reduce((s,g)=>s+parseFloat(g.monto||0),0);
  const hoy = fechaHoy();
  const gastosHoy = (data||[]).filter(g => g.fecha === hoy).reduce((s,g)=>s+parseFloat(g.monto||0),0);
  
  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">Gastos ${count?`<span style="font-size:.75rem;color:var(--text2)">(${count})</span>`:''}</div>
      <button class="btn-add" onclick="modalNuevoGasto()">+ Gasto</button>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
      <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:12px;padding:.75rem;text-align:center">
        <div style="font-size:.6rem;color:var(--danger);letter-spacing:1px;font-family:var(--font-head)">TOTAL GASTOS</div>
        <div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;color:var(--danger)">₲${gs(totalGastos)}</div>
      </div>
      <div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.3);border-radius:12px;padding:.75rem;text-align:center">
        <div style="font-size:.6rem;color:var(--warning);letter-spacing:1px;font-family:var(--font-head)">GASTOS HOY</div>
        <div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;color:var(--warning)">₲${gs(gastosHoy)}</div>
      </div>
    </div>
    
    <div class="tabs" style="flex-wrap:wrap">
      <button class="tab ${filtro==='todos'?'active':''}" onclick="gastos({filtro:'todos'})">Todos</button>
      ${CATEGORIAS_GASTO.map(c=>`<button class="tab ${filtro===c?'active':''}" onclick="gastos({filtro:'${c}'})">${c}</button>`).join('')}
    </div>
    
    ${(data||[]).length===0 ? '<div class="empty"><p>No hay gastos registrados</p></div>' :
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
      </div>`).join('')}
    ${renderPagination(count||0, offset, '_navGastos')}`;
}
function _navGastos(o) { gastos({offset:o}); }

function modalNuevoGasto(existing) {
  openModal(`
    <div class="modal-title">${existing?'EDITAR':'NUEVO'} GASTO</div>
    <div class="form-group"><label class="form-label">Descripción *</label><input class="form-input" id="g-desc" value="${h(existing?.descripcion||'')}" placeholder="Electricidad, alquiler, repuestos..."></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Monto (₲) *</label><input class="form-input" id="g-monto" type="number" value="${existing?.monto||''}"></div>
      <div class="form-group"><label class="form-label">Fecha</label><input class="form-input" id="g-fecha" type="date" value="${existing?.fecha||fechaHoy()}"></div>
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

async function modalEditarGasto(id) {
  const { data } = await sb.from('gastos_taller').select('*').eq('id',id).single();
  if (data) modalNuevoGasto(data);
}

async function guardarGasto(id) {
  if (guardando()) return;
  const desc = document.getElementById('g-desc').value.trim();
  const monto = parseFloat(document.getElementById('g-monto').value);
  if (!desc || !monto) { toast('Descripción y monto son obligatorios','error'); return; }
  
  const fecha = document.getElementById('g-fecha').value;
  const categoria = document.getElementById('g-cat').value;
  const proveedor = document.getElementById('g-prov').value;
  const comprobante = document.getElementById('g-comp').value;
  
  const data = {
    descripcion: desc,
    monto,
    fecha,
    categoria,
    proveedor,
    comprobante,
    taller_id: tid()
  };
  
  let gastoId = id;
  if (id) {
    const { error } = await offlineUpdate('gastos_taller', data, 'id', id);
    if (error) { toast('Error: '+error.message,'error'); return; }
  } else {
    const { data: saved, error } = await offlineInsert('gastos_taller', data);
    if (error) { toast('Error: '+error.message,'error'); return; }
    gastoId = saved?.[0]?.id;
  }
  
  // ─── INTEGRACIÓN CON FINANZAS ─────────────────────────────────────────────
  try {
    let catFinanciera = categoria || 'Gastos generales';
    const { data: cats } = await sb.from('categorias_financieras')
      .select('id')
      .eq('taller_id', tid())
      .eq('nombre', catFinanciera)
      .limit(1);
    
    let categoriaId;
    if (cats?.length) {
      categoriaId = cats[0].id;
    } else {
      const { data: nuevaCat } = await sb.from('categorias_financieras')
        .insert({ taller_id: tid(), nombre: catFinanciera, tipo: 'egreso', es_fija: false })
        .select('id')
        .single();
      categoriaId = nuevaCat?.id;
    }
    
    if (categoriaId) {
      const movimientoData = {
        taller_id: tid(),
        tipo: 'egreso',
        categoria_id: categoriaId,
        monto: monto,
        descripcion: `${desc}${proveedor?' — '+proveedor:''}${comprobante?' (Comp: '+comprobante+')':''}`,
        fecha: fecha,
        referencia_id: gastoId,
        referencia_tabla: 'gastos_taller'
      };
      
      if (id) {
        const { data: existente } = await sb.from('movimientos_financieros')
          .select('id')
          .eq('referencia_id', id)
          .eq('referencia_tabla', 'gastos_taller')
          .maybeSingle();
        
        if (existente) {
          await sb.from('movimientos_financieros').update(movimientoData).eq('id', existente.id);
        } else {
          await sb.from('movimientos_financieros').insert(movimientoData);
        }
      } else {
        await sb.from('movimientos_financieros').insert(movimientoData);
      }
    }
  } catch (e) {
    console.warn('Error al registrar en finanzas:', e);
  }
  
  clearCache('gastos');
  clearCache('finanzas');
  clearCache('dash_gastos_mes');
  toast(id ? 'Gasto actualizado' : 'Gasto registrado', 'success');
  closeModal();
  gastos();
}

async function eliminarGasto(id) {
  confirmar('¿Eliminar este gasto? También se eliminará el registro financiero asociado.', async () => {
    await sb.from('movimientos_financieros')
      .delete()
      .eq('referencia_id', id)
      .eq('referencia_tabla', 'gastos_taller');
    
    await offlineDelete('gastos_taller', 'id', id);
    clearCache('gastos');
    clearCache('finanzas');
    toast('Gasto eliminado');
    closeModal();
    gastos();
  });
}
