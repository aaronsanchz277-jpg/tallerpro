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
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede gestionar cuentas a pagar')) return;
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

async function marcarCuentaPagadaConSafeCall(id, onSuccess) {
  await safeCall(async () => {
    await marcarCuentaPagada(id, onSuccess);
  }, null, 'No se pudo marcar como pagada');
}

// Anti-doble-click global: dos clicks rápidos no deben disparar dos egresos.
let _cuentaPagandoLock = false;

// onSuccess es opcional. Si está, se llama al final en lugar de saltar al
// detalle de la cuenta — esto deja que vistas externas (Centro de cobros)
// se queden donde estaban y refresquen su lista.
async function marcarCuentaPagada(id, onSuccess) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede marcar una cuenta como pagada')) return;
  if (_cuentaPagandoLock) return;
  _cuentaPagandoLock = true;
  try {
    // Update condicional (.eq pagada=false): si dos pestañas chocan, solo
    // el primero entra; el resto recibe "ya estaba pagada". El INSERT del
    // egreso en movimientos_financieros lo dispara un TRIGGER en Supabase
    // (trg_cuenta_pagar_egreso), en la misma transacción que este UPDATE,
    // así que es atómico: si la app cae en el medio no queda caja descuadrada.
    const { data: actualizadas, error: updErr } = await sb.from('cuentas_pagar')
      .update({ pagada:true, fecha_pago:new Date().toISOString().split('T')[0] })
      .eq('id',id)
      .eq('pagada', false)
      .select('id');
    if (updErr) { toast('Error: ' + updErr.message, 'error'); return; }
    if (!actualizadas || actualizadas.length === 0) {
      // 0 filas afectadas puede ser por dos motivos: la cuenta ya estaba
      // pagada, o el id no existe. Distinguimos para no mentir en el toast.
      const { data: existe } = await sb.from('cuentas_pagar').select('id').eq('id', id).maybeSingle();
      if (!existe) {
        toast('No se encontró la cuenta', 'error');
      } else {
        toast('Esta cuenta ya estaba pagada', 'info');
        if (typeof onSuccess === 'function') onSuccess(id); else detalleCuenta(id);
      }
      return;
    }

    clearCache('cuentas');
    clearCache('finanzas');
    toast('Cuenta pagada — egreso registrado en Finanzas','success');
    if (typeof onSuccess === 'function') onSuccess(id); else detalleCuenta(id);
  } finally {
    _cuentaPagandoLock = false;
  }
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
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede eliminar cuentas')) return;
  confirmar('¿Eliminar esta cuenta?', async () => {
    await safeCall(async () => {
      await sb.from('cuentas_pagar').delete().eq('id',id);
      clearCache('cuentas');
      toast('Cuenta eliminada');
      cuentasPagar();
    }, null, 'No se pudo eliminar la cuenta');
  });
}

// ─── REPARACIÓN HISTÓRICA DE CUENTAS PAGADAS SIN EGRESO (Tarea #42) ─────────
// Desde la Tarea #35 hay un trigger en Supabase que crea el egreso en la
// misma transacción que el UPDATE pagada=true, así que casos nuevos no
// pueden quedar inconsistentes. Pero pagos viejos hechos antes del fix
// pudieron quedar con pagada=true sin movimiento_financiero asociado si
// la app se cortó entre los dos pasos. Estas funciones detectan esos casos
// históricos (sin filtro de fecha) y los compensan con el egreso faltante.
async function cuentas_detectarPagadasSinEgreso() {
  if (!tid()) return { ok: false, error: 'No hay taller activo', items: [] };

  const { data: cuentas, error: cErr } = await sb.from('cuentas_pagar')
    .select('id, proveedor, monto, fecha_pago, fecha_vencimiento, notas')
    .eq('taller_id', tid())
    .eq('pagada', true);
  if (cErr) return { ok: false, error: cErr.message, items: [] };
  if (!cuentas || cuentas.length === 0) return { ok: true, items: [] };

  // Buscamos en bloques de a 100 para no pasarnos del límite de IN().
  const conMov = new Set();
  for (let i = 0; i < cuentas.length; i += 100) {
    const ids = cuentas.slice(i, i + 100).map(c => c.id);
    const { data: movs, error: mErr } = await sb.from('movimientos_financieros')
      .select('referencia_id')
      .eq('taller_id', tid())
      .eq('referencia_tabla', 'cuentas_pagar')
      .in('referencia_id', ids);
    if (mErr) return { ok: false, error: mErr.message, items: [] };
    (movs || []).forEach(m => conMov.add(m.referencia_id));
  }

  const sinEgreso = cuentas.filter(c => !conMov.has(c.id));
  // Más vieja primero, así el admin ve la evolución histórica.
  sinEgreso.sort((a, b) => (a.fecha_pago || '').localeCompare(b.fecha_pago || ''));
  return { ok: true, items: sinEgreso };
}

async function cuentas_repararPagadasSinEgreso(items) {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede reparar inconsistencias de finanzas')) {
    return { reparados: 0, errores: ['Permiso denegado'] };
  }
  if (!items || items.length === 0) return { reparados: 0, errores: [] };

  const categoriaId = await obtenerCategoriaFinanciera('Repuestos', 'egreso');
  if (!categoriaId) {
    return { reparados: 0, errores: ['No se pudo obtener/crear la categoría "Repuestos"'] };
  }

  const hoy = new Date().toISOString().split('T')[0];
  let reparados = 0;
  const errores = [];

  for (const c of items) {
    try {
      // Re-chequeo defensivo: si el trigger ya creó el egreso (o un repair
      // paralelo lo hizo), no insertamos uno duplicado.
      const { data: existe } = await sb.from('movimientos_financieros')
        .select('id')
        .eq('taller_id', tid())
        .eq('referencia_tabla', 'cuentas_pagar')
        .eq('referencia_id', c.id)
        .maybeSingle();
      if (existe) continue;

      const { error: insErr } = await sb.from('movimientos_financieros').insert({
        taller_id: tid(),
        tipo: 'egreso',
        categoria_id: categoriaId,
        monto: c.monto,
        concepto: `Pago proveedor: ${c.proveedor || ''}`.trim(),
        fecha: c.fecha_pago || hoy,
        referencia_id: c.id,
        referencia_tabla: 'cuentas_pagar'
      });
      if (insErr) errores.push(`${c.proveedor || c.id}: ${insErr.message}`);
      else reparados++;
    } catch (e) {
      errores.push(`${c.proveedor || c.id}: ${e.message}`);
    }
  }

  clearCache('finanzas');
  clearCache('cuentas');
  return { reparados, errores };
}

async function cuentas_modalRevisarPagadasSinEgreso() {
  if (typeof requireAdmin === 'function' && !requireAdmin('Solo el administrador puede revisar inconsistencias de finanzas')) return;

  openModal(`
    <div class="modal-title">🔧 Cuentas pagadas sin egreso</div>
    <div id="cpse-resultado">
      <div style="text-align:center;padding:1rem;color:var(--text2)">Buscando inconsistencias históricas…</div>
    </div>
    <button class="btn-secondary" style="margin-top:1rem" onclick="closeModal()">Cerrar</button>
  `);

  await cuentas_renderRevisarPagadasSinEgreso();
}

async function cuentas_renderRevisarPagadasSinEgreso() {
  const cont = document.getElementById('cpse-resultado');
  if (!cont) return;
  cont.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--text2)">Analizando datos…</div>`;

  const res = await cuentas_detectarPagadasSinEgreso();
  if (!res.ok) {
    cont.innerHTML = `<div style="color:var(--danger);text-align:center;padding:1rem">Error: ${h(res.error || 'no se pudo verificar')}</div>`;
    return;
  }

  const items = res.items || [];
  if (items.length === 0) {
    cont.innerHTML = `<div style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:10px;padding:.85rem;text-align:center;color:var(--success)">✅ No hay cuentas pagadas sin egreso. La caja está consistente.</div>`;
    return;
  }

  const total = items.reduce((s, c) => s + parseFloat(c.monto || 0), 0);
  const filas = items.map(c => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.5rem .6rem;border-bottom:1px solid var(--border)">
      <div style="min-width:0;flex:1">
        <div style="font-size:.82rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(c.proveedor || 'Sin proveedor')}</div>
        <div style="font-size:.68rem;color:var(--text2)">Pago: ${c.fecha_pago ? formatFecha(c.fecha_pago) : '<span style="color:var(--warning)">sin fecha — se usará hoy</span>'}</div>
        ${c.notas ? `<div style="font-size:.65rem;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(c.notas)}</div>` : ''}
      </div>
      <div style="font-family:var(--font-head);font-size:.9rem;color:var(--danger);flex-shrink:0">-₲${gs(c.monto)}</div>
    </div>
  `).join('');

  cont.innerHTML = `
    <div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.25);border-radius:10px;padding:.75rem;margin-bottom:.75rem">
      <div style="color:var(--warning);font-family:var(--font-head);font-size:.85rem;letter-spacing:1px;margin-bottom:.25rem">⚠️ ${items.length} CUENTA(S) SIN EGRESO</div>
      <div style="font-size:.72rem;color:var(--text2)">Estas cuentas figuran como pagadas pero no tienen un egreso en Finanzas. Reparar inserta el egreso retroactivo (categoría <strong>Repuestos</strong>) usando la fecha de pago original.</div>
      <div style="margin-top:.4rem;font-size:.78rem;color:var(--text)">Total a regularizar: <strong style="color:var(--danger);font-family:var(--font-head)">₲${gs(total)}</strong></div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;max-height:260px;overflow-y:auto;margin-bottom:.75rem">
      ${filas}
    </div>
    <button class="btn-primary" id="cpse-btn-reparar" onclick="cuentas_repararPagadasSinEgresoConSafeCall()">🔧 Reparar las ${items.length} cuenta(s)</button>
  `;
}

async function cuentas_repararPagadasSinEgresoConSafeCall() {
  await safeCall(async () => {
    const btn = document.getElementById('cpse-btn-reparar');
    if (btn) { btn.disabled = true; btn.textContent = 'Reparando…'; }

    // Re-detectamos al momento del click para no compensar nada que ya
    // haya sido cubierto por otra pestaña o por el trigger en el medio.
    const res = await cuentas_detectarPagadasSinEgreso();
    if (!res.ok) { toast('No se pudo verificar: ' + (res.error || ''), 'error'); return; }

    const out = await cuentas_repararPagadasSinEgreso(res.items || []);
    if (out.reparados > 0) {
      toast(`✅ Se insertaron ${out.reparados} egreso(s) retroactivo(s)`, 'success');
    } else if (!out.errores.length) {
      toast('No quedaban inconsistencias para reparar', 'info');
    }
    if (out.errores.length) {
      console.warn('Errores reparando cuentas pagadas sin egreso:', out.errores);
      toast(`Quedaron ${out.errores.length} error(es). Revisá la consola.`, 'error');
    }

    await cuentas_renderRevisarPagadasSinEgreso();
    if (typeof finanzas_cargarDatos === 'function' && document.getElementById('finanzas-contenido-dinamico')) {
      finanzas_cargarDatos();
    }
  }, null, 'No se pudo completar la reparación');
}
