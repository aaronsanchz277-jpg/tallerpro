// ─── CRÉDITOS ──────────────────────────────────────────────────────────────────
async function creditos({ filtro='pendiente' }={}) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede ver créditos')) {
    if (typeof navigate === 'function') navigate('dashboard');
    return;
  }
  const { data } = await cachedQuery(`creditos_${filtro}`, () => {
    let q = sb.from('fiados').select('*, clientes(nombre,telefono)').eq('taller_id',tid()).order('created_at',{ascending:false});
    if (filtro!=='todos') q = q.eq('pagado', filtro==='pagado');
    return q;
  });
  const total = (data||[]).filter(f=>!f.pagado).reduce((s,f)=>s+parseFloat(f.monto||0),0);

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('credTitulo')}</div>
      <button class="btn-add" onclick="modalNuevoCredito()">+ Nuevo</button>
    </div>
    ${filtro==='pendiente'?`<div style="background:rgba(255,68,68,.1);border:1px solid rgba(255,68,68,.3);border-radius:10px;padding:.75rem 1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center"><span style="color:var(--text2);font-size:.8rem">${t('credTotalPend')}</span><span style="font-family:var(--font-head);font-size:1.4rem;color:var(--danger)">₲${gs(total)}</span></div>`:''}
    <div class="tabs">
      <button class="tab ${filtro==='pendiente'?'active':''}" onclick="creditos({filtro:'pendiente'})">${t('credPendientes')}</button>
      <button class="tab ${filtro==='pagado'?'active':''}" onclick="creditos({filtro:'pagado'})">${t('credPagados')}</button>
      <button class="tab ${filtro==='todos'?'active':''}" onclick="creditos({filtro:'todos'})">${t('credTodos')}</button>
    </div>
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('credSinDatos')}</p></div>` :
      (data||[]).map(f => `
      <div class="card">
        <div class="card-header">
          <div class="card-avatar">${f.clientes?h(f.clientes.nombre).charAt(0).toUpperCase():'?'}</div>
          <div class="card-info">
            <div class="card-name">${f.clientes?h(f.clientes.nombre):t('sinCliente')}</div>
            <div class="card-sub">${h(f.descripcion||t('sinDescripcion'))} · ${formatFecha(f.fecha)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-family:var(--font-head);font-size:1.1rem;color:${f.pagado?'var(--success)':'var(--danger)'}">₲${gs(f.monto)}</div>
            ${!f.pagado?`<button onclick="marcarPagadoConSafeCall('${f.id}')" style="font-size:.7rem;background:rgba(0,255,136,.15);color:var(--success);border:1px solid rgba(0,255,136,.3);border-radius:6px;padding:2px 8px;cursor:pointer;margin-top:4px">${t('credPagar')}</button>`:`<span style="font-size:.7rem;color:var(--success)">${t('credPagadoLabel')}</span>`}
          </div>
        </div>
      </div>`).join('')}`;
}

async function marcarPagadoConSafeCall(id) {
  await safeCall(async () => {
    await marcarPagado(id);
  }, null, 'No se pudo marcar como pagado');
}

async function marcarPagado(id) {
  await offlineUpdate('fiados', { pagado: true }, 'id', id);
  
  // NOTA: La inserción en movimientos_financieros ahora la hace un TRIGGER en Supabase
  // (ver script SQL proporcionado)
  
  clearCache('creditos');
  clearCache('finanzas');
  toast('Marcado como pagado','success');
  creditos();
}

async function modalNuevoCredito() {
  const clienteSelect = await renderClienteSelect('f-cliente', null, false);
  openModal(`
    <div class="modal-title">${t("modNuevoCredito")}</div>
    <div class="form-group"><label class="form-label">${t("lblCliente")} *</label>${clienteSelect}</div>
    <div class="form-group"><label class="form-label">${t("lblMonto")}</label>${renderMontoInput('f-monto', '', '0')}</div>
    <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="f-desc" placeholder="Cambio de aceite pendiente"></div>
    <div class="form-group"><label class="form-label">${t("lblFecha")}</label>${renderFechaInput('f-fecha')}</div>
    <button class="btn-primary" onclick="guardarCreditoConSafeCall()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarCreditoConSafeCall() {
  await safeCall(async () => {
    await guardarCredito();
  }, null, 'No se pudo guardar el crédito');
}

async function guardarCredito() {
  const cid = document.getElementById('f-cliente').value;
  if (!cid) { toast('Seleccioná un cliente','error'); return; }
  
  const monto = parseFloat(document.getElementById('f-monto').value);
  if (!validatePositiveNumber(monto, 'Monto')) return;
  
  const { error } = await offlineInsert('fiados', {
    cliente_id: cid,
    monto,
    descripcion: document.getElementById('f-desc').value,
    fecha: document.getElementById('f-fecha').value,
    taller_id: tid()
  });
  if (error) { toast('Error','error'); return; }
  
  clearCache('creditos');
  toast('Crédito registrado','success');
  closeModal(); 
  creditos();
}
