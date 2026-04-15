// ─── MANTENIMIENTOS ─────────────────────────────────────────────────────────
async function mantenimientos() {
  const { data } = await cachedQuery('mantenimientos_list', () =>
    sb.from('mantenimientos').select('*, vehiculos(patente,marca,modelo), clientes(nombre,telefono)')
      .eq('taller_id', tid()).order('proximo_fecha', {ascending:true})
  );

  const hoy = new Date().toISOString().split('T')[0];
  const vencidos = (data||[]).filter(m => m.proximo_fecha && m.proximo_fecha <= hoy && m.estado === 'activo');
  const proximos = (data||[]).filter(m => m.proximo_fecha && m.proximo_fecha > hoy && m.estado === 'activo');
  const sinFecha = (data||[]).filter(m => !m.proximo_fecha && m.estado === 'activo');
  const completados = (data||[]).filter(m => m.estado === 'completado');

  function mantBadge(m) {
    if (m.estado === 'completado') return `<span class="card-badge badge-green">${t('mantAlDia')}</span>`;
    if (m.proximo_fecha && m.proximo_fecha <= hoy) return `<span class="card-badge badge-red">${t('mantVencido')}</span>`;
    if (m.proximo_fecha) return `<span class="card-badge badge-yellow">${t('mantProximo')}</span>`;
    return `<span class="card-badge badge-blue">ACTIVO</span>`;
  }

  function renderMant(list) {
    return list.map(m => `
      <div class="card" onclick="detalleMant('${m.id}')">
        <div class="card-header">
          <div class="card-avatar">🔔</div>
          <div class="card-info">
            <div class="card-name">${h(m.tipo)}</div>
            <div class="card-sub">${m.vehiculos?h(m.vehiculos.patente)+' · '+h(m.vehiculos.marca):''} ${m.clientes?'· '+h(m.clientes.nombre):''}</div>
            <div class="card-sub">${m.proximo_fecha?'Próximo: '+formatFecha(m.proximo_fecha):''} ${m.proximo_km?'· '+m.proximo_km+' km':''}</div>
          </div>
          ${mantBadge(m)}
        </div>
      </div>`).join('');
  }

  document.getElementById('main-content').innerHTML = `
    <div class="section-header">
      <div class="section-title">${t('mantTitulo')}</div>
      <button class="btn-add" onclick="modalNuevoMant()">${t('mantNuevo')}</button>
    </div>
    ${vencidos.length > 0 ? `
      <div style="font-size:.72rem;color:var(--danger);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.4rem">⚠ ${t('mantVencido')} (${vencidos.length})</div>
      ${renderMant(vencidos)}` : ''}
    ${proximos.length > 0 ? `
      <div style="font-size:.72rem;color:var(--warning);font-family:var(--font-head);letter-spacing:1px;margin:.75rem 0 .4rem">${t('mantProximo')} (${proximos.length})</div>
      ${renderMant(proximos)}` : ''}
    ${sinFecha.length > 0 ? `
      <div style="font-size:.72rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px;margin:.75rem 0 .4rem">ACTIVOS (${sinFecha.length})</div>
      ${renderMant(sinFecha)}` : ''}
    ${completados.length > 0 ? `
      <div style="font-size:.72rem;color:var(--success);font-family:var(--font-head);letter-spacing:1px;margin:.75rem 0 .4rem">${t('mantAlDia')} (${completados.length})</div>
      ${renderMant(completados)}` : ''}
    ${(data||[]).length===0 ? `<div class="empty"><p>${t('mantSinDatos')}</p></div>` : ''}`;
}

async function detalleMant(id) {
  const { data:m } = await sb.from('mantenimientos').select('*, vehiculos(patente,marca,modelo), clientes(nombre,telefono)').eq('id',id).single();
  if (!m) return;
  const hoy = new Date().toISOString().split('T')[0];
  const vencido = m.proximo_fecha && m.proximo_fecha <= hoy && m.estado === 'activo';
  const tel = m.clientes?.telefono?.replace(/\D/g,'');

  document.getElementById('main-content').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="navigate('mantenimientos')">${t('volver')}</button>
      <div class="detail-avatar">🔔</div>
      <div><div class="detail-name">${h(m.tipo)}</div><div class="detail-sub">${m.vehiculos?h(m.vehiculos.patente)+' · '+h(m.vehiculos.marca):''}</div></div>
    </div>
    <div class="info-grid">
      <div class="info-item"><div class="label">${t('mantVehiculo')}</div><div class="value">${m.vehiculos?h(m.vehiculos.patente):'-'}</div></div>
      <div class="info-item"><div class="label">${t('mantCliente')}</div><div class="value">${m.clientes?h(m.clientes.nombre):'-'}</div></div>
      <div class="info-item"><div class="label">${t('mantFrecKm')}</div><div class="value">${m.frecuencia_km||'-'}</div></div>
      <div class="info-item"><div class="label">${t('mantFrecMeses')}</div><div class="value">${m.frecuencia_meses||'-'}</div></div>
      <div class="info-item"><div class="label">${t('mantUltimoKm')}</div><div class="value">${m.ultimo_km||'-'}</div></div>
      <div class="info-item"><div class="label">${t('mantUltimaFecha')}</div><div class="value">${formatFecha(m.ultimo_fecha)||'-'}</div></div>
      <div class="info-item"><div class="label">${t('mantProximoKm')}</div><div class="value" style="color:${vencido?'var(--danger)':'var(--text)'}">${m.proximo_km||'-'}</div></div>
      <div class="info-item"><div class="label">${t('mantProximaFecha')}</div><div class="value" style="color:${vencido?'var(--danger)':'var(--text)'}">${formatFecha(m.proximo_fecha)||'-'}</div></div>
    </div>
    ${m.notas?`<div class="info-item" style="margin-bottom:1rem"><div class="label">${t('lblNotas')}</div><div class="value">${h(m.notas)}</div></div>`:''}
    <div style="display:flex;gap:.5rem;flex-wrap:wrap">
      ${m.estado==='activo'?`<button class="btn-primary" style="flex:1" onclick="completarMantConSafeCall('${id}')">${t('mantCompletar')}</button>`:''}
      ${tel?`<button onclick="window.open('https://wa.me/${tel}?text=${encodeURIComponent(t('mantMsgWsp')+' '+m.tipo+'. Vehículo: '+(m.vehiculos?h(m.vehiculos.patente):'')+'.')}')" style="flex:1;background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:10px;padding:.6rem;font-family:var(--font-head);font-size:.85rem;cursor:pointer">${t('mantRecordarWsp')}</button>`:''}
      <button class="btn-danger" style="margin:0" onclick="eliminarMantConSafeCall('${id}')">${t('eliminarBtn')}</button>
    </div>`;
}

async function completarMantConSafeCall(id) {
  await safeCall(async () => {
    const hoy = new Date().toISOString().split('T')[0];
    const { data:m } = await sb.from('mantenimientos').select('*').eq('id',id).single();
    if (!m) return;
    let proxFecha = null;
    if (m.frecuencia_meses) {
      const d = new Date();
      d.setMonth(d.getMonth() + m.frecuencia_meses);
      proxFecha = d.toISOString().split('T')[0];
    }
    let proxKm = null;
    if (m.frecuencia_km && m.proximo_km) proxKm = m.proximo_km + m.frecuencia_km;

    await offlineUpdate('mantenimientos', {
      ultimo_fecha: hoy,
      ultimo_km: m.proximo_km || m.ultimo_km,
      proximo_fecha: proxFecha,
      proximo_km: proxKm,
      estado: 'activo'
    }, 'id', id);
    toast(t('mantCompletar') + ' ✓', 'success');
    detalleMant(id);
  }, null, 'No se pudo completar el mantenimiento');
}

async function eliminarMantConSafeCall(id) {
  confirmar(t('confirmar'), async () => {
    await safeCall(async () => {
      await offlineDelete('mantenimientos', 'id', id);
      toast('Eliminado');
      navigate('mantenimientos');
    }, null, 'No se pudo eliminar');
  });
}

async function modalNuevoMant() {
  const [{ data:vehs }, { data:cls }] = await Promise.all([
    sb.from('vehiculos').select('id,patente,marca').eq('taller_id',tid()).order('patente'),
    sb.from('clientes').select('id,nombre').eq('taller_id',tid()).order('nombre')
  ]);
  const tipos = t('mantTipos').split(',');
  const clienteSelect = await renderClienteSelect('f-cliente', null, true);
  const vehiculoSelect = await renderVehiculoSelect('f-vehiculo', null, null, true);
  
  openModal(`
    <div class="modal-title">${t('mantNuevo')}</div>
    <div class="form-group"><label class="form-label">${t('mantTipo')}</label>
      <input class="form-input" id="f-tipo" list="tipos-sugeridos" placeholder="Escribí o elegí un tipo...">
      <datalist id="tipos-sugeridos">
        ${tipos.map(tp => `<option value="${h(tp)}">`).join('')}
      </datalist>
    </div>
    <div class="form-group"><label class="form-label">${t('mantVehiculo')}</label>${vehiculoSelect}</div>
    <div class="form-group"><label class="form-label">${t('mantCliente')}</label>${clienteSelect}</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t('mantFrecKm')}</label><input class="form-input" id="f-frec-km" type="number" placeholder="5000"></div>
      <div class="form-group"><label class="form-label">${t('mantFrecMeses')}</label><input class="form-input" id="f-frec-meses" type="number" placeholder="6"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t('mantUltimoKm')}</label><input class="form-input" id="f-ult-km" type="number"></div>
      <div class="form-group"><label class="form-label">${t('mantUltimaFecha')}</label>${renderFechaInput('f-ult-fecha', fechaHoy())}</div>
    </div>
    <div style="border-top:1px solid var(--border);margin:.5rem 0;padding-top:.5rem">
      <div style="font-size:.75rem;color:var(--accent);font-family:var(--font-head);letter-spacing:1px;margin-bottom:.5rem">${t('mantProximaFecha')} / ${t('mantProximoKm')}</div>
      <div style="font-size:.7rem;color:var(--text2);margin-bottom:.5rem">Podés poner la fecha exacta o dejar que se calcule por frecuencia</div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${t('mantProximaFecha')}</label>${renderFechaInput('f-prox-fecha', '')}</div>
      <div class="form-group"><label class="form-label">${t('mantProximoKm')}</label><input class="form-input" id="f-prox-km" type="number" placeholder=""></div>
    </div>
    <div class="form-group"><label class="form-label">${t('lblNotas')}</label><textarea class="form-input" id="f-notas" rows="2"></textarea></div>
    <button class="btn-primary" onclick="guardarMantConSafeCall()">${t('guardar')}</button>
    <button class="btn-secondary" onclick="closeModal()">${t('cancelar')}</button>`);
}

async function guardarMantConSafeCall() {
  await safeCall(async () => {
    await guardarMant();
  }, null, 'No se pudo guardar el mantenimiento');
}

async function guardarMant() {
  const tipo = document.getElementById('f-tipo').value.trim();
  if (!validateRequired(tipo, 'Tipo')) return;
  
  const vid = document.getElementById('f-vehiculo').value;
  const cid = document.getElementById('f-cliente').value;
  const frecKm = parseInt(document.getElementById('f-frec-km').value) || null;
  const frecMeses = parseInt(document.getElementById('f-frec-meses').value) || null;
  const ultKm = parseInt(document.getElementById('f-ult-km').value) || null;
  const ultFecha = document.getElementById('f-ult-fecha').value || null;

  const proxFechaManual = document.getElementById('f-prox-fecha').value || null;
  const proxKmManual = parseInt(document.getElementById('f-prox-km').value) || null;

  let proxFecha = proxFechaManual;
  if (!proxFecha && frecMeses && ultFecha) {
    const d = new Date(ultFecha);
    d.setMonth(d.getMonth() + frecMeses);
    proxFecha = d.toISOString().split('T')[0];
  }
  let proxKm = proxKmManual;
  if (!proxKm && frecKm && ultKm) proxKm = ultKm + frecKm;

  const data = {
    tipo,
    vehiculo_id: vid || null,
    cliente_id: cid || null,
    taller_id: tid(),
    frecuencia_km: frecKm,
    frecuencia_meses: frecMeses,
    ultimo_km: ultKm,
    ultimo_fecha: ultFecha,
    proximo_km: proxKm,
    proximo_fecha: proxFecha
  };
  
  const { error } = await offlineInsert('mantenimientos', data);
  if (error) { toast('Error: '+error.message,'error'); return; }
  
  toast('Mantenimiento programado','success');
  closeModal(); 
  mantenimientos();
}
