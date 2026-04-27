// ─── GASTOS (Registro de egresos del taller) ────────────────────────────────
// Integrado con Finanzas vía trigger en BD

const CATEGORIAS_GASTO = ['Alquiler','Servicios','Repuestos','Sueldos','Impuestos','Herramientas','Insumos','Limpieza','Otros'];

async function gastos({ filtro='todos', offset=0 }={}) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede ver gastos')) {
    if (typeof navigate === 'function') navigate('dashboard');
    return;
  }
  const cacheKey = `gastos_${filtro}_${offset}`;
  const { data, count } = await cachedQuery(cacheKey, () => {
    let q = sb.from('gastos_taller').select('*', {count:'exact'}).eq('taller_id',tid()).order('fecha',{ascending:false});
    if(filtro!=='todos') q = q.eq('categoria',filtro);
    return q.range(offset, offset+PAGE_SIZE-1);
  });
  
  // Tarea #75: KPIs ignoran los gastos marcados como "no afecta balance".
  const gastosParaKPIs = (data||[]).filter(g => g.afecta_balance !== false);
  const totalGastos = gastosParaKPIs.reduce((s,g)=>s+parseFloat(g.monto||0),0);
  const hoy = fechaHoy();
  const gastosHoy = gastosParaKPIs.filter(g => g.fecha === hoy).reduce((s,g)=>s+parseFloat(g.monto||0),0);
  
  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">Gastos ${count?`<span style="font-size:.75rem;color:var(--text2)">(${count})</span>`:''}</div>
      <button class="btn-add" onclick="modalNuevoGasto()">+ Gasto</button>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
      <div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:12px;padding:.75rem;text-align:center">
        <div style="font-size:.6rem;color:var(--danger);letter-spacing:1px;font-family:var(--font-head)">TOTAL GASTOS</div>
        <div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;color:var(--danger)">${fm(totalGastos)}</div>
      </div>
      <div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.3);border-radius:12px;padding:.75rem;text-align:center">
        <div style="font-size:.6rem;color:var(--warning);letter-spacing:1px;font-family:var(--font-head)">GASTOS HOY</div>
        <div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;color:var(--warning)">${fm(gastosHoy)}</div>
      </div>
    </div>
    
    <div class="tabs" style="flex-wrap:wrap">
      <button class="tab ${filtro==='todos'?'active':''}" onclick="gastos({filtro:'todos'})">Todos</button>
      ${CATEGORIAS_GASTO.map(c=>`<button class="tab ${filtro===c?'active':''}" onclick="gastos({filtro:'${c}'})">${c}</button>`).join('')}
    </div>
    
    ${(data||[]).length===0 ? '<div class="empty"><p>No hay gastos registrados</p></div>' :
      (data||[]).map(g=>{
        const afectaBal = g.afecta_balance !== false;
        const opacityStyle = afectaBal ? '' : 'opacity:.65;';
        const badge = (!afectaBal && typeof badgeNoAfectaBalance === 'function') ? ' ' + badgeNoAfectaBalance() : '';
        return `
      <div class="card" style="${opacityStyle}" onclick="modalEditarGasto('${g.id}')">
        <div class="card-header">
          <div class="card-avatar">📤</div>
          <div class="card-info">
            <div class="card-name">${h(g.descripcion||'Gasto')}${badge}</div>
            <div class="card-sub">${h(g.proveedor||'')}${g.categoria?' · '+h(g.categoria):''} · ${formatFecha(g.fecha)}</div>
          </div>
          <div style="font-family:var(--font-head);color:var(--danger);font-size:1rem">${fm(g.monto||0)}</div>
        </div>
      </div>`;
      }).join('')}
    ${renderPagination(count||0, offset, '_navGastos')}`;
}
function _navGastos(o) { gastos({offset:o}); }

function modalNuevoGasto(existing) {
  openModal(`
    <div class="modal-title">${existing?'EDITAR':'NUEVO'} GASTO</div>
    <div class="form-group"><label class="form-label">Descripción *</label><input class="form-input" id="g-desc" value="${h(existing?.descripcion||'')}" placeholder="Electricidad, alquiler, repuestos..."></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Monto (${monedaActual().simbolo}) *</label><input class="form-input" id="g-monto" type="number" value="${existing?.monto||''}"></div>
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
    <div class="form-group" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.6rem .75rem">
      <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.85rem">
        <input type="checkbox" id="g-afecta-balance" ${existing && existing.afecta_balance === false ? '' : 'checked'} style="accent-color:var(--accent);width:18px;height:18px">
        <span>Afecta al balance mensual</span>
      </label>
      <div style="font-size:.68rem;color:var(--text2);margin-top:.3rem;padding-left:1.7rem">Destildá si es un gasto con plata propia, un préstamo o un reembolso que no debe restar en los KPIs ni reportes del mes.</div>
    </div>
    <button class="btn-primary" onclick="guardarGasto(${existing?"'"+existing.id+"'":'null'})">${t('guardar')}</button>
    ${existing?`<button class="btn-danger" onclick="eliminarGasto('${existing.id}')">Eliminar</button>`:''}
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function modalEditarGasto(id) {
  const { data } = await sb.from('gastos_taller').select('*').eq('id',id).single();
  if (data) modalNuevoGasto(data);
}

async function guardarGasto(id) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede registrar gastos')) return;
  if (guardando()) return;
  const desc = document.getElementById('g-desc').value.trim();
  const monto = parseFloat(document.getElementById('g-monto').value);
  if (!desc || !monto) { toast('Descripción y monto son obligatorios','error'); return; }
  
  const fecha = document.getElementById('g-fecha').value;
  const categoria = document.getElementById('g-cat').value;
  const proveedor = document.getElementById('g-prov').value;
  const comprobante = document.getElementById('g-comp').value;
  
  const checkAfectaBal = document.getElementById('g-afecta-balance');
  const afectaBalUI = checkAfectaBal ? checkAfectaBal.checked : true;

  const data = {
    descripcion: desc,
    monto,
    fecha,
    categoria,
    proveedor,
    comprobante,
    taller_id: tid()
  };

  // Tarea #75: incluir afecta_balance solo si la migración SQL ya se corrió.
  const colExiste = typeof detectarAfectaBalance === 'function' ? await detectarAfectaBalance() : false;
  if (colExiste) {
    data.afecta_balance = afectaBalUI;
  } else if (!afectaBalUI && typeof avisarAfectaBalanceFaltante === 'function') {
    avisarAfectaBalanceFaltante();
  }

  if (id) {
    const { error } = await offlineUpdate('gastos_taller', data, 'id', id);
    if (error) { toast('Error: '+error.message,'error'); return; }
  } else {
    const { error } = await offlineInsert('gastos_taller', data);
    if (error) { toast('Error: '+error.message,'error'); return; }
  }

  // Tarea #81: la sincronización (afecta_balance + monto + fecha) hacia
  // movimientos_financieros la hace ahora un TRIGGER AFTER UPDATE en Supabase
  // (`trigger_gasto_movimiento_update`). Así queda consistente incluso si
  // el gasto se edita desde otra interfaz (editor de Supabase, futuros
  // endpoints, etc.). La INSERCIÓN inicial también la hace un trigger
  // (`trigger_gasto_movimiento`).
  
  clearCache('gastos');
  clearCache('finanzas');
  clearCache('dash_gastos_mes');
  toast(id ? 'Gasto actualizado' : 'Gasto registrado', 'success');
  closeModal();
  gastos();
}

async function eliminarGasto(id) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede eliminar gastos')) return;
  confirmar('¿Eliminar este gasto? También se eliminará el registro financiero asociado.', async () => {
    // El trigger de BD podría encargarse, pero por seguridad borramos manualmente
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
