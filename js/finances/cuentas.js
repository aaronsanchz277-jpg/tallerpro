// ─── CUENTAS A PAGAR (Proveedores) ──────────────────────────────────────────
async function cuentasPagar({ filtro='pendiente' }={}) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede ver cuentas a pagar')) {
    if (typeof navigate === 'function') navigate('dashboard');
    return;
  }
  const { data } = await sb.from('cuentas_pagar').select('*').eq('taller_id',tid()).order('fecha_vencimiento',{ascending:true});
  const hoy = new Date().toISOString().split('T')[0];
  const pendientes = (data||[]).filter(c => !c.pagada);
  const pagadas = (data||[]).filter(c => c.pagada);
  const vencidas = pendientes.filter(c => c.fecha_vencimiento && c.fecha_vencimiento < hoy);
  const porVencer = pendientes.filter(c => c.fecha_vencimiento && c.fecha_vencimiento >= hoy && c.fecha_vencimiento <= new Date(Date.now()+7*86400000).toISOString().split('T')[0]);
  const totalPendiente = pendientes.reduce((s,c) => s+parseFloat(c.monto||0), 0);
  const lista = filtro === 'pagada' ? pagadas : pendientes;

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">Cuentas a pagar</div>
      <button class="btn-add" onclick="modalNuevaCuenta()">+ Nueva</button>
    </div>

    <div style="background:var(--surface);border:1px solid ${vencidas.length?'var(--danger)':'var(--border)'};border-radius:12px;padding:1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:.7rem;color:${totalPendiente>0?'var(--danger)':'var(--success)'};letter-spacing:1px;font-family:var(--font-head)">TOTAL POR PAGAR</div>
        <div style="font-family:var(--font-head);font-size:1.8rem;color:${totalPendiente>0?'var(--danger)':'var(--success)'}">₲${gs(totalPendiente)}</div>
        <div style="font-size:.7rem;color:var(--text2)">${pendientes.length} pendiente(s)${vencidas.length?' · <span style="color:var(--danger)">'+vencidas.length+' vencida(s)</span>':''}</div>
      </div>
      <div style="font-size:2rem">${vencidas.length?'🚨':'📋'}</div>
    </div>

    ${porVencer.length > 0 ? `<div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.3);border-radius:10px;padding:.75rem;margin-bottom:1rem">
      <div style="font-size:.7rem;color:var(--warning);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.3rem">⏰ VENCEN ESTA SEMANA</div>
      ${porVencer.map(c => `<div style="font-size:.78rem;color:var(--text2);padding:.15rem 0">${h(c.proveedor)} — ₲${gs(c.monto)} · ${formatFecha(c.fecha_vencimiento)}</div>`).join('')}
    </div>` : ''}

    <div class="tabs">
      <button class="tab ${filtro==='pendiente'?'active':''}" onclick="cuentasPagar({filtro:'pendiente'})">Pendientes (${pendientes.length})</button>
      <button class="tab ${filtro==='pagada'?'active':''}" onclick="cuentasPagar({filtro:'pagada'})">Pagadas (${pagadas.length})</button>
    </div>

    ${lista.length === 0 ? '<div class="empty"><p>No hay cuentas</p></div>' :
      lista.map(c => {
        const vencida = !c.pagada && c.fecha_vencimiento && c.fecha_vencimiento < hoy;
        return `<div class="card" onclick="detalleCuenta('${c.id}')">
          <div class="card-header">
            <div class="card-avatar" style="font-size:1.2rem">${c.pagada?'✅':vencida?'🚨':'📄'}</div>
            <div class="card-info">
              <div class="card-name">${h(c.proveedor)}</div>
              <div class="card-sub">₲${gs(c.monto)} · Vence: ${c.fecha_vencimiento?formatFecha(c.fecha_vencimiento):'Sin fecha'}</div>
              ${c.notas?`<div class="card-sub">${h(c.notas)}</div>`:''}
            </div>
            <span class="card-badge ${c.pagada?'badge-green':vencida?'badge-red':'badge-yellow'}">${c.pagada?'Pagada':vencida?'Vencida':'Pendiente'}</span>
          </div>
        </div>`;
      }).join('')}`;
}

function modalNuevaCuenta() {
  openModal(`
    <div class="modal-title">Nueva cuenta a pagar</div>
    <div class="form-group"><label class="form-label">Proveedor *</label><input class="form-input" id="f-proveedor" placeholder="Distribuidora X, Repuestera Y..."></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Monto ₲ *</label>${renderMontoInput('f-monto', '', '500000')}</div>
      <div class="form-group"><label class="form-label">Fecha vencimiento</label>${renderFechaInput('f-vence')}</div>
    </div>
    <div class="form-group"><label class="form-label">Concepto / Notas</label><input class="form-input" id="f-notas" placeholder="Factura #123, repuestos..."></div>
    <button class="btn-primary" onclick="guardarCuentaConSafeCall()">Guardar</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function guardarCuentaConSafeCall() {
  await safeCall(async () => {
    await guardarCuenta();
  }, null, 'No se pudo guardar la cuenta');
}

async function guardarCuenta(id=null) {
  const proveedor = document.getElementById('f-proveedor').value.trim();
  if (!validateRequired(proveedor, 'Proveedor')) return;
  
  const monto = parseFloat(document.getElementById('f-monto').value);
  if (!validatePositiveNumber(monto, 'Monto')) return;
  
  const data = {
    proveedor,
    monto,
    fecha_vencimiento: document.getElementById('f-vence').value || null,
    notas: document.getElementById('f-notas').value || null,
    pagada: false,
    taller_id: tid()
  };
  
  const { error } = id ?
    await sb.from('cuentas_pagar').update(data).eq('id',id) :
    await sb.from('cuentas_pagar').insert(data);
    
  if (error) { toast('Error: '+error.message,'error'); return; }
  
  clearCache('cuentas');
  toast(id ? 'Cuenta actualizada' : 'Cuenta registrada','success');
  closeModal(); 
  cuentasPagar();
}

async function detalleCuenta(id) {
  const { data:c } = await sb.from('cuentas_pagar').select('*').eq('id',id).single();
  if (!c) return;
  const hoy = new Date().toISOString().split('T')[0];
  const vencida = !c.pagada && c.fecha_vencimiento && c.fecha_vencimiento < hoy;

  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="cuentasPagar()">${t('volver')}</button>
      <div class="detail-avatar" style="font-size:1.2rem">${c.pagada?'✅':vencida?'🚨':'📄'}</div>
      <div><div class="detail-name">${h(c.proveedor)}</div><div class="detail-sub">${c.pagada?'Pagada':vencida?'VENCIDA':'Pendiente'}</div></div>
    </div>
    <div class="info-grid">
      <div class="info-item"><div class="label">Monto</div><div class="value" style="color:var(--danger);font-family:var(--font-head);font-size:1.3rem">₲${gs(c.monto)}</div></div>
      <div class="info-item"><div class="label">Vencimiento</div><div class="value" style="color:${vencida?'var(--danger)':'var(--text)'}">${c.fecha_vencimiento?formatFecha(c.fecha_vencimiento):'Sin fecha'}</div></div>
      ${c.notas?`<div class="info-item" style="grid-column:1/-1"><div class="label">Notas</div><div class="value">${h(c.notas)}</div></div>`:''}
      <div class="info-item"><div class="label">Estado</div><div class="value"><span class="card-badge ${c.pagada?'badge-green':vencida?'badge-red':'badge-yellow'}">${c.pagada?'Pagada':vencida?'Vencida':'Pendiente'}</span></div></div>
    </div>
    <div style="display:flex;gap:.5rem;margin-top:1rem">
      ${!c.pagada?`<button onclick="marcarCuentaPagadaConSafeCall('${id}')" class="btn-primary" style="flex:1;margin:0">✓ Marcar como pagada</button>`:''}
      <button onclick="modalEditarCuenta('${id}')" class="btn-secondary" style="margin:0">Editar</button>
      <button onclick="eliminarCuentaConSafeCall('${id}')" class="btn-danger" style="margin:0">✕</button>
    </div>`;
}

async function marcarCuentaPagadaConSafeCall(id) {
  await safeCall(async () => {
    await marcarCuentaPagada(id);
  }, null, 'No se pudo marcar como pagada');
}

async function marcarCuentaPagada(id) {
  const { data:c } = await sb.from('cuentas_pagar').select('proveedor,monto').eq('id',id).single();
  await sb.from('cuentas_pagar').update({ pagada:true, fecha_pago:new Date().toISOString().split('T')[0] }).eq('id',id);
  
  // Integración con Finanzas (MODIFICADO)
  const categoriaId = await obtenerCategoriaFinanciera('Repuestos', 'egreso');
  if (categoriaId && c) {
    await sb.from('movimientos_financieros').insert({
      taller_id: tid(),
      tipo: 'egreso',
      categoria_id: categoriaId,
      monto: c.monto,
      descripcion: 'Pago proveedor: ' + c.proveedor,
      fecha: new Date().toISOString().split('T')[0],
      referencia_id: id,
      referencia_tabla: 'cuentas_pagar'
    });
  }
  
  clearCache('cuentas');
  clearCache('finanzas');
  toast('Cuenta pagada — egreso registrado en Finanzas','success');
  detalleCuenta(id);
}

async function modalEditarCuenta(id) {
  const { data:c } = await sb.from('cuentas_pagar').select('*').eq('id',id).single();
  openModal(`
    <div class="modal-title">Editar cuenta</div>
    <div class="form-group"><label class="form-label">Proveedor *</label><input class="form-input" id="f-proveedor" value="${h(c.proveedor||'')}"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Monto ₲</label>${renderMontoInput('f-monto', c.monto||0)}</div>
      <div class="form-group"><label class="form-label">Fecha vencimiento</label>${renderFechaInput('f-vence', c.fecha_vencimiento)}</div>
    </div>
    <div class="form-group"><label class="form-label">Notas</label><input class="form-input" id="f-notas" value="${h(c.notas||'')}"></div>
    <button class="btn-primary" onclick="guardarCuentaConSafeCall('${id}')">Actualizar</button>
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>`);
}

async function eliminarCuentaConSafeCall(id) {
  confirmar('¿Eliminar esta cuenta?', async () => {
    await safeCall(async () => {
      await sb.from('cuentas_pagar').delete().eq('id',id);
      clearCache('cuentas');
      toast('Cuenta eliminada');
      cuentasPagar();
    }, null, 'No se pudo eliminar la cuenta');
  });
}
